const { getApp } = require('#backend/utils/context.js');

const Migration = class
{
  constructor(ApiAdapter)
  {
    this.ApiAdapter = ApiAdapter;
  }

  get = async function(identifier)
  {
    const { data } = await this.getAll({ limit: 1, identifier });

    return data[0];
  };

  getAll = async function({ offset = 0, limit = 10, identifier })
  {
    const app = getApp();

    const { data, moreElements, nextOffset } = await this.ApiAdapter.vql({
      statement: `
             SELECT id,
                    identifier
               FROM system.queryAppMigrations
              WHERE id NOTNULL
                AND appIdentifier = '${app.client.appIdentifier}'
${identifier ? `AND identifier = '${identifier}'` : ''}
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

  async getNote(key)
  {
    const app = getApp();

    const { data } = await this.ApiAdapter.vql({
      statement: `
              SELECT note
                FROM system.queryAppMigrations
               WHERE appIdentifier = '${app.client.appIdentifier}'
                 AND identifier = '${key}'
    `,
    });

    let note;

    try
    {
      note = JSON.parse(data[0]?.note);
    }
    catch (error)
    {
      note = null;
    }

    return note;
  }

  set = async function(identifier, note)
  {
    const app = getApp();

    const { data: response } = await this.ApiAdapter.fetch('/cmn/system/app-migration', {
      body: {
        appIdentifier: app.client.appIdentifier,
        identifier,
        executedAt: new Date().toISOString(),
        note,
      },
      method: 'post',
    });

    return response;
  };

  delete = async function(id)
  {
    const { data: response } = await this.ApiAdapter.fetch(`/cmn/system/app-migration/${id}`, {
      method: 'delete',
    });

    return response;
  };
};

module.exports = Migration;
