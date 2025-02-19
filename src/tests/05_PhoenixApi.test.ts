import { expect, test, describe, beforeAll, afterAll, beforeEach } from "bun:test";
import { PhoenixStore } from "../core/PhoenixStore";
import { PhoenixApi } from "../api/PhoenixApi";
import { getTestDbUri, setup, teardown } from "./setup";
import { config } from "../utils/config";
import { MongoAdapter } from "../adapters/MongoAdapter";

describe("PhoenixApi", () => {
  const adapter = new MongoAdapter(getTestDbUri(), `${config.MONGODB_DATABASE}_test`);
  const store = new PhoenixStore(adapter);
  const api = new PhoenixApi(store);
  const collection = `test_collection_${Date.now()}`;
  const TEST_PORT = 4000;
  const BASE_URL = `http://localhost:${TEST_PORT}`;

  beforeAll(async () => {
    await setup();
    await adapter.connect();
    await store.connect();
    api.start(TEST_PORT);
  });

  afterAll(async () => {
    await store.disconnect();
    await adapter.disconnect();
    await teardown();
  });

  describe("CRUD Operations", () => {
    const testData = {
      name: "Test User",
      email: "test@example.com",
      age: 25
    };

    test("should create a document", async () => {
      const response = await fetch(`${BASE_URL}/api/v1/${collection}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(testData)
      });

      const result = await response.json();
      expect(response.status).toBe(200);
      expect(result.status).toBe("success");
      expect(result.data.id).toBeDefined();
      expect(result.data.path).toBe(`${collection}/${result.data.id}`);
    });

    test("should read a document", async () => {
      // First create a document
      const createResponse = await fetch(`${BASE_URL}/api/v1/${collection}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(testData)
      });
      const createResult = await createResponse.json();
      const id = createResult.data.id;

      // Then read it
      const response = await fetch(`${BASE_URL}/api/v1/${collection}/${id}`);
      const result = await response.json();
      expect(response.status).toBe(200);
      expect(result.status).toBe("success");
      expect(result.data.id).toBe(id);
      expect(result.data.path).toBe(`${collection}/${id}`);
      expect(result.data.data.name).toBe(testData.name);
      expect(result.data.data.email).toBe(testData.email);
      expect(result.data.data.age).toBe(testData.age);
    });

    test("should update a document", async () => {
      // First create a document
      const createResponse = await fetch(`${BASE_URL}/api/v1/${collection}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(testData)
      });
      const createResult = await createResponse.json();
      const id = createResult.data.id;

      // Then update it
      const updateData = { name: "Updated Name" };
      const response = await fetch(`${BASE_URL}/api/v1/${collection}/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData)
      });

      const result = await response.json();
      expect(response.status).toBe(200);
      expect(result.status).toBe("success");
      expect(result.data.id).toBe(id);
      expect(result.data.path).toBe(`${collection}/${id}`);

      // Verify the update
      const getResponse = await fetch(`${BASE_URL}/api/v1/${collection}/${id}`);
      const getResult = await getResponse.json();
      expect(getResult.data.data.name).toBe(updateData.name);
      expect(getResult.data.data.email).toBe(testData.email); // Original field should remain
      expect(getResult.data.data.age).toBe(testData.age); // Original field should remain
    });

    test("should delete a document", async () => {
      // First create a document
      const createResponse = await fetch(`${BASE_URL}/api/v1/${collection}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(testData)
      });
      const createResult = await createResponse.json();
      const id = createResult.data.id;

      // Then delete it
      const response = await fetch(`${BASE_URL}/api/v1/${collection}/${id}`, {
        method: "DELETE"
      });

      const result = await response.json();
      expect(response.status).toBe(200);
      expect(result.status).toBe("success");
      expect(result.data.id).toBe(id);
      expect(result.data.path).toBe(`${collection}/${id}`);

      // Verify the deletion
      const getResponse = await fetch(`${BASE_URL}/api/v1/${collection}/${id}`);
      const getResult = await getResponse.json();
      expect(getResult.status).toBe("error");
      expect(getResult.code).toBe("DOCUMENT_NOT_FOUND");
      expect(getResult.message).toBe("Document not found");
    });

    test("should handle non-existent documents", async () => {
      const nonExistentId = "nonexistent";
      
      // Try to read
      const getResponse = await fetch(`${BASE_URL}/api/v1/${collection}/${nonExistentId}`);
      const getResult = await getResponse.json();
      expect(getResult.status).toBe("error");
      expect(getResult.code).toBe("DOCUMENT_NOT_FOUND");
      expect(getResult.message).toBe("Document not found");

      // Try to update
      const updateResponse = await fetch(`${BASE_URL}/api/v1/${collection}/${nonExistentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New Name" })
      });
      const updateResult = await updateResponse.json();
      expect(updateResult.status).toBe("error");
      expect(updateResult.code).toBe("DOCUMENT_NOT_FOUND");
      expect(updateResult.message).toBe("Document not found");

      // Try to delete
      const deleteResponse = await fetch(`${BASE_URL}/api/v1/${collection}/${nonExistentId}`, {
        method: "DELETE"
      });
      const deleteResult = await deleteResponse.json();
      expect(deleteResult.status).toBe("error");
      expect(deleteResult.code).toBe("DOCUMENT_NOT_FOUND");
      expect(deleteResult.message).toBe("Document not found");
    });
  });

  describe("Query Operations", () => {
    const testData = [
      { name: "John", age: 25, city: "New York", tags: ["developer"] },
      { name: "Jane", age: 30, city: "London", tags: ["designer"] },
      { name: "Bob", age: 20, city: "Paris", tags: ["developer", "designer"] },
      { name: "Alice", age: 35, city: "New York", tags: ["manager"] },
      { name: "Charlie", age: 28, city: "London", tags: ["developer"] }
    ];

    beforeEach(async () => {
      // Clear existing data
      const response = await fetch(`${BASE_URL}/api/v1/${collection}`);
      const result = await response.json();
      for (const doc of result.data) {
        await fetch(`${BASE_URL}/api/v1/${collection}/${doc.id}`, {
          method: "DELETE"
        });
      }

      // Insert test data
      for (const data of testData) {
        await fetch(`${BASE_URL}/api/v1/${collection}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data)
        });
      }
    });

    test("should query with equality operator", async () => {
      const filter = encodeURIComponent(JSON.stringify([
        { field: "city", operator: "==", value: "New York" }
      ]));
      
      const response = await fetch(
        `${BASE_URL}/api/v1/${collection}?filter=${filter}`
      );
      const result = await response.json();
      
      expect(response.status).toBe(200);
      expect(result.status).toBe("success");
      expect(result.data).toHaveLength(2);
      result.data.forEach((doc: any) => {
        expect(doc.data.city).toBe("New York");
      });
    });

    test("should query with comparison operators", async () => {
      const filter = encodeURIComponent(JSON.stringify([
        { field: "age", operator: ">=", value: 30 }
      ]));
      
      const response = await fetch(
        `${BASE_URL}/api/v1/${collection}?filter=${filter}`
      );
      const result = await response.json();
      
      expect(response.status).toBe(200);
      expect(result.status).toBe("success");
      expect(result.data.length).toBeGreaterThan(0);
      result.data.forEach((doc: any) => {
        expect(doc.data.age).toBeGreaterThanOrEqual(30);
      });
    });

    test("should support array operators", async () => {
      const filter = encodeURIComponent(JSON.stringify([
        { field: "tags", operator: "array-contains", value: "developer" }
      ]));
      
      const response = await fetch(
        `${BASE_URL}/api/v1/${collection}?filter=${filter}`
      );
      const result = await response.json();
      
      expect(response.status).toBe(200);
      expect(result.status).toBe("success");
      expect(result.data.length).toBeGreaterThan(0);
      result.data.forEach((doc: any) => {
        expect(doc.data.tags).toContain("developer");
      });
    });

    test("should support in operator with array values", async () => {
      const filter = encodeURIComponent(JSON.stringify([
        { field: "city", operator: "in", value: ["London", "Paris"] }
      ]));
      
      const response = await fetch(
        `${BASE_URL}/api/v1/${collection}?filter=${filter}`
      );
      const result = await response.json();
      
      expect(response.status).toBe(200);
      expect(result.status).toBe("success");
      expect(result.data.length).toBeGreaterThan(0);
      result.data.forEach((doc: any) => {
        expect(["London", "Paris"]).toContain(doc.data.city);
      });
    });

    test("should support orderBy", async () => {
      const response = await fetch(
        `${BASE_URL}/api/v1/${collection}?orderBy=age:desc`
      );
      const result = await response.json();
      
      expect(response.status).toBe(200);
      expect(result.status).toBe("success");
      
      // Check if sorted correctly
      for (let i = 1; i < result.data.length; i++) {
        expect(result.data[i-1].data.age).toBeGreaterThanOrEqual(result.data[i].data.age);
      }
    });

    test("should support limit", async () => {
      const limit = 2;
      const response = await fetch(
        `${BASE_URL}/api/v1/${collection}?limit=${limit}`
      );
      const result = await response.json();
      
      expect(response.status).toBe(200);
      expect(result.status).toBe("success");
      expect(result.data).toHaveLength(limit);
    });

    test("should support offset", async () => {
      // First get all results ordered by name
      const allResponse = await fetch(
        `${BASE_URL}/api/v1/${collection}?orderBy=name:asc`
      );
      const allResult = await allResponse.json();

      // Then get results with offset
      const offset = 2;
      const response = await fetch(
        `${BASE_URL}/api/v1/${collection}?orderBy=name:asc&offset=${offset}`
      );
      const result = await response.json();
      
      expect(response.status).toBe(200);
      expect(result.status).toBe("success");
      expect(result.data[0].data.name).toBe(allResult.data[offset].data.name);
    });

    test("should support multiple where conditions", async () => {
      const filter = encodeURIComponent(JSON.stringify([
        { field: "age", operator: ">=", value: 25 },
        { field: "city", operator: "==", value: "London" }
      ]));
      
      const url = `${BASE_URL}/api/v1/${collection}?filter=${filter}`;
      console.log('Debug - Query URL:', url);
      console.log('Debug - Decoded URL:', decodeURIComponent(url));
      
      const response = await fetch(url);
      const result = await response.json();
      
      console.log('Debug - Response:', JSON.stringify(result, null, 2));
      
      expect(response.status).toBe(200);
      expect(result.status).toBe("success");
      expect(result.data.length).toBeGreaterThan(0);
      result.data.forEach((doc: any) => {
        const data = doc.data;
        console.log('Debug - Document:', JSON.stringify(data, null, 2));
        expect(data.age).toBeGreaterThanOrEqual(25);
        expect(data.city).toBe("London");
      });
    });

    test("should combine where, orderBy, and limit", async () => {
      const filter = encodeURIComponent(JSON.stringify([
        { field: "age", operator: ">=", value: 25 }
      ]));
      const orderBy = encodeURIComponent('age:desc');
      const response = await fetch(
        `${BASE_URL}/api/v1/${collection}?filter=${filter}&orderBy=${orderBy}&limit=2`
      );
      const result = await response.json();
      
      expect(response.status).toBe(200);
      expect(result.status).toBe("success");
      expect(result.data).toHaveLength(2);
      result.data.forEach((doc: any) => {
        expect(doc.data.age).toBeGreaterThanOrEqual(25);
      });
      expect(result.data[0].data.age).toBeGreaterThanOrEqual(result.data[1].data.age);
    });

    test("should handle invalid query parameters", async () => {
      // Test invalid operator
      const filter1 = encodeURIComponent(JSON.stringify([
        { field: "age", operator: "invalid", value: 25 }
      ]));
      const response1 = await fetch(
        `${BASE_URL}/api/v1/${collection}?filter=${filter1}`
      );
      const result1 = await response1.json();
      expect(result1.status).toBe("error");
      expect(result1.code).toBe("INVALID_QUERY_PARAMS");

      // Test invalid filter format
      const response2 = await fetch(
        `${BASE_URL}/api/v1/${collection}?filter=invalid-json`
      );
      const result2 = await response2.json();
      expect(result2.status).toBe("error");
      expect(result2.code).toBe("INVALID_QUERY_PARAMS");

      // Test invalid limit
      const response3 = await fetch(
        `${BASE_URL}/api/v1/${collection}?limit=-1`
      );
      const result3 = await response3.json();
      expect(result3.status).toBe("error");
      expect(result3.code).toBe("INVALID_QUERY_PARAMS");
    });
  });
}); 