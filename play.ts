import { MultiResult, multiSet } from "https://raw.githubusercontent.com/cknight/kv-utils/1.0.0/mod.ts";
const keyValues = new Map<Deno.KvKey, unknown>();
for (let i = 0; i < 100; i++) {
  keyValues.set(["key", i], `value-${i}`);
}
const result: MultiResult = await multiSet(keyValues);

if (!result.ok) {
  const failedToInsertKeys = result.failedKeys;
  // ....
}