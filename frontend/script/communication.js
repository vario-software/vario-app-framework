import { appIdentifier, integrationId } from './parameters.js';

const sendMain = payload =>
{
  window.parent.postMessage({
    appIdentifier,
    integrationId,
    ...payload,
  }, '*');
};

const receiveMain = actions =>
{
  const controller = new AbortController();

  window.addEventListener('message', ({ data }) =>
  {
    Object.keys(actions).forEach(key =>
    {
      if (typeof data === 'object' && key in data)
      {
        actions[key](data[key]);
      }
    });
  }, { signal: controller.signal });

  return () => controller.abort();
};

export { sendMain, receiveMain };
