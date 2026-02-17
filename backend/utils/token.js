const { jwtVerify, decodeJwt, importJWK } = require('jose');
const { getApp } = require('#backend/utils/context.js');
const { getAppToken, getContext } = require('#backend/utils/context.js');

function validateOfflineToken(offlineToken)
{
  return new Promise((resolve, reject) =>
  {
    if (!offlineToken)
    {
      console.log('No token to read');
      reject();
      return;
    }

    const app = getApp();

    try
    {
      const payload = decodeJwt(offlineToken);

      const { azp } = payload;
      const { clientId } = app.client;

      if (!azp || azp !== clientId)
      {
        reject();
        return;
      }

      resolve(payload);
    }
    catch (error)
    {
      console.log('cannot decodeJwT');
    }
  });
}

function validateAppToken(appToken)
{
  return new Promise((resolve, reject) =>
  {
    if (!appToken)
    {
      reject();
      return;
    }

    const app = getApp();

    const { appIdentifier, appJWK } = app.client;

    const jwk = JSON.parse(appJWK).keys[0];

    importJWK(jwk, 'ES256')
      .then(key =>
      {
        jwtVerify(appToken, key)
          .then(({ payload }) =>
          {
            const { aud, exp } = payload;

            if (!aud || aud !== appIdentifier)
            {
              console.log('First cond', !aud, aud !== appIdentifier);
              reject();
              return;
            }

            if (!exp || exp < (Date.now() / 1000))
            {
              console.log('Second cond', !exp, exp < (Date.now() / 1000));
              reject();
              return;
            }

            resolve(payload);
          })
          .catch(reject);
      })
      .catch(reject);
  });
}

function isAppTokenExpired()
{
  const { accessToken } = getContext();

  const { exp } = accessToken;

  return ((exp - 2) < (Date.now() / 1000));
}

async function refreshAppToken()
{
  const appToken = getAppToken();
  const app = getApp();

  const { data } = await app.erp.fetch(`/cmn/apps/${app.client.appIdentifier}/refresh-token`, {
    method: 'POST',
    body: appToken,
    headers: {
      'Content-Type': 'text/plain',
    },
    secret: true,
    executeAsAppUser: true,
    secretsToMask: ['bearerToken'],
  });

  const newAppToken = data.bearerToken;

  const accessToken = await validateAppToken(newAppToken);

  const context = getContext();

  context.appToken = newAppToken;
  context.accessToken = accessToken;
}

module.exports = {
  validateOfflineToken,
  validateAppToken,
  isAppTokenExpired,
  refreshAppToken,
};
