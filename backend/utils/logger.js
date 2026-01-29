const util = require('util');
const { getTenant, getRequestId, getRequest } = require('#backend/utils/context.js');

const format = object => util.inspect(object, {
  depth: 7,
  colors: true,
  breakLength: 120,
  maxArrayLength: 20,
  maxStringLength: 5000,
  compact: 3,
});

async function log(message, loggerName, level = 'DEBUG')
{
  const tenant = getTenant();
  const requestId = getRequestId();

  switch (level)
  {
    case 'WARNING':
      console.warn(format({ tenant, message, requestId, loggerName }));
      break;
    case 'ERROR':
      console.error(format({ tenant, message, requestId, loggerName }));
      break;
    case 'INFO':
      console.info(format({ tenant, message, requestId, loggerName }));
      break;
    case 'DEBUG':
      console.debug(format({ tenant, message, requestId, loggerName, requestPath: getRequest().path }));
      break;
    default:
      console.log(format({ tenant, message, requestId, loggerName }));
  }
}

module.exports = {
  log,
};
