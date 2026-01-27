const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');
const ErpApi = require('#backend/api/ErpApi.js');
const appAuthentication = require('#backend/setup/appAuthentication.js');
const setupContext = require('#backend/setup/context.js');
const setupException = require('#backend/setup/exception.js');
const { log } = require('#backend/utils/logger.js');
const OfflineToken = require('#backend/modules/offlineToken.js');
const AccessToken = require('#backend/modules/accessToken.js');
const BaseUrlCache = require('#backend/modules/baseUrlCache.js');

let exceptionHandler;

const VarioCloudApp = class
{
  constructor(client, options = {})
  {
    this.onUnhandledError = options.onUnhandledError ?? console.error;
    this.onMigrationError = options.onMigrationError ?? console.error;
    this.onKeycloakError = options.onKeycloakError;

    exceptionHandler = setupException(this);

    this.express = express();
    this.port = '8080';
    this.uiPath = null;
    this.uiPrefix = '/ui';

    this.version = 'latest';

    this.client = client;

    this.log = options.log ?? log;

    this.offlineToken = options.offlineToken ?? new OfflineToken(this);
    this.accessToken = options.accessToken ?? new AccessToken(this);
    this.baseUrlCache = options.baseUrlCache ?? new BaseUrlCache(this);

    this.erp = ErpApi;

    this.express.disable('x-powered-by');

    this.express.use(cors());

    this.express.use(bodyParser.json({ strict: false, ...options.bodyParser }));
    this.express.use(bodyParser.raw({ type: 'application/octet-stream', limit: 100 * 1024 * 1024 }));

    this.apiServer = express.Router();

    this.apiServer.use(setupContext(this));
    this.apiServer.use(appAuthentication);

    this.express.use(options.apiPrefix ?? '/api', this.apiServer);
  }

  start()
  {
    validateClient(this.client);

    if (this.uiPath)
    {
      this.uiServer = express.Router();

      if (this.uiPath.startsWith('http'))
      {
        this.uiServer.use(
          createProxyMiddleware({
            target: `${this.uiPath}/ui`,
            changeOrigin: true,
          }),
        );
      }
      else
      {
        this.uiServer.use(express.static(this.uiPath));

        // For SPA-Routing
        this.uiServer.get('/*', (req, res) =>
        {
          res.sendFile(path.resolve(this.uiPath, 'index.html'));
        });
      }

      this.express.use(this.uiPrefix, this.uiServer);
    }

    this.express.use(exceptionHandler);

    return new Promise((resolve, reject) =>
    {
      this.express.listen(this.port, error =>
      {
        if (error)
        {
          reject(error);
          return;
        }

        resolve(this);
      });
    });
  }
};

function validateClient(client)
{
  if (!client)
  {
    throw new Error('client config missing');
  }

  const missingProps = ['clientId', 'clientSecret', 'appIdentifier', 'appJWK']
    .filter(prop => !client[prop]);

  if (missingProps.length)
  {
    throw new Error(`client config is missing: ${missingProps.join()}`);
  }

  try
  {
    JSON.parse(client.appJWK);
  }
  catch
  {
    throw new Error('appJWK is not a valid JSON');
  }
}

module.exports = VarioCloudApp;
