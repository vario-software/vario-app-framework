const { getAccessToken } = require('#backend/utils/context.js');
const HttpError = require('#backend/utils/httpError.js');

function checkPermission(verb, strict = true)
{
  const { isSuperUser, permissions } = getAccessToken();

  if (!(isSuperUser || permissions?.includes(verb)))
  {
    if (strict)
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

    return false;
  }

  return true;
}

function checkPermissionMiddleware(verb)
{
  return async (req, res, next) =>
  {
    checkPermission(verb);

    next();
  };
}

module.exports = {
  checkPermission,
  checkPermissionMiddleware,
};
