const { getResponse, getApp } = require('#backend/utils/context.js');
const HttpError = require('#backend/utils/httpError.js');

function setupException()
{
  process.on('unhandledRejection', reason => errorHandling(reason));

  return (req, res, next) =>
  {
    try
    {
      next();
    }
    catch (error)
    {
      errorHandling(error);
    }
  };
}

async function errorHandling(error)
{
  const response = getResponse();
  const statusCode = error.statusCode ?? 500;
  const message = error.message ?? 'UNKNOWN_ERROR';
  const logLevel = error.logLevel ?? 'ERROR';
  const logService = error.logService ?? 'setup/exception';
  const stackTrace = error.stack?.split('\n').map(line => line.trim());
  const { logInfo, data } = error;

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
    console.warn(error);
  }

  if (response && !response.headersSent && error instanceof HttpError)
  {
    response.status(statusCode).send({ error: message, data }).end();
  }
}

module.exports = setupException;
