const VarioApi = require('#backend/api/Api.js');
const HttpError = require('#backend/utils/httpError.js');
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

  const { data } = await VarioApi.fetch(refreshUrl, refreshOptions)
    .catch(async error =>
    {
      await app.log(
        {
          request: { url: refreshUrl, body: '[secret]' },
          response: `[secret(${Object.keys(typeof error?.data === 'object' ? error.data : {})})]`,
          duration: `${(performance.now() - timer).toFixed(2)}ms`,
        },
        'utils/keycloak',
        'DEBUG',
      );

      if (app.onKeycloakError)
      {
        app.onKeycloakError(error);
      }

      // invalid_grant on the offline-token refresh means the offline token is no
      // longer usable (expired, revoked or "Offline user session not found").
      // Surface a dedicated, actionable code instead of the generic
      // UNABLE_TO_SEND_REQUEST so the UI and logs clearly point to "reconnect app".
      if (error?.logInfo?.response?.data?.error === 'invalid_grant')
      {
        throw new HttpError(
          'OFFLINE_TOKEN_INVALID',
          error.statusCode ?? 401,
          'utils/keycloak',
          error.logInfo,
          error.logId,
        );
      }

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
