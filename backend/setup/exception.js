const { getResponse, getApp } = require('#backend/utils/context.js');
const HttpError = require('#backend/utils/httpError.js');

function setupException(app)
{
  async function errorHandling(error)
  {
    // Work handed over from a queue or a timer can reject with anything, and a
    // bare `reject()` arrives as undefined. This is the last place that can
    // report it, so it must not be the place that trips over it.
    if (!error || typeof error !== 'object')
    {
      error = new Error(`rejected with a non-error value: ${String(error)}`);
    }

    if (error.handled)
    {
      return;
    }

    error.handled = true;

    const response = getResponse();
    const statusCode = error.statusCode ?? 500;
    const logLevel = error.logLevel ?? 'ERROR';
    const logService = error.logService ?? 'setup/exception';
    const stackTrace = error.stack?.split('\n').map(line => line.trim());
    const { logInfo, data } = error;

    const message = error instanceof HttpError && error.message ? error.message : 'UNKNOWN_ERROR';

    // Answered before reporting, so a report that takes long or never finishes
    // does not leave the client waiting.
    if (response && !response.headersSent)
    {
      try
      {
        response.status(statusCode).send({ error: message, data }).end();
      }
      catch (responseError)
      {
        // `data` that does not serialize (a TLS error carries its certificate
        // chain, which refers to itself) or a `statusCode` that is no HTTP status
        // must neither leave the client waiting nor stop the report below.
        console.error('Answering with the error failed', responseError);

        if (!response.headersSent)
        {
          response.status(500).send({ error: message }).end();
        }
      }
    }

    if (error instanceof HttpError)
    {
      await getApp()?.log(
        {
          statusCode,
          message,
          logInfo,
          stackTrace,
        },
        logService,
        logLevel,
      );
    }
    else
    {
      await app.onUnhandledError(error);
    }
  }

  // Must never reject: a listener's rejected promise raises the next
  // `unhandledRejection`, which lands right back here — endlessly, if the
  // reporting keeps failing.
  const reportError = error => errorHandling(error).catch(reportingError =>
  {
    console.error('Reporting an error failed', reportingError, 'while reporting', error);
  });

  process.on('unhandledRejection', reportError);
  process.on('uncaughtException', reportError);

  // Work that has outlived its express handler — a queued job, a timer — has
  // nowhere to reject into: the handler below is only reached through `next()`,
  // and the process-wide listeners can not be relied on to run in its context.
  // Such work hands its error over here instead, from inside its own context.
  app.handleError = reportError;

  // eslint-disable-next-line no-unused-vars
  return (error, req, res, next) =>
  {
    reportError(error);

    // A response that has already begun — a stream, say — can no longer become
    // an error response. Left open, the client waits for the rest until it
    // times out; closing the connection, as Express's own handler does, shows
    // it the response broke off. Only here, where the error is this request's
    // own: one from background work must not cut off a stream that is fine.
    if (res.headersSent && !res.writableEnded)
    {
      res.destroy();
    }
  };
}

module.exports = setupException;
