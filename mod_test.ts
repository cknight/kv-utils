import { assertEquals } from "https://deno.land/std@0.193.0/testing/asserts.ts";
import { test } from "./test_deps.ts";
import {
  count,
  countAll,
  multiDelete,
  multiSet,
  replaceLocalDataWithRemote,
  wipeKvStore,
} from "./mod.ts";

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
  },
});

test({
  name: "1000 keys added",
  async fn(t) {
    await resetDatabase(t);
    await t.step("1000 keys added", async () => {
      assertEquals(await countAll(), 0);
      const keyValues = new Map();
      for (let i = 0; i < 1000; i++) {
        keyValues.set([`key${i}`], `value${i}`);
      }
      await multiSet(keyValues);
      assertEquals(await countAll(), 1000);
    });
  },
});

test({
  name: "1015 keys added",
  async fn(t) {
    await resetDatabase(t);
    await insert1015Keys(t);
  },
});

test({
  name: "0 keys deleted",
  async fn(t) {
    await resetDatabase(t);
    await insert1015Keys(t);
    await t.step("0 keys deleted", async () => {
      await multiDelete([]);
      assertEquals(await countAll(), 1015);
    });
  },
});

test({
  name: "1 key deleted",
  async fn(t) {
    await resetDatabase(t);
    await insert1015Keys(t);
    await t.step("1 key deleted", async () => {
      await multiDelete([["key", 1]]);
      assertEquals(await countAll(), 1014);
    });
  },
});

test({
  name: "10 keys deleted",
  async fn(t) {
    await resetDatabase(t);
    await insert1015Keys(t);
    await t.step("10 keys deleted", async () => {
      const keys = [];
      for (let i = 0; i < 10; i++) {
        keys.push([`key`, i]);
      }
      await multiDelete(keys);
      assertEquals(await countAll(), 1005);
    });
  },
});

test({
  name: "1015 keys deleted",
  async fn(t) {
    await resetDatabase(t);
    await insert1015Keys(t);
    await t.step("1015 keys deleted", async () => {
      // add 1 additional key which won't be deleted
      await multiSet(new Map([[["asdf"], "asdf"]]));
      assertEquals(await countAll(), 1016);

      const keys = [];
      for (let i = 0; i < 1015; i++) {
        keys.push([`key`, i]);
      }
      await multiDelete(keys);
      assertEquals(await countAll(), 1);
    });
  },
});

test({
  name: "0 keys deleted from list",
  async fn(t) {
    await resetDatabase(t);
    await insert1015Keys(t);
    await t.step("0 keys deleted from list", async () => {
      await multiDelete({ prefix: ["doesNotExist"] });
      assertEquals(await countAll(), 1015);
    });
  },
});

test({
  name: "1 key deleted from list",
  async fn(t) {
    await resetDatabase(t);
    await insert1015Keys(t);
    await t.step("1 key deleted from list", async () => {
      await multiDelete({ prefix: ["key"], end: ["key", 1] });
      assertEquals(await countAll(), 1014);
    });
  },
});

test({
  name: "10 keys deleted from list",
  async fn(t) {
    await resetDatabase(t);
    await insert1015Keys(t);
    await t.step("10 keys deleted from list", async () => {
      await multiDelete({ prefix: ["key"], end: ["key", 10] });
      assertEquals(await countAll(), 1005);
    });
  },
});

test({
  name: "1015 keys deleted from list",
  async fn(t) {
    await resetDatabase(t);
    await insert1015Keys(t);
    await t.step("1015 keys deleted from list", async () => {
      await multiDelete({ prefix: ["key"] });
      assertEquals(await countAll(), 0);
    });
  },
});

test({
  name: "count 0 keys",
  async fn(t) {
    await resetDatabase(t);
    await insert1015Keys(t);
    await t.step("count 0 keys", async () => {
      assertEquals(await count({ prefix: ["doesNotExist"] }), 0);
    });
  },
});

test({
  name: "count 1 key",
  async fn(t) {
    await resetDatabase(t);
    await insert1015Keys(t);
    await t.step("count 1 key", async () => {
      assertEquals(await count({ prefix: ["key"], end: ["key", 1] }), 1);
    });
  },
});

test({
  name: "count 10 keys",
  async fn(t) {
    await resetDatabase(t);
    await insert1015Keys(t);
    await t.step("count 10 keys", async () => {
      assertEquals(await count({ prefix: ["key"], end: ["key", 10] }), 10);
    });
  },
});

test({
  name: "Replace entire local database with remote data",
  async fn(t) {
    await resetDatabase(t);

    const origDenoOpenKv = Deno.openKv;
    const inMemKv = await Deno.openKv(":memory:");
    try {
      Deno.openKv = async (path?: string) => {
        if (path === ":memory:") {
          return inMemKv;
        }
        return origDenoOpenKv(path);
      };
  
      await t.step("Populate remote database", async () => {
        for (let i = 0; i < 1015; i++) {
          inMemKv.set([`remoteKey`, i], `value${i}`);
        }
        let count = 0;
        for await (const _ of inMemKv.list({prefix: []})) {
          count++;
        }
        assertEquals(count, 1015);
      });
  
      await insert1015Keys(t);
  
      await t.step("Replace entire local database with remote data", async () => {
        const result = await replaceLocalDataWithRemote(":memory:");
        assertEquals(result.ok, true);
        assertEquals(await countAll(), 1015);
        assertEquals(await count({ prefix: ["remoteKey"] }), 1015);
      });
      } finally {
        Deno.openKv = origDenoOpenKv;
        inMemKv.close();
      }
  }
});

test({
  name: "Replace part of local database with remote data",
  async fn(t) {
    await resetDatabase(t);

    const origDenoOpenKv = Deno.openKv;
    const inMemKv = await Deno.openKv(":memory:");
    const kv = await Deno.openKv();

    try {
      Deno.openKv = async (path?: string) => {
        if (path === ":memory:") {
          return inMemKv;
        }
        return origDenoOpenKv(path);
      };
  
      await t.step("Populate remote database", async () => {
        for (let i = 0; i < 1015; i++) {
          inMemKv.set([`key`, i], `remote value${i}`);
        }
        let count = 0;
        for await (const _ of inMemKv.list({prefix: []})) {
          count++;
        }
        assertEquals(count, 1015);
      });
  
      await insert1015Keys(t);
      await kv.set(["keep", "this", "key"], "value");

      await t.step("Replace matching local database keys with remote data", async () => {
        const result = await replaceLocalDataWithRemote(":memory:", [{prefix: ["key"]}]);
        assertEquals(result.ok, true);
        assertEquals(await countAll(), 1016);
        assertEquals(await count({ prefix: ["key"] }), 1015);
        assertEquals(await count({ prefix: ["keep"] }), 1);
        assertEquals((await kv.get(["key", 1])).value, "remote value1");
      });
      } finally {
        Deno.openKv = origDenoOpenKv;
        inMemKv.close();
        kv.close();
      }
  }
});



async function resetDatabase(t: Deno.TestContext) {
  await t.step("Reset database", async () => {
    await wipeKvStore();
    assertEquals(await countAll(), 0);
  });
}

async function insert1015Keys(t: Deno.TestContext) {
  await t.step("insert 1015 keys", async () => {
    const keyValues = new Map();
    for (let i = 0; i < 1015; i++) {
      keyValues.set([`key`, i], `value${i}`);
    }
    await multiSet(keyValues);
    assertEquals(await countAll(), 1015);
  });
}
