const { getAppDomain } = require('#backend/utils/context.js');
const { getApp } = require('#backend/utils/context.js');

const Webhook = class
{
  constructor(ApiAdapter)
  {
    this.ApiAdapter = ApiAdapter;
  }

  register = async function(destinationQueue, url, destinationOwner)
  {
    const apiUrl = `${process.env.WEBHOOK_HOST ?? `https://${getAppDomain()}`}`;

    const app = getApp();

    await this.ApiAdapter.fetch(`/community/${app.version}/cmn/system/app-message-webhook/register`, {
      method: 'POST',
      body: JSON.stringify({
        url: `${apiUrl}${url}`,
        destinationOwner,
        destinationQueue,
        appIdentifier: app.client.appIdentifier,
      }),
    });
  };

  deregister = async function(destinationQueue, url, destinationOwner)
  {
    const apiUrl = `${process.env.WEBHOOK_HOST ?? `https://${getAppDomain()}`}`;

    const app = getApp();

    await this.ApiAdapter.fetch(`/community/${app.version}/cmn/system/app-message-webhook/deregister`, {
      method: 'POST',
      body: JSON.stringify({
        url: `${apiUrl}${url}`,
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
    const apiUrl = `${process.env.WEBHOOK_HOST ?? `https://${getAppDomain()}`}`;
    const fullUrl = `${apiUrl}${url}`;

    const registeredWebhooks = await this.getRegistered();

    return registeredWebhooks.some(
      webhook => webhook.destinationQueue === destinationQueue && webhook.url === fullUrl,
    );
  };
};

module.exports = Webhook;
