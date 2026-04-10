const { getTenant } = require('#backend/utils/context.js');
const { validateOfflineToken } = require('#backend/utils/token.js');

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

  async get()
  {
    const tenant = getTenant();

    if (this.#cache[tenant])
    {
      return this.#cache[tenant];
    }

    const offlineToken = await this.app.offlineToken.get(tenant);
    const { iss } = await validateOfflineToken(offlineToken);

    const domain = iss.replace('https://sso.', '').split('/')[0];
    const baseUrl = `https://${tenant}.${domain}`;

    await this.set(baseUrl);

    return baseUrl;
  }

  async set(value)
  {
    const tenant = getTenant();

    this.#cache[tenant] = value;
  }

  async delete()
  {
    const tenant = getTenant();

    delete this.#cache[tenant];
  }
}

module.exports = BaseUrlCache;
