import { describe, expect, test, beforeAll, afterAll } from 'bun:test';
import { StorageAdapter } from '../adapters/StorageAdapter';
import { setup, teardown, getTestStorageConfig } from './setup';
import { config } from '../utils/config';

describe('Storage', () => {
  let storage: StorageAdapter;
  const testFileName = 'test-file.txt';
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
    test('should upload a file to default bucket', async () => {
      const file = Buffer.from(testFileContent);
      const result = await storage.uploadFile(file, testFileName);

      expect(result).toBeDefined();
      expect(result.name).toBe(testFileName);
      expect(result.bucket).toBe(config.STORAGE_BUCKETS.UPLOADS);
      expect(result.contentType).toBe('text/plain');
      expect(result.size).toBe(testFileContent.length);
      expect(result.path).toBeDefined();
      expect(result.id).toBeDefined();

      // Store for cleanup
      uploadedFilePath = result.path;
      uploadedBucket = result.bucket;
    });

    test('should upload a file with custom options', async () => {
      const file = Buffer.from(testFileContent);
      const options = {
        bucket: config.STORAGE_BUCKETS.AVATARS,
        path: 'custom/path',
        metadata: {
          userId: '123',
          purpose: 'test'
        },
        contentType: 'application/custom',
        public: true
      };

      const result = await storage.uploadFile(file, testFileName, options);

      expect(result).toBeDefined();
      expect(result.bucket).toBe(options.bucket);
      expect(result.path).toContain(options.path);
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

      await expect(storage.uploadFile(file, testFileName, options))
        .rejects.toThrow('Bucket not found');
    });
  });

  describe('File Operations', () => {
    test('should get file info', async () => {
      const fileInfo = await storage.getFileInfo(uploadedBucket, uploadedFilePath);

      expect(fileInfo).toBeDefined();
      expect(fileInfo.name).toBe(testFileName);
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
      const { url, fields } = await storage.getPresignedUploadUrl('new-file.txt');

      expect(url).toBeDefined();
      expect(fields).toBeDefined();
      expect(fields['bucket']).toBeDefined();
      expect(fields['key']).toBeDefined();
    });

    test('should delete file', async () => {
      // Upload a new file for deletion
      const file = Buffer.from('Delete me');
      const result = await storage.uploadFile(file, 'delete-test.txt');

      // Delete the file
      await storage.deleteFile(result.bucket, result.path);

      // Verify file is deleted
      await expect(storage.getFileInfo(result.bucket, result.path))
        .rejects.toThrow('FILE_NOT_FOUND');
    });
  });
}); 