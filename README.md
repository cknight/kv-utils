# kv-utils

Collection of utilities for working with Deno KV.

## multiSet

Set multiple key/value pairs into KV. The key/value pairs are grouped together
into transactions for higher performance over setting individually as this
reduces network traversal. For large sets of data this is up to 400x faster than
setting keys individually.

```ts
import {
  MultiResult,
  multiSet,
} from "https://deno.land/x/kv_utils@1.1.1/mod.ts";

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
transactions for higher performance over deleting individually as this reduces
network traversal. For large sets of data this is up to 400x faster than deleting
keys individually.

Delete from an array of keys:

```ts
import { multiDelete } from "https://deno.land/x/kv_utils@1.1.1/mod.ts";

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

Or delete all matches from a
[list selector](https://deno.land/api?unstable=&s=Deno.KvListSelector)

```ts
import { multiDelete } from "https://deno.land/x/kv_utils@1.1.1/mod.ts";

const result = await multiDelete({ prefix: ["key"], end: ["key", 7] });

if (!result.ok) {
  const failedToDeleteKeys = result.failedKeys;
  // ....
}
```

## replaceLocalDataWithRemote

This utility will either:

1. Delete all local KV data, and replace it with all data at a remote KV
   instance
2. Delete all local KV data matching any prefix passed in (preserving any data
   which does not match), and inserting any remote KV data which matches any
   prefix passed in.

Replace all local data with remote data:

```ts
import { replaceLocalDataWithRemote } from "https://deno.land/x/kv_utils@1.1.1/mod.ts";

const kvUUID = "910c3c46-e7b9-4339-a4ff-41da05ae7f30"; //Replace with your own KV UUID
const remoteKvUrl = `https://api.deno.com/databases/${kvUUID}/connect`;
const result = await replaceLocalDataWithRemote(remoteKvUrl);

if (!result.ok) {
  const failedKeys = result.failedKeys;
  // ...
}
```

This code will delete all user and session data on the local KV and replace with
the remote user and session data. Other data is unaffected:

```ts
import { replaceLocalDataWithRemote } from "https://deno.land/x/kv_utils@1.1.1/mod.ts";

const kvUUID = "910c3c46-e7b9-4339-a4ff-41da05ae7f30"; //Replace with your own KV UUID
const remoteKvUrl = `https://api.deno.com/databases/${kvUUID}/connect`;
const result = await replaceLocalDataWithRemote(remoteKvUrl, [{
  prefix: ["user"],
}, { prefix: ["session"] }]);

if (!result.ok) {
  const failedKeys = result.failedKeys;
  // ...
}
```

## wipeKvStore

A shorthand, explicit, way to clear your KV store of all data.

**Warning**: This will remove all data from your KV store. There is no recovery.

```ts
import { wipeKvStore } from "https://deno.land/x/kv_utils@1.1.1/mod.ts";

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
counting it, which is very inefficient. This is useful in test scenarios, but in
production code you should keep track of row counts in a separate key entry
which gets atomically incremented/decremented in a transaction alongside any
`set` or `delete` operations.

See also [this issue](https://github.com/denoland/deno/issues/18965) which
proposes a native count function in KV.

```ts
import { count } from "https://deno.land/x/kv_utils@1.1.1/mod.ts";

const keyCount = await count({ prefix: ["key"] });
```

## countAll

A shorthand function to count all keys in KV. Note, this works by fetching all
the data and then counting it, which is very inefficient. This is useful in test
scenarios, but in production code you should keep track of row counts in a
separate key entry which gets atomically incremented/decremented in a
transaction alongside any `set` or `delete` operations.

```ts
import { countAll } from "https://deno.land/x/kv_utils@1.1.1/mod.ts";

const numOfKeys = await countAll();
```
