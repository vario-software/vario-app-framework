const { getApp } = require('#backend/utils/context.js');

const PermittedToken = class
{
  constructor(ApiAdapter)
  {
    this.ApiAdapter = ApiAdapter;
  }

  create = async function(expiresAt, permissions)
  {
    const app = getApp();

    const { data } = await this.ApiAdapter.fetch(`/cmn/apps/${app.client.appIdentifier}/permitted-token`, {
      method: 'POST',
      body: JSON.stringify({
        expiresAt,
        permissions,
      }),
      secret: true,
      secretsToMask: ['bearerToken'],
      useInternalApi: true,
    });

    return data;
  };
};

module.exports = PermittedToken;
