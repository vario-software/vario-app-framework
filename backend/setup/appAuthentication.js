const { getContext, getRequestId } = require('#backend/utils/context.js');
const { validateAppToken } = require('#backend/utils/token.js');

function appAuthentication(req, res, next)
{
  const authorizationHeader = req.get('Authorization');

  // Read appToken from Authorization-Header
  let token = authorizationHeader?.replace('Bearer ', '');

  if (['/api/install', '/api/uninstall'].includes(req.path))
  {
    /* if the app has no ui we need to
         extract the appToken from the query */
    if (req.method === 'GET')
    {
      token = req.query.appToken;
    }
  }

  validateAppToken(token)
    .then(accessToken =>
    {
      const context = getContext();

      context.appToken = token;
      context.accessToken = accessToken;

      next();
    })
    .catch(error =>
    {
      console.log({
        message: 'Auth failed',
        requestId: getRequestId(),
        token,
        error,
        requestPath: req.path,
      });

      res.status(401).end();
    });
}

module.exports = appAuthentication;
