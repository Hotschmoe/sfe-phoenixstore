import { Client } from 'minio';
import { StorageFile, UploadOptions, PresignedUrlOptions, StorageError } from '../types/storage';
import { config } from '../utils/config';
import { PhoenixStoreError } from '../types';
import { randomBytes } from 'crypto';
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
  private readonly defaultBucket = config.STORAGE_BUCKETS.UPLOADS;
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

    // Ensure buckets exist on initialization
    this.initializeBuckets().catch(error => {
      console.error('Failed to initialize buckets:', error);
    });
  }

  private async initializeBuckets(): Promise<void> {
    const requiredBuckets = [
      config.STORAGE_BUCKETS.UPLOADS,
      config.STORAGE_BUCKETS.AVATARS
    ];

    for (const bucket of requiredBuckets) {
      const exists = await this.client.bucketExists(bucket);
      if (!exists) {
        await this.client.makeBucket(bucket, config.STORAGE_REGION);
        // Make bucket public
        const policy = {
          Version: '2012-10-17',
          Statement: [
            {
              Effect: 'Allow',
              Principal: { AWS: ['*'] },
              Action: ['s3:GetObject'],
              Resource: [`arn:aws:s3:::${bucket}/*`]
            }
          ]
        };
        await this.client.setBucketPolicy(bucket, JSON.stringify(policy));
      }
    }
  }

  /**
   * Upload a file to storage
   */
  async uploadFile(
    file: Buffer | string,
    fileName: string,
    options: UploadOptions = {}
  ): Promise<StorageFile> {
    try {
      const bucket = options.bucket || this.defaultBucket;
      const fileId = this.generateFileId();
      const ext = extname(fileName);
      const path = options.path 
        ? `${options.path}/${fileId}${ext}`
        : `${fileId}${ext}`;

      // Store original filename in metadata
      const metadata = {
        'Original-Filename': fileName,
        ...options.metadata
      };

      // Ensure bucket exists
      const bucketExists = await this.client.bucketExists(bucket);
      if (!bucketExists) {
        throw new PhoenixStoreError('Bucket not found', 'BUCKET_NOT_FOUND');
      }

      // Upload file
      await this.client.putObject(
        bucket,
        path,
        file,
        file instanceof Buffer ? file.length : Buffer.from(file).length,
        {
          'Content-Type': options.contentType || this.getContentType(fileName),
          ...metadata
        }
      );

      // Generate file info
      const stats = await this.client.statObject(bucket, path);
      const url = options.public 
        ? `${this.publicUrl}/${bucket}/${path}`
        : '';

      return {
        id: fileId,
        name: fileName,  // Use original filename
        bucket,
        path,
        contentType: stats.metaData['content-type'] || 'application/octet-stream',
        size: stats.size,
        metadata,
        createdAt: stats.lastModified.toISOString(),
        updatedAt: stats.lastModified.toISOString(),
        url
      };
    } catch (error: any) {
      throw new PhoenixStoreError(
        `Failed to upload file: ${error.message}`,
        'UPLOAD_ERROR'
      );
    }
  }

  /**
   * Generate a presigned URL for file upload
   */
  async getPresignedUploadUrl(
    fileName: string,
    options: PresignedUrlOptions = {}
  ): Promise<{ url: string; fields: Record<string, string> }> {
    try {
      const bucket = options.bucket || this.defaultBucket;
      const fileId = this.generateFileId();
      const ext = extname(fileName);
      const path = options.path 
        ? `${options.path}/${fileId}${ext}`
        : `${fileId}${ext}`;

      const contentType = options.contentType || this.getContentType(fileName);
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
      throw new PhoenixStoreError(
        `Failed to generate presigned URL: ${error.message}`,
        'STORAGE_ERROR'
      );
    }
  }

  /**
   * Delete a file from storage
   */
  async deleteFile(bucket: string, path: string): Promise<void> {
    try {
      await this.client.removeObject(bucket, path);
    } catch (error: any) {
      if (error.code === 'NoSuchKey' || error.code === 'NotFound') {
        throw new PhoenixStoreError('File not found', 'FILE_NOT_FOUND');
      }
      throw new PhoenixStoreError(
        `Failed to delete file: ${error.message}`,
        'DELETE_ERROR'
      );
    }
  }

  /**
   * Get file information
   */
  async getFileInfo(bucket: string, path: string): Promise<StorageFile> {
    try {
      const stats = await this.client.statObject(bucket, path);
      const fileId = path.split('/').pop()?.split('.')[0] || '';
      const originalName = stats.metaData['original-filename'] || path.split('/').pop() || '';

      return {
        id: fileId,
        name: originalName,
        bucket,
        path,
        contentType: stats.metaData['content-type'] || 'application/octet-stream',
        size: stats.size,
        metadata: stats.metaData,
        createdAt: stats.lastModified.toISOString(),
        updatedAt: stats.lastModified.toISOString(),
        url: `${this.publicUrl}/${bucket}/${path}`
      };
    } catch (error: any) {
      if (error.code === 'NotFound') {
        throw new PhoenixStoreError('File not found', 'FILE_NOT_FOUND');
      }
      throw new PhoenixStoreError(
        `Failed to get file info: ${error.message}`,
        'FILE_NOT_FOUND'
      );
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
      throw new PhoenixStoreError(
        `Failed to generate download URL: ${error.message}`,
        'STORAGE_ERROR'
      );
    }
  }

  private generateFileId(): string {
    return randomBytes(16).toString('hex');
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
} 