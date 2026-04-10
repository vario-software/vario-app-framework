const { getRequest } = require('#backend/utils/context.js');

async function redirectRequest(path, options = {})
{
  const req = getRequest();

  options.headers = req.headers;
  options.inputStream = req;

  return this.getResponseStream(path, options);
}

module.exports = redirectRequest;
