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
      res.end();
    });
}

module.exports = streamResponse;
