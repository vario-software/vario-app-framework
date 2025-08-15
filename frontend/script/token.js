let appToken;

const initAppTokenHandling = () =>
{
  const url = new URL(window.location.href);

  appToken = url.searchParams.get('appToken');

  window.addEventListener('message', ({ data }) =>
  {
    if (data.appToken)
    {
      appToken = data.appToken;
    }
  });
};

const getAppToken = () => appToken;

export { initAppTokenHandling, getAppToken };
