const kv = await Deno.openKv();

export interface BulkResult {
  ok: boolean;
  failedKeys?: Deno.KvKey[];
}

/**
 * Bulk insert key value pairs into the KV store
 * @param keyValues Map of key value pairs to insert
 * @returns object with ok property indicating success or failure and optional failedKeys
 *          property containing keys that failed to insert
 */
export async function bulkSet(keyValues: Map<Deno.KvKey, unknown>): Promise<BulkResult> {
  let atomic = kv.atomic();
  let count = 0;
  let keysInAction = [];
  const failedKeys: Deno.KvKey[] = [];
  for (const [key, value] of keyValues) {
    atomic.set(key, value);
    keysInAction.push(key);
    if (++count == 10) {
      try {
        await atomic.commit();
      } catch (e) {
        failedKeys.push(...await retrySetIndividually(keysInAction, keyValues));
      }
      atomic = kv.atomic();
      count = 0;
      keysInAction = [];        
    }
  }
  if (count > 0) {
    try {
      await atomic.commit();
    } catch (e) {
      failedKeys.push(...await retrySetIndividually(keysInAction, keyValues));
    }
  }

  return failedKeys.length > 0 ? {ok: false, failedKeys: failedKeys} : {ok: true};
}

/**
 * Bulk delete key value pairs from the KV store
 * @param keys list of keys to delete
 * @returns object with ok property indicating success or failure and optional failedKeys
 *          property containing keys that failed to delete
 */
export async function bulkDelete(keys:Deno.KvKey[]): Promise<BulkResult> {
  let atomic = kv.atomic();
  let count = 0;
  let keysInAction = [];
  const failedKeys: Deno.KvKey[] = [];

  for (const key of keys) {
    atomic.delete(key);
    keysInAction.push(key);
    if (++count == 10) {
      try {
        await atomic.commit();
      } catch (e) {
        failedKeys.push(...await retryDeleteIndividually(keysInAction));
      }
      atomic = kv.atomic();
      count = 0;
      keysInAction = [];
    }
  }
  if (count > 0) {
    try {
      await atomic.commit();
    } catch (e) {
      failedKeys.push(...await retryDeleteIndividually(keysInAction));
    }
  }

  return failedKeys.length > 0 ? {ok: false, failedKeys: failedKeys} : {ok: true};
}

/**
 * Bulk delete key value pairs from the KV store based on a prefix selector
 * @param prefix prefix of keys to delete
 * @returns object with ok property indicating success or failure and optional failedKeys
 *          property containing keys that failed to delete
 */
export async function bulkDeleteFromList(prefix: Deno.KvListSelector): Promise<BulkResult> {
  const keys = [];
  for await (const entry of kv.list(prefix)) {
    keys.push(entry.key);
  }

  return bulkDelete(keys);
}

/**
 * Wipe the entire KV store. THIS DELETES ALL DATA IN THE KV STORE.  THERE IS NO RECOVERY.
 * @returns object with ok property indicating success or failure and optional failedKeys
 *          property containing keys that failed to delete
 */
export async function wipeKvStore(): Promise<BulkResult> {
  return await bulkDeleteFromList({prefix: []});
}

/**
 * Count the number of keys in the KV store based on a prefix selector
 * @param prefix prefix of keys to count
 * @returns number of keys
 */
export async function count(prefix: Deno.KvListSelector): Promise<number> {
  let count = 0;
  for await (const _ of kv.list(prefix)) {
    count++;
  }
  return count;
}

/**
 * Count the number of keys in the entire KV store
 * @returns number of keys
 */
export async function countAll(): Promise<number> {
  return await count({prefix: []});
}

async function retrySetIndividually(keys: Deno.KvKey[], keyValues: Map<Deno.KvKey, unknown>): Promise<Deno.KvKey[]> {
  const failedKeys = [];
  for (const key of keys) {
    try {
      await kv.set(key, keyValues.get(key));
    } catch (e) {
      failedKeys.push(key);
    }
  }
  return failedKeys;
}

async function retryDeleteIndividually(keys: Deno.KvKey[]): Promise<Deno.KvKey[]> {
  const failedKeys = [];
  for (const key of keys) {
    try {
      await kv.delete(key);
    } catch (e) {
      failedKeys.push(key);
    }
  }
  return failedKeys;
}
