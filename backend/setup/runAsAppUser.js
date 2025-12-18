const { getContext, getApp } = require('#backend/utils/context.js');

async function runAsAppUser(value = true)
{
  const context = getContext();

  if (context.runAsAppUser !== value)
  {
    context.runAsAppUser = value;

    const app = getApp();

    await app.log(
      `set "runAsAppUser" to "${value}"`,
      'setup/runAsAppUser',
      'INFO',
    );
  }
}

module.exports = runAsAppUser;
