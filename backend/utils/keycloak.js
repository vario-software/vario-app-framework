const VarioApi = require('#backend/api/Api.js');
const { getApp } = require('#backend/utils/context.js');

async function refreshAccessToken(offlineToken, refreshUrl)
{
  const app = getApp();

  const { clientId, clientSecret, appIdentifier } = app.client;

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: offlineToken,
    client_id: clientId,
    client_secret: clientSecret,
  }).toString();

  const refreshOptions = {
    method: 'POST',
    headers: {
      'user-agent': appIdentifier,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
    suppressLogs: true,
  };

  const timer = performance.now();

  const { data } = await VarioApi.fetch(refreshUrl, refreshOptions).catch(async error =>
  {
    await app.log(
      {
        request: { refreshUrl, refreshOptions, body },
        response: { ...error?.data },
        duration: `${(performance.now() - timer).toFixed(2)}ms`,
      },
      'utils/keycloak',
      'DEBUG',
    );

    throw error;
  });

  await app.log(
    {
      request: { url: refreshUrl, body: '[secret]' },
      response: `[secret(${Object.keys(typeof data === 'object' ? data : {})})]`,
      duration: `${(performance.now() - timer).toFixed(2)}ms`,
    },
    'utils/keycloak',
    'DEBUG',
  );

  return data;
}

module.exports = refreshAccessToken;
