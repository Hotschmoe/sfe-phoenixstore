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

  describe("Advanced Query Patterns", () => {
    test("should handle complex chaining with multiple conditions", async () => {
      const users = store.collection(collection);
      const results = await users
        .where("age", ">=", 25)
        .where("city", "in", ["London", "New York"])
        .orderBy("name", "desc")
        .limit(3)
        .get();
      
      expect(results.length).toBeLessThanOrEqual(3);
      results.forEach(doc => {
        expect(doc.age).toBeGreaterThanOrEqual(25);
        expect(["London", "New York"]).toContain(doc.city);
      });
      
      // Check descending order
      for (let i = 1; i < results.length; i++) {
        expect(results[i-1].name >= results[i].name).toBe(true);
      }
    });

    test("should maintain query immutability", async () => {
      const users = store.collection(collection);
      const baseQuery = users.where("age", ">=", 25);
      
      const queryA = baseQuery.where("city", "==", "London");
      const queryB = baseQuery.where("city", "==", "New York");
      
      const [resultsA, resultsB] = await Promise.all([
        queryA.get(),
        queryB.get()
      ]);
      
      resultsA.forEach(doc => expect(doc.city).toBe("London"));
      resultsB.forEach(doc => expect(doc.city).toBe("New York"));
    });
  });

  describe("Error Handling", () => {
    test("should handle invalid query combinations", async () => {
      const users = store.collection(collection);
      
      try {
        await users
          .orderBy("age")
          .where("age", ">", 25)
          .get();
        throw new Error("Should not reach here");
      } catch (error: any) {
        expect(error.code).toBe("INVALID_QUERY");
        expect(error.message).toContain("where must come before orderBy");
      }
    });

    test("should validate field values", async () => {
      const users = store.collection(collection);
      
      try {
        await users
          .where("age", ">", "invalid_age") // age should be number
          .get();
        throw new Error("Should not reach here");
      } catch (error: any) {
        expect(error.code).toBe("INVALID_ARGUMENT");
      }
    });
  });

  describe("Type Safety", () => {
    interface User {
      name: string;
      age: number;
      city: string;
      tags: string[];
      metadata?: {
        lastLogin?: Date;
        preferences?: {
          theme: string;
          notifications: boolean;
        };
      };
    }

    test("should enforce type safety in complex objects", async () => {
      const users = store.collection<User>(collection);
      
      // This should compile without type errors
      const query = users
        .where("metadata.preferences.theme", "==", "dark")
        .where("metadata.lastLogin", ">", new Date(2024, 0, 1))
        .orderBy("metadata.lastLogin", "desc");
      
      await query.get();
      expect(true).toBe(true); // If we reach here, types are correct
    });

    test("should enforce runtime type validation", async () => {
      const users = store.collection<User>(collection);
      
      // Test numeric operator with string value
      try {
        await users
          .where("age", ">", "25") // age should be number
          .get();
        throw new Error("Should have thrown INVALID_ARGUMENT error");
      } catch (error: any) {
        expect(error.code).toBe("INVALID_ARGUMENT");
      }

      // Test with invalid field path
      try {
        await users
          .where("nonexistent.field", "==", "value")
          .get();
        throw new Error("Should have thrown an error");
      } catch (error: any) {
        expect(error).toBeDefined();
      }

      // Test with invalid operator
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