import { describe, expect, test, beforeAll, afterAll } from 'bun:test';
import { StorageAdapter } from '../adapters/StorageAdapter';
import { setup, teardown, getTestStorageConfig } from './setup';
import { config } from '../utils/config';

describe('Storage', () => {
  let storage: StorageAdapter;
  const testFilePath = 'test/file.txt';
  const testFileContent = 'Hello, World!';
  let uploadedFilePath: string;
  let uploadedBucket: string;

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
      if (uploadedFilePath && uploadedBucket) {
        await storage.deleteFile(uploadedBucket, uploadedFilePath);
      }
      await teardown();
    } catch (error) {
      console.error('Failed to cleanup storage tests:', error);
    }
  });

  describe('File Upload', () => {
    test('should upload a file to default bucket with path', async () => {
      const file = Buffer.from(testFileContent);
      const result = await storage.uploadFile(file, testFilePath);

      expect(result).toBeDefined();
      expect(result.name).toBe('file.txt');
      expect(result.bucket).toBe(config.STORAGE_BUCKETS.UPLOADS);
      expect(result.path).toBe(testFilePath);
      expect(result.contentType).toBe('text/plain');
      expect(result.size).toBe(testFileContent.length);
      expect(result.url).toContain(config.STORAGE_PUBLIC_URL);

      // Store for cleanup
      uploadedFilePath = result.path;
      uploadedBucket = result.bucket;
    });

    test('should upload a file with custom options', async () => {
      const file = Buffer.from(testFileContent);
      const customPath = 'custom/path/custom-file.txt';
      const options = {
        bucket: config.STORAGE_BUCKETS.AVATARS,
        contentType: 'application/custom',
        metadata: {
          userId: '123',
          purpose: 'test'
        }
      };

      const result = await storage.uploadFile(file, customPath, options);

      expect(result).toBeDefined();
      expect(result.name).toBe('custom-file.txt');
      expect(result.bucket).toBe(options.bucket);
      expect(result.path).toBe(customPath);
      expect(result.contentType).toBe(options.contentType);
      expect(result.metadata).toEqual(options.metadata);
      expect(result.url).toContain(config.STORAGE_PUBLIC_URL);

      // Clean up this file
      await storage.deleteFile(result.bucket, result.path);
    });

    test('should fail with invalid bucket', async () => {
      const file = Buffer.from(testFileContent);
      const options = {
        bucket: 'nonexistent-bucket'
      };

      await expect(storage.uploadFile(file, testFilePath, options))
        .rejects.toThrow('storage/bucket-not-found');
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
      const fileInfo = await storage.getFileInfo(uploadedBucket, uploadedFilePath);

      expect(fileInfo).toBeDefined();
      expect(fileInfo.name).toBe('file.txt');
      expect(fileInfo.path).toBe(uploadedFilePath);
      expect(fileInfo.size).toBe(testFileContent.length);
      expect(fileInfo.contentType).toBe('text/plain');
    });

    test('should generate presigned download URL', async () => {
      const url = await storage.getPresignedDownloadUrl(uploadedBucket, uploadedFilePath);

      expect(url).toBeDefined();
      expect(url).toContain(uploadedBucket);
      expect(url).toContain(uploadedFilePath);
    });

    test('should generate presigned upload URL', async () => {
      const uploadPath = 'test/presigned-upload.txt';
      const { url, fields } = await storage.getPresignedUploadUrl(uploadPath);

      expect(url).toBeDefined();
      expect(fields).toBeDefined();
      expect(fields.bucket).toBe(config.STORAGE_BUCKETS.UPLOADS);
      expect(fields.key).toBe(uploadPath);
    });

    test('should handle file not found errors', async () => {
      const nonexistentPath = 'nonexistent/file.txt';
      
      await expect(storage.getFileInfo(uploadedBucket, nonexistentPath))
        .rejects.toThrow('storage/object-not-found');
        
      await expect(storage.deleteFile(uploadedBucket, nonexistentPath))
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
}); 