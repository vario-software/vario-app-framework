import { sendMain } from './communication.js';

let transferedHeight;

const transferHeight = () =>
{
  const height = document.body.scrollHeight;

  if (transferedHeight !== height)
  {
    sendMain({ height });

    transferedHeight = height;
  }
};

const initHeightTransfer = () =>
{
  transferHeight();

  const observer = new MutationObserver(transferHeight);

  observer.observe(document.body, {
    attributes: true,
    characterData: true,
    childList: true,
    subtree: true,
  });
};

export { initHeightTransfer };
