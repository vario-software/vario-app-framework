# VARIO App Framework — Frontend

The browser-side part of the [VARIO App Framework](https://github.com/vario-software/vario-app-framework). A VARIO Cloud App runs in an iframe inside the ERP; this package provides what it needs there:

- **Corporate-design CSS** — buttons, inputs, cards, datagrids, checkboxes and toggles, so the App matches the ERP
- **Communication helpers** — `sendMain` / `receiveMain` for the postMessage protocol between App and ERP
- **Integration utilities** — frame height transfer, App token handling, shared settings, screen-size classes, sticky-nav buttons and edit mode

```bash
npm install @vario-software/vario-app-framework-frontend
```

```html
<link rel="stylesheet" href="node_modules/@vario-software/vario-app-framework-frontend/style/index.css">
```

```javascript
import { sendMain, receiveMain } from '@vario-software/vario-app-framework-frontend/script/communication.js';

sendMain({ height: document.body.scrollHeight });
```

Installing [`@vario-software/vario-app-framework`](https://www.npmjs.com/package/@vario-software/vario-app-framework) pulls in this package together with the backend part.

## Tenant corporate design

Tenants can set their own appearance in the ERP (primary and accent color, logo, application name). The ERP answers the App's `ready` message with a `corporateDesign` message and sends it again whenever the appearance changes:

```javascript
{
  appTitle: 'VARIO Cloud',
  logo: 'data:image/png;base64,…', // or null
  primaryColor: '#0057b8',          // or null for the VARIO default
  accentColor: null,
  variables: {
    light: { '--v-secondary': '#0057b8', '--v-on-secondary': '#ffffff', … },
    dark: { '--v-secondary': '#005dc7', … },
  },
}
```

`script/index.js` applies the CSS variables to `:root` automatically, matching the App's UI mode, so the corporate-design CSS follows the tenant's colors. Without a custom appearance `variables.light` and `variables.dark` are empty and the VARIO defaults stay. Apps that load the scripts individually call `initCorporateDesign()` together with `secureIntegration()`, so the answer to `ready` is not missed.

```javascript
import { getCorporateDesign } from '@vario-software/vario-app-framework-frontend/script/corporateDesign.js';
import { receiveMain } from '@vario-software/vario-app-framework-frontend/script/communication.js';

const { logo, appTitle } = getCorporateDesign() ?? {};

receiveMain({ corporateDesign: design => updateHeader(design) });
```

## VARIO Cloud developer resources

- [Understand VARIO Cloud Apps](https://developer.vario-software.de/documentation/apps/introduction)
- [Build your first VARIO Cloud App](https://developer.vario-software.de/documentation/apps/quickstart)
- [Browse the VARIO Cloud Developer Docs](https://developer.vario-software.de/)
- [View the source code on GitHub](https://github.com/vario-software/vario-app-framework)
