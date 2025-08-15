const url = new URL(window.location.href);

const parameters = url.searchParams;

const superUser = parameters.get('superUser');
const permissions = parameters.get('permissions');

export function hasPermission(permission)
{
  return (superUser === 'true') || permissions.split(',').includes(permission);
}
