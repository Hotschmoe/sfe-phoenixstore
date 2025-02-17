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

    test("should handle various invalid connection strings", async () => {
      const invalidCases = [
        {
          uri: "not-a-mongodb-url",
          description: "completely invalid URL"
        },
        {
          uri: "mongodb://invalid@:password@localhost:27017",
          description: "malformed authentication"
        },
        {
          uri: "postgresql://localhost:27017",
          description: "wrong protocol"
        }
      ];

      for (const { uri, description } of invalidCases) {
        try {
          // First try to create the adapter
          const invalidAdapter = new MongoAdapter(uri, "phoenixstore_test");
          
          // If creation succeeds, try to connect
          await invalidAdapter.connect();
          throw new Error(`Should have failed for ${description}`);
        } catch (error: any) {
          // For invalid URIs, we expect MongoDB's native errors
          const hasFailedConnect = error.message.includes("Failed to connect to MongoDB");
          const hasInvalidUri = error.message.includes("mongodb");
          expect(hasFailedConnect || hasInvalidUri).toBe(true);
        }
      }
    }, 10000);
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