const TextEnum = class
{
  constructor(ApiAdapter)
  {
    this.ApiAdapter = ApiAdapter;
  }

  get = async function(key)
  {
    const { data } = await this.getAll({ limit: 1, key });

    return data[0];
  };

  getAll = async function({ offset = 0, limit = 10, key })
  {
    const { data, moreElements, nextOffset } = await this.ApiAdapter.vql({
      statement: `
            SELECT
              id,
              label,
              key,
              textEnums.id,
              textEnums.label
            FROM masterdata.query-textenum-group
  ${key ? `WHERE key = '${key}'` : ''}
    `,
      offset,
      limit,
    });

    return {
      data,
      moreElements,
      nextOffset,
    };
  };

  setGroup = async function(textEnumGroupTemplate)
  {
    let textEnumGroup = await this.getEnumGroup(textEnumGroupTemplate.key);

    if (textEnumGroup)
    {
      await this.removeEnums(textEnumGroup);
    }
    else
    {
      textEnumGroup = await this.createGroup(textEnumGroupTemplate);
    }

    return textEnumGroup;
  };

  setEnums = async function(textEnumGroupKey, textEnums)
  {
    await this.createEnums(
      textEnumGroupKey,
      textEnums,
    );
  };

  createGroup = async function(textEnumGroup)
  {
    const response = await this.ApiAdapter.fetch(
      '/cmn/masterdata/text-enum-groups',
      {
        body: JSON.stringify(textEnumGroup),
        method: 'POST',
      });

    return response.data;
  };

  getAllEnums = async function({ offset = 0, limit = 10, groupId })
  {
    const { data, moreElements, nextOffset } = await this.ApiAdapter.vql({
      statement: `
            SELECT
              id,
              entry
            FROM masterdata.query-textenum
  ${groupId ? `WHERE group.id = '${groupId}'` : ''}
    `,
      offset,
      limit,
    });

    return {
      data,
      moreElements,
      nextOffset,
    };
  };

  removeEnums = async function(textEnumGroup)
  {
    const textEnums = await this.getEnumsByGroup(textEnumGroup);

    if (!textEnums)
    {
      return true;
    }

    await textEnums.reduce(async (previousPromise, textEnum) =>
    {
      await previousPromise;

      return this.removeEnum(textEnum);
    }, Promise.resolve());

    return true;
  };

  removeEnum = async function(textEnum)
  {
    return this.ApiAdapter.fetch(
      `/cmn/masterdata/text-enums/${textEnum.id}`,
      {
        method: 'DELETE',
      },
    );
  };

  createEnums = async function(customGroupKey, textEnums)
  {
    await textEnums.reduce(async (previousPromise, textEnum) =>
    {
      await previousPromise;

      return this.createEnum(textEnum);
    }, Promise.resolve());

    return true;
  };

  createEnum = async function(textEnum)
  {
    await this.ApiAdapter.fetch(
      '/cmn/masterdata/text-enums',
      {
        body: JSON.stringify(textEnum),
        method: 'POST',
      },
    );
  };
};

module.exports = TextEnum;
