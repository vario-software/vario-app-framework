import { sendMain, receiveMain } from './communication.js';

export default class StickynavEditmode
{
  #editFn = null;

  #saveFn = null;

  #cancelFn = null;

  isActive = false;

  constructor()
  {
    sendMain({ editmode: { add: true } });

    this.unsubscribe = receiveMain({
      edit: () =>
      {
        if (this.#editFn)
        {
          this.#editFn();
        }

        this.isActive = true;
      },

      save: () =>
      {
        if (this.#saveFn)
        {
          this.#saveFn();
        }

        this.isActive = false;
      },

      cancel: () =>
      {
        if (this.#cancelFn)
        {
          this.#cancelFn();
        }

        this.isActive = false;
      },
    });
  }

  activate = function ()
  {
    this.unsubscribe();

    sendMain({ editmode: { activate: true } });
  };

  deactivate = function ()
  {
    sendMain({ editmode: { remove: true } });
  };

  setEditFn = function (callback)
  {
    this.#editFn = callback;
  };

  setSaveFn = function (callback)
  {
    this.#saveFn = callback;
  };

  setCancelFn = function (callback)
  {
    this.#cancelFn = callback;
  };
}
