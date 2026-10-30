const { getContext } = require('#backend/utils/context.js');

/* The migrator catches a failing migration so it does not keep the following
 * ones from running, and collects the outcome on the context. The install
 * endpoints hand that outcome to the UI, which warns about the failed ones. */
function getMigrationResult()
{
  const { success = [], failed = [] } = getContext()?.migrationResult ?? {};

  return { success, failed };
}

module.exports = { getMigrationResult };
