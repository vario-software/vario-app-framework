class PromiseSingletonMap
{
  constructor()
  {
    this.promiseMap = new Map();
  }

  /**
   * Executes the function only once per key.
   * On parallel access, the existing promise is returned.
   */
  run(key, fn)
  {
    if (this.promiseMap.has(key))
    {
      return this.promiseMap.get(key);
    }

    const promise = fn().finally(() =>
    {
      this.promiseMap.delete(key);
    });

    this.promiseMap.set(key, promise);

    return promise;
  }
}

module.exports = PromiseSingletonMap;
