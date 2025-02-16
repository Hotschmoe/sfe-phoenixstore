import { Client } from 'minio';
import { StorageFile, UploadOptions, PresignedUrlOptions } from '../types/storage';
import { config } from '../utils/config';
import { PhoenixStoreError } from '../types';
import { extname } from 'path';

interface StorageConfig {
  endPoint: string;
  port: number;
  useSSL: boolean;
  accessKey: string;
  secretKey: string;
  region?: string;
  publicUrl?: string;
}

export class StorageAdapter {
  private client: Client;
  private readonly defaultBucket: string;
  private readonly publicUrl: string;

  constructor(customConfig?: Partial<StorageConfig>) {
    const finalConfig = {
      endPoint: customConfig?.endPoint || config.STORAGE_ENDPOINT,
      port: customConfig?.port || config.STORAGE_PORT,
      useSSL: customConfig?.useSSL ?? config.STORAGE_USE_SSL,
      accessKey: customConfig?.accessKey || config.STORAGE_ACCESS_KEY,
      secretKey: customConfig?.secretKey || config.STORAGE_SECRET_KEY,
      region: customConfig?.region || config.STORAGE_REGION
    };

    this.client = new Client(finalConfig);
    this.publicUrl = customConfig?.publicUrl || config.STORAGE_PUBLIC_URL;
    this.defaultBucket = config.STORAGE_BUCKET;

    // Ensure bucket exists on initialization
    this.initializeBucket().catch(error => {
      console.error('Failed to initialize bucket:', error);
    });
  }

