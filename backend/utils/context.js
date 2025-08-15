const { AsyncLocalStorage } = require('async_hooks');

const asyncLocalStorage = new AsyncLocalStorage();

function runInContext(context, callback)
{
  asyncLocalStorage.run(context, callback);
}

function getContext()
{
  return asyncLocalStorage.getStore();
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
  getTenant,
  getExternalUserId,
  getRequest,
  getResponse,
  getApp,
  getRequestId,
  runInContext,
};
