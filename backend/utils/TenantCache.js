const { getTenant } = require('#backend/utils/context.js');

module.exports = class TenantCache
{
  #cache = {};

  #getSubdomain()
  {
    const subdomain = getTenant();

    if (!subdomain)
    {
      throw new Error('missing subdomain');
    }

    if (!this.#cache[subdomain])
    {
      this.#cache[subdomain] = {};
    }

    return subdomain;
  }

  has(key)
  {
    const subdomain = this.#getSubdomain();

    return key in this.#cache[subdomain];
  }

  get(key)
  {
    const subdomain = this.#getSubdomain();

    return this.#cache[subdomain][key];
  }

  set(key, value)
  {
    const subdomain = this.#getSubdomain();

    this.#cache[subdomain][key] = value;
  }

  merge(object)
  {
    const subdomain = this.#getSubdomain();

    Object.assign(this.#cache[subdomain], object);
  }

  clear()
  {
    const subdomain = this.#getSubdomain();

    delete this.#cache[subdomain];
  }

  delete(key)
  {
    const subdomain = this.#getSubdomain();

    delete this.#cache[subdomain][key];
  }
};
