const { getTenant, getRequestId, getRequest } = require('#backend/utils/context.js');

async function log(message, loggerName, level = 'DEBUG')
{
  const tenant = getTenant();
  const requestId = getRequestId();

  switch (level)
  {
    case 'WARNING':
      console.warn({ tenant, message, requestId, loggerName });
      break;
    case 'ERROR':
      console.error({ tenant, message, requestId, loggerName });
      break;
    case 'INFO':
      console.info({ tenant, message, requestId, loggerName });
      break;
    case 'DEBUG':
      console.debug({ tenant, message, requestId, loggerName, requestPath: getRequest().path });
      break;
    default:
      console.log({ tenant, message, requestId, loggerName });
  }
}

module.exports = {
  log,
};
