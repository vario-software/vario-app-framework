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

    let message = 'UNKNOWN_ERROR';

    if (error instanceof HttpError)
    {
      if (error.message)
      {
        message = error.message;
      }

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

    if (response && !response.headersSent)
    {
      response.status(statusCode).send({ error: message, data }).end();
    }
  }

  process.on('unhandledRejection', reason => errorHandling(reason));
  process.on('uncaughtException', reason => errorHandling(reason));

  // Work that has outlived its express handler — a queued job, a timer — has
  // nowhere to reject into: the handler below is only reached through `next()`,
  // and the process-wide listeners run outside any context, where the app and
  // the tenant to log with are gone. Such work hands its error over here
  // instead, from inside the context it belongs to.
  app.handleError = errorHandling;

  // eslint-disable-next-line no-unused-vars
  return (error, req, res, next) =>
  {
    errorHandling(error);
  };
}

module.exports = setupException;
