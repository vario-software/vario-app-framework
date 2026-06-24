const { validateOfflineToken } = require('#backend/utils/token.js');
const HttpError = require('#backend/utils/httpError.js');

class BaseUrlCache
{
  #cache = {};

  constructor(app)
  {
    this.app = app;
  }

  async init()
  {
    return Promise.resolve();
  }

  #assertTenant(tenant)
  {
    if (!tenant)
    {
      throw new HttpError(
        'MISSING_TENANT',
        400,
        'backend/modules/baseUrlCache',
      );
    }
  }

  async get(tenant)
  {
    this.#assertTenant(tenant);

    if (this.#cache[tenant])
    {
      return this.#cache[tenant];
    }

    const offlineToken = await this.app.offlineToken.get(tenant);
    const { iss } = await validateOfflineToken(offlineToken);

    const domain = iss.replace('https://sso.', '').split('/')[0];
    const baseUrl = `https://${tenant}.${domain}`;

    await this.set(tenant, baseUrl);

    return baseUrl;
  }

  async set(tenant, value)
  {
    this.#assertTenant(tenant);

    this.#cache[tenant] = value;
  }

  async delete(tenant)
  {
    this.#assertTenant(tenant);

    delete this.#cache[tenant];
  }
}

module.exports = BaseUrlCache;
