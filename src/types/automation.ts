export interface AutomationStatus {
  status: 'idle' | 'processing' | 'completed' | 'error' | 'cancelled';
  message: string;
  progress: number;
  currentChunk: number;
  totalChunks: number;
  phase: 'waiting' | 'initializing' | 'splitting' | 'dubbing' | 'merging' | 'extracting' | 'replacing' | 'completed' | 'error' | 'cancelled';
}

export interface AutomationResult {
  success: boolean;
  dubbedChunks?: string[];
  mergedDubbedVideo?: string;
  dubbedAudio?: string;
  finalVideo?: string;
  error?: string;
}

export interface AutomationFiles {
  input: string[];
  output: string[];
  dubbed: string[];
}
