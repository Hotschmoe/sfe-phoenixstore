import { describe, expect, test, beforeAll, afterAll } from 'bun:test';
import { StorageAdapter } from '../adapters/StorageAdapter';
import { setup, teardown, TEST_CONFIG } from './setup';

describe('Storage', () => {
  let storage: StorageAdapter;
  const testFilePath = 'tests/file.txt';
  const testFileContent = 'Hello, World!';
  let uploadedFilePath: string;

  beforeAll(async () => {
    try {
      await setup();
      
      // Initialize StorageAdapter with test configuration
      const testConfig = {
        endPoint: TEST_CONFIG.storage.host,
        port: TEST_CONFIG.storage.port,
        useSSL: TEST_CONFIG.storage.useSSL,
        accessKey: TEST_CONFIG.storage.accessKey,
        secretKey: TEST_CONFIG.storage.secretKey,
        region: TEST_CONFIG.storage.region,
        url: TEST_CONFIG.storage.publicUrl,
        bucket: TEST_CONFIG.storage.bucket  // Changed from defaultBucket to bucket
      };

      storage = new StorageAdapter(testConfig);
      
      // Give MinIO a moment to initialize
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error('[X] Failed to setup storage tests:', error);
      throw error;
    }
  });

  afterAll(async () => {
    try {
      // Clean up uploaded file if it exists
      if (uploadedFilePath) {
        await storage.deleteFile(TEST_CONFIG.storage.bucket, uploadedFilePath);
      }
      await teardown();
    } catch (error) {
      console.error('[X] Failed to cleanup storage tests:', error);
    }
  });

  describe('File Upload', () => {
    test('should upload a file with default options', async () => {
      const file = Buffer.from(testFileContent);
      const result = await storage.uploadFile(file, testFilePath);

      expect(result).toBeDefined();
      expect(result.name).toBe('file.txt');
      expect(result.bucket).toBe(TEST_CONFIG.storage.bucket);
      expect(result.path).toBe(testFilePath);
      expect(result.contentType).toBe('text/plain');
      expect(result.size).toBe(testFileContent.length);
      expect(result.url).toContain(TEST_CONFIG.storage.port.toString());

      // Store for cleanup
      uploadedFilePath = result.path;
    });

    test('should upload a file with custom options', async () => {
      const file = Buffer.from(testFileContent);
      const customPath = 'tests/custom/path/custom-file.txt';
      const options = {
        contentType: 'application/custom',
        metadata: {
          userId: '123',
          purpose: 'test'
        }
      };

      const result = await storage.uploadFile(file, customPath, options);

      expect(result).toBeDefined();
      expect(result.name).toBe('custom-file.txt');
      expect(result.bucket).toBe(TEST_CONFIG.storage.bucket);
      expect(result.path).toBe(customPath);
      expect(result.contentType).toBe(options.contentType);
      expect(result.metadata).toEqual(options.metadata);
      expect(result.url).toContain(TEST_CONFIG.storage.port.toString());

      // Clean up this file
      await storage.deleteFile(result.bucket, result.path);
    });

    test('should handle special characters in path', async () => {
      const file = Buffer.from(testFileContent);
      const pathWithSpecialChars = 'tests/special@#$%/file.txt';

      const result = await storage.uploadFile(file, pathWithSpecialChars);
      expect(result.path).toBe(pathWithSpecialChars);

      // Clean up
      await storage.deleteFile(result.bucket, result.path);
    });
  });

  describe('File Operations', () => {
    test('should get file info', async () => {
      const fileInfo = await storage.getFileInfo(TEST_CONFIG.storage.bucket, uploadedFilePath);

      expect(fileInfo).toBeDefined();
      expect(fileInfo.name).toBe('file.txt');
      expect(fileInfo.path).toBe(uploadedFilePath);
      expect(fileInfo.size).toBe(testFileContent.length);
      expect(fileInfo.contentType).toBe('text/plain');
    });

    test('should generate presigned download URL', async () => {
      const url = await storage.getPresignedDownloadUrl(TEST_CONFIG.storage.bucket, uploadedFilePath);

      expect(url).toBeDefined();
      expect(url).toContain(TEST_CONFIG.storage.bucket);
      expect(url).toContain(uploadedFilePath);
    });

    test('should generate presigned upload URL', async () => {
      const uploadPath = 'test/presigned-upload.txt';
      console.log('[Storage] Generating presigned upload URL:', {
        bucket: TEST_CONFIG.storage.bucket,
        path: uploadPath,
        contentType: 'text/plain',
        expirySeconds: 3600,
      });
      const result = await storage.getPresignedUploadUrl(uploadPath);
      console.log('[Storage] Generated presigned upload URL:', {
        postURL: result.url,
        fields: Object.keys(result.fields),
      });

      expect(result.url).toBeDefined();
      expect(result.fields).toBeDefined();
      expect(result.fields.bucket).toBe(TEST_CONFIG.storage.bucket);
      expect(result.fields.key).toBe(uploadPath);
    });

    test('should handle file not found errors', async () => {
      const nonexistentPath = 'nonexistent/file.txt';
      
      await expect(storage.getFileInfo(TEST_CONFIG.storage.bucket, nonexistentPath))
        .rejects.toThrow('storage/object-not-found');
        
      await expect(storage.deleteFile(TEST_CONFIG.storage.bucket, nonexistentPath))
        .rejects.toThrow('storage/object-not-found');
    });

    test('should delete file', async () => {
      // Upload a new file for deletion
      const file = Buffer.from('Delete me');
      const deletePath = 'test/delete-test.txt';
      const result = await storage.uploadFile(file, deletePath);

      // Delete the file
      await storage.deleteFile(result.bucket, result.path);

      // Verify file is deleted
      await expect(storage.getFileInfo(result.bucket, result.path))
        .rejects.toThrow('storage/object-not-found');
    });
  });

  describe('List Operations', () => {
    beforeAll(async () => {
      // Upload test files in different paths
      const testFiles = [
        'tests/folder1/file1.txt',
        'tests/folder1/file2.txt',
        'tests/folder1/subfolder/file3.txt',
        'tests/folder2/file4.txt'
      ];

      for (const path of testFiles) {
        await storage.uploadFile(Buffer.from(`Content of ${path}`), path);
      }
    });

    afterAll(async () => {
      // Clean up test files
      const testFiles = [
        'tests/folder1/file1.txt',
        'tests/folder1/file2.txt',
        'tests/folder1/subfolder/file3.txt',
        'tests/folder2/file4.txt'
      ];

      for (const path of testFiles) {
        try {
          await storage.deleteFile(TEST_CONFIG.storage.bucket, path);
        } catch (error) {
          console.warn(`Failed to delete test file ${path}:`, error);
        }
      }
    });

    test('should list all files and folders', async () => {
      const result = await storage.listAll('tests/');
      
      expect(result.files.length).toBeGreaterThanOrEqual(4); // Our test files
      expect(result.prefixes).toContain('tests/folder1/');
      expect(result.prefixes).toContain('tests/folder2/');
      expect(result.prefixes).toContain('tests/folder1/subfolder/');
      
      // Verify file contents
      const fileNames = result.files.map(f => f.path);
      expect(fileNames).toContain('tests/folder1/file1.txt');
      expect(fileNames).toContain('tests/folder1/file2.txt');
      expect(fileNames).toContain('tests/folder1/subfolder/file3.txt');
      expect(fileNames).toContain('tests/folder2/file4.txt');
    });

    test('should list files in specific folder', async () => {
      const result = await storage.listAll('tests/folder1/');
      
      expect(result.files.length).toBeGreaterThanOrEqual(3); // Files in folder1
      expect(result.prefixes).toContain('tests/folder1/subfolder/');
      
      const fileNames = result.files.map(f => f.path);
      expect(fileNames).toContain('tests/folder1/file1.txt');
      expect(fileNames).toContain('tests/folder1/file2.txt');
      expect(fileNames).toContain('tests/folder1/subfolder/file3.txt');
      expect(fileNames).not.toContain('tests/folder2/file4.txt');
    });

    test('should list files with pagination', async () => {
      // First page (2 results)
      const page1 = await storage.list('tests/', { maxResults: 2 });
      expect(page1.files.length).toBe(2);
      expect(page1.nextPageToken).toBeDefined();

      // Second page
      const page2 = await storage.list('tests/', { 
        maxResults: 2,
        pageToken: page1.nextPageToken
      });
      expect(page2.files.length).toBeGreaterThanOrEqual(1);
      
      // Get all files for comparison
      const allFiles = await storage.listAll('tests/');
      const allPaths = new Set(allFiles.files.map(f => f.path));
      
      // Verify all returned files exist in the complete set
      const page1Paths = new Set(page1.files.map(f => f.path));
      const page2Paths = new Set(page2.files.map(f => f.path));
      
      // Each file from pages should exist in complete set
      for (const path of page1Paths) {
        expect(allPaths.has(path)).toBe(true);
      }
      for (const path of page2Paths) {
        expect(allPaths.has(path)).toBe(true);
      }
      
      // No duplicates between pages
      const intersection = [...page1Paths].filter(x => page2Paths.has(x));
      expect(intersection.length).toBe(0);
      
      // Total number of files returned should match maxResults
      expect(page1.files.length).toBe(2); // First page full
      expect(page2.files.length).toBeGreaterThanOrEqual(1); // At least one in second page
    });
  });
}); 