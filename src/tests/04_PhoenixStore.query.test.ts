import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import { PhoenixStore } from "../core/PhoenixStore";
import { getTestDbUri, setup, teardown } from "./setup";
import { config } from "../utils/config";
import { MongoAdapter } from "../adapters/MongoAdapter";

describe("PhoenixStore Query Operations", () => {
  const adapter = new MongoAdapter(getTestDbUri(), `${config.MONGODB_DATABASE}_test`);
  const store = new PhoenixStore(adapter);
  const collection = `test_collection_${Date.now()}`;

  // Test data
  const testData = [
    { name: "John", age: 25, city: "New York", tags: ["developer"] },
    { name: "Jane", age: 30, city: "London", tags: ["designer"] },
    { name: "Bob", age: 20, city: "Paris", tags: ["developer", "designer"] },
    { name: "Alice", age: 35, city: "New York", tags: ["manager"] },
    { name: "Charlie", age: 28, city: "London", tags: ["developer"] }
  ];

  beforeAll(async () => {
    await setup();
    await adapter.connect();
    await store.connect();
    
    // Insert test data
    const users = store.collection(collection);
    for (const data of testData) {
      await users.add(data);
    }
  });

  afterAll(async () => {
    await store.disconnect();
    await adapter.disconnect();
    await teardown();
  });

  describe("Query Builder Pattern", () => {
    test("should support where clause", async () => {
      const users = store.collection(collection);
      const results = await users
        .where("city", "==", "New York")
        .get();
      
      expect(results.length).toBe(2);
      results.forEach(doc => {
        const data = doc.data();
        expect(data?.city).toBe("New York");
      });
    });

    test("should support chained where clauses", async () => {
      const users = store.collection(collection);
      const results = await users
        .where("age", ">=", 25)
        .where("city", "==", "London")
        .get();
      
      expect(results.length).toBe(2);
      results.forEach(doc => {
        const data = doc.data();
        expect(data?.age).toBeGreaterThanOrEqual(25);
        expect(data?.city).toBe("London");
      });
    });

    test("should support orderBy", async () => {
      const users = store.collection(collection);
      const results = await users
        .orderBy("age", "asc")
        .get();
      
      expect(results.length).toBe(5);
      for (let i = 1; i < results.length; i++) {
        const prevData = results[i-1].data();
        const currData = results[i].data();
        expect(prevData?.age).toBeLessThanOrEqual(currData?.age);
      }
    });

    test("should support limit", async () => {
      const users = store.collection(collection);
      const results = await users
        .orderBy("name", "asc")
        .limit(2)
        .get();
      
      expect(results.length).toBe(2);
    });

    test("should support offset", async () => {
      const users = store.collection(collection);
      const allResults = await users
        .orderBy("name", "asc")
        .get();
      
      const offsetResults = await users
        .orderBy("name", "asc")
        .offset(2)
        .get();
      
      expect(offsetResults.length).toBe(3);
      const firstOffsetData = offsetResults[0].data();
      const thirdOriginalData = allResults[2].data();
      expect(firstOffsetData?.name).toBe(thirdOriginalData?.name);
    });
  });

  describe("Complex Queries", () => {
    test("should combine where, orderBy, and limit", async () => {
      const users = store.collection(collection);
      const results = await users
        .where("age", ">=", 25)
        .orderBy("age", "desc")
        .limit(2)
        .get();
      
      expect(results.length).toBe(2);
      const docs = results.map(doc => doc.data());
      expect(docs[0]?.age).toBeGreaterThan(docs[1]?.age);
      docs.forEach(doc => expect(doc?.age).toBeGreaterThanOrEqual(25));
    });

    test("should handle in operator with multiple values", async () => {
      const users = store.collection(collection);
      const results = await users
        .where("city", "in", ["London", "Paris"])
        .get();
      
      expect(results.length).toBe(3);
      results.forEach(doc => {
        const data = doc.data();
        expect(["London", "Paris"]).toContain(data?.city);
      });
    });
  });

  describe("Advanced Query Patterns", () => {
    test("should handle complex chaining with multiple conditions", async () => {
      const users = store.collection(collection);
      const results = await users
        .where("age", ">=", 25)
        .where("tags", "array-contains", "developer")
        .orderBy("age", "desc")
        .limit(2)
        .get();
      
      expect(results.length).toBeLessThanOrEqual(2);
      results.forEach(doc => {
        const data = doc.data();
        expect(data?.age).toBeGreaterThanOrEqual(25);
        expect(data?.tags).toContain("developer");
      });
    });

    test("should maintain query immutability", async () => {
      const users = store.collection(collection);
      const baseQuery = users.where("age", ">=", 25);
      
      const queryA = baseQuery.where("city", "==", "London");
      const queryB = baseQuery.where("city", "==", "New York");
      
      const resultsA = await queryA.get();
      const resultsB = await queryB.get();
      
      resultsA.forEach(doc => {
        const data = doc.data();
        expect(data?.age).toBeGreaterThanOrEqual(25);
        expect(data?.city).toBe("London");
      });
      
      resultsB.forEach(doc => {
        const data = doc.data();
        expect(data?.age).toBeGreaterThanOrEqual(25);
        expect(data?.city).toBe("New York");
      });
    });
  });

  describe("Error Handling", () => {
    test("should handle invalid query combinations", async () => {
      const users = store.collection(collection);
      await expect(
        users
          .orderBy("age", "desc")
          .where("age", ">", 25)
          .get()
      ).rejects.toThrow();
    });

    test("should validate field values", async () => {
      const users = store.collection(collection);
      await expect(
        users
          .where("age", "==", "not a number")
          .get()
      ).resolves.toHaveLength(0);
    });
  });

  describe("Type Safety", () => {
    interface User {
      name: string;
      age: number;
      city: string;
      tags: string[];
    }

    test("should enforce type safety in complex objects", async () => {
      const users = store.collection<User>(collection);
      const results = await users
        .where("age", ">=", 25)
        .where("tags", "array-contains", "developer")
        .get();
      
      results.forEach(doc => {
        const data = doc.data();
        if (data) {
          // TypeScript should infer these types correctly
          expect(typeof data.name).toBe("string");
          expect(typeof data.age).toBe("number");
          expect(Array.isArray(data.tags)).toBe(true);
        }
      });
    });

    test("should enforce runtime type validation", async () => {
      const users = store.collection<User>(collection);
      try {
        await users
          .where("age", "invalid" as any, 25)
          .get();
        throw new Error("Should have thrown INVALID_OPERATOR error");
      } catch (error: any) {
        expect(error.code).toBe("INVALID_OPERATOR");
      }
    });
  });
}); 