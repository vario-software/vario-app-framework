const { getAccessToken } = require('#backend/utils/context.js');
const HttpError = require('#backend/utils/httpError.js');

async function checkPermission(verb)
{
  const { isSuperUser, permissions } = await getAccessToken();

  if (!(isSuperUser || permissions?.includes(verb)))
  {
    throw new HttpError(
      'APP_AUTHORIZATION_FAILED',
      403,
      'utils/permission',
      { missingVerb: verb },
      null,
      'ERROR',
    );
  }
}

function checkPermissionMiddleware(verb)
{
  return async (req, res, next) =>
  {
    await checkPermission(verb);

    next();
  };
}

module.exports = {
  checkPermission,
  checkPermissionMiddleware,
};
