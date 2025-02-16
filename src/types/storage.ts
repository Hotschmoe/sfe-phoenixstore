export interface StorageFile {
  id: string;           // Unique file identifier
  name: string;         // Original file name
  bucket: string;       // Bucket name
  path: string;         // Full path in bucket
  contentType: string;  // MIME type
  size: number;         // File size in bytes
  metadata?: {          // Optional metadata
    [key: string]: string;
  };
  createdAt: string;    // ISO date string
  updatedAt: string;    // ISO date string
  url: string;          // Public URL (if available)
}

export interface UploadOptions {
  bucket?: string;      // Target bucket (defaults to 'uploads')
  path?: string;        // Custom path within bucket
  metadata?: {          // Custom metadata
    [key: string]: string;
  };
  contentType?: string; // Override content type
  public?: boolean;     // Make file publicly accessible
}

export interface PresignedUrlOptions extends UploadOptions {
  expires?: number;     // URL expiration in seconds
}

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