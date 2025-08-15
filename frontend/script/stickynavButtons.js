import { sendMain } from './communication.js';

export default class StickynavButtons
{
  #buttons = {};

  add = function (button)
  {
    this.#buttons[button.key] = button;

    this.#update();
  };

  delete = function (key)
  {
    delete this.#buttons[key];

    this.#update();
  };

  toggleLoading = function (key)
  {
    this.#buttons[key].loading = !this.#buttons[key].loading;

    this.#update();
  };

  toggleActive = function (key)
  {
    this.#buttons[key].disabled = !this.#buttons[key].disabled;

    this.#update();
  };

  keys = function ()
  {
    return Object.keys(this.#buttons);
  };

  values = function ()
  {
    return Object.values(this.#buttons);
  };

  get = function (key)
  {
    return this.#buttons[key];
  };

  #update = function()
  {
    const stickynavButtons = this.values();

    sendMain({ stickynavButtons });
  };
}
