const { getApp, getContext, getRequest } = require('#backend/utils/context.js');
const ErpApi = require('#backend/api/ErpApi.js');

const Migrator = class
{
  migrationResults = {};

  ApiAdapter = ErpApi;

  constructor(key)
  {
    this.key = key;

    this.req = getRequest();
    this.app = getApp();
  }

  setMigration = async function (key, callback)
  {
    const migration = `${this.key}.${key}`;

    if (await this.ApiAdapter.migration.get(migration))
    {
      return;
    }

    const context = getContext();

    context.migration = migration;

    try
    {
      this.migrationResults[key] = await callback(this.methods, this.migrationResults);

      let note;

      try
      {
        note = JSON.stringify(this.migrationResults[key]);
      }
      catch (error)
      {
        note = null;
      }

      await this.ApiAdapter.migration.set(migration, note);
    }
    catch (error)
    {
      await this.methods.log(`Migration "${migration}" failed\n\n${error.message}`, 'ERROR', error.message);
    }
  };

  methods = {
    log: async (message, level = 'INFO') =>
    {
      const context = getContext();

      await this.app.log(
        message,
        `services/maintenance/install/migrations/${context.migration}`,
        level,
      );
    },

    createEavGroup: async eavGroup =>
    {
      eavGroup = await this.ApiAdapter.eav.setGroup(eavGroup);

      await this.methods.log(`EAV-Group "${eavGroup.label}" with id "${eavGroup.id}" successfully created\n`);

      return eavGroup;
    },

    changeEavGroup: async (groupKey, callback) =>
    {
      const eavGroup = await this.ApiAdapter.eav.changeGroup(groupKey, callback);

      await this.methods.log(`EAV-Group "${eavGroup.label}" with id "${eavGroup.id}" successfully changed\n`);

      return eavGroup;
    },

    deleteEavGroup: async groupKey =>
    {
      const eavGroup = await this.ApiAdapter.eav.deleteGroup(groupKey);

      await this.methods.log(`EAV-Group "${groupKey}" successfully deleted\n`);

      return eavGroup;
    },

    createTextEnumGroup: async textEnumGroup =>
    {
      textEnumGroup = await this.ApiAdapter.textenum.setGroup(textEnumGroup);

      await this.methods.log(`Text-Enum-Group "${textEnumGroup.label}" with id "${textEnumGroup.id}" successfully created\n`);

      return textEnumGroup;
    },

    registerWebhook: async (destinationQueue, url) =>
    {
      await this.ApiAdapter.webhook.register(destinationQueue, url);

      await this.methods.log(`Webhook for destination "${destinationQueue}" registered\n`);
    },

    deregisterWebhook: async (destinationQueue, url) =>
    {
      await this.ApiAdapter.webhook.deregister(destinationQueue, url);

      await this.methods.log(`Webhook for destination "${destinationQueue}" deregistered\n`);
    },

    createSalesChannelBackend: async label =>
    {
      const { data: salesChannelBackend } = await this.ApiAdapter.fetch('/erp/sales-channels/backend', {
        method: 'POST',
        body: JSON.stringify({
          appId: this.app.client.appIdentifier,
          label,
          type: 'APP',
          active: true,
        }),
      });

      await this.methods.log(`Sales-Channel-Backend with id "${salesChannelBackend.id}" successfully created\n`);

      return salesChannelBackend;
    },

    createSalesChannel: async (salesChannelBackend, label, description, channelType = 'ECOMMERCE') =>
    {
      const { data: salesChannel } = await this.ApiAdapter.fetch('/erp/sales-channels', {
        method: 'POST',
        body: JSON.stringify({
          label,
          description,
          active: true,
          channelType,
          channelBackend: { id: salesChannelBackend.id },
          externalRef: '',
        }),
      });

      await this.methods.log(`Sales-Channel with id "${salesChannel.id}" successfully created\n`);

      return salesChannel;
    },

    getSalesChannels: async () =>
    {
      const { data: salesChannels } = await this.ApiAdapter.vql({
        statement: `
          SELECT id,
                 label
            FROM sales-channel.salesChannels 
            WHERE channelBackend.appId = '${this.app.client.appIdentifier}'
              AND channelBackend.type = 'APP'
        `,
      });

      return salesChannels;
    },

    findSalesChannelBackend: async () =>
    {
      const { data: salesChannelBackends } = await this.ApiAdapter.vql({
        statement: `
          SELECT id
            FROM sales-channel.salesChannelBackends 
            WHERE appId = '${this.app.client.appIdentifier}'
              AND type = 'APP'
        `,
      });

      return salesChannelBackends?.[0];
    },

    getSalesChannelBackend: async salesChannelBackendId =>
    {
      const { data: salesChannelBackend } = await this.ApiAdapter.fetch(`/erp/sales-channels/backend/${salesChannelBackendId}`);

      if (salesChannelBackend)
      {
        await this.methods.log(`Use existing Sales-Channel-Backend with id "${salesChannelBackend.id}"\n`);
      }

      return salesChannelBackend;
    },

    activateSalesChannelBackend: async salesChannelBackend =>
    {
      await this.ApiAdapter.fetch(`/erp/sales-channels/backend/${salesChannelBackend.id}/activate`, {
        method: 'PUT',
        body: '{}',
      });
    },

    createMultipartImportPreset: async importMultipartPresetTemplate =>
    {
      const { data: importMultipartPreset } = await this.ApiAdapter.fetch(
        '/cmn/data-import/runs/multi-part',
        {
          useInternalApi: true,
          method: 'POST',
          body: JSON.stringify(importMultipartPresetTemplate),
        });

      await this.methods.log(`Import-Multipart-Preset with id "${importMultipartPreset.id}" successfully created\n`);

      return importMultipartPreset;
    },

    createFinanceBackend: async label =>
    {
      const { data: finance } = await this.ApiAdapter.fetch('/erp/finance/backend', {
        method: 'POST',
        body: JSON.stringify({
          label,
          usePerformanceDate: false,
          appId: this.app.client.appIdentifier,
        }),
      });

      await this.methods.log(`Finance Backend with id "${finance.id}" successfully created\n`);

      return finance;
    },

    changeFinanceBackend: async (label, description) =>
    {
      const body = {
        adhocPreset: {
          queryPredicate: {
            type: 'JUNCTION',
            operator: 'AND',
            children: [
              {
                type: 'FILTER',
                property: 'label',
                operator: 'EQUALS',
                values: [
                  label,
                ],
              },
            ],
          },
        },
      };

      const { data: financeBackend } = await this.ApiAdapter.fetch(
        '/cmn/computed-queries/finance-export/backends',
        {
          method: 'POST',
          useInternalApi: true,
          body,
        },
      );

      const { data: finance } = await this.ApiAdapter.fetch(`/erp/finance/backend/${financeBackend?.data?.[0].id}`, {
        method: 'PUT',
        body: JSON.stringify({
          label,
          description,
          usePerformanceDate: false,
          appId: this.app.client.appIdentifier,
        }),
      });

      await this.methods.log(`Finance Backend with id "${finance.id}" successfully created\n`);

      return finance;
    },

    updateMultipartImportPreset: async (id, importMultipartPresetTemplate) =>
    {
      const { data: importMultipartPreset } = await this.app.erp.fetch(
        `/cmn/data-import/runs/multi-part/${id}`,
        {
          useInternalApi: true,
          method: 'PUT',
          body: JSON.stringify(importMultipartPresetTemplate),
        });

      await this.methods.log(`Import-Multipart-Preset with id "${importMultipartPreset.id}" successfully updated\n`);

      return importMultipartPreset;
    },

    addAppScriptingTrigger: async (triggerId, script) =>
    {
      await this.ApiAdapter.fetch(
        '/community/latest/cmn/system/app-scripting-proxy',
        {
          useInternalApi: true,
          method: 'POST',
          body: JSON.stringify({
            appIdentifier: this.app.client.appIdentifier,
            triggerId,
            script,
          }),
        });

      await this.methods.log(`App-Script-Trriger with id "${triggerId}" successfully updated\n`);
    },
  };
};

module.exports = Migrator;
