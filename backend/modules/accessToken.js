const HttpError = require('#backend/utils/httpError.js');

class AccessToken
{
  #cache = {};

  async init()
  {
    return Promise.resolve();
  }

  async get(tenant)
  {
    this.#assertTenant(tenant);

    const tokenData = this.#cache[tenant];

    if (!tokenData)
    {
      return null;
    }

    if (Date.now() >= tokenData.expiresAt)
    {
      await this.delete(tenant);

      return null;
    }

    return tokenData.accessToken;
  }

  async set(tenant, accessToken, expiresAt)
  {
    this.#assertTenant(tenant);

    this.#cache[tenant] = {
      accessToken,
      expiresAt,
    };
  }

  async delete(tenant)
  {
    this.#assertTenant(tenant);

    delete this.#cache[tenant];
  }

  #assertTenant(tenant)
  {
    if (!tenant)
    {
      throw new HttpError(
        'MISSING_TENANT',
        400,
        'backend/modules/accessToken',
      );
    }
  }
}

module.exports = AccessToken;
