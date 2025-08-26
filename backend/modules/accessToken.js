class AccessToken
{
  #cache = {};

  async init()
  {
    return Promise.resolve();
  }

  async get(tenant)
  {
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
    this.#cache[tenant] = {
      accessToken,
      expiresAt,
    };
  }

  async delete(tenant)
  {
    delete this.#cache[tenant];
  }
}

module.exports = AccessToken;
