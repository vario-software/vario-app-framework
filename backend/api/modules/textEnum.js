const { getApp } = require('#backend/utils/context.js');
const HttpError = require('#backend/utils/httpError.js');

const TextEnum = class
{
  constructor(ApiAdapter)
  {
    this.ApiAdapter = ApiAdapter;
  }

  get = async function(key)
  {
    if (!key)
    {
      throw new HttpError(
        'MISSING_TEXT_ENUM_GROUP_KEY',
        400,
        'backend/api/modules/textEnum',
      );
    }

    const { data } = await this.getAll({ limit: 1, key });

    return data[0];
  };

  getAll = async function({ offset = 0, limit = 10, key })
  {
    const { data, moreElements, nextOffset } = await this.ApiAdapter.vql({
      statement: `
            SELECT
              --v:result{displayname='id'}
              id,
              --v:result{displayname='label'}
              label,
              --v:result{displayname='key'}
              key
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
    const app = getApp();

    let textEnumGroup = await this.get(textEnumGroupTemplate.key);

    if (textEnumGroup)
    {
      await this.removeEnums(textEnumGroup);

      const response = await this.ApiAdapter.fetch(
        `/community/${app.version}/cmn/masterdata/text-enum-groups/${textEnumGroup.id}`,
        {
          body: JSON.stringify(textEnumGroupTemplate),
          method: 'PUT',
        });

      textEnumGroup = response.data;
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
    const app = getApp();

    const response = await this.ApiAdapter.fetch(
      `/community/${app.version}/cmn/masterdata/text-enum-groups`,
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
              --v:result{displayname='id'}
              id,
              --v:result{displayname='entry'}
              entry
            FROM masterdata.query-textenum
  ${groupId ? `WHERE group.id = '${groupId}'` : ''}
            ORDER BY id
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

  getEnumsByGroup = async function(textEnumGroup)
  {
    if (!textEnumGroup?.id)
    {
      return [];
    }

    const textEnums = [];
    let moreElements;

    do
    {
      // eslint-disable-next-line no-await-in-loop
      const page = await this.getAllEnums({ offset: textEnums.length, limit: 500, groupId: textEnumGroup.id });

      textEnums.push(...page.data);
      moreElements = String(page.moreElements) === 'true' && page.data.length > 0;
    }
    while (moreElements);

    return textEnums;
  };

  removeEnums = async function(textEnumGroup)
  {
    const textEnums = await this.getEnumsByGroup(textEnumGroup);

    await textEnums.reduce(async (previousPromise, textEnum) =>
    {
      await previousPromise;

      return this.removeEnum(textEnum);
    }, Promise.resolve());

    return true;
  };

  removeEnum = async function(textEnum)
  {
    const app = getApp();

    return this.ApiAdapter.fetch(
      `/community/${app.version}/cmn/masterdata/text-enums/${textEnum.id}`,
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

      return this.createEnum({ ...textEnum, groupKey: customGroupKey });
    }, Promise.resolve());

    return true;
  };

  createEnum = async function(textEnum)
  {
    const app = getApp();

    await this.ApiAdapter.fetch(
      `/community/${app.version}/cmn/masterdata/text-enums`,
      {
        body: JSON.stringify(textEnum),
        method: 'POST',
      },
    );
  };
};

module.exports = TextEnum;
