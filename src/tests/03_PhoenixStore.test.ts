import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import { PhoenixStore } from "../core/PhoenixStore";
import { getTestDbUri, setup, teardown } from "./setup";
import { config } from "../utils/config";
import { MongoAdapter } from "../adapters/MongoAdapter";

describe("PhoenixStore", () => {
  const adapter = new MongoAdapter(getTestDbUri(), `${config.MONGODB_DATABASE}_test`);
  const store = new PhoenixStore(adapter);

  beforeAll(async () => {
    await setup();
    await adapter.connect();
    await store.connect();
  });

  afterAll(async () => {
    await store.disconnect();
    await adapter.disconnect();
    await teardown();
  });

  describe("Collection Operations", () => {
    const getTestCollection = () => `test_collection_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const testData = {
      name: "Test User",
      email: "test@example.com",
      age: 25
    };

    test("should add a document to collection", async () => {
      const collection = getTestCollection();
      const users = store.collection(collection);
      const id = await users.add(testData);
      expect(id).toBeDefined();
      expect(typeof id).toBe("string");
    });

    test("should retrieve a document from collection", async () => {
      const collection = getTestCollection();
      const users = store.collection(collection);
      const id = await users.add(testData);
      const doc = await users.doc(id).get();
      
      expect(doc.id).toBe(id);
      const data = doc.data();
      expect(data).toBeDefined();
      expect(data?.name).toBe(testData.name);
      expect(data?.email).toBe(testData.email);
      expect(data?.age).toBe(testData.age);
    });

    test("should update a document in collection", async () => {
      const collection = getTestCollection();
      const users = store.collection(collection);
      const id = await users.add(testData);
      const updateData = { name: "Updated Name" };
      
      await users.doc(id).update(updateData);
      const doc = await users.doc(id).get();
      const data = doc.data();
      
      expect(data?.name).toBe(updateData.name);
      expect(data?.email).toBe(testData.email); // Original field should remain
      expect(data?.age).toBe(testData.age); // Original field should remain
    });

    test("should delete a document from collection", async () => {
      const collection = getTestCollection();
      const users = store.collection(collection);
      const id = await users.add(testData);
      
      await users.doc(id).delete();
      const doc = await users.doc(id).get();
      expect(doc.data()).toBeNull();
    });

    test("should handle type-safe operations", async () => {
      interface User {
        name: string;
        email: string;
        age: number;
      }

      const collection = getTestCollection();
      const users = store.collection<User>(collection);
      const id = await users.add(testData);
      const doc = await users.doc(id).get();
      const data = doc.data();
      
      // TypeScript should infer these types correctly
      if (data) {
        expect(typeof data.name).toBe("string");
        expect(typeof data.email).toBe("string");
        expect(typeof data.age).toBe("number");
      }
    });
  });
});
