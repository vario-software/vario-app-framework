const Api = require('#backend/api/Api.js');
const { getTenant, getAppToken, getContext } = require('#backend/utils/context.js');

const PromiseSingletonMap = require('#backend/utils/promiseSingletonMap.js');
const refreshAccessToken = require('#backend/utils/keycloak.js');
const Eav = require('#backend/api/modules/eav.js');
const Migration = require('#backend/api/modules/migration.js');
const TextEnum = require('#backend/api/modules/textEnum.js');
const Webhook = require('#backend/api/modules/webhook.js');
const PermittedToken = require('#backend/api/modules/permittedToken.js');
const { validateOfflineToken, isAppTokenExpired, refreshAppToken } = require('#backend/utils/token.js');

const singletonPromise = new PromiseSingletonMap();
class ErpApi extends Api
{
  constructor(path, options = {})
  {
    const {
      runAsAppUser = false,
    } = getContext();

    const {
      executeAsAppUser = runAsAppUser,
      ...restOptions
    } = options;

    super(path, restOptions);

    this.executeAsAppUser = executeAsAppUser;
  }

  async onBeforeRequest()
  {
    const { baseUrl, Authorization } = await this.getAuthorization();

    if (!this.executeAsAppUser)
    {
      if (isAppTokenExpired())
      {
        await refreshAppToken();
      }

      this.setHeaders({
        'X-Forwarded-App-Token': getAppToken(),
      });
    }

    this.setAuthorization(Authorization);

    if (this.useInternalApi)
    {
      this.setBaseUrl(`${baseUrl}/api/vario`);
    }
    else
    {
      this.setBaseUrl(`${baseUrl}/api/vario/community/${this.app.version}`);
    }
  }

  async onResponse()
  {
    const statusCode = this.getStatusCode();

    if (statusCode === 401)
    {
      const tenant = getTenant();

      await this.app.accessToken.delete(tenant);
    }
  }

  async getAuthorization()
  {
    const tenant = getTenant();

    return singletonPromise.run(tenant, async () =>
    {
      const savedAccessToken = await this.app.accessToken.get(tenant);

      if (savedAccessToken)
      {
        const baseUrl = await this.app.baseUrlCache.get();

        return {
          baseUrl,
          Authorization: `Bearer ${savedAccessToken}`,
        };
      }

      const offlineToken = await this.app.offlineToken.get(tenant);
      const { iss } = await validateOfflineToken(offlineToken);

      const domain = iss.replace('https://sso.', '').split('/')[0];
      const baseUrl = `https://${tenant}.${domain}`;

      await this.app.baseUrlCache.set(baseUrl);

      const {
        access_token: accessToken,
        expires_in: expiresIn,
      } = await refreshAccessToken(
        offlineToken,
        `${iss}/protocol/openid-connect/token`,
      );

      const expiresAt = Date.now() + (expiresIn * 0.9) * 1000;

      this.app.accessToken.set(tenant, accessToken, expiresAt);

      return {
        baseUrl,
        Authorization: `Bearer ${accessToken}`,
      };
    });
  }
}

ErpApi.migration = new Migration(ErpApi);
ErpApi.eav = new Eav(ErpApi);
ErpApi.textenum = new TextEnum(ErpApi);
ErpApi.webhook = new Webhook(ErpApi);
ErpApi.permittedToken = new PermittedToken(ErpApi);

module.exports = ErpApi;
