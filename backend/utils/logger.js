const util = require('util');
const { getTenant, getRequestId, getRequest } = require('#backend/utils/context.js');

const formatLog = obj => util.inspect(obj, { depth: null, colors: true, maxArrayLength: null });

async function log(message, loggerName, level = 'DEBUG')
{
  const tenant = getTenant();
  const requestId = getRequestId();

  switch (level)
  {
    case 'WARNING':
      console.warn(formatLog({ tenant, message, requestId, loggerName }));
      break;
    case 'ERROR':
      console.error(formatLog({ tenant, message, requestId, loggerName }));
      break;
    case 'INFO':
      console.info(formatLog({ tenant, message, requestId, loggerName }));
      break;
    case 'DEBUG':
      console.debug(formatLog({ tenant, message, requestId, loggerName, requestPath: getRequest().path }));
      break;
    default:
      console.log(formatLog({ tenant, message, requestId, loggerName }));
  }
}

module.exports = {
  log,
};