  private async initializeBucket(): Promise<void> {
    const exists = await this.client.bucketExists(this.defaultBucket);
    if (!exists) {
      await this.client.makeBucket(this.defaultBucket, config.STORAGE_REGION);
      // Make bucket public
      const policy = {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: { AWS: ['*'] },
            Action: ['s3:GetObject'],
            Resource: [`arn:aws:s3:::${this.defaultBucket}/*`]
          }
        ]
      };
      await this.client.setBucketPolicy(this.defaultBucket, JSON.stringify(policy));
    }
  }

  private normalizeMetadata(metaData: Record<string, string>, originalMetadata: Record<string, string> = {}): Record<string, string> {
    // Create a map of lowercase keys to original keys
    const keyMap = Object.keys(originalMetadata).reduce((map, key) => {
      map[key.toLowerCase()] = key;
      return map;
    }, {} as Record<string, string>);

    // Filter out internal metadata and restore original case
    return Object.entries(metaData).reduce((normalized, [key, value]) => {
      // Skip internal MinIO metadata
      if (key.startsWith('x-amz-') || key === 'content-type') {
        return normalized;
      }
      
      // Use original case if available, otherwise use the key as-is
      const originalKey = keyMap[key.toLowerCase()] || key;
      normalized[originalKey] = value;
      return normalized;
    }, {} as Record<string, string>);
  }

  /**
   * Upload a file to storage
   * @param file Buffer or string content to upload
   * @param path Full path including filename (e.g., 'images/profile.jpg')
   * @param options Upload options
   */
  async uploadFile(
    file: Buffer | string,
    path: string,
    options: UploadOptions = {}
  ): Promise<StorageFile> {
    try {
      const bucket = options.bucket || this.defaultBucket;
      const contentType = options.contentType || this.getContentType(path);
      const metadata = options.metadata || {};

      // Ensure bucket exists
      const bucketExists = await this.client.bucketExists(bucket);
      if (!bucketExists) {
        throw new PhoenixStoreError('storage/bucket-not-found', 'Specified bucket does not exist');
      }

      // Upload file
      await this.client.putObject(
        bucket,
        path,
        file,
        file instanceof Buffer ? file.length : Buffer.from(file).length,
        {
          'Content-Type': contentType,
          ...metadata
        }
      );

      // Get file stats
      const stats = await this.client.statObject(bucket, path);
      
      return {
        name: path.split('/').pop() || path,
        bucket,
        path,
        contentType: stats.metaData['content-type'] || contentType,
        size: stats.size,
        metadata: this.normalizeMetadata(stats.metaData, metadata),
        createdAt: stats.lastModified.toISOString(),
        updatedAt: stats.lastModified.toISOString(),
        url: `${this.publicUrl}/${bucket}/${path}`
      };
    } catch (error: any) {
      if (error instanceof PhoenixStoreError) throw error;
      throw new PhoenixStoreError('storage/upload-failed', `Failed to upload file: ${error.message}`);
    }
  }

  /**
   * Get file information
   */
  async getFileInfo(bucket: string, path: string): Promise<StorageFile> {
    try {
      const stats = await this.client.statObject(bucket, path);

      return {
        name: path.split('/').pop() || path,
        bucket,
        path,
        contentType: stats.metaData['content-type'] || 'application/octet-stream',
        size: stats.size,
        metadata: this.normalizeMetadata(stats.metaData),
        createdAt: stats.lastModified.toISOString(),
        updatedAt: stats.lastModified.toISOString(),
        url: `${this.publicUrl}/${bucket}/${path}`
      };
    } catch (error: any) {
      if (error.code === 'NotFound') {
        throw new PhoenixStoreError('storage/object-not-found', 'File does not exist');
      }
      throw new PhoenixStoreError('storage/unknown', `Failed to get file info: ${error.message}`);
    }
  }

  /**
   * Delete a file from storage
   */
  async deleteFile(bucket: string, path: string): Promise<void> {
    try {
      // Check if file exists first
      await this.client.statObject(bucket, path);
      await this.client.removeObject(bucket, path);
    } catch (error: any) {
      if (error.code === 'NotFound') {
        throw new PhoenixStoreError('storage/object-not-found', 'File does not exist');
      }
      throw new PhoenixStoreError('storage/unknown', `Failed to delete file: ${error.message}`);
    }
  }

  /**
   * Generate a presigned URL for file download
   */
  async getPresignedDownloadUrl(
    bucket: string,
    path: string,
    expires: number = 3600
  ): Promise<string> {
    try {
      return await this.client.presignedGetObject(bucket, path, expires);
    } catch (error: any) {
      throw new PhoenixStoreError('storage/invalid-url', `Failed to generate download URL: ${error.message}`);
    }
  }

  /**
   * Generate a presigned URL for file upload
   */
  async getPresignedUploadUrl(
    path: string,
    options: PresignedUrlOptions = {}
  ): Promise<{ url: string; fields: Record<string, string> }> {
    try {
      const bucket = options.bucket || this.defaultBucket;
      const contentType = options.contentType || this.getContentType(path);
      const expirySeconds = options.expires || 3600;

      // Create post policy
      const policy = this.client.newPostPolicy();
      policy.setKey(path);
      policy.setBucket(bucket);
      policy.setContentType(contentType);
      policy.setExpires(new Date(Date.now() + expirySeconds * 1000));

      const result = await this.client.presignedPostPolicy(policy);

      return {
        url: result.postURL,
        fields: {
          ...result.formData,
          key: path,
          bucket,
          'Content-Type': contentType
        }
      };
    } catch (error: any) {
      throw new PhoenixStoreError('storage/invalid-url', `Failed to generate upload URL: ${error.message}`);
    }
  }

  private getContentType(fileName: string): string {
    const ext = extname(fileName).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.txt': 'text/plain',
      '.json': 'application/json',
      '.xml': 'application/xml',
      '.zip': 'application/zip',
      '.mp3': 'audio/mpeg',
      '.mp4': 'video/mp4',
      '.wav': 'audio/wav',
      '.avi': 'video/x-msvideo',
      '.mov': 'video/quicktime',
      '.webm': 'video/webm'
    };

    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * List all files and prefixes (folders) at a given path
   * @param prefix Directory path to list from (e.g., 'users/' or 'users/123/images/')
   */
  async listAll(prefix: string = ''): Promise<{ files: StorageFile[]; prefixes: string[] }> {
    try {
      const bucket = this.defaultBucket;
      const stream = this.client.listObjectsV2(bucket, prefix, true);
      
      const files: StorageFile[] = [];
      const prefixSet = new Set<string>();

      for await (const item of stream) {
        // Get file info
        const fileInfo = await this.getFileInfo(bucket, item.name);
        files.push(fileInfo);

        // Extract prefixes (folders)
        const parts = item.name.split('/');
        if (parts.length > 1) {
          // Add all parent folders
          for (let i = 0; i < parts.length - 1; i++) {
            const prefix = parts.slice(0, i + 1).join('/') + '/';
            if (prefix.startsWith(prefix)) {
              prefixSet.add(prefix);
            }
          }
        }
      }

      return {
        files,
        prefixes: Array.from(prefixSet)
      };
    } catch (error: any) {
      throw new PhoenixStoreError('storage/unknown', `Failed to list files: ${error.message}`);
    }
  }

  /**
   * List files and prefixes with pagination
   * @param prefix Directory path to list from
   * @param options Pagination options
   */
  async list(prefix: string = '', options: { maxResults?: number; pageToken?: string } = {}): Promise<{
    files: StorageFile[];
    prefixes: string[];
    nextPageToken?: string;
  }> {
    try {
      const bucket = this.defaultBucket;
      const maxResults = options.maxResults || 1000;
      
      // Use pageToken as startAfter if provided
      const stream = this.client.listObjectsV2(bucket, prefix, true, options.pageToken);
      
      const files: StorageFile[] = [];
      const prefixSet = new Set<string>();
      let nextMarker: string | undefined;
      let count = 0;
      let skipCount = 0;

      for await (const item of stream) {
        // Get file info
        const fileInfo = await this.getFileInfo(bucket, item.name);
        files.push(fileInfo);
        count++;

        if (count >= maxResults) {
          nextMarker = item.name;
          break;
        }

        // Extract prefixes (folders)
        const parts = item.name.split('/');
        if (parts.length > 1) {
          // Add all parent folders
          for (let i = 0; i < parts.length - 1; i++) {
            const prefix = parts.slice(0, i + 1).join('/') + '/';
            if (prefix.startsWith(prefix)) {
              prefixSet.add(prefix);
            }
          }
        }
      }

      return {
        files,
        prefixes: Array.from(prefixSet),
        ...(nextMarker && { nextPageToken: nextMarker })
      };
    } catch (error: any) {
      throw new PhoenixStoreError('storage/unknown', `Failed to list files: ${error.message}`);
    }
  }
} 