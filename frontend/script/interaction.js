import { sendMain, receiveMain } from './communication.js';

const confirm = (confirmation, callback) =>
{
  sendMain({
    confirmation,
  });

  const unsubscribe = receiveMain({
    confimation: ({ key, values }) =>
    {
      callback(key, values);

      unsubscribe();
    },
  });
};

const initStickynav = () => new Promise(resolve =>
{
  sendMain({
    initStickynav: true,
  });

  const handleResponse = ({ data }) =>
  {
    if (data.initStickynav)
    {
      window.removeEventListener('message', handleResponse);

      resolve(data.initStickynav);
    }
  };

  window.addEventListener('message', handleResponse);
});

export { initStickynav, confirm };
