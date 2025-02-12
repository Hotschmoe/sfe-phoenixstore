import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import { PhoenixStore } from "../core/PhoenixStore";
import { getTestDbUri, setup, teardown } from "./setup";

describe("PhoenixStore", () => {
  const store = new PhoenixStore(getTestDbUri(), "phoenixstore_test");

  beforeAll(async () => {
    await setup();
    await store.connect();
  });

  afterAll(async () => {
    await store.disconnect();
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
      
      const updateData = { name: "Updated Name", age: 26 };
      await users.doc(id).update(updateData);
      
      const doc = await users.doc(id).get();
      const data = doc.data();
      expect(data?.name).toBe(updateData.name);
      expect(data?.age).toBe(updateData.age);
      expect(data?.email).toBe(testData.email); // Should keep original email
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

      if (data) {
        // TypeScript should recognize these properties
        const name: string = data.name;
        const age: number = data.age;
        expect(typeof name).toBe("string");
        expect(typeof age).toBe("number");
      }
    });
  });
});
