export interface StorageFile {
  name: string;         // File name from path
  bucket: string;       // Bucket name
  path: string;         // Full path in bucket
  contentType: string;  // MIME type
  size: number;         // File size in bytes
  metadata?: {          // Optional metadata
    [key: string]: string;
  };
  createdAt: string;    // ISO date string
  updatedAt: string;    // ISO date string
  url: string;          // Public URL
}

export interface UploadOptions {
  bucket?: string;      // Target bucket (defaults to 'uploads')
  contentType?: string; // Override content type
  metadata?: {          // Custom metadata
    [key: string]: string;
  };
}

export interface PresignedUrlOptions {
  bucket?: string;      // Target bucket (defaults to 'uploads')
  contentType?: string; // Override content type
  expires?: number;     // URL expiration in seconds
}

// Firebase-like error codes
export type StorageErrorCode = 
  | 'storage/unknown'
  | 'storage/object-not-found'
  | 'storage/bucket-not-found'
  | 'storage/upload-failed'
  | 'storage/invalid-url';

export interface StorageError {
  code: 
    | 'FILE_NOT_FOUND'
    | 'BUCKET_NOT_FOUND'
    | 'INVALID_FILE'
    | 'UPLOAD_ERROR'
    | 'DELETE_ERROR'
    | 'STORAGE_ERROR';
  message: string;
  details?: any;
} 