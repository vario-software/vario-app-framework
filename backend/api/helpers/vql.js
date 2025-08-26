async function vql({ statement, variableSubstitutions = [], limit = null, offset = null })
{
  const payload = {
    statement,
    variableSubstitutionList: {
      variableSubstitutions,
    },
  };

  if (limit)
  {
    payload.limit = limit;
  }

  if (offset > 0)
  {
    payload.offset = offset;
  }

  const result = await this.fetch('/cmn/computed-queries/execute', {
    useInternalApi: true,
    method: 'POST',
    body: JSON.stringify(payload),
  });

  return {
    ...result.data,
    data: mapDisplayName(result.data.definition, result.data.data),
    moreElements: result.response.headers['x-query-more-elements'],
    nextOffset: result.response.headers['x-query-next-offset'],
  };
}

module.exports = vql;

function mapDisplayName(definition, items)
{
  const transformedArray = [];

  items.forEach(item =>
  {
    const newItem = {};

    definition.forEach(def =>
    {
      if (item[def.attribute] !== null && item[def.attribute] !== undefined)
      {
        newItem[def.displayName] = item[def.attribute];
      }
      // Special Case: Computed Array of Objects (i.e. contacts)
      else if (def.definition && def._type === 'meta' && item[def.definition.path])
      {
        newItem[def.definition.displayName] = item[def.definition.path];
      }
    });

    transformedArray.push(newItem);
  });

  return transformedArray;
}
