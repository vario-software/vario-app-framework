class OfflineToken
{
  constructor(app, filename = 'offlineToken.db')
  {
    this.app = app;
    this.filename = filename;
    this.database = {};
  }

  async init()
  {
  // eslint-disable-next-line v-custom-rules/no-await-on-import
    const { JSONFilePreset } = await import('lowdb/node');

    this.database = await JSONFilePreset(this.filename, {});
  }

  async get(tenant)
  {
    return this.database.data[tenant];
  }

  async set(tenant, offlineToken)
  {
    this.app.accessToken.delete(tenant);

    return this.database.update(tokens =>
    {
      tokens[tenant] = offlineToken;
    });
  }

  async delete(tenant)
  {
    this.app.accessToken.delete(tenant);

    return this.database.update(tokens =>
    {
      delete tokens[tenant];
    });
  }
}

module.exports = OfflineToken;
