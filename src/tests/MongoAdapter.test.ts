import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import { MongoAdapter } from "../adapters/MongoAdapter";
import { PhoenixStoreError } from "../types";
import { getTestDbUri, setup, teardown } from "./setup";

describe("MongoAdapter", () => {
  const adapter = new MongoAdapter(getTestDbUri(), "phoenixstore_test");

  beforeAll(async () => {
    console.log('Starting MongoAdapter tests...');
    try {
      await setup();
      console.log('Connecting adapter...');
      await adapter.connect();
      console.log('Adapter connected');
    } catch (error) {
      console.error('Failed to setup MongoAdapter tests:', error);
      throw error;
    }
  });

  afterAll(async () => {
    try {
      await adapter.disconnect();
      await teardown();
    } catch (error) {
      console.error('Failed to cleanup MongoAdapter tests:', error);
    }
  });

  describe("Connection", () => {
    test("should connect to MongoDB successfully", async () => {
      const newAdapter = new MongoAdapter(getTestDbUri(), "phoenixstore_test");
      await newAdapter.connect();
      expect(newAdapter).toBeDefined();
      await newAdapter.disconnect();
    }, 10000);

    test("should throw error with invalid connection string", async () => {
      const invalidAdapter = new MongoAdapter("not-a-mongodb-url", "phoenixstore_test");
      try {
        await invalidAdapter.connect();
        throw new Error("Should not reach here");
      } catch (error) {
        expect(error).toBeInstanceOf(PhoenixStoreError);
        expect(error.code).toBe("MONGODB_CONNECTION_ERROR");
      }
    });
  });

  describe("CRUD Operations", () => {
    const getTestCollection = () => `test_collection_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const testData = { name: "Test User", email: "test@example.com" };

    test("should add a document and return an ID", async () => {
      const collection = getTestCollection();
      const id = await adapter.add(collection, testData);
      expect(id).toBeDefined();
      expect(typeof id).toBe("string");
    });

    test("should retrieve a document by ID", async () => {
      const collection = getTestCollection();
      const id = await adapter.add(collection, testData);
      const doc = await adapter.get(collection, id);
      expect(doc).toBeDefined();
      expect(doc?.name).toBe(testData.name);
      expect(doc?.email).toBe(testData.email);
    });

    test("should return null for non-existent document", async () => {
      const collection = getTestCollection();
      const doc = await adapter.get(collection, "nonexistent-id");
      expect(doc).toBeNull();
    });

    test("should update a document", async () => {
      const collection = getTestCollection();
      const id = await adapter.add(collection, testData);
      const updateData = { name: "Updated Name" };
      const updated = await adapter.update(collection, id, updateData);
      expect(updated).toBe(true);

      const doc = await adapter.get(collection, id);
      expect(doc?.name).toBe(updateData.name);
      expect(doc?.email).toBe(testData.email); // Original field should remain
    });

    test("should return false when updating non-existent document", async () => {
      const collection = getTestCollection();
      const updated = await adapter.update(collection, "nonexistent-id", { name: "New Name" });
      expect(updated).toBe(false);
    });

    test("should delete a document", async () => {
      const collection = getTestCollection();
      const id = await adapter.add(collection, testData);
      const deleted = await adapter.delete(collection, id);
      expect(deleted).toBe(true);

      const doc = await adapter.get(collection, id);
      expect(doc).toBeNull();
    });

    test("should return false when deleting non-existent document", async () => {
      const collection = getTestCollection();
      const deleted = await adapter.delete(collection, "nonexistent-id");
      expect(deleted).toBe(false);
    });
  });
}); 