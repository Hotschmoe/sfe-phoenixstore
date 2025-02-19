import { expect, test, describe, beforeAll, afterAll } from "bun:test";
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
      expect(result.id).toBeDefined();
    });

    test("should read a document", async () => {
      // First create a document
      const createResponse = await fetch(`${BASE_URL}/api/v1/${collection}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(testData)
      });
      const { id } = await createResponse.json();

      // Then read it
      const response = await fetch(`${BASE_URL}/api/v1/${collection}/${id}`);
      const result = await response.json();
      expect(response.status).toBe(200);
      expect(result.status).toBe("success");
      expect(result.data.id).toBe(id);
      expect(result.data.name).toBe(testData.name);
      expect(result.data.email).toBe(testData.email);
      expect(result.data.age).toBe(testData.age);
    });

    test("should update a document", async () => {
      // First create a document
      const createResponse = await fetch(`${BASE_URL}/api/v1/${collection}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(testData)
      });
      const { id } = await createResponse.json();

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

      // Verify the update
      const getResponse = await fetch(`${BASE_URL}/api/v1/${collection}/${id}`);
      const getResult = await getResponse.json();
      expect(getResult.data.name).toBe(updateData.name);
      expect(getResult.data.email).toBe(testData.email); // Original field should remain
      expect(getResult.data.age).toBe(testData.age); // Original field should remain
    });

    test("should delete a document", async () => {
      // First create a document
      const createResponse = await fetch(`${BASE_URL}/api/v1/${collection}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(testData)
      });
      const { id } = await createResponse.json();

      // Then delete it
      const response = await fetch(`${BASE_URL}/api/v1/${collection}/${id}`, {
        method: "DELETE"
      });

      const result = await response.json();
      expect(response.status).toBe(200);
      expect(result.status).toBe("success");

      // Verify the deletion
      const getResponse = await fetch(`${BASE_URL}/api/v1/${collection}/${id}`);
      const getResult = await getResponse.json();
      expect(getResult.status).toBe("error");
      expect(getResult.code).toBe("DOCUMENT_NOT_FOUND");
    });

    test("should handle non-existent documents", async () => {
      const nonExistentId = "nonexistent";
      
      // Try to read
      const getResponse = await fetch(`${BASE_URL}/api/v1/${collection}/${nonExistentId}`);
      const getResult = await getResponse.json();
      expect(getResult.status).toBe("error");
      expect(getResult.code).toBe("DOCUMENT_NOT_FOUND");

      // Try to update
      const updateResponse = await fetch(`${BASE_URL}/api/v1/${collection}/${nonExistentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New Name" })
      });
      const updateResult = await updateResponse.json();
      expect(updateResult.status).toBe("error");
      expect(updateResult.code).toBe("DOCUMENT_NOT_FOUND");

      // Try to delete
      const deleteResponse = await fetch(`${BASE_URL}/api/v1/${collection}/${nonExistentId}`, {
        method: "DELETE"
      });
      const deleteResult = await deleteResponse.json();
      expect(deleteResult.status).toBe("error");
      expect(deleteResult.code).toBe("DOCUMENT_NOT_FOUND");
    });
  });
}); 