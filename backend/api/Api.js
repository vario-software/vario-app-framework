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

class Api
{
  baseUrl = '';

  constructor(path, {
    method = 'GET',
    saveResponse = true,
    resolveOn = 'end',
    timeout = 15 * 60 * 1000,
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
    if (this.saveResponse)
    {
      this.data.push(chunk);
    }

    this.onData(chunk);
  }

  async finishRequest()
  {
    if (this.checkIfSuccessful())
    {
      const response = this.getData();

      const message = {
        request: {
          requestUrl: this.fullPath,
          requestOptions: this.requestOptions,
          body: this.secret ? maskSpecificKey(this.body, this.secretsToMask) : this.body,
        },
        response: this.secret ? maskSpecificKey(response, this.secretsToMask) : response,
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
    const maskedBody = this.suppressLogs ? '[secret]' : (this.secret ? maskSpecificKey(this.body, this.secretsToMask) : this.body);

    const statusCode = this.getStatusCode();

    // `UNABLE_TO_SEND_REQUEST` is thrown for two very different situations that
    // are indistinguishable from the message alone: a genuine transport failure
    // (socket reset/close, DNS, timeout → no statusCode) and any non-2xx answer
    // the remote actually returned (statusCode set, body in `error`). Tag the
    // kind so logs and callers can tell them apart without changing the message.
    const kind = statusCode ? 'ERROR_RESPONSE' : 'TRANSPORT_ERROR';

    const message = {
      kind,
      request: {
        requestUrl: this.fullPath,
        requestOptions: this.requestOptions,
        body: maskedBody,
      },
      response: error,
      duration: `${(performance.now() - this.timer).toFixed(2)}ms`,
      retryCount: this.retryCount,
    };

    const logId = await this.log(message);

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

  async execute()
  {
    await this.onBeforeRequest();

    return new Promise((resolve, reject) =>
    {
      this.resolve = resolve;
      this.reject = reject;

      const protocol = this.fullPath.startsWith('https://') ? https : http;

      this.request = protocol.request(
        this.fullPath,
        this.requestOptions,
        async response =>
        {
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

      if (this.inputStream)
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
          this.inputStream = Readable.from(Buffer.concat(buffer));
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

    const statusCode = this.getStatusCode();
    const responseHeaders = this.getResponseHeaders();

    if (statusCode === 429)
    {
      const retryInSeconds = Number(responseHeaders['x-rate-limit-retry-after-seconds']);

      setTimeout(() =>
      {
        this.retryCount = (this.retryCount ?? 0) + 1;

        this.execute()
          .then(this.resolve)
          .catch(this.reject);
      }, Math.max(retryInSeconds * 1000, 6000));

      return;
    }

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

function maskSpecificKey(response, secretsToMask = ['value'], mask = '[secret]')
{
  if (!response || typeof response !== 'object')
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