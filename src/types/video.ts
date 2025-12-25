export interface VideoChunk {
  name: string;
  startTime: number;
  endTime: number;
  blob: Blob;
}

export type ProcessingStatus = 'idle' | 'loading' | 'processing' | 'complete' | 'error';

export interface ProcessingState {
  status: ProcessingStatus;
  progress: number;
  currentStep: string;
  chunks: VideoChunk[];
  totalChunks: number;
  processedChunks: number;
}

export interface VideoProcessorConfig {
  chunkDurationSeconds: number;
  batchSize: number;
  ffmpegBaseUrl: string;
  youtubeTimeoutMs: number;
}

export interface DownloadResult {
  success: boolean;
  title: string;
  quality: string;
  mimeType: string;
  videoBase64: string;
  size: number;
  error?: string;
}