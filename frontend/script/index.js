import { secureIntegration } from './secure.js';
import { initHeightTransfer } from './height.js';
import { initAppTokenHandling } from './token.js';
import { initSharedSettings } from './sharedSettings.js';
import { initScreenSize } from './screenSize.js';

window.addEventListener('DOMContentLoaded', () =>
{
  secureIntegration();
  initHeightTransfer();
  initAppTokenHandling();
  initSharedSettings();
  initScreenSize();
});
