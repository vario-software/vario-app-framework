const { jwtVerify, decodeJwt } = require('jose');
const { getApp } = require('#backend/utils/context.js');

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

    const { clientSecret, appIdentifier } = app.client;

    const key = new TextEncoder().encode(clientSecret);

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
  });
}

module.exports = {
  validateOfflineToken,
  validateAppToken,
};
