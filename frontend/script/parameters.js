const url = new URL(window.location.href);

const parameters = url.searchParams;

const appIdentifier = parameters.get('appIdentifier');
const integrationId = parameters.get('integrationId');

const language = parameters.get('language');
const supportMode = parameters.get('supportMode');
const myCompanyId = parameters.get('myCompanyId');
const uimode = parameters.get('uimode');
const detailDatagridTable = parameters.get('detailDatagridTable');

const superUser = parameters.get('superUser');
const permissions = parameters.get('permissions');

const additionalPayload = parameters.get('additionalPayload');

export {
  appIdentifier,
  integrationId,

  language,
  supportMode,
  myCompanyId,
  uimode,
  detailDatagridTable,

  superUser,
  permissions,

  additionalPayload,
};
