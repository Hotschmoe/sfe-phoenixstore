import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import { PhoenixStore } from "../core/PhoenixStore";
import { PhoenixApi } from "../api/PhoenixApi";
import { getTestDbUri, setup, teardown } from "./setup";

describe("PhoenixApi", () => {
  const store = new PhoenixStore(getTestDbUri(), "phoenixstore_test");
  const api = new PhoenixApi(store);
  const TEST_PORT = 4000;

  beforeAll(async () => {
    await setup();
    await store.connect();
    api.start(TEST_PORT);
  });

  afterAll(async () => {
    await store.disconnect();
    await teardown();
  });

  describe("CRUD Operations", () => {
    const testData = {
      name: "Test User",
      email: "test@example.com",
      age: 25
    };

    test("should create a document", async () => {
      const response = await fetch(`http://localhost:${TEST_PORT}/api/v1/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testData)
      });

      const result = await response.json();
      expect(response.status).toBe(200);
      expect(result.status).toBe('success');
      expect(result.id).toBeDefined();
      
      // Store ID for subsequent tests
      return result.id;
    });

    test("should read a document", async () => {
      // First create a document
      const createResponse = await fetch(`http://localhost:${TEST_PORT}/api/v1/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testData)
      });
      const { id } = await createResponse.json();

      // Then read it
      const response = await fetch(`http://localhost:${TEST_PORT}/api/v1/users/${id}`);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.status).toBe('success');
      expect(result.data).toBeDefined();
      expect(result.data.name).toBe(testData.name);
      expect(result.data.email).toBe(testData.email);
      expect(result.data.age).toBe(testData.age);
    });

    test("should update a document", async () => {
      // First create a document
      const createResponse = await fetch(`http://localhost:${TEST_PORT}/api/v1/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testData)
      });
      const { id } = await createResponse.json();

      // Then update it
      const updateData = { name: "Updated Name", age: 26 };
      const updateResponse = await fetch(`http://localhost:${TEST_PORT}/api/v1/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });
      const updateResult = await updateResponse.json();
      expect(updateResponse.status).toBe(200);
      expect(updateResult.status).toBe('success');

      // Verify the update
      const getResponse = await fetch(`http://localhost:${TEST_PORT}/api/v1/users/${id}`);
      const getResult = await getResponse.json();
      expect(getResult.data.name).toBe(updateData.name);
      expect(getResult.data.age).toBe(updateData.age);
      expect(getResult.data.email).toBe(testData.email); // Should keep original email
    });

    test("should delete a document", async () => {
      // First create a document
      const createResponse = await fetch(`http://localhost:${TEST_PORT}/api/v1/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testData)
      });
      const { id } = await createResponse.json();

      // Then delete it
      const deleteResponse = await fetch(`http://localhost:${TEST_PORT}/api/v1/users/${id}`, {
        method: 'DELETE'
      });
      const deleteResult = await deleteResponse.json();
      expect(deleteResponse.status).toBe(200);
      expect(deleteResult.status).toBe('success');

      // Verify it's gone
      const getResponse = await fetch(`http://localhost:${TEST_PORT}/api/v1/users/${id}`);
      const getResult = await getResponse.json();
      expect(getResult.status).toBe('error');
      expect(getResult.code).toBe('DOCUMENT_NOT_FOUND');
    });

    test("should handle non-existent documents", async () => {
      const response = await fetch(`http://localhost:${TEST_PORT}/api/v1/users/nonexistent-id`);
      const result = await response.json();
      
      expect(response.status).toBe(200); // We return 200 with error in body
      expect(result.status).toBe('error');
      expect(result.code).toBe('DOCUMENT_NOT_FOUND');
    });
  });
}); 