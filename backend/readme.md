# VARIO App Framework — Backend

The Node.js backend of the [VARIO App Framework](https://github.com/vario-software/vario-app-framework). It runs the server side of a VARIO Cloud App and takes care of the parts every App needs:

- **Authentication** — verifies the App token on incoming calls, and exchanges the tenant's offline token for access tokens on outgoing ones
- **ERP API access** — a ready-made client for REST calls and VQL queries, with the tenant's base URL resolved for you
- **Webhooks** — registering, deregistering and receiving them
- **Installation migrations** — versioned, once-only setup steps for EAV groups, backends and webhooks
- **MCP endpoint** — tools and their UI (MCP Apps) for VARIO Intelligence

```bash
npm install @vario-software/vario-app-framework-backend
```

```javascript
const VarioCloudApp = require('@vario-software/vario-app-framework-backend/app.js');
const client = require('../app-client.js');

const app = new VarioCloudApp(client);

app.offlineToken.init().then(() => app.start());
```

## MCP endpoint

An App can bring tools to VARIO Intelligence. Declare one or more endpoints in the App manifest:

```json
"mcpIntegrations": {
  "integrations": [
    { "id": "my-app", "msgKey": "My App", "url": "https://my-app.example.com/api/mcp", "permissionKey": "parcel-tracking" }
  ]
}
```

and serve them with the official MCP SDK:

```javascript
const { McpServer, UI_MIME_TYPE, registerMcpEndpoint, z } = require('@vario-software/vario-app-framework-backend/utils/mcp.js');
const { checkPermission } = require('@vario-software/vario-app-framework-backend/utils/permission.js');

registerMcpEndpoint(app, '/mcp', () =>
{
  const server = new McpServer({ name: 'my-app', version: '1.0.0' });

  server.registerTool('track_parcel', {
    title: 'Track parcel',
    description: 'Status and history of a parcel',
    inputSchema: z.object({ trackingNumber: z.string() }),
    annotations: { readOnlyHint: true },
    _meta: { ui: { resourceUri: 'ui://my-app/tracking.html' } },
  }, async ({ trackingNumber }) =>
  {
    checkPermission('parcel-tracking');

    return { content: [{ type: 'text', text: 'Delivered' }], structuredContent: { trackingNumber } };
  });

  server.registerResource('tracking', 'ui://my-app/tracking.html', { mimeType: UI_MIME_TYPE }, async () => ({
    contents: [{ uri: 'ui://my-app/tracking.html', mimeType: UI_MIME_TYPE, text: '<!DOCTYPE html>...' }],
  }));

  return server;
});
```

The contract:

- Intelligence calls the endpoint server to server with an App token of the chatting user, so `app.erp` acts with that user's rights, exactly like in any other route.
- `url` is an absolute `https` URL on the host of the App's `rootUrl` (or a subdomain of it); other hosts and redirects are refused, because the request carries the user's token.
- `tools/list` must not depend on the user; Intelligence caches it per installed App version. At most 40 tools per endpoint, each with a plain object `inputSchema`.
- `permissionKey` only hides the endpoint in Intelligence from users without that App permission, it does not protect it: anyone with a valid App token can call the endpoint directly. Every tool checks the rights it needs itself with `checkPermission`, as in the example above.
- Tools with `readOnlyHint: true` run right away. Every other tool only runs after the user approved a preview card in the chat, so it may write.
- A `ui://` resource (MCP Apps, `text/html;profile=mcp-app`) renders inside the chat in a sandboxed frame without network access. It gets its data from the tool result and may call the tools of its own endpoint by their plain names; a writing tool called from the UI only returns its preview.

Installing [`@vario-software/vario-app-framework`](https://www.npmjs.com/package/@vario-software/vario-app-framework) pulls in this package together with the frontend part.

## VARIO Cloud developer resources

- [Understand VARIO Cloud Apps](https://developer.vario-software.de/documentation/apps/introduction)
- [Build your first VARIO Cloud App](https://developer.vario-software.de/documentation/apps/quickstart)
- [Browse the VARIO Cloud Developer Docs](https://developer.vario-software.de/)
- [View the source code on GitHub](https://github.com/vario-software/vario-app-framework)
