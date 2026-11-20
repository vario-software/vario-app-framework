const {
  McpServer,
  createMcpHandler,
  isLegacyRequest,
  WebStandardStreamableHTTPServerTransport,
} = require('@modelcontextprotocol/server');
const { z } = require('zod');

/*
 * MCP endpoint of an App (manifest `mcpIntegrations`). VARIO Intelligence and the
 * VARIO MCP server load tools and ui:// resources from it on behalf of the user:
 * every request carries that user's App token, which appAuthentication has
 * already verified, so tools reach the ERP via app.erp exactly like any route.
 * Stateless: one McpServer per request, no session.
 */
const UI_MIME_TYPE = 'text/html;profile=mcp-app';

// Request headers that describe the original byte stream, not the re-wrapped body.
const DROPPED_HEADERS = new Set(['content-length', 'transfer-encoding', 'connection', 'keep-alive']);

// The body parser already consumed the stream; the parsed body travels as parsedBody.
function toWebRequest(req, signal)
{
  const headers = new Headers();

  Object.entries(req.headers).forEach(([key, value]) =>
  {
    if (value !== undefined && !DROPPED_HEADERS.has(key))
    {
      [].concat(value).forEach(entry => headers.append(key, entry));
    }
  });

  return new Request(new URL(req.originalUrl ?? req.url, 'http://mcp.local'), { method: req.method, headers, signal });
}

async function handleLegacy(createServer, request, parsedBody)
{
  const server = createServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  request.signal.addEventListener('abort', () => transport.close(), { once: true });

  try
  {
    await server.connect(transport);

    const response = await transport.handleRequest(request, { parsedBody });
    const body = response.body && response.status !== 204 ? await response.arrayBuffer() : null;

    return new Response(body, response);
  }
  finally
  {
    await transport.close();
    await server.close();
  }
}

/**
 * Serves an MCP endpoint (Streamable HTTP) below the App's API, e.g. `registerMcpEndpoint(app, '/mcp', createServer)`
 * for the manifest path `/api/mcp`.
 * @param {object} app VarioCloudApp
 * @param {string} path route below the API prefix
 * @param {() => McpServer} createServer builds a fresh server with its tools and resources per request
 */
function registerMcpEndpoint(app, path, createServer)
{
  const modern = createMcpHandler(createServer, { legacy: 'reject' });

  app.apiServer.post(path, async (req, res) =>
  {
    const disconnected = new AbortController();

    res.on('close', () =>
    {
      if (!res.writableFinished)
      {
        disconnected.abort();
      }
    });

    const request = toWebRequest(req, disconnected.signal);
    const response = await isLegacyRequest(request, req.body)
      ? await handleLegacy(createServer, request, req.body)
      : await modern.fetch(request, { parsedBody: req.body });

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body)
    {
      for await (const chunk of response.body)
      {
        res.write(chunk);
      }
    }

    res.end();
  });

  // Stateless: no SSE stream to open and no session to delete.
  app.apiServer.all(path, (req, res) =>
  {
    res.status(405).set('Allow', 'POST').end();
  });
}

module.exports = {
  McpServer,
  UI_MIME_TYPE,
  registerMcpEndpoint,
  z,
};
