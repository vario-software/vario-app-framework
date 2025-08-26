async function fetch(path, options = {})
{
  const apiRequest = new this(path, options);

  await apiRequest.execute();

  return { data: apiRequest.getData(), response: apiRequest.response };
}

module.exports = fetch;
