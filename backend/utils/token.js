const { jwtVerify, decodeJwt, importJWK } = require('jose');
const { getApp } = require('#backend/utils/context.js');
const { getAppToken, getContext, bindContext } = require('#backend/utils/context.js');
const { getGroupKeyDefault } = require('#backend/setup/concurrency.js');

const KEEP_ALIVE_MARGIN = 2 * 60 * 1000;
const KEEP_ALIVE_MIN_DELAY = 60 * 1000;
const KEEP_ALIVE_MAX_DURATION = 60 * 60 * 1000;

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

    const jwk = appJWK.keys[0];

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

function refreshAppToken()
{
  const context = getContext();

  if (!context.appTokenRefresh)
  {
    context.appTokenRefresh = requestAppToken().finally(() =>
    {
      context.appTokenRefresh = null;
    });
  }

  return context.appTokenRefresh;
}

async function requestAppToken()
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
    getGroupKey: () => `refresh:${getGroupKeyDefault()}`,
  });

  const newAppToken = data.bearerToken;

  const accessToken = await validateAppToken(newAppToken);

  const context = getContext();

  context.appToken = newAppToken;
  context.accessToken = accessToken;
}

function keepAppTokenAlive()
{
  const context = getContext();

  context.appTokenKeepAliveUntil = Date.now() + KEEP_ALIVE_MAX_DURATION;

  context.appTokenWaiting = (context.appTokenWaiting ?? 0) + 1;

  scheduleAppTokenRefresh();

  let signedOff = false;

  return () =>
  {
    if (signedOff)
    {
      return;
    }

    signedOff = true;

    context.appTokenWaiting -= 1;

    if (context.appTokenWaiting > 0)
    {
      return;
    }

    clearTimeout(context.appTokenTimer);

    context.appTokenTimer = null;
  };
}

function scheduleAppTokenRefresh()
{
  const context = getContext();

  if (context.appTokenTimer)
  {
    return;
  }

  const remaining = context.appTokenKeepAliveUntil - Date.now();

  if (remaining <= 0)
  {
    return;
  }

  const delay = Math.min(
    Math.max((context.accessToken.exp * 1000) - KEEP_ALIVE_MARGIN - Date.now(), KEEP_ALIVE_MIN_DELAY),
    remaining,
  );

  const timer = setTimeout(bindContext(async () =>
  {
    try
    {
      await refreshAppToken();
    }
    catch (error)
    {
      await getApp().log(
        `app token was not renewed while waiting: ${error?.message ?? error}`,
        'utils/token',
        'WARNING',
      );
    }
    finally
    {
      if (context.appTokenTimer === timer)
      {
        context.appTokenTimer = null;
      }

      if (context.appTokenWaiting > 0)
      {
        scheduleAppTokenRefresh();
      }
    }
  }), delay);

  context.appTokenTimer = timer;

  timer.unref();
}

module.exports = {
  validateOfflineToken,
  validateAppToken,
  isAppTokenExpired,
  refreshAppToken,
  keepAppTokenAlive,
};
