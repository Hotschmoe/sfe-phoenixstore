import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import { MongoAdapter } from "../adapters/MongoAdapter";
import { getTestDbUri, setup, teardown } from "./setup";
import { config } from "../utils/config";

describe("MongoAdapter Query Operations", () => {
  const adapter = new MongoAdapter(getTestDbUri(), `${config.MONGODB_DATABASE}_test`);
  const collection = `test_collection_${Date.now()}`;

  // Test data
  const testData = [
    { name: "John", age: 25, city: "New York", tags: ["developer"], active: true, score: 85.5 },
    { name: "Jane", age: 30, city: "London", tags: ["designer"], active: true, score: 92.0 },
    { name: "Bob", age: 20, city: "Paris", tags: ["developer", "designer"], active: false, score: 78.5 },
    { name: "Alice", age: 35, city: "New York", tags: ["manager"], active: true, score: 95.0 },
    { name: "Charlie", age: 28, city: "London", tags: ["developer"], active: false, score: 88.0 },
    { name: "David", age: 32, tags: null, active: true, score: null },  // Missing city, null tags
    { name: "Eve", age: 27, city: "Paris", tags: [], active: false, score: 82.0 }  // Empty tags array
  ];

  beforeAll(async () => {
    console.log('Starting MongoAdapter Query tests...');
    try {
      await setup();
      console.log('Connecting adapter...');
      await adapter.connect();
      console.log('Adapter connected');

      // Insert test data
      console.log('Inserting test data...');
      for (const data of testData) {
        await adapter.add(collection, data);
      }
      console.log('Test data inserted');
    } catch (error) {
      console.error('Failed to setup MongoAdapter Query tests:', error);
      throw error;
    }
  });

  afterAll(async () => {
    try {
      await adapter.disconnect();
      await teardown();
    } catch (error) {
      console.error('Failed to cleanup MongoAdapter Query tests:', error);
    }
  });

  describe("Basic Queries", () => {
    test("should filter documents with equality", async () => {
      const results = await adapter.query(collection, [
        { field: "city", operator: "==", value: "New York" }
      ]);
      
      expect(results).toHaveLength(2);
      expect(results.every(doc => doc.city === "New York")).toBe(true);
    });

    test("should filter documents with not equals", async () => {
      const results = await adapter.query(collection, [
        { field: "city", operator: "!=", value: "London" }
      ]);
      
      expect(results.every(doc => doc.city !== "London")).toBe(true);
    });

    test("should filter documents with greater than", async () => {
      const results = await adapter.query(collection, [
        { field: "age", operator: ">", value: 28 }
      ]);
      
      expect(results).toHaveLength(3);
      expect(results.every(doc => doc.age > 28)).toBe(true);
    });

    test("should filter documents with greater than or equal", async () => {
      const results = await adapter.query(collection, [
        { field: "age", operator: ">=", value: 30 }
      ]);
      
      expect(results.every(doc => doc.age >= 30)).toBe(true);
    });

    test("should filter documents with less than", async () => {
      const results = await adapter.query(collection, [
        { field: "age", operator: "<", value: 25 }
      ]);
      
      expect(results).toHaveLength(1);
      expect(results[0].age).toBeLessThan(25);
    });

    test("should filter documents with less than or equal", async () => {
      const results = await adapter.query(collection, [
        { field: "age", operator: "<=", value: 25 }
      ]);
      
      expect(results.every(doc => doc.age <= 25)).toBe(true);
    });

    test("should handle boolean values", async () => {
      const results = await adapter.query(collection, [
        { field: "active", operator: "==", value: true }
      ]);
      
      expect(results.every(doc => doc.active === true)).toBe(true);
    });

    test("should handle floating point values", async () => {
      const results = await adapter.query(collection, [
        { field: "score", operator: ">=", value: 90.0 }
      ]);
      
      expect(results.every(doc => doc.score >= 90.0)).toBe(true);
    });
  });

  describe("Array Operators", () => {
    test("should filter with array-contains operator", async () => {
      const results = await adapter.query(collection, [
        { field: "tags", operator: "array-contains", value: "developer" }
      ]);
      
      expect(results).toHaveLength(3);
      results.forEach(doc => {
        expect(doc.tags).toContain("developer");
      });
    });

    test("should filter with array-contains-any operator", async () => {
      const results = await adapter.query(collection, [
        { field: "tags", operator: "array-contains-any", value: ["designer", "manager"] }
      ]);
      
      expect(results).toHaveLength(3);
      results.forEach(doc => {
        expect(doc.tags.some((tag: string) => ["designer", "manager"].includes(tag))).toBe(true);
      });
    });

    test("should handle null arrays", async () => {
      const results = await adapter.query(collection, [
        { field: "tags", operator: "==", value: null }
      ]);
      
      expect(results).toHaveLength(1);
      expect(results[0].tags).toBeNull();
    });

    test("should handle empty arrays", async () => {
      const results = await adapter.query(collection, [
        { field: "tags", operator: "array-contains", value: "nonexistent" }
      ]);
      
      expect(results).toHaveLength(0);
    });

    test("should combine array operators with other conditions", async () => {
      const results = await adapter.query(collection, [
        { field: "tags", operator: "array-contains", value: "developer" },
        { field: "city", operator: "==", value: "London" }
      ]);
      
      expect(results).toHaveLength(1);
      expect(results[0].city).toBe("London");
      expect(results[0].tags).toContain("developer");
    });
  });

  describe("Complex Queries", () => {
    test("should combine multiple conditions with different operators", async () => {
      const results = await adapter.query(collection, [
        { field: "age", operator: ">=", value: 25 },
        { field: "active", operator: "==", value: true },
        { field: "score", operator: ">", value: 80 }
      ]);
      
      results.forEach(doc => {
        expect(doc.age).toBeGreaterThanOrEqual(25);
        expect(doc.active).toBe(true);
        expect(doc.score).toBeGreaterThan(80);
      });
    });

    test("should handle in operator with multiple values", async () => {
      const results = await adapter.query(collection, [
        { field: "city", operator: "in", value: ["London", "Paris"] }
      ]);
      
      expect(results.every(doc => ["London", "Paris"].includes(doc.city))).toBe(true);
    });
  });

  describe("Sorting and Pagination", () => {
    test("should sort documents ascending", async () => {
      const results = await adapter.query(
        collection,
        [],
        { orderBy: "age", orderDirection: "asc" }
      );
      
      for (let i = 1; i < results.length; i++) {
        expect(results[i].age).toBeGreaterThanOrEqual(results[i-1].age);
      }
    });

    test("should sort documents descending", async () => {
      const results = await adapter.query(
        collection,
        [],
        { orderBy: "age", orderDirection: "desc" }
      );
      
      for (let i = 1; i < results.length; i++) {
        expect(results[i].age).toBeLessThanOrEqual(results[i-1].age);
      }
    });

    test("should handle combined limit and offset", async () => {
      const allResults = await adapter.query(
        collection,
        [],
        { orderBy: "age", orderDirection: "asc" }
      );
      
      const paginatedResults = await adapter.query(
        collection,
        [],
        { orderBy: "age", orderDirection: "asc", limit: 2, offset: 2 }
      );
      
      expect(paginatedResults).toHaveLength(2);
      expect(paginatedResults[0].age).toBe(allResults[2].age);
      expect(paginatedResults[1].age).toBe(allResults[3].age);
    });

    test("should handle offset beyond dataset size", async () => {
      const results = await adapter.query(
        collection,
        [],
        { offset: 100 }
      );
      
      expect(results).toHaveLength(0);
    });
  });

  describe("Error Handling", () => {
    test("should handle invalid operator", async () => {
      try {
        await adapter.query(collection, [
          { field: "age", operator: "invalid" as any, value: 25 }
        ]);
        throw new Error("Should not reach here");
      } catch (error: any) {
        expect(error.code).toBe("INVALID_OPERATOR");
      }
    });

    test("should handle invalid field types", async () => {
      const results = await adapter.query(collection, [
        { field: "age", operator: "==", value: "not a number" }
      ]);
      // MongoDB will coerce types, so this should return empty results rather than error
      expect(results).toHaveLength(0);
    });

    test("should handle non-existent field in sorting", async () => {
      const results = await adapter.query(
        collection,
        [],
        { orderBy: "nonexistent", orderDirection: "asc" }
      );
      
      expect(results).toHaveLength(testData.length); // Should still return all results
    });

    test("should handle null field values", async () => {
      const results = await adapter.query(collection, [
        { field: "score", operator: "==", value: null }
      ]);
      
      expect(results).toHaveLength(1);
      expect(results[0].score).toBeNull();
    });

    test("should handle missing field values", async () => {
      const results = await adapter.query(collection, [
        { field: "city", operator: "==", value: null }
      ]);
      
      expect(results.every(doc => !doc.hasOwnProperty('city') || doc.city === null)).toBe(true);
    });
  });
}); 