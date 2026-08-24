const { http, https } = require('follow-redirects');
const { Readable } = require('stream');
const { omitBy, isNil } = require('lodash');
const fetchFn = require('#backend/api/helpers/fetch.js');
const getResponseStreamFn = require('#backend/api/helpers/getResponseStream.js');
const gatewayFn = require('#backend/api/helpers/gateway.js');
const redirectRequestFn = require('#backend/api/helpers/redirectRequest.js');
const vqlFn = require('#backend/api/helpers/vql.js');
const { getApp } = require('#backend/utils/context.js');
const HttpError = require('#backend/utils/httpError.js');
const { URLSearchParams } = require('url');

const RETRY_MIN_DELAY = 6 * 1000;
const RETRY_MAX_DELAY = 60 * 1000;
const LOG_MAX_SIZE = 512 * 1024;

class Api
{
  baseUrl = '';

  constructor(path, {
    method = 'GET',
    saveResponse = true,
    resolveOn = 'end',
    timeout = 15 * 60 * 1000,
    maxRetries = 5,
    suppressLogs = false,
    secretsToMask = ['value'],
    pathParams = {},
    followRedirects,
    body,
    inputStream,
    formData,
    outputStream,
    headers,
    secret,
    query,
    ...restOptions
  } = {})
  {
    this.method = method;
    this.saveResponse = saveResponse;
    this.resolveOn = resolveOn;
    this.timeout = timeout;
    this.maxRetries = maxRetries;
    this.timer = performance.now();
    this.outputStream = outputStream;
    this.secret = secret;
    this.restOptions = restOptions;
    this.suppressLogs = suppressLogs;
    this.followRedirects = followRedirects;
    this.secretsToMask = secretsToMask;
    this.pathParams = pathParams;
    this.query = query;

    this.app = getApp();

    this.setPath(path);

    this.setHeaders({
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'user-agent': this.app.client.appIdentifier,
      ...headers,
    });

    if (formData ?? inputStream)
    {
      this.inputStream = formData ?? inputStream;
    }
    else if (body)
    {
      this.body = body;
    }
  }

  get fullPath()
  {
    return this.baseUrl + expandUrl(this.path, this.pathParams) + this.queryString;
  }

  get queryString()
  {
    const parsedQuery = new URLSearchParams(this.query);

    if(parsedQuery.size > 0)
    {
      return '?' + parsedQuery.toString();
    }

    return '';
  }

  get serviceName()
  {
    return `backend/api/${this.constructor.name}`;
  }

  get requestOptions()
  {
    return {
      method: this.method,
      headers: omitBy(this.requestHeaders, isNil),
      followRedirects: this.followRedirects,
      ...this.restOptions,
    };
  }

  /**
   * Whether the response is handed to the caller as a stream and therefore does
   * not have to be collected in memory a second time. A file proxied through
   * `gateway()` or `getResponseStream()` would otherwise be held completely,
   * once per concurrent request, for nobody to read.
   *
   * An unsuccessful response is always collected: its body is the detail
   * callers read from the `HttpError`, and an error body is small.
   */
  get streamsResponseOut()
  {
    return Boolean(this.outputStream) && this.checkIfSuccessful();
  }

  setPath(path)
  {
    const splitPath = path?.split('?')

    if(splitPath[0])
    {
      this.path = splitPath[0];
    }

    if(splitPath[1])
    {
      this.setQuery(Object.fromEntries(new URLSearchParams(splitPath[1]).entries()));
    }

    return this;
  }

  setBaseUrl(baseUrl)
  {
    this.baseUrl = baseUrl;

    return this;
  }

  setQuery(query)
  {
    this.query = {
      ...this.query,
      ...query,
    };

    return this;
  }

