import { receiveMain } from './communication.js';
import { uimode } from './parameters.js';

let corporateDesign = null;
let dark = uimode === 'dark';
let appliedVariables = [];

const applyVariables = () =>
{
  const root = document.documentElement;
  const variables = corporateDesign?.variables?.[dark ? 'dark' : 'light'] ?? {};

  appliedVariables.forEach(name => root.style.removeProperty(name));

  Object.entries(variables).forEach(([name, value]) => root.style.setProperty(name, value));

  appliedVariables = Object.keys(variables);
};

const initCorporateDesign = () =>
{
  receiveMain({
    corporateDesign: design =>
    {
      corporateDesign = design;

      applyVariables();
    },

    updateSettings: data =>
    {
      if (data.key === 'uimode')
      {
        dark = data.value === 'dark';

        applyVariables();
      }
    },
  });
};

const getCorporateDesign = () => corporateDesign;

export { initCorporateDesign, getCorporateDesign };
