import { assertEquals } from "https://deno.land/std@0.193.0/testing/asserts.ts";
import { test } from "./test_deps.ts";
import { multiDelete, multiSet, count, countAll, wipeKvStore, MultiResult } from "./mod.ts";

test({
  name: "No keys added - empty map",
  async fn(t) {
    await resetDatabase(t);
    await t.step("No keys added - empty map", async () => {
      assertEquals(await countAll(), 0);
      await multiSet(new Map());
      assertEquals(await countAll(), 0);
    });
  },
});

test({
  name: "1 key added",
  async fn(t) {
    await resetDatabase(t);
    await t.step("1 key added", async () => {
      assertEquals(await countAll(), 0);
      await multiSet(new Map([[["asdf"], "asdf"]]));
      assertEquals(await countAll(), 1);
    });
  }
});

test({
  name: "10 keys added",
  async fn(t) {
    await resetDatabase(t);
    await t.step("10 keys added", async () => {
      assertEquals(await countAll(), 0);
      const keyValues = new Map();
      for (let i = 0; i < 10; i++) {
        keyValues.set([`key${i}`], `value${i}`);
      }
      await multiSet(keyValues);
      assertEquals(await countAll(), 10);
    });
  }
});

test({
  name: "115 keys added",
  async fn(t) {
    await resetDatabase(t);
    await insert115Keys(t);
  }
});

test({
  name: "0 keys deleted",
  async fn(t) {
    await resetDatabase(t);
    await insert115Keys(t);
    await t.step("0 keys deleted", async () => {
      await multiDelete([]);
      assertEquals(await countAll(), 115);
    });
  }
});

test({
  name: "1 key deleted",
  async fn(t) {
    await resetDatabase(t);
    await insert115Keys(t);
    await t.step("1 key deleted", async () => {
      await multiDelete([["key", 1]]);
      assertEquals(await countAll(), 114);
    });
  }
});

test({
  name: "10 keys deleted",
  async fn(t) {
    await resetDatabase(t);
    await insert115Keys(t);
    await t.step("10 keys deleted", async () => {
      const keys = [];
      for (let i = 0; i < 10; i++) {
        keys.push([`key`, i]);
      }
      await multiDelete(keys);
      assertEquals(await countAll(), 105);
    });
  }
});

test({
  name: "115 keys deleted",
  async fn(t) {
    await resetDatabase(t);
    await insert115Keys(t);
    await t.step("115 keys deleted", async () => {
      // add 1 additional key which won't be deleted
      await multiSet(new Map([[["asdf"], "asdf"]]));
      assertEquals(await countAll(), 116);

      const keys = [];
      for (let i = 0; i < 115; i++) {
        keys.push([`key`, i]);
      }
      await multiDelete(keys);
      assertEquals(await countAll(), 1);
    });
  }
});

test({
  name: "0 keys deleted from list",
  async fn(t) {
    await resetDatabase(t);
    await insert115Keys(t);
    await t.step("0 keys deleted from list", async () => {
      await multiDelete({prefix: ["doesNotExist"]});
      assertEquals(await countAll(), 115);
    });
  }
});

test({
  name: "1 key deleted from list",
  async fn(t) {
    await resetDatabase(t);
    await insert115Keys(t);
    await t.step("1 key deleted from list", async () => {
      await multiDelete({prefix: ["key"], end: ["key", 1]});
      assertEquals(await countAll(), 114);
    });
  }
});

test({
  name: "10 keys deleted from list",
  async fn(t) {
    await resetDatabase(t);
    await insert115Keys(t);
    await t.step("10 keys deleted from list", async () => {
      await multiDelete({prefix: ["key"], end: ["key", 10]});
      assertEquals(await countAll(), 105);
    });
  }
});

test({
  name: "115 keys deleted from list",
  async fn(t) {
    await resetDatabase(t);
    await insert115Keys(t);
    await t.step("115 keys deleted from list", async () => {
      await multiDelete({prefix: ["key"]});
      assertEquals(await countAll(), 0);
    });
  }
});

test({
  name: "count 0 keys",
  async fn(t) {
    await resetDatabase(t);
    await insert115Keys(t);
    await t.step("count 0 keys", async () => {
      assertEquals(await count({prefix: ["doesNotExist"]}), 0);
    });
  }
});

test({
  name: "count 1 key",
  async fn(t) {
    await resetDatabase(t);
    await insert115Keys(t);
    await t.step("count 1 key", async () => {
      assertEquals(await count({prefix: ["key"], end: ["key", 1]}), 1);
    });
  }
});

test({
  name: "count 10 keys",
  async fn(t) {
    await resetDatabase(t);
    await insert115Keys(t);
    await t.step("count 10 keys", async () => {
      assertEquals(await count({prefix: ["key"], end: ["key", 10]}), 10);
    });
  }
});

async function resetDatabase(t:Deno.TestContext) {
  await t.step("Reset database", async () => {
    await wipeKvStore();
    assertEquals(await countAll(), 0);
  });
}

async function insert115Keys(t: Deno.TestContext) {
  await t.step("insert 115 keys", async () => {
    const keyValues = new Map();
    for (let i = 0; i < 115; i++) {
      keyValues.set([`key`, i], `value${i}`);
    }
    await multiSet(keyValues);
    assertEquals(await countAll(), 115);
  });
}