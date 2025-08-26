import { superUser, permissions } from './parameters.js';

/* We need to ensure that this integration only
   works when running in a "VARIO Cloud" frame.

   So we make sure that it is embedded and that
   the parent window is the VARIO Cloud.

        {tenant}.vario.cloud ✓ valid
  {tenant}.stage-vario.cloud ✓ valid
    {tenant}.dev-vario.cloud ✓ valid
                   localhost ✓ valid
  */

const getMainUrl = property =>
{
  if (document.referrer)
  {
    const refUrl = new URL(document.referrer);
    return refUrl[property];
  }

  return 'tenant.vario.cloud';
};

const isValidIntegration = () =>
{
  if (window.parent === window)
  {
    return false;
  }

  if (!getMainUrl('hostname').match(/^[A-Za-z0-9-.]+\.(dev-|stage-)?vario\.cloud$|^localhost$/))
  {
    return false;
  }

  return true;
};

const secureIntegration = () =>
{
  if (!isValidIntegration())
  {
    throw new Error('Application does not run within VARIO-Cloud.');
  }
};

const hasPermission = permission => (superUser === 'true') || permissions.split(',').includes(permission);

export { secureIntegration, hasPermission };
