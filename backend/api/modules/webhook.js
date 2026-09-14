const { getAppDomain, getApp, getRequest } = require('#backend/utils/context.js');

const Webhook = class
{
  constructor(ApiAdapter)
  {
    this.ApiAdapter = ApiAdapter;
  }

  resolveWebhookUrl = function(url)
  {
    const HAS_PROTOCOL = /^https?:\/\//i;

    if (HAS_PROTOCOL.test(url))
    {
      return url;
    }

    const base = process.env.WEBHOOK_HOST
      || getAppDomain()
      || getRequest()?.get('host');

    const { origin } = new URL(HAS_PROTOCOL.test(base) ? base : `https://${base}`);

    return new URL(url, origin).toString();
  };

  register = async function(destinationQueue, url, destinationOwner)
  {
    const app = getApp();

    await this.ApiAdapter.fetch(`/community/${app.version}/cmn/system/app-message-webhook/register`, {
      method: 'POST',
      body: JSON.stringify({
        url: this.resolveWebhookUrl(url),
        destinationOwner,
        destinationQueue,
        appIdentifier: app.client.appIdentifier,
      }),
    });
  };

  deregister = async function(destinationQueue, url, destinationOwner)
  {
    const app = getApp();

    await this.ApiAdapter.fetch(`/community/${app.version}/cmn/system/app-message-webhook/deregister`, {
      method: 'POST',
      body: JSON.stringify({
        url: this.resolveWebhookUrl(url),
        destinationOwner,
        destinationQueue,
        appIdentifier: app.client.appIdentifier,
      }),
    });
  };

  getRegistered = async function()
  {
    const app = getApp();

    const { data } = await this.ApiAdapter.vql({
      statement: `
        SELECT destinationQueue, url
          FROM system.queryAppMessageWebhook
         WHERE appIdentifier = '${app.client.appIdentifier}'
      `,
    });

    return data || [];
  };

  isRegistered = async function(destinationQueue, url)
  {
    const fullUrl = this.resolveWebhookUrl(url);

    const registeredWebhooks = await this.getRegistered();

    return registeredWebhooks.some(
      webhook => webhook.destinationQueue === destinationQueue && webhook.url === fullUrl,
    );
  };
};

module.exports = Webhook;
