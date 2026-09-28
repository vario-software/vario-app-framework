const Bottleneck = require('bottleneck');
const { getApp, getTenant, getExternalUserId, getContext, runInContext, bindContext } = require('#backend/utils/context.js');
const TenantCache = require('#backend/utils/TenantCache.js');

function setupConcurrency(app, options = {})
{
  // The values come from the environment, where a variable can be present but
  // empty. `Number('')` is 0, which every one of these settings would accept as
  // an active limit and then stop working, so the fallback has to catch it as
  // well as a typo turning into NaN — none of them has a meaningful zero.
  app.incomingBottleneck = new Bottleneck.Group({
    maxConcurrent: Number(options.incomingBottleneck?.maxConcurrent) || 30,
    highWater: Number(options.incomingBottleneck?.maxQueued) || 200,
    timeout: Number(options.incomingBottleneck?.timeout) || 60 * 60 * 1000,
    strategy: Bottleneck.strategy.OVERFLOW,
  });

  // Read back by `concurrencyMiddleware`, which only ever sees the app.
  app.incomingBottleneck.expiration = Number(options.incomingBottleneck?.expiration) || 10 * 60 * 1000;

  app.outgoingBottleneck = new Bottleneck.Group({
    maxConcurrent: Number(options.outgoingBottleneck?.maxConcurrent) || 30,
    timeout: Number(options.outgoingBottleneck?.timeout) || 60 * 60 * 1000,
  });

  // `timeout` decides when an idle limiter is thrown away, it does not end a
  // job: a handler that never settles holds its slot for the life of the
  // process, and once all of them are taken that key is dead. `expiration`
  // gives the slot back, and has to stay well under `timeout` — otherwise the
  // cleanup deletes a limiter whose jobs are still running and the one built
  // for the next request starts counting from zero.
  const expiration = Number(options.executionQueue?.expiration) || 30 * 60 * 1000;

  const group = new Bottleneck.Group({
    maxConcurrent: Number(options.executionQueue?.maxConcurrent) || 30,
    timeout: Number(options.executionQueue?.timeout) || 2 * 60 * 60 * 1000,
  });

  const add = handler =>
  {
    // The handler reports its own failure, so the only thing left for the
    // `.catch` below is the queue's own bookkeeping — see `keyed`.
    const run = async () =>
    {
      try
      {
        await handler();
      }
      catch (error)
      {
        await app.handleError(error);
      }
    };

    return group
      .key(getTenant())
      .schedule({ expiration }, bindContext(run))
      .catch(bindContext(error => app.log(
        `queue did not carry a job: ${error.message}`,
        'setup/concurrency',
        'WARNING',
      )));
  };

  const running = new TenantCache();

  const keyed = (key, handler) =>
  {
    if (running.has(key))
    {
      return running.get(key);
    }

    // The entry has to outlive the queue job, not the other way round:
    // `expiration` hands the slot back without stopping the handler, so a
    // `finally` on the scheduled promise would free the key while the work is
    // still going and the next tick would start a second run of it. The key is
    // what bounds how many runs of the same work exist, so it is tied to the
    // handler, which also reports its own failure.
    const run = async () =>
    {
      try
      {
        await handler();
      }
      catch (error)
      {
        await app.handleError(error);
      }
      finally
      {
        running.delete(key);
      }
    };

    const promise = group
      .key(getTenant())
      .schedule({ expiration }, bindContext(run))
      // Only the queue itself can still fail here: `expiration` means the slot
      // was taken back while `run` carries on, and a job the queue turned away
      // never started. Neither is an error of the work.
      .catch(bindContext(error => app.log(
        `queue did not carry the job for ${key}: ${error.message}`,
        'setup/concurrency',
        'WARNING',
      )));

    running.set(key, promise);

    return promise;
  };

  app.executionQueue = {
    add,
    keyed,
    group,
  };
}

function concurrencyMiddleware(getGroupKey = getGroupKeyDefault)
{
  return (req, res, next) =>
  {
    const app = getApp();

    if (!app.incomingBottleneck)
    {
      next();
      return;
    }

    const context = getContext();

    const key = getGroupKey();

    let closed = false;

    res.on('close', () =>
    {
      closed = true;
    });

    app.incomingBottleneck.key(key)
      .schedule(() => new Promise(resolve =>
      {
        if (closed)
        {
          resolve();
          return;
        }

        // The slot is held until the response is through. A handler that never
        // answers and a client that never hangs up would hold it for the life
        // of the process, so it is given back after `expiration` — the request
        // itself is not touched and runs to its end.
        const timer = setTimeout(resolve, app.incomingBottleneck.expiration);

        res.on('close', () =>
        {
          clearTimeout(timer);
          resolve();
        });

        const executionTime = performance.now();

        runInContext({ executionTime, ...context }, () =>
        {
          next();
        });
      }))
      .catch(async error =>
      {
        if (!(error instanceof Bottleneck.BottleneckError))
        {
          next(error);
          return;
        }

        // The queue turned the request away — reaching `highWater` is only one
        // of the reasons, a limiter built with an unusable setting is another,
        // so the message says what happened instead of asserting a cause.
        app.log(
          `${req.method} ${req.originalUrl} was not queued for ${key}: ${error.message}`,
          'setup/concurrency',
          'WARNING',
        );

        res.status(429).send({ error: 'TOO_MANY_REQUESTS' }).end();
      });
  };
}

function getGroupKeyDefault()
{
  return [getTenant() ?? 'unknown', getExternalUserId() ?? 'unknown'].join(':');
}

module.exports = {
  setupConcurrency,
  concurrencyMiddleware,
  getGroupKeyDefault,
};
