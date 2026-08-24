# VARIO App Framework — Backend

The Node.js backend of the [VARIO App Framework](https://github.com/vario-software/vario-app-framework). It runs the server side of a VARIO Cloud App and takes care of the parts every App needs:

- **Authentication** — verifies the App token on incoming calls, and exchanges the tenant's offline token for access tokens on outgoing ones
- **ERP API access** — a ready-made client for REST calls and VQL queries, with the tenant's base URL resolved for you
- **Webhooks** — registering, deregistering and receiving them
- **Installation migrations** — versioned, once-only setup steps for EAV groups, backends and webhooks

```bash
npm install @vario-software/vario-app-framework-backend
```

```javascript
const VarioCloudApp = require('@vario-software/vario-app-framework-backend/app.js');
const client = require('../app-client.js');

const app = new VarioCloudApp(client);

app.offlineToken.init().then(() => app.start());
```

Installing [`@vario-software/vario-app-framework`](https://www.npmjs.com/package/@vario-software/vario-app-framework) pulls in this package together with the frontend part.

## VARIO Cloud developer resources

- [Understand VARIO Cloud Apps](https://developer.vario-software.de/documentation/apps/introduction)
- [Build your first VARIO Cloud App](https://developer.vario-software.de/documentation/apps/quickstart)
- [Browse the VARIO Cloud Developer Docs](https://developer.vario-software.de/)
- [View the source code on GitHub](https://github.com/vario-software/vario-app-framework)