  setHeaders(headers)
  {
    const headerBlacklist = [
      'host',
      'x-forwarded-for',
      'x-forwarded-proto',
      'x-forwarded-port',
      'x-amzn-trace-id',
      'x-envoy-external-address',
      'x-request-id',
      'x-envoy-attempt-count',
      'x-tenant-id',
      'x-forwarded-client-cert',
      'x-b3-traceid',
      'x-b3-spanid',
      'x-b3-parentspanid',
      'x-b3-sampled',
    ];

    Object.keys(headers).forEach(key =>
    {
      if (headerBlacklist.includes(key.toLowerCase()))
      {
        delete headers[key];
      }
    });

    this.requestHeaders = {
      ...this.requestHeaders,
      ...headers,
    };

    return this;
  }

  setAuthorization(Authorization)
  {
    this.requestHeaders.Authorization = Authorization;

    return this;
  }

  /**
   * A request header by name, regardless of the case the caller wrote it in.
   *
   * `setHeaders` merges what it is given verbatim, so forwarded headers — as
   * `redirectRequest()` passes them on — can leave a lowercase `content-type`
   * next to the `Content-Type` default. Node lowercases both before sending,
   * which makes the one written last the one that goes out, so that is the one
   * to read here as well.
   */
  getRequestHeader(name)
  {
    const lowerName = name.toLowerCase();

    const key = Object.keys(this.requestHeaders ?? {})
      .reverse()
      .find(header => header.toLowerCase() === lowerName);

    return key === undefined ? undefined : this.requestHeaders[key];
  }

  getResponseHeaders()
  {
    return this.response?.headers;
  }

  getStatusCode()
  {
    return this.response?.statusCode;
  }

  handleData(chunk)
  {
    this.responseSize += chunk.length;

    if (this.saveResponse && !this.streamsResponseOut)
    {
      this.data.push(chunk);
    }

    this.onData(chunk);
  }

  /**
   * Turns a request or response payload into something that can be logged.
   *
   * Readable payloads (text, xml, json) are logged as they are, objects are
   * additionally formatted via `JSON.stringify`. Everything else (images,
   * pdfs, ...) is reduced to its mime type and byte size, so binary data never
   * has to be turned into a string just to be logged. The same summary is used
   * once a readable payload grows past `LOG_MAX_SIZE` — a csv export or an
   * html error page is readable, but of no use in a log entry at that size.
   *
   * `data` may be a function to defer building the payload until it is known
   * to be loggable at all.
   */
  getLoggableData(data, contentType, size)
  {
    const mimeType = contentType?.split(';')[0].trim().toLowerCase();

    const resolve = () => (typeof data === 'function' ? data() : data);

    const describe = byteLength => (byteLength ? `[${mimeType ?? 'unknown'}, ${byteLength} bytes]` : null);

    // Binary data is not worth logging at any size, and a response whose size is
    // known up front never has its payload built just to be thrown away again.
    if ((mimeType && !isReadableMimeType(mimeType)) || size > LOG_MAX_SIZE)
    {
      return describe(size ?? getByteLength(resolve()));
    }

    const payload = resolve();

    if (payload === null || payload === undefined)
    {
      // A response that was streamed out instead of collected leaves nothing to
      // log but its size — reporting `null` would read as an empty body.
      return size ? describe(size) : payload;
    }

    // Only an object has to be serialized to know its size — a buffer or string
    // reports it without a copy, so an oversized one never reaches `toString()`.
    // Request bodies arrive without a known size, which makes this the only
    // guard that fires for them.
    const text = typeof payload === 'string' || Buffer.isBuffer(payload)
      ? payload
      : JSON.stringify(payload, null, 2);

    const byteLength = getByteLength(text);

    return byteLength > LOG_MAX_SIZE ? describe(byteLength) : text.toString();
  }

  async finishRequest()
  {
    if (this.checkIfSuccessful())
    {
      const message = {
        request: {
          requestUrl: this.fullPath,
          requestOptions: this.requestOptions,
          body: this.getLoggableData(
            this.secret ? maskSpecificKey(this.body, this.secretsToMask) : this.body,
            this.getRequestHeader('Content-Type'),
          ),
        },
        response: this.getLoggableData(
          () => this.secret ? maskSpecificKey(this.getData(), this.secretsToMask) : this.getData(),
          this.getResponseHeaders()?.['content-type'],
          this.responseSize,
        ),
        duration: `${(performance.now() - this.timer).toFixed(2)}ms`,
        retryCount: this.retryCount,
      };

      await this.log(message);
    }

    await this.finish('end');

    this.onEnd();
  }

