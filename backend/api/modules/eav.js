const { getApp } = require('#backend/utils/context.js');

const Eav = class
{
  constructor(ApiAdapter)
  {
    this.ApiAdapter = ApiAdapter;
  }

  getGroup = async function(groupKey)
  {
    const app = getApp();

    const { data: eavGroup } = await this.ApiAdapter.fetch(`/community/${app.version}/cmn/eav-groups/by-key/${groupKey}`, {
      method: 'GET',
    });

    return eavGroup;
  };

  setGroup = async function(eavGroup)
  {
    const existingGroup = await this.getGroupIdByKey(eavGroup.key);

    if (existingGroup)
    {
      eavGroup.id = existingGroup;

      return eavGroup;
    }

    const app = getApp();

    eavGroup = await this.ApiAdapter.fetch(`/community/${app.version}/cmn/eav-groups`, {
      method: 'POST',
      body: JSON.stringify(eavGroup),
    });

    return eavGroup.data;
  };

  changeGroup = async function (groupKey, callback)
  {
    let eavGroup = await this.getGroup(groupKey);

    const app = getApp();

    eavGroup = callback(eavGroup);

    eavGroup = await this.ApiAdapter.fetch(`/community/${app.version}/cmn/eav-groups/${eavGroup.id}`, {
      method: 'PUT',
      body: JSON.stringify(eavGroup),
    });

    return eavGroup.data;
  };

  deleteGroup = async function (groupKey)
  {
    const eavGroup = await this.getGroup(groupKey);
    const app = getApp();

    await this.ApiAdapter.fetch(`/community/${app.version}/cmn/eav-groups/${eavGroup.id}/remove-data`, {
      method: 'POST',
      body: JSON.stringify({ entities: eavGroup.entities }),
    });

    await this.ApiAdapter.fetch(`/community/${app.version}/cmn/eav-groups/${eavGroup.id}`, {
      method: 'DELETE',
    });

    return true;
  };

  removeDataFromGroup = async function (groupKey, attributeKeys = [])
  {
    const eavGroup = await this.getGroup(groupKey);
    const app = getApp();

    const attributeId = attributeKeys
      .map(attrKey => eavGroup.attributes?.find(({ key }) => key === attrKey)?.id)
      .filter(id => id !== null || id !== undefined);

    await this.ApiAdapter.fetch(`/community/${app.version}/cmn/eav-groups/${eavGroup.id}/remove-data`, {
      method: 'POST',
      body: JSON.stringify({ entities: eavGroup.entities, attributeId }),
    });

    return true;
  };

  getGroupIdByKey = async function(groupKey)
  {
    try
    {
      const eavGroup = await this.getGroup(groupKey);

      return eavGroup.id;
    }
    catch
    {
      return null;
    }
  };
};

module.exports = Eav;
