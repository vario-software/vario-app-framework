function streamResponse(res, handler)
{
  const streaming = res.req.headers['x-stream'] === 'true';

  if (!streaming)
  {
    return handler().then(result => res.send(result).status(200).end());
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  const onProgress = data =>
  {
    res.write(`${JSON.stringify(data)}\n`);
  };

  // Keep the connection non-idle during long silent phases (e.g. polling for the
  // ERP import to extract). Reverse proxies/gateways close idle connections with a
  // 504 after ~60s; a periodic blank line resets that timer. Blank lines are ignored
  // by the client parsers (they filter out non-JSON / empty lines).
  const HEARTBEAT_INTERVAL_MS = 15_000;
  const heartbeat = setInterval(() => res.write('\n'), HEARTBEAT_INTERVAL_MS);

  return handler(onProgress)
    .then(result =>
    {
      res.write(`${JSON.stringify({ type: 'done', ...result })}\n`);
    })
    .catch(error =>
    {
      res.write(`${JSON.stringify({ type: 'error', message: error.message })}\n`);
    })
    .finally(() =>
    {
      clearInterval(heartbeat);
      res.end();
    });
}

module.exports = streamResponse;
