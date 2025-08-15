const { getApp, getContext, getExternalUserId } = require('#backend/utils/context.js');
const HttpError = require('#backend/utils/httpError.js');

async function checkPermission(verb)
{
  const { superUser, permissions } = await getPermissions();

  if (!(superUser || permissions.includes(verb)))
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

async function getPermissions()
{
  const context = getContext();

  if (context.permissions)
  {
    return context.permissions;
  }

  const app = getApp();

  const { appIdentifier } = app.client;

  const userId = getExternalUserId();

  const { data } = await app.erp.fetch(`/cmn/users/${userId}/authorization`, {
    useInternalApi: true,
  });

  const { superUser, operations } = data;

  const permissions = operations
    .filter(({ permission }) => permission.resource === appIdentifier)
    .map(({ permission }) => permission.verb);

  context.permissions = { superUser, permissions };

  return context.permissions;
}

module.exports = {
  checkPermission,
  checkPermissionMiddleware,
};
