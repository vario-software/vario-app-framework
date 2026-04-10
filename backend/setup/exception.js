const { getResponse, getApp } = require('#backend/utils/context.js');
const HttpError = require('#backend/utils/httpError.js');

function setupException(app)
{
  async function errorHandling(error)
  {
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

  // eslint-disable-next-line no-unused-vars
  return (error, req, res, next) =>
  {
    errorHandling(error);
  };
}

module.exports = setupException;
