import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import { PhoenixStore } from "../core/PhoenixStore";
import { PhoenixApi } from "../api/PhoenixApi";
import { getTestDbUri, setup, teardown, TEST_CONFIG } from "./setup";
import { MongoAdapter } from "../adapters/MongoAdapter";
import { StorageAdapter } from "../adapters/StorageAdapter";

describe("PhoenixApi Storage Operations", () => {
  const adapter = new MongoAdapter(getTestDbUri(), TEST_CONFIG.mongodb.database);
  const store = new PhoenixStore(adapter);
  const api = new PhoenixApi(store);
  const TEST_PORT = 4000;
  const BASE_URL = `http://localhost:${TEST_PORT}`;
  let uploadedFilePath: string;

  beforeAll(async () => {
    await setup();
    await adapter.connect();
    await store.connect();

    // Override the storage adapter with test configuration
    const testConfig = {
      endPoint: TEST_CONFIG.storage.host, // This should be 'localhost'
      port: TEST_CONFIG.storage.port,
      useSSL: TEST_CONFIG.storage.useSSL,
      accessKey: TEST_CONFIG.storage.accessKey,
      secretKey: TEST_CONFIG.storage.secretKey,
      region: TEST_CONFIG.storage.region,
      url: TEST_CONFIG.storage.publicUrl,
      defaultBucket: TEST_CONFIG.storage.bucket // Make sure we use the test bucket
    };

    const testStorage = new StorageAdapter(testConfig);
    
    // @ts-ignore - Accessing private property for testing
    api.storageAdapter = testStorage;
    
    api.start(TEST_PORT);
  });

  afterAll(async () => {
    if (uploadedFilePath) {
      try {
        await fetch(`${BASE_URL}/api/v1/storage/${uploadedFilePath}`, {
          method: "DELETE"
        });
      } catch (error) {
        console.error('[X] Failed to cleanup test file:', error);
      }
    }
    await store.disconnect();
    await adapter.disconnect();
    await teardown();
  });

  describe("File Upload Operations", () => {
    test("should upload a file with default options", async () => {
      const testContent = "Hello, World!";
      const testPath = "tests/file.txt";
      const file = Buffer.from(testContent);

      const response = await fetch(`${BASE_URL}/api/v1/storage/upload/${testPath}`, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: file
      });

      const result = await response.json();
      expect(response.status).toBe(200);
      expect(result.status).toBe("success");
      expect(result.data.name).toBe("file.txt");
      expect(result.data.bucket).toBe(TEST_CONFIG.storage.bucket);
      expect(result.data.path).toBe(testPath);
      expect(result.data.contentType).toBe("text/plain");
      expect(result.data.size).toBe(testContent.length);
      expect(result.data.url).toContain(TEST_CONFIG.storage.port.toString());

      // Store for cleanup
      uploadedFilePath = testPath;
    });

    test("should upload a file with custom options", async () => {
      const testContent = "Custom Content";
      const customPath = "tests/custom/path/custom-file.txt";
      const file = Buffer.from(testContent);

      const response = await fetch(`${BASE_URL}/api/v1/storage/upload/${customPath}`, {
        method: "POST",
        headers: { "Content-Type": "application/custom" },
        body: file
      });

      const result = await response.json();
      expect(response.status).toBe(200);
      expect(result.status).toBe("success");
      expect(result.data.name).toBe("custom-file.txt");
      expect(result.data.contentType).toBe("application/custom");
      expect(result.data.path).toBe(customPath);

      // Clean up this file
      await fetch(`${BASE_URL}/api/v1/storage/${customPath}`, {
        method: "DELETE"
      });
    });

    test("should handle special characters in path", async () => {
      const testContent = "Special Content";
      const specialPath = "tests/special@#$%/file.txt";
      const file = Buffer.from(testContent);

      const response = await fetch(`${BASE_URL}/api/v1/storage/upload/${specialPath}`, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: file
      });

      const result = await response.json();
      expect(response.status).toBe(200);
      expect(result.status).toBe("success");
      expect(result.data.path).toBe(specialPath);

      // Clean up
      await fetch(`${BASE_URL}/api/v1/storage/${specialPath}`, {
        method: "DELETE"
      });
    });
  });

  describe("File Operations", () => {
    test("should get file info", async () => {
      const response = await fetch(`${BASE_URL}/api/v1/storage/info/${uploadedFilePath}`);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.status).toBe("success");
      expect(result.data.name).toBe("file.txt");
      expect(result.data.path).toBe(uploadedFilePath);
      expect(result.data.contentType).toBe("text/plain");
    });

    test("should generate presigned download URL", async () => {
      const response = await fetch(`${BASE_URL}/api/v1/storage/download/${uploadedFilePath}`);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.status).toBe("success");
      expect(result.data.url).toBeDefined();
      expect(result.data.url).toContain(TEST_CONFIG.storage.bucket);
      expect(result.data.url).toContain(uploadedFilePath);
    });

    test("should generate presigned upload URL", async () => {
      const uploadPath = "tests/presigned-upload.txt";
      const response = await fetch(
        `${BASE_URL}/api/v1/storage/upload-url/${uploadPath}?contentType=text/plain`
      );
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.status).toBe("success");
      expect(result.data.url).toBeDefined();
      expect(result.data.fields).toBeDefined();
      expect(result.data.fields.bucket).toBe(TEST_CONFIG.storage.bucket);
      expect(result.data.fields.key).toBe(uploadPath);
    });

    test("should handle file not found errors", async () => {
      const nonexistentPath = "tests/nonexistent/file.txt";
      
      const response = await fetch(`${BASE_URL}/api/v1/storage/info/${nonexistentPath}`);
      const result = await response.json();
      
      expect(response.status).toBe(200);
      expect(result.status).toBe("error");
      expect(result.code).toBe("storage/object-not-found");
    });

    test("should delete file", async () => {
      // Upload a new file for deletion
      const testContent = "Delete me";
      const deletePath = "tests/delete-test.txt";
      const file = Buffer.from(testContent);

      await fetch(`${BASE_URL}/api/v1/storage/upload/${deletePath}`, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: file
      });

      // Delete the file
      const deleteResponse = await fetch(`${BASE_URL}/api/v1/storage/${deletePath}`, {
        method: "DELETE"
      });
      const deleteResult = await deleteResponse.json();

      expect(deleteResponse.status).toBe(200);
      expect(deleteResult.status).toBe("success");

      // Verify file is deleted
      const verifyResponse = await fetch(`${BASE_URL}/api/v1/storage/info/${deletePath}`);
      const verifyResult = await verifyResponse.json();
      expect(verifyResult.status).toBe("error");
      expect(verifyResult.code).toBe("storage/object-not-found");
    });
  });

  describe("List Operations", () => {
    const testFiles = [
      "tests/folder1/file1.txt",
      "tests/folder1/file2.txt",
      "tests/folder1/subfolder/file3.txt",
      "tests/folder2/file4.txt"
    ];

    beforeAll(async () => {
      // Upload test files
      for (const path of testFiles) {
        await fetch(`${BASE_URL}/api/v1/storage/upload/${path}`, {
          method: "POST",
          headers: { "Content-Type": "text/plain" },
          body: Buffer.from(`Content of ${path}`)
        });
      }
    });

    afterAll(async () => {
      // Clean up test files
      for (const path of testFiles) {
        try {
          await fetch(`${BASE_URL}/api/v1/storage/${path}`, {
            method: "DELETE"
          });
        } catch (error) {
          console.warn(`Failed to delete test file ${path}:`, error);
        }
      }
    });

    test("should list all files and folders", async () => {
      const response = await fetch(`${BASE_URL}/api/v1/storage/list`);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.status).toBe("success");
      expect(result.data.files.length).toBeGreaterThanOrEqual(4);
      expect(result.data.prefixes).toContain("tests/folder1/");
      expect(result.data.prefixes).toContain("tests/folder2/");
      expect(result.data.prefixes).toContain("tests/folder1/subfolder/");

      const fileNames = result.data.files.map((f: any) => f.path);
      testFiles.forEach(file => {
        expect(fileNames).toContain(file);
      });
    });

    test("should list files in specific folder", async () => {
      const response = await fetch(`${BASE_URL}/api/v1/storage/list/tests/folder1`);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.status).toBe("success");
      expect(result.data.files.length).toBeGreaterThanOrEqual(3);
      expect(result.data.prefixes).toContain("tests/folder1/subfolder/");

      const fileNames = result.data.files.map((f: any) => f.path);
      expect(fileNames).toContain("tests/folder1/file1.txt");
      expect(fileNames).toContain("tests/folder1/file2.txt");
      expect(fileNames).toContain("tests/folder1/subfolder/file3.txt");
      expect(fileNames).not.toContain("tests/folder2/file4.txt");
    });

    test("should list files with pagination", async () => {
      // First page (2 results)
      const page1Response = await fetch(`${BASE_URL}/api/v1/storage/list/tests?maxResults=2`);
      const page1 = await page1Response.json();
      expect(page1.data.files.length).toBe(2);
      expect(page1.data.nextPageToken).toBeDefined();

      // Second page
      const page2Response = await fetch(
        `${BASE_URL}/api/v1/storage/list/tests?maxResults=2&pageToken=${page1.data.nextPageToken}`
      );
      const page2 = await page2Response.json();
      expect(page2.data.files.length).toBeGreaterThanOrEqual(1);

      // Get all files for comparison
      const allResponse = await fetch(`${BASE_URL}/api/v1/storage/list/tests`);
      const allFiles = await allResponse.json();
      const allPaths = new Set(allFiles.data.files.map((f: any) => f.path));

      // Verify all returned files exist in the complete set
      const page1Paths = new Set(page1.data.files.map((f: any) => f.path));
      const page2Paths = new Set(page2.data.files.map((f: any) => f.path));

      // Each file from pages should exist in complete set
      for (const path of page1Paths) {
        expect(allPaths.has(path as string)).toBe(true);
        expect((path as string).startsWith('tests/')).toBe(true);
      }
      for (const path of page2Paths) {
        expect(allPaths.has(path as string)).toBe(true);
        expect((path as string).startsWith('tests/')).toBe(true);
      }

      // No duplicates between pages
      const intersection = [...page1Paths].filter(x => page2Paths.has(x));
      expect(intersection.length).toBe(0);
      
      // Verify all paths are in the tests directory
      for (const path of allPaths) {
        expect((path as string).startsWith('tests/')).toBe(true);
      }
    });
  });
}); 