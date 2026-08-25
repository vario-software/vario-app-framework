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

## VARIO Cloud developer resources

- [Understand VARIO Cloud Apps](https://developer.vario-software.de/documentation/apps/introduction)
- [Build your first VARIO Cloud App](https://developer.vario-software.de/documentation/apps/quickstart)
- [Browse the VARIO Cloud Developer Docs](https://developer.vario-software.de/)
- [View the source code on GitHub](https://github.com/vario-software/vario-app-framework)

For more information about VARIO and our ERP system, visit [www.vario-software.de](https://www.vario-software.de).