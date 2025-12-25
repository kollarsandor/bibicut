export const VIDEO_PROCESSOR_CONFIG = {
  CHUNK_DURATION_SECONDS: 60,
  BATCH_SIZE: 3,
  FFMPEG_BASE_URL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm',
  YOUTUBE_TIMEOUT_MS: 120000,
  PROGRESS: {
    FFMPEG_LOADING: 10,
    FFMPEG_LOADED: 30,
    VIDEO_PREPARING: 35,
    VIDEO_PREPARED: 40,
    PROCESSING_START: 45,
    PROCESSING_RANGE: 50,
    COMPLETE: 100,
    YOUTUBE_START: 5,
    YOUTUBE_DECODING: 25,
    YOUTUBE_DECODED: 30,
  },
  PADDING_DIGITS: 3,
} as const;

export const FILE_CONFIG = {
  ZIP_FILENAME: 'video_chunks.zip',
  DEFAULT_VIDEO_EXTENSION: '.mp4',
  DEFAULT_MIME_TYPE: 'video/mp4',
  BYTES_PER_MB: 1048576,
  MAX_FILE_SIZE_MB: 2048,
  SUPPORTED_FORMATS: ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/avi'],
} as const;

export const SUPABASE_CONFIG = {
  URL: import.meta.env.VITE_SUPABASE_URL || 'https://haebrawbsusnefurodvr.supabase.co',
  ANON_KEY: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhhZWJyYXdic3VzbmVmdXJvZHZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2MjI3NTIsImV4cCI6MjA4MjE5ODc1Mn0.h1uCzrN2BOKQW6Prp6d2x4y0MHvh9EjYgs8sS4KLq1k',
} as const;