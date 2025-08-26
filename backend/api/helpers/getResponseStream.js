const { PassThrough } = require('stream');

async function getResponseStream(path, options = {})
{
  const stream = new PassThrough();

  options.outputStream = stream;
  options.resolveOn = 'response';

  const apiRequest = new this(path, options);

  await apiRequest.execute();

  return stream;
}

module.exports = getResponseStream;
