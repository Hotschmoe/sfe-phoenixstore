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
      await expect(newAdapter.connect()).resolves.not.toThrow();
      await newAdapter.disconnect();
    }, 10000); // Increase timeout to 10 seconds

    test("should throw error with invalid connection string", async () => {
      const invalidAdapter = new MongoAdapter("invalid-uri", "phoenixstore_test");
      await expect(invalidAdapter.connect()).rejects.toThrow(PhoenixStoreError);
    });
  });

  describe("CRUD Operations", () => {
    const testCollection = "test_collection";
    const testData = { name: "Test User", email: "test@example.com" };

    test("should add a document and return an ID", async () => {
      const id = await adapter.add(testCollection, testData);
      expect(id).toBeDefined();
      expect(typeof id).toBe("string");
    });

    test("should retrieve a document by ID", async () => {
      const id = await adapter.add(testCollection, testData);
      const doc = await adapter.get(testCollection, id);
      expect(doc).toBeDefined();
      expect(doc?.name).toBe(testData.name);
      expect(doc?.email).toBe(testData.email);
    });

    test("should return null for non-existent document", async () => {
      const doc = await adapter.get(testCollection, "nonexistent-id");
      expect(doc).toBeNull();
    });

    test("should update a document", async () => {
      const id = await adapter.add(testCollection, testData);
      const updateData = { name: "Updated Name" };
      const updated = await adapter.update(testCollection, id, updateData);
      expect(updated).toBe(true);

      const doc = await adapter.get(testCollection, id);
      expect(doc?.name).toBe(updateData.name);
      expect(doc?.email).toBe(testData.email); // Original field should remain
    });

    test("should return false when updating non-existent document", async () => {
      const updated = await adapter.update(testCollection, "nonexistent-id", { name: "New Name" });
      expect(updated).toBe(false);
    });

    test("should delete a document", async () => {
      const id = await adapter.add(testCollection, testData);
      const deleted = await adapter.delete(testCollection, id);
      expect(deleted).toBe(true);

      const doc = await adapter.get(testCollection, id);
      expect(doc).toBeNull();
    });

    test("should return false when deleting non-existent document", async () => {
      const deleted = await adapter.delete(testCollection, "nonexistent-id");
      expect(deleted).toBe(false);
    });
  });
}); 