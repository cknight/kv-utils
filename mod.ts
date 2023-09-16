const kv = await Deno.openKv();

export interface MultiResult {
  ok: boolean;
  failedKeys?: Deno.KvKey[];
}

const MAX_NUM_TRANSACTIONS = 1000;
const MAX_KV_VALUE_SIZE = 1024 * 64; //bytes (64kb)
const MAX_TRANSACTION_SIZE = 819000; //bytes
const SIZE_LIMIT = MAX_TRANSACTION_SIZE - MAX_KV_VALUE_SIZE;

/**
 * Set multiple key value pairs into the KV store
 * @param keyValues Map of key value pairs to insert
 * @returns object with ok property indicating success or failure and optional failedKeys
 *          property containing keys that failed to insert
 */
export async function multiSet(
  keyValues: Map<Deno.KvKey, unknown>,
): Promise<MultiResult> {
  let atomic = kv.atomic();
  let count = 0;
  let transactionSize = 0;
  let keysInAction = [];
  const failedKeys: Deno.KvKey[] = [];
  for (const [key, value] of keyValues) {
    atomic.set(key, value);
    keysInAction.push(key);
    transactionSize += computeTransactionSize(value);
    if (++count == MAX_NUM_TRANSACTIONS || transactionSize > SIZE_LIMIT) {
      try {
        await atomic.commit();
      } catch (e) {
        failedKeys.push(...await retrySetIndividually(keysInAction, keyValues));
      }
      atomic = kv.atomic();
      count = 0;
      transactionSize = 0;
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

  return failedKeys.length > 0
    ? { ok: false, failedKeys: failedKeys }
    : { ok: true };
}

/**
 * Delete multiple key value pairs from the KV store based on array of keys or a list selector
 * @param source list of keys to delete or prefix selector
 * @returns object with ok property indicating success or failure and optional failedKeys
 *          property containing keys that failed to delete
 */
export async function multiDelete(
  source: Deno.KvKey[] | Deno.KvListSelector,
): Promise<MultiResult> {
  let atomic = kv.atomic();
  let count = 0;
  let transactionSize = 0;
  let keysInAction = [];
  const failedKeys: Deno.KvKey[] = [];
  let keys: Deno.KvKey[] = [];

  if (source instanceof Array) {
    keys = source;
  } else {
    for await (const entry of kv.list(source)) {
      keys.push(entry.key);
    }
  }

  for (const key of keys) {
    atomic.delete(key);
    keysInAction.push(key);
    transactionSize += computeTransactionSize(key);
    if (++count == MAX_NUM_TRANSACTIONS || transactionSize > SIZE_LIMIT) {
      try {
        await atomic.commit();
      } catch (e) {
        failedKeys.push(...await retryDeleteIndividually(keysInAction));
      }
      atomic = kv.atomic();
      count = 0;
      transactionSize = 0;
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

  return failedKeys.length > 0
    ? { ok: false, failedKeys: failedKeys }
    : { ok: true };
}

/**
 * Wipe the entire KV store. THIS DELETES ALL DATA IN THE KV STORE.  THERE IS NO RECOVERY.
 * @returns object with ok property indicating success or failure and optional failedKeys
 *          property containing keys that failed to delete
 */
export async function wipeKvStore(): Promise<MultiResult> {
  return await multiDelete({ prefix: [] });
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
  return await count({ prefix: [] });
}

/**
 * If prefixes are supplied, all matching prefixed key entries are deleted from the local
 * KV store and replaced with any matching prefixed key/values from the remote KV store.
 * If no prefixes are supplied, all keys are deleted from the local KV store and
 * replaced with all key/values from the remote KV store.  NOTE: this requires that
 * you have a personal access token (PAT) associated with the remote KV store, setup as
 * an environment variable named DENO_KV_ACCESS_TOKEN.
 * @param remoteKvUrl Connection URL of remote KV store
 * @param prefixes Optional list of prefixes to delete and populate from remote KV store.
 *                 Defaults to all keys.
 * @returns object with ok property indicating success or failure and optional list of failedKeys
 */
export async function replaceLocalDataWithRemote(
  remoteKvUrl: string,
  prefixes?: Deno.KvListSelector[],
): Promise<MultiResult> {
  const data: Map<Deno.KvKey, unknown> = new Map();
  const failedKeys: Deno.KvKey[] = [];

  if (prefixes) {
    for (const prefix of prefixes) {
      const result = await multiDelete(prefix);
      if (!result.ok) {
        console.log(`Failed to delete all keys for prefix ${prefix}`);
        failedKeys.push(...result.failedKeys!);
      }
    }
  } else {
    await wipeKvStore();
  }
  const remoteKv = await Deno.openKv(remoteKvUrl);

  if (prefixes) {
    for (const prefix of prefixes) {
      for await (
        const entry of remoteKv.list(prefix, {
          consistency: "eventual",
        })
      ) {
        data.set(entry.key, entry.value);
      }
    }
  } else {
    for await (
      const entry of remoteKv.list({ prefix: [] }, {
        consistency: "eventual",
      })
    ) {
      data.set(entry.key, entry.value);
    }
  }

  const result = await multiSet(data);

  if (!result.ok) {
    console.log(
      `Failed to set ${failedKeys.length} keys from remote KV store.`,
    );
    failedKeys.push(...result.failedKeys!);
  }
  console.log(
    `Added ${data.size - failedKeys.length} entries to local KV store.`,
  );

  return failedKeys.length > 0
    ? { ok: false, failedKeys: failedKeys }
    : { ok: true };
}

async function retrySetIndividually(
  keys: Deno.KvKey[],
  keyValues: Map<Deno.KvKey, unknown>,
): Promise<Deno.KvKey[]> {
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

async function retryDeleteIndividually(
  keys: Deno.KvKey[],
): Promise<Deno.KvKey[]> {
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

function computeTransactionSize(value: unknown): number {
  return JSON.stringify(value).length;
}
