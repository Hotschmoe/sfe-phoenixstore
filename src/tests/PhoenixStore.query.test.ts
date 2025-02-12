import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import { PhoenixStore } from "../core/PhoenixStore";
import { getTestDbUri, setup, teardown } from "./setup";

describe("PhoenixStore Query Operations", () => {
  const store = new PhoenixStore(getTestDbUri(), "phoenixstore_test");
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
    await store.connect();
    
    // Insert test data
    const users = store.collection(collection);
    for (const data of testData) {
      await users.add(data);
    }
  });

  afterAll(async () => {
    await store.disconnect();
    await teardown();
  });

  describe("Query Builder Pattern", () => {
    test("should support where clause", async () => {
      const users = store.collection(collection);
      const results = await users
        .where("city", "==", "New York")
        .get();
      
      expect(results).toHaveLength(2);
      expect(results.every(doc => doc.city === "New York")).toBe(true);
    });

    test("should support chained where clauses", async () => {
      const users = store.collection(collection);
      const results = await users
        .where("age", ">=", 25)
        .where("city", "==", "London")
        .get();
      
      expect(results).toHaveLength(2);
      results.forEach(doc => {
        expect(doc.age).toBeGreaterThanOrEqual(25);
        expect(doc.city).toBe("London");
      });
    });

    test("should support orderBy", async () => {
      const users = store.collection(collection);
      const results = await users
        .orderBy("age", "asc")
        .get();
      
      expect(results).toHaveLength(5);
      for (let i = 1; i < results.length; i++) {
        expect(results[i].age).toBeGreaterThanOrEqual(results[i-1].age);
      }
    });

    test("should support limit", async () => {
      const users = store.collection(collection);
      const results = await users
        .orderBy("name", "asc")
        .limit(2)
        .get();
      
      expect(results).toHaveLength(2);
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
      
      expect(offsetResults).toHaveLength(3);
      expect(offsetResults[0].name).toBe(allResults[2].name);
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
      
      expect(results).toHaveLength(2);
      expect(results[0].age).toBeGreaterThan(results[1].age);
      results.forEach(doc => {
        expect(doc.age).toBeGreaterThanOrEqual(25);
      });
    });

    test("should handle in operator with multiple values", async () => {
      const users = store.collection(collection);
      const results = await users
        .where("city", "in", ["London", "Paris"])
        .orderBy("name", "asc")
        .get();
      
      expect(results).toHaveLength(3);
      expect(results.every(doc => ["London", "Paris"].includes(doc.city))).toBe(true);
    });
  });

  describe("Type Safety", () => {
    interface User {
      name: string;
      age: number;
      city: string;
      tags: string[];
    }

    test("should maintain type safety in queries", async () => {
      const users = store.collection<User>(collection);
      const results = await users
        .where("age", ">", 25)
        .get();
      
      results.forEach(user => {
        // TypeScript should recognize these types
        const name: string = user.name;
        const age: number = user.age;
        expect(typeof name).toBe("string");
        expect(typeof age).toBe("number");
        expect(Array.isArray(user.tags)).toBe(true);
      });
    });
  });
}); 