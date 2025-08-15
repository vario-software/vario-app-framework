import { sendMain, receiveMain } from './communication.js';
import { uimode, detailDatagridTable } from './parameters.js';

const sharedSettings = { uimode, detailDatagridTable };

const transferSettings = (key, value) =>
{
  sendMain({
    updateSettings: {
      key,
      value,
    },
  });
};

const initSharedSettings = () =>
{
  initUIMode();

  receiveMain({
    updateSettings: data =>
    {
      sharedSettings[data.key] = data.value;

      initUIMode();
    },
  });
};

const initUIMode = () =>
{
  if (sharedSettings.uimode === 'dark')
  {
    window.document.body.classList.add('v-dark');
  }
  else
  {
    window.document.body.classList.remove('v-dark');
  }
};

export { initSharedSettings, transferSettings, sharedSettings };
