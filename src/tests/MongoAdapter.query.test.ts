import { expect, test, describe, beforeAll, afterAll, beforeEach } from "bun:test";
import { MongoAdapter } from "../adapters/MongoAdapter";
import { getTestDbUri, setup, teardown } from "./setup";

describe("MongoAdapter Query Operations", () => {
  const adapter = new MongoAdapter(getTestDbUri(), "phoenixstore_test");
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
    
    // Insert test data
    for (const data of testData) {
      await adapter.add(collection, data);
    }
  });

  afterAll(async () => {
    await adapter.disconnect();
    await teardown();
  });

  describe("Basic Queries", () => {
    test("should filter documents with equality", async () => {
      const results = await adapter.query(collection, [
        { field: "city", operator: "==", value: "New York" }
      ]);
      
      expect(results).toHaveLength(2);
      expect(results.every(doc => doc.city === "New York")).toBe(true);
    });

    test("should filter documents with greater than", async () => {
      const results = await adapter.query(collection, [
        { field: "age", operator: ">", value: 28 }
      ]);
      
      expect(results).toHaveLength(2);
      expect(results.every(doc => doc.age > 28)).toBe(true);
    });

    test("should filter documents with less than", async () => {
      const results = await adapter.query(collection, [
        { field: "age", operator: "<", value: 25 }
      ]);
      
      expect(results).toHaveLength(1);
      expect(results[0].age).toBeLessThan(25);
    });
  });

  describe("Complex Queries", () => {
    test("should combine multiple conditions", async () => {
      const results = await adapter.query(collection, [
        { field: "age", operator: ">=", value: 25 },
        { field: "city", operator: "==", value: "London" }
      ]);
      
      expect(results).toHaveLength(2);
      results.forEach(doc => {
        expect(doc.age).toBeGreaterThanOrEqual(25);
        expect(doc.city).toBe("London");
      });
    });

    test("should handle in operator", async () => {
      const results = await adapter.query(collection, [
        { field: "city", operator: "in", value: ["London", "Paris"] }
      ]);
      
      expect(results).toHaveLength(3);
      expect(results.every(doc => ["London", "Paris"].includes(doc.city))).toBe(true);
    });
  });

  describe("Sorting and Pagination", () => {
    test("should sort documents", async () => {
      const results = await adapter.query(
        collection,
        [],
        { orderBy: "age", orderDirection: "asc" }
      );
      
      expect(results).toHaveLength(5);
      for (let i = 1; i < results.length; i++) {
        expect(results[i].age).toBeGreaterThanOrEqual(results[i-1].age);
      }
    });

    test("should limit results", async () => {
      const results = await adapter.query(
        collection,
        [],
        { limit: 2, orderBy: "name", orderDirection: "asc" }
      );
      
      expect(results).toHaveLength(2);
    });

    test("should apply offset", async () => {
      const allResults = await adapter.query(
        collection,
        [],
        { orderBy: "name", orderDirection: "asc" }
      );
      
      const offsetResults = await adapter.query(
        collection,
        [],
        { offset: 2, orderBy: "name", orderDirection: "asc" }
      );
      
      expect(offsetResults).toHaveLength(3);
      expect(offsetResults[0].name).toBe(allResults[2].name);
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

    test("should handle non-existent field in sorting", async () => {
      const results = await adapter.query(
        collection,
        [],
        { orderBy: "nonexistent", orderDirection: "asc" }
      );
      
      expect(results).toHaveLength(5); // Should still return results
    });
  });

  describe("Edge Cases", () => {
    let testCollection: string;
    
    beforeEach(async () => {
      // Create a new collection for each test
      testCollection = `test_collection_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    });

    test("should handle null values in queries", async () => {
      await adapter.add(testCollection, { name: "Test", age: null });
      const results = await adapter.query(testCollection, [
        { field: "age", operator: "==", value: null }
      ]);
      expect(results).toHaveLength(1);
      expect(results[0].age).toBeNull();
    });

    test("should handle undefined fields", async () => {
      // Add two documents: one with null age, one without age field
      await adapter.add(testCollection, { name: "Test1", age: null });
      await adapter.add(testCollection, { name: "Test2" }); // no age field
      
      const results = await adapter.query(testCollection, [
        { field: "age", operator: "==", value: null }
      ]);
      
      // MongoDB treats both null values and missing fields as matching null equality
      expect(results).toHaveLength(2);
      results.forEach(doc => {
        expect(doc.age).toBeFalsy(); // Could be null or undefined
      });
    });

    test("should handle empty result sets", async () => {
      const results = await adapter.query(testCollection, [
        { field: "age", operator: "==", value: 999 }
      ]);
      expect(results).toHaveLength(0);
    });

    test("should handle invalid field names", async () => {
      try {
        await adapter.query(testCollection, [
          { field: "$invalid", operator: "==", value: "test" }
        ]);
        throw new Error("Should not reach here");
      } catch (error: any) {
        // MongoDB returns a general query error for invalid field names
        expect(error.code).toBe("QUERY_ERROR");
      }
    });
  });

  describe("Performance Cases", () => {
    test("should handle large result sets efficiently", async () => {
      // Insert 1000 documents
      const promises = Array.from({ length: 1000 }, (_, i) => 
        adapter.add(collection, { 
          name: `Test ${i}`, 
          age: Math.floor(Math.random() * 100) 
        })
      );
      await Promise.all(promises);

      const startTime = Date.now();
      const results = await adapter.query(collection, [
        { field: "age", operator: ">", value: 50 }
      ], { limit: 100 });
      const endTime = Date.now();

      expect(results.length).toBeLessThanOrEqual(100);
      expect(endTime - startTime).toBeLessThan(100); // Should complete in under 100ms
    });

    test("should handle concurrent queries", async () => {
      const queries = Array.from({ length: 10 }, () => 
        adapter.query(collection, [
          { field: "age", operator: ">", value: 25 }
        ])
      );
      const results = await Promise.all(queries);
      results.forEach(result => {
        expect(Array.isArray(result)).toBe(true);
      });
    });
  });
}); 