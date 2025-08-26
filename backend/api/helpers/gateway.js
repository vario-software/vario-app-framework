const { getResponse } = require('#backend/utils/context.js');

async function gateway(path, options = {})
{
  const res = getResponse();

  options.outputStream = res;

  const apiRequest = new this(path, options);

  apiRequest.onResponse = () =>
  {
    res.set(apiRequest.getResponseHeaders());
  };

  await apiRequest.execute();
}

module.exports = gateway;
