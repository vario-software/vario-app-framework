import { receiveMain, sendMain } from './communication.js';

export function uninstallFromErp()
{
  return new Promise((resolve, reject) =>
  {
    receiveMain({
      uninstallState: state =>
      {
        if (state)
        {
          resolve();
        }
        else
        {
          reject();
        }
      },
    });

    sendMain({ requestUninstall: true });
  });
}
