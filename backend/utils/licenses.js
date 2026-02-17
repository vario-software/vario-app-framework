const { getApp, getContext } = require('#backend/utils/context.js');
const HttpError = require('#backend/utils/httpError.js');

async function checkLicense(licenseKey, silent)
{
  const licenses = await getLicenses();

  if (!licenses.includes(licenseKey))
  {
    if (silent)
    {
      return false;
    }

    throw new HttpError(
      'ERP_LICENSE_MISSING',
      402,
      'utils/licenses',
      { key: licenseKey },
      null,
      'ERROR',
    );
  }

  return true;
}

function checkLicenseMiddleware(licenseKey)
{
  return async (req, res, next) =>
  {
    await checkLicense(licenseKey);

    next();
  };
}

async function getLicenses()
{
  const context = getContext();

  if (context.licenses)
  {
    return context.licenses;
  }

  const app = getApp();

  const { data } = await app.erp.fetch('/cmn/systems/licenses/');

  return data.map(({ licenseKey }) => licenseKey);
}

module.exports = {
  checkLicense,
  checkLicenseMiddleware,
};
