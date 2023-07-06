# kv-utils

Collection of utilities for working with Deno KV.

## multiSet
Set multiple key/value pairs into KV. Sets are grouped together into transactions for higher performance than setting individually.

```ts
const keyValues = new Map();
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
Delete multiple key/value pairs from KV.  Deletes are grouped together into transactions for higher performance than deleting individually.

Delete from an array of keys:
```ts
const keys:Deno.KvKey[]  = [];
for (let i = 0; i < 100; i++) {
  keys.push(["key", i]);
}
const result = await multiDelete(keys);

if (!result.ok) {
  const failedToDeleteKeys = result.failedKeys;
  // ....
}
```

Or delete from a list selector
```ts
const result = await multiDelete({prefix: ["key"], end: ["key", 1]});

if (!result.ok) {
  const failedToDeleteKeys = result.failedKeys;
  // ....
}
```

## wipeKvStore

A shorthand, explicit, way to clear your KV store of all data.  

__Warning__:  This will remove all data from your KV store!

```ts
const result = await wipeKvStore();

if (!result.ok) {
  const keysWhichWereNotDeleted = result.failedKeys;
  // ....
}
```

## count
For a given list selector, count the number of matching keys.  Note, this works by fetching all the data and then counting it, which is inefficient but all we have to work with at this stage.  Keep an eye on [this issue](https://github.com/denoland/deno/issues/18965) which proposes a native count function in KV.

```ts
const keyCount = await count({prefix: ["key"]});
```

## countAll

A shorthand function to count all keys in KV.

```ts
const numOfKeys = await countAll();
```

