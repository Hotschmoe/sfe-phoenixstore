import { describe, expect, test, beforeAll, afterAll } from 'bun:test';
import { StorageAdapter } from '../adapters/StorageAdapter';
import { setup, teardown, getTestStorageConfig } from './setup';
import { config } from '../utils/config';

describe('Storage', () => {
  let storage: StorageAdapter;
  const testFilePath = 'test/file.txt';
  const testFileContent = 'Hello, World!';
  let uploadedFilePath: string;

  beforeAll(async () => {
    try {
      await setup();
      storage = new StorageAdapter(getTestStorageConfig());
      
      // Give MinIO a moment to initialize
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error('Failed to setup storage tests:', error);
      throw error;
    }
  });

  afterAll(async () => {
    try {
      // Clean up uploaded file if it exists
      if (uploadedFilePath) {
        await storage.deleteFile(config.STORAGE_BUCKET, uploadedFilePath);
      }
      await teardown();
    } catch (error) {
      console.error('Failed to cleanup storage tests:', error);
    }
  });

  describe('File Upload', () => {
    test('should upload a file with default options', async () => {
      const file = Buffer.from(testFileContent);
      const result = await storage.uploadFile(file, testFilePath);

      expect(result).toBeDefined();
      expect(result.name).toBe('file.txt');
      expect(result.bucket).toBe(config.STORAGE_BUCKET);
      expect(result.path).toBe(testFilePath);
      expect(result.contentType).toBe('text/plain');
      expect(result.size).toBe(testFileContent.length);
      expect(result.url).toContain(config.STORAGE_PUBLIC_URL);

      // Store for cleanup
      uploadedFilePath = result.path;
    });

    test('should upload a file with custom options', async () => {
      const file = Buffer.from(testFileContent);
      const customPath = 'custom/path/custom-file.txt';
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
      expect(result.bucket).toBe(config.STORAGE_BUCKET);
      expect(result.path).toBe(customPath);
      expect(result.contentType).toBe(options.contentType);
      expect(result.metadata).toEqual(options.metadata);
      expect(result.url).toContain(config.STORAGE_PUBLIC_URL);

      // Clean up this file
      await storage.deleteFile(result.bucket, result.path);
    });

    test('should handle special characters in path', async () => {
      const file = Buffer.from(testFileContent);
      const pathWithSpecialChars = 'test/special@#$%/file.txt';

      const result = await storage.uploadFile(file, pathWithSpecialChars);
      expect(result.path).toBe(pathWithSpecialChars);

      // Clean up
      await storage.deleteFile(result.bucket, result.path);
    });
  });

  describe('File Operations', () => {
    test('should get file info', async () => {
      const fileInfo = await storage.getFileInfo(config.STORAGE_BUCKET, uploadedFilePath);

      expect(fileInfo).toBeDefined();
      expect(fileInfo.name).toBe('file.txt');
      expect(fileInfo.path).toBe(uploadedFilePath);
      expect(fileInfo.size).toBe(testFileContent.length);
      expect(fileInfo.contentType).toBe('text/plain');
    });

    test('should generate presigned download URL', async () => {
      const url = await storage.getPresignedDownloadUrl(config.STORAGE_BUCKET, uploadedFilePath);

      expect(url).toBeDefined();
      expect(url).toContain(config.STORAGE_BUCKET);
      expect(url).toContain(uploadedFilePath);
    });

    test('should generate presigned upload URL', async () => {
      const uploadPath = 'test/presigned-upload.txt';
      const { url, fields } = await storage.getPresignedUploadUrl(uploadPath);

      expect(url).toBeDefined();
      expect(fields).toBeDefined();
      expect(fields.bucket).toBe(config.STORAGE_BUCKET);
      expect(fields.key).toBe(uploadPath);
    });

    test('should handle file not found errors', async () => {
      const nonexistentPath = 'nonexistent/file.txt';
      
      await expect(storage.getFileInfo(config.STORAGE_BUCKET, nonexistentPath))
        .rejects.toThrow('storage/object-not-found');
        
      await expect(storage.deleteFile(config.STORAGE_BUCKET, nonexistentPath))
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
        'folder1/file1.txt',
        'folder1/file2.txt',
        'folder1/subfolder/file3.txt',
        'folder2/file4.txt'
      ];

      for (const path of testFiles) {
        await storage.uploadFile(Buffer.from(`Content of ${path}`), path);
      }
    });

    afterAll(async () => {
      // Clean up test files
      const testFiles = [
        'folder1/file1.txt',
        'folder1/file2.txt',
        'folder1/subfolder/file3.txt',
        'folder2/file4.txt'
      ];

      for (const path of testFiles) {
        try {
          await storage.deleteFile(config.STORAGE_BUCKET, path);
        } catch (error) {
          console.warn(`Failed to delete test file ${path}:`, error);
        }
      }
    });

    test('should list all files and folders', async () => {
      const result = await storage.listAll();
      
      expect(result.files.length).toBeGreaterThanOrEqual(4); // Our test files
      expect(result.prefixes).toContain('folder1/');
      expect(result.prefixes).toContain('folder2/');
      expect(result.prefixes).toContain('folder1/subfolder/');
      
      // Verify file contents
      const fileNames = result.files.map(f => f.path);
      expect(fileNames).toContain('folder1/file1.txt');
      expect(fileNames).toContain('folder1/file2.txt');
      expect(fileNames).toContain('folder1/subfolder/file3.txt');
      expect(fileNames).toContain('folder2/file4.txt');
    });

    test('should list files in specific folder', async () => {
      const result = await storage.listAll('folder1/');
      
      expect(result.files.length).toBeGreaterThanOrEqual(3); // Files in folder1
      expect(result.prefixes).toContain('folder1/subfolder/');
      
      const fileNames = result.files.map(f => f.path);
      expect(fileNames).toContain('folder1/file1.txt');
      expect(fileNames).toContain('folder1/file2.txt');
      expect(fileNames).toContain('folder1/subfolder/file3.txt');
      expect(fileNames).not.toContain('folder2/file4.txt');
    });

    test('should list files with pagination', async () => {
      // First page (2 results)
      const page1 = await storage.list('', { maxResults: 2 });
      expect(page1.files.length).toBe(2);
      expect(page1.nextPageToken).toBeDefined();

      // Second page
      const page2 = await storage.list('', { 
        maxResults: 2,
        pageToken: page1.nextPageToken
      });
      expect(page2.files.length).toBeGreaterThanOrEqual(1);
      
      // Get all files for comparison
      const allFiles = await storage.listAll();
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