  async log(message, level = 'DEBUG')
  {
    if (this.suppressLogs)
    {
      return null;
    }

    return this.app.log(message, this.serviceName, level);
  }

  async responseHandler()
  {
    this.data = [];
    this.responseSize = 0;

    await this.onResponse();

    await this.finish('response');
  }

  onBeforeRequest()
  {
  }

  onData()
  {
  }

  onEnd()
  {
  }

  onResponse()
  {
  }

  onClose()
  {
  }

  async onError(error)
  {
    const maskedBody = this.suppressLogs ? '[secret]' : this.getLoggableData(
      this.secret ? maskSpecificKey(this.body, this.secretsToMask) : this.body,
      this.getRequestHeader('Content-Type'),
    );

    const statusCode = this.getStatusCode();

    // `UNABLE_TO_SEND_REQUEST` is thrown for two very different situations that
    // are indistinguishable from the message alone: a genuine transport failure
    // (socket reset/close, DNS, timeout → no statusCode) and any non-2xx answer
    // the remote actually returned (statusCode set, body in `error`). Tag the
    // kind so logs and callers can tell them apart without changing the message.
    const kind = statusCode ? 'ERROR_RESPONSE' : 'TRANSPORT_ERROR';

    // An unsuccessful response arrives here as its payload, which may be a
    // binary buffer the logger would otherwise expand byte by byte. A transport
    // error carries no payload to reduce. Only the log entry is shortened — the
    // `HttpError` keeps the payload as it is, callers read details from it.
    const loggableResponse = error instanceof Error ? error : this.getLoggableData(
      error,
      this.getResponseHeaders()?.['content-type'],
      this.responseSize,
    );

    const message = {
      kind,
      request: {
        requestUrl: this.fullPath,
        requestOptions: this.requestOptions,
        body: maskedBody,
      },
      response: loggableResponse,
      duration: `${(performance.now() - this.timer).toFixed(2)}ms`,
      retryCount: this.retryCount,
    };

    const logId = await this.log(message);

    // A timeout destroys the request the same way a retry does, so the upload
    // would be left behind here as well.
    this.releaseAttemptStream();

    this.inputBuffer = null;

    this.reject(new HttpError(
      'UNABLE_TO_SEND_REQUEST',
      statusCode,
      this.serviceName,
      {
        request: {
          requestUrl: this.fullPath,
          requestOptions: this.requestOptions,
          body: maskedBody,
        },
        response: {
          data: error,
        },
      },
      logId,
      undefined,
      {
        kind,
        statusCode,
        requestUrl: this.fullPath,
        responseData: error,
      },
    ));
  }

  /**
   * Swallows a rate limited response so the request is sent again.
   *
   * This has to happen before the response is handed anywhere: with an
   * `outputStream` — `getResponseStream()`, `gateway()` — the 429 body would
   * already be delivered to the caller and the stream ended, and the retry
   * would then write to a stream that is closed.
   *
   * Returns true when the response was swallowed.
   */
  handleRetry(response)
  {
    // A stream can only be read once, so a body that is still on its way can
    // not be sent a second time: `inputBuffer` is only filled on the source
    // stream's `end`, and a rate limit usually arrives long before a large
    // upload is through. Repeating it anyway would send the remaining chunks
    // under the original `Content-Length` and hang until `timeout`.
    const canRepeatBody = !this.inputStream
      || typeof this.inputStream === 'function'
      || Boolean(this.inputBuffer);

    // Not repeating is enough: the 429 falls through to the ordinary error
    // path and keeps the status and body the remote sent.
    if (response.statusCode !== 429 || (this.retryCount ?? 0) >= this.maxRetries || !canRepeatBody)
    {
      return false;
    }

    const retryDelay = Math.min(
      Math.max(getRetryDelay(response.headers), RETRY_MIN_DELAY),
      RETRY_MAX_DELAY,
    );

    // The upload has to be let go before those listeners disappear, see
    // `releaseAttemptStream`.
    this.releaseAttemptStream();

    // The request may still be uploading. Its listeners have to go first,
    // otherwise tearing it down surfaces as a transport error.
    this.request.removeAllListeners('error');
    this.request.removeAllListeners('close');
    this.request.on('error', () => {});
    this.request.destroy();
    response.destroy();

    this.response = response;

    const { resolve, reject } = this;

    setTimeout(() =>
    {
      this.retryCount = (this.retryCount ?? 0) + 1;

      this.execute().then(resolve).catch(reject);
    }, retryDelay);

    return true;
  }

  /**
   * Lets go of the payload stream the current attempt is piping.
   *
   * `pipe` cleans up through listeners it installs on the destination (`error`,
   * `close`), which `handleRetry` has to remove to tear the request down
   * quietly. Without them the source stays attached to the destroyed request,
   * which keeps accepting writes and throws them away: the whole payload is
   * read for nothing, and a source that never ends is read forever.
   *
   * Unpiping alone would not be enough — that stops the flow but leaves the
   * source open, one leaked handle per attempt.
   *
   * Only a stream this attempt created itself is released — one a factory built,
   * or the replay of `inputBuffer`. An `inputStream` the caller handed over is
   * never destroyed here; it is only ever repeated once it has ended anyway.
   */
  releaseAttemptStream()
  {
    if (!this.attemptStream)
    {
      return;
    }

    this.attemptStream.unpipe(this.request);

    // The stream is on its way out, an error from closing it has nowhere to go.
    this.attemptStream.on('error', () => {});
    this.attemptStream.destroy();

    this.attemptStream = null;
  }

  async execute()
  {
    await this.onBeforeRequest();

    return new Promise((resolve, reject) =>
    {
      this.resolve = resolve;
      this.reject = reject;

      // Every attempt starts without a response: the 429 `handleRetry` left
      // behind would otherwise be reported as the status of a retry that never
      // got an answer, and a transport error would look like an error response.
      this.response = undefined;

      const protocol = this.fullPath.startsWith('https://') ? https : http;

      this.request = protocol.request(
        this.fullPath,
        this.requestOptions,
        async response =>
        {
          if (this.handleRetry(response))
          {
            return;
          }

          this.response = response;

          if (this.outputStream)
          {
            response.pipe(this.outputStream);
          }

          response.on('data', (...args) => this.handleData(...args));
          response.on('end', (...args) => this.finishRequest(...args));
          response.on('error', (...args) => this.onError(...args));

          this.responseHandler(response);
        });

      this.request.on('error', (...args) => this.onError(...args));
      this.request.on('close', (...args) => this.onClose(...args));

      if (this.timeout)
      {
        this.request.setTimeout(this.timeout, () =>
        {
          this.request.destroy(new HttpError(
            'REQUEST_TIMEOUT',
            408,
            this.serviceName,
            {
              requestUrl: this.fullPath,
            },
            undefined,
            undefined,
          ));
        });
      }

      // A factory is called once per attempt, so a retry can build a fresh
      // stream instead of keeping the whole payload buffered in memory.
      if (typeof this.inputStream === 'function')
      {
        this.attemptStream = this.inputStream();

        this.attemptStream.pipe(this.request);
      }
      else if (this.inputBuffer)
      {
        this.attemptStream = Readable.from(this.inputBuffer);

        this.attemptStream.pipe(this.request);
      }
      else if (this.inputStream)
      {
        const buffer = [];

        this.inputStream.on('data', chunk =>
        {
          if (!Buffer.isBuffer(chunk))
          {
            chunk = Buffer.from(chunk);
          }

          buffer.push(chunk);
        });

        this.inputStream.on('end', () =>
        {
          // The payload is kept as single chunks so a retry can replay them
          // via `Readable.from` without ever building a second full copy.
          this.inputBuffer = buffer;
        });

        this.inputStream.pipe(this.request);
      }
      else
      {
        if (this.body)
        {
          if (typeof this.body !== 'string')
          {
            this.request.write(JSON.stringify(this.body));
          }
          else
          {
            this.request.write(this.body);
          }
        }

        this.request.end();
      }
    });
  }

  getData()
  {
    const data = Buffer.concat(this.data);

    if (!data.length)
    {
      return null;
    }

    const responseHeaders = this.getResponseHeaders();

    if (!responseHeaders['content-type']?.startsWith('application/'))
    {
      return data.toString();
    }

    if (responseHeaders['content-type']?.startsWith('application/json'))
    {
      return JSON.parse(data);
    }

    return data;
  }

  async finish(type)
  {
    if (this.resolveOn !== type)
    {
      return;
    }

    // A retryable 429 never gets here — `handleRetry` swallows it before the
    // response is handed anywhere. Once the retries are used up it arrives as
    // an ordinary unsuccessful response.
    this.inputBuffer = null;

    // Dropped rather than destroyed: with `resolveOn: 'response'` the body may
    // still be uploading. A replay stream keeps the chunks of `inputBuffer`
    // alive, so the line above only releases them together with this one.
    this.attemptStream = null;

    if (this.checkIfSuccessful())
    {
      this.resolve();
    }
    else
    {
      await this.onError(this.getData());
    }
  }

  checkIfSuccessful()
  {
    const statusCode = this.getStatusCode();

    return statusCode >= 200 && statusCode < 400;
  }
}

Api.fetch = fetchFn;
Api.getResponseStream = getResponseStreamFn;
Api.gateway = gatewayFn;
Api.vql = vqlFn;
Api.redirectRequest = redirectRequestFn;

module.exports = Api;

/**
 * How long the remote asked us to wait before retrying, in milliseconds.
 *
 * Reads the bucket4j header our own services send, and the standard
 * `Retry-After`, which may carry either seconds or an http date. Anything
 * missing or unparsable has to yield a number: `Math.max(NaN, …)` is NaN, and
 * `setTimeout` turns that into 1ms — the retries would then fire back to back
 * and burn through before the rate limit ever recovers.
 */
function getRetryDelay(responseHeaders)
{
  const rateLimitSeconds = Number(responseHeaders['x-rate-limit-retry-after-seconds']);

  if (Number.isFinite(rateLimitSeconds))
  {
    return rateLimitSeconds * 1000;
  }

  const retryAfter = responseHeaders['retry-after'];

  if (!retryAfter)
  {
    return 0;
  }

  if (Number.isFinite(Number(retryAfter)))
  {
    return Number(retryAfter) * 1000;
  }

  const retryAt = Date.parse(retryAfter);

  return Number.isFinite(retryAt) ? retryAt - Date.now() : 0;
}

function isReadableMimeType(mimeType)
{
  const readableMimeTypes = [
    'application/json',
    'application/xml',
    'application/javascript',
    'application/graphql',
    'application/x-www-form-urlencoded',
  ];

  return mimeType.startsWith('text/')
    || mimeType.endsWith('+json')
    || mimeType.endsWith('+xml')
    || readableMimeTypes.includes(mimeType);
}

function getByteLength(data)
{
  if (data === null || data === undefined)
  {
    return 0;
  }

  if (Buffer.isBuffer(data))
  {
    return data.length;
  }

  return Buffer.byteLength(typeof data === 'string' ? data : JSON.stringify(data));
}

function maskSpecificKey(response, secretsToMask = ['value'], mask = '[secret]')
{
  if (!response || typeof response !== 'object' || Buffer.isBuffer(response))
  {
    return response;
  }

  return Object.keys(response).reduce((acc, key) =>
  {
    if (secretsToMask.includes(key))
    {
      acc[key] = mask;
    }
    else if (typeof response[key] === 'object' && response[key] !== null)
    {
      acc[key] = maskSpecificKey(response[key], secretsToMask, mask);
    }
    else
    {
      acc[key] = response[key];
    }

    return acc;
  }, {});
}

function expandUrl(template, params)
{
  return template.replace(/:([a-zA-Z_-]+)/g, (match, key) =>
  {
    if (!(key in params))
    {
      throw new Error(`Missing parameter "${key}" for template "${template}"`);
    }
    
    return encodeURIComponent(params[key]);
  });
}