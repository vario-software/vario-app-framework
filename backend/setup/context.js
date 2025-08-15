const { runInContext } = require('#backend/utils/context.js');

function setupContext(app)
{
  return (req, res, next) =>
  {
    // Identifier to this context
    const requestId = `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 8)}`;
    const startTime = performance.now();

    res.setHeader('x-request-id', requestId);

    const specificContext = {
      req,
      res,
      app,
      requestId,
      startTime,
    };

    res.on('finish', async () =>
    {
      await app.log(
        `${(performance.now() - specificContext.startTime).toFixed(2)}ms`,
        'setup/context/finish',
        'DEBUG',
      );
    });

    runInContext(specificContext, () =>
    {
      next();
    });
  };
}

module.exports = setupContext;
