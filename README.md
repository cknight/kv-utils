# kv-utils

Collection of utilities for working with Deno KV.

## multiSet

Set multiple key/value pairs into KV. Sets are grouped together into
transactions for higher performance than setting individually.

```ts
import {
  MultiResult,
  multiSet,
} from "https://raw.githubusercontent.com/cknight/kv-utils/1.0.0/mod.ts";

const keyValues = new Map<Deno.KvKey, unknown>();
for (let i = 0; i < 100; i++) {
  keyValues.set(["key", i], `value-${i}`);
}
const result: MultiResult = await multiSet(keyValues);

if (!result.ok) {
  const failedToInsertKeys = result.failedKeys;
  // ....
}
```

## multiDelete

Delete multiple key/value pairs from KV. Deletes are grouped together into
transactions for higher performance than deleting individually.

Delete from an array of keys:

```ts
import { multiDelete } from "https://raw.githubusercontent.com/cknight/kv-utils/1.0.0/mod.ts";

const keys: Deno.KvKey[] = [];
for (let i = 0; i < 100; i++) {
  keys.push(["key", i]);
}
const result = await multiDelete(keys);

if (!result.ok) {
  const failedToDeleteKeys = result.failedKeys;
  // ....
}
```

Or delete from a
[list selector](https://deno.land/api?unstable=&s=Deno.KvListSelector)

```ts
import { multiDelete } from "https://raw.githubusercontent.com/cknight/kv-utils/1.0.0/mod.ts";

const result = await multiDelete({ prefix: ["key"], end: ["key", 1] });

if (!result.ok) {
  const failedToDeleteKeys = result.failedKeys;
  // ....
}
```

## wipeKvStore

A shorthand, explicit, way to clear your KV store of all data.

**Warning**: This will remove all data from your KV store!

```ts
import { wipeKvStore } from "https://raw.githubusercontent.com/cknight/kv-utils/1.0.0/mod.ts";

const result = await wipeKvStore();

if (!result.ok) {
  const keysWhichWereNotDeleted = result.failedKeys;
  // ....
}
```

## count

For a given
[list selector](https://deno.land/api?unstable=&s=Deno.KvListSelector), count
the number of matching keys. Note, this works by fetching all the data and then
counting it, which is inefficient but all we have to work with at this stage.
Keep an eye on [this issue](https://github.com/denoland/deno/issues/18965) which
proposes a native count function in KV.

```ts
import { count } from "https://raw.githubusercontent.com/cknight/kv-utils/1.0.0/mod.ts";

const keyCount = await count({ prefix: ["key"] });
```

## countAll

A shorthand function to count all keys in KV.

```ts
import { countAll } from "https://raw.githubusercontent.com/cknight/kv-utils/1.0.0/mod.ts";

const numOfKeys = await countAll();
```
