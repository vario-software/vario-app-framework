const { AsyncLocalStorage } = require('async_hooks');

const asyncLocalStorage = new AsyncLocalStorage();

function runInContext(context, callback)
{
  return asyncLocalStorage.run(context, callback);
}

function getContext()
{
  return asyncLocalStorage.getStore();
}

/**
 * Ties a callback to the context it was created in.
 *
 * For callbacks that are handed to something which runs them later on its own
 * terms — a queue handing out slots, a pool, a timer someone else owns. Those
 * run in whatever context happened to be active when the caller got to them,
 * which is not the one the callback belongs to.
 */
function bindContext(callback)
{
  const context = getContext();

  return (...args) => runInContext(context, () => callback(...args));
}

function getAccessToken()
{
  const accessToken = getContext()?.accessToken;

  return accessToken;
}

function getAppToken()
{
  const appToken = getContext()?.appToken;

  return appToken;
}

function getTenant()
{
  const tenant = getAccessToken()?.tenantSubdomain;

  return tenant;
}

function getAppDomain()
{
  const appDomain = getAccessToken()?.appDomain;

  return appDomain;
}

function getExternalUserId()
{
  const externalUserId = getAccessToken()?.sub;

  return externalUserId;
}

function getRequest()
{
  const request = getContext()?.req;

  return request;
}

function getResponse()
{
  const response = getContext()?.res;

  return response;
}

function getApp()
{
  const app = getContext()?.app;

  return app;
}

function getRequestId()
{
  const requestId = getContext()?.requestId;

  return requestId;
}

module.exports = {
  getContext,
  getAppToken,
  getAccessToken,
  getAppDomain,
  getTenant,
  getExternalUserId,
  getRequest,
  getResponse,
  getApp,
  getRequestId,
  runInContext,
  bindContext,
};
