const Eav = class
{
  constructor(ApiAdapter)
  {
    this.ApiAdapter = ApiAdapter;
  }

  setGroup = async function(eavGroup)
  {
    const existingGroup = await this.getGroupIdByKey(eavGroup.key);

    if (existingGroup)
    {
      eavGroup.id = existingGroup;

      return eavGroup;
    }

    eavGroup = await this.ApiAdapter.fetch('/cmn/eav-groups', {
      method: 'POST',
      body: JSON.stringify(eavGroup),
    });

    return eavGroup.data;
  };

  changeGroup = async function (groupKey, callback)
  {
    let { data: eavGroup } = await this.ApiAdapter.fetch(`/cmn/eav-groups/by-key/${groupKey}`, {
      method: 'GET',
    });

    eavGroup = callback(eavGroup);

    eavGroup = await this.ApiAdapter.fetch(`/cmn/eav-groups/${eavGroup.id}`, {
      method: 'PUT',
      body: JSON.stringify(eavGroup),
    });

    return eavGroup.data;
  };

  deleteGroup = async function (groupKey)
  {
    const { data: eavGroup } = await this.ApiAdapter.fetch(`/cmn/eav-groups/by-key/${groupKey}`);

    await this.ApiAdapter.fetch(`/cmn/eav-groups/${eavGroup.id}/remove-data`, {
      method: 'POST',
      body: JSON.stringify({ entities: eavGroup.entities }),
    });

    await this.ApiAdapter.fetch(`/cmn/eav-groups/${eavGroup.id}`, {
      method: 'DELETE',
    });

    return true;
  };

  getGroupIdByKey = async function(groupKey)
  {
    try
    {
      const { data: eavGroup } = await this.ApiAdapter.fetch(`/cmn/eav-groups/by-key/${groupKey}`);

      return eavGroup.id;
    }
    catch
    {
      return null;
    }
  };
};

module.exports = Eav;
