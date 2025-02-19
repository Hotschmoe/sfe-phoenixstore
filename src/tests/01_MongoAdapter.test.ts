import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import { MongoAdapter } from "../adapters/MongoAdapter";
import { getTestDbUri, setup, teardown } from "./setup";
import { ObjectId } from "mongodb";
import { config } from "../utils/config";

describe("MongoAdapter", () => {
  const adapter = new MongoAdapter(getTestDbUri(), `${config.MONGODB_DATABASE}_test`);

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
      const newAdapter = new MongoAdapter(getTestDbUri(), `${config.MONGODB_DATABASE}_test`);
      await newAdapter.connect();
      expect(newAdapter).toBeDefined();
      await newAdapter.disconnect();
    });

    test("should handle various invalid connection strings", async () => {
      const invalidUris = [
        "invalid-uri",
        "mongodb://invalid:invalid@localhost:27017",
        "mongodb://localhost:1234" // Non-existent port
      ];

      for (const uri of invalidUris) {
        const invalidAdapter = new MongoAdapter(uri, `${config.MONGODB_DATABASE}_test`);
        await expect(invalidAdapter.connect()).rejects.toThrow();
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
      expect(() => new ObjectId(id)).not.toThrow();
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
      const doc = await adapter.get(collection, new ObjectId().toString());
      expect(doc).toBeNull();
    });

    test("should update a document", async () => {
      const collection = getTestCollection();
      const id = await adapter.add(collection, testData);
      const updateData = { name: "Updated Name" };
      const result = await adapter.update(collection, id, updateData);
      expect(result).toBeUndefined();

      const doc = await adapter.get(collection, id);
      expect(doc?.name).toBe(updateData.name);
      expect(doc?.email).toBe(testData.email); // Original field should remain
    });

    test("should return false when updating non-existent document", async () => {
      const collection = getTestCollection();
      const result = await adapter.update(collection, new ObjectId().toString(), { name: "New Name" });
      expect(result).toBeUndefined();
    });

    test("should delete a document", async () => {
      const collection = getTestCollection();
      const id = await adapter.add(collection, testData);
      const result = await adapter.delete(collection, id);
      expect(result).toBeUndefined();

      const doc = await adapter.get(collection, id);
      expect(doc).toBeNull();
    });

    test("should return false when deleting non-existent document", async () => {
      const collection = getTestCollection();
      const result = await adapter.delete(collection, new ObjectId().toString());
      expect(result).toBeUndefined();
    });
  });
}); 