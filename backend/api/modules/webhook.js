const { getRequest } = require('#backend/utils/context.js');
const { getApp } = require('#backend/utils/context.js');

const Webhook = class
{
  constructor(ApiAdapter)
  {
    this.ApiAdapter = ApiAdapter;
  }

  register = async function(destinationQueue, url, destinationOwner)
  {
    const apiUrl = `${process.env.WEBHOOK_HOST ?? `https://${getRequest().get('host')}`}`;

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
    const apiUrl = `${process.env.WEBHOOK_HOST ?? `https://${getRequest().get('host')}`}`;

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
};

module.exports = Webhook;
