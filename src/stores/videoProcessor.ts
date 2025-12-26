import { createSignal, batch } from '@/core/signal';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';
import { supabase } from '@/lib/supabaseClient';
import type { VideoChunk, ProcessingStatus, DownloadResult } from '@/types/video';
import { VIDEO_PROCESSOR_CONFIG, FILE_CONFIG } from '@/constants/config';
import { TRANSLATIONS } from '@/constants/translations';

export interface VideoProcessorState {
  status: ProcessingStatus;
  progress: number;
  currentStep: string;
  chunks: VideoChunk[];
  totalChunks: number;
  processedChunks: number;
}

export interface VideoProcessorActions {
  processVideo: (file: File) => Promise<void>;
  processYoutubeUrl: (url: string) => Promise<void>;
  reset: () => void;
  cancel: () => void;
}

export interface VideoProcessorStore {
  getStatus: () => ProcessingStatus;
  getProgress: () => number;
  getCurrentStep: () => string;
  getChunks: () => VideoChunk[];
  getTotalChunks: () => number;
  getProcessedChunks: () => number;
  subscribe: (callback: () => void) => () => void;
  actions: VideoProcessorActions;
}

let ffmpegInstance: FFmpeg | null = null;
let isFFmpegLoaded = false;
let cancelledFlag = false;
const blobUrls: string[] = [];

function getFFmpeg(): FFmpeg {
  if (!ffmpegInstance) {
    ffmpegInstance = new FFmpeg();
  }
  return ffmpegInstance;
}

function cleanupBlobUrls(): void {
  const len = blobUrls.length;
  for (let i = 0; i < len; i++) {
    try {
      URL.revokeObjectURL(blobUrls[i]);
    } catch (e) {}
  }
  blobUrls.length = 0;
}

export function createVideoProcessorStore(): VideoProcessorStore {
  const [status, setStatus] = createSignal<ProcessingStatus>('idle');
  const [progress, setProgress] = createSignal(0);
  const [currentStep, setCurrentStep] = createSignal('');
  const [chunks, setChunks] = createSignal<VideoChunk[]>([]);
  const [totalChunks, setTotalChunks] = createSignal(0);
  const [processedChunks, setProcessedChunks] = createSignal(0);
  
  const subscribers = new Set<() => void>();
  
  const notify = (): void => {
    const subs = Array.from(subscribers);
    const len = subs.length;
    for (let i = 0; i < len; i++) {
      subs[i]();
    }
  };
  
  const loadFFmpeg = async (): Promise<boolean> => {
    if (isFFmpegLoaded) return true;
    
    try {
      batch(() => {
        setStatus('loading');
        setCurrentStep(TRANSLATIONS.processing.loadingFfmpeg);
        setProgress(VIDEO_PROCESSOR_CONFIG.PROGRESS.FFMPEG_LOADING);
      });
      notify();
      
      const ffmpeg = getFFmpeg();
      const baseURL = VIDEO_PROCESSOR_CONFIG.FFMPEG_BASE_URL;
      
      const [coreURL, wasmURL] = await Promise.all([
        toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      ]);
      
      await ffmpeg.load({ coreURL, wasmURL });
      
      isFFmpegLoaded = true;
      setProgress(VIDEO_PROCESSOR_CONFIG.PROGRESS.FFMPEG_LOADED);
      notify();
      return true;
    } catch (error) {
      console.error('FFmpeg load error:', error);
      batch(() => {
        setStatus('error');
        setCurrentStep(TRANSLATIONS.processing.ffmpegLoadError);
      });
      notify();
      return false;
    }
  };
  
  const getVideoDuration = (blob: Blob): Promise<number> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      const url = URL.createObjectURL(blob);
      blobUrls.push(url);
      
      video.preload = 'metadata';
      video.src = url;
      
      const cleanup = (): void => {
        const index = blobUrls.indexOf(url);
        if (index > -1) {
          blobUrls.splice(index, 1);
        }
        URL.revokeObjectURL(url);
      };
      
      video.onloadedmetadata = (): void => {
        cleanup();
        resolve(video.duration);
      };
      
      video.onerror = (): void => {
        cleanup();
        reject(new Error(TRANSLATIONS.processing.metadataError));
      };
    });
  };
  
  const processVideoBlob = async (blob: Blob, fileName: string): Promise<void> => {
    cancelledFlag = false;
    const loaded = await loadFFmpeg();
    if (!loaded || cancelledFlag) return;
    
    const ffmpeg = getFFmpeg();
    
    try {
      batch(() => {
        setStatus('processing');
        setCurrentStep(TRANSLATIONS.processing.preparingVideo);
        setProgress(VIDEO_PROCESSOR_CONFIG.PROGRESS.VIDEO_PREPARING);
        setChunks([]);
        setProcessedChunks(0);
      });
      notify();
      
      const [arrayBuffer, videoDuration] = await Promise.all([
        blob.arrayBuffer(),
        getVideoDuration(blob)
      ]);
      
      if (cancelledFlag) return;
      
      const lastDotIndex = fileName.lastIndexOf('.');
      const extension = lastDotIndex !== -1 
        ? fileName.substring(lastDotIndex) 
        : FILE_CONFIG.DEFAULT_VIDEO_EXTENSION;
      const inputName = 'input' + extension;
      
      await ffmpeg.writeFile(inputName, new Uint8Array(arrayBuffer));
      setProgress(VIDEO_PROCESSOR_CONFIG.PROGRESS.VIDEO_PREPARED);
      notify();
      
      const minutes = Math.floor(videoDuration / 60);
      const seconds = Math.floor(videoDuration % 60);
      setCurrentStep(TRANSLATIONS.processing.videoDuration(minutes, seconds));
      notify();
      
      const chunkDuration = VIDEO_PROCESSOR_CONFIG.CHUNK_DURATION_SECONDS;
      const numChunks = Math.ceil(videoDuration / chunkDuration);
      batch(() => {
        setTotalChunks(numChunks);
        setProgress(VIDEO_PROCESSOR_CONFIG.PROGRESS.PROCESSING_START);
      });
      notify();
      
      const newChunks: VideoChunk[] = [];
      const batchSize = VIDEO_PROCESSOR_CONFIG.BATCH_SIZE;
      
      for (let batchStart = 0; batchStart < numChunks; batchStart += batchSize) {
        if (cancelledFlag) return;
        
        const batchEnd = Math.min(batchStart + batchSize, numChunks);
        const batchPromises: Promise<VideoChunk>[] = [];
        
        for (let i = batchStart; i < batchEnd; i++) {
          const startTime = i * chunkDuration;
          const actualDuration = Math.min(chunkDuration, videoDuration - startTime);
          const endTime = startTime + actualDuration;
          const paddedIndex = String(i + 1).padStart(VIDEO_PROCESSOR_CONFIG.PADDING_DIGITS, '0');
          const outputName = `part_${paddedIndex}.mp4`;
          
          const processChunk = async (): Promise<VideoChunk> => {
            await ffmpeg.exec([
              '-i', inputName,
              '-ss', startTime.toString(),
              '-t', actualDuration.toString(),
              '-c:v', 'libx264',
              '-c:a', 'aac',
              '-preset', 'ultrafast',
              '-avoid_negative_ts', 'make_zero',
              '-fflags', '+genpts',
              '-movflags', '+faststart',
              outputName,
            ]);
            
            const data = await ffmpeg.readFile(outputName);
            const uint8Array = data instanceof Uint8Array 
              ? data 
              : new TextEncoder().encode(data as string);
            const chunkBlob = new Blob([new Uint8Array(uint8Array)], { 
              type: FILE_CONFIG.DEFAULT_MIME_TYPE 
            });
            
            await ffmpeg.deleteFile(outputName);
            
            return { name: outputName, startTime, endTime, blob: chunkBlob };
          };
          
          batchPromises.push(processChunk());
        }
        
        setCurrentStep(TRANSLATIONS.processing.processingChunks(batchStart + 1, batchEnd, numChunks));
        notify();
        
        const batchResults = await Promise.all(batchPromises);
        const resultsLen = batchResults.length;
        for (let i = 0; i < resultsLen; i++) {
          newChunks.push(batchResults[i]);
        }
        
        const progressValue = VIDEO_PROCESSOR_CONFIG.PROGRESS.PROCESSING_START +
          (batchEnd / numChunks) * VIDEO_PROCESSOR_CONFIG.PROGRESS.PROCESSING_RANGE;
        batch(() => {
          setProcessedChunks(batchEnd);
          setProgress(progressValue);
        });
        notify();
      }
      
      await ffmpeg.deleteFile(inputName);
      
      newChunks.sort((a, b) => a.startTime - b.startTime);
      
      batch(() => {
        setChunks(newChunks);
        setStatus('complete');
        setCurrentStep(TRANSLATIONS.processing.allChunksComplete);
        setProgress(VIDEO_PROCESSOR_CONFIG.PROGRESS.COMPLETE);
      });
      notify();
    } catch (error) {
      console.error('Processing error:', error);
      const errorMessage = error instanceof Error 
        ? error.message 
        : TRANSLATIONS.processing.processingError;
      batch(() => {
        setStatus('error');
        setCurrentStep(errorMessage);
      });
      notify();
    }
  };
  
  const processVideo = async (file: File): Promise<void> => {
    await processVideoBlob(file, file.name);
  };
  
  const processYoutubeUrl = async (url: string): Promise<void> => {
    cancelledFlag = false;
    
    try {
      batch(() => {
        setStatus('loading');
        setCurrentStep(TRANSLATIONS.youtube.downloading);
        setProgress(VIDEO_PROCESSOR_CONFIG.PROGRESS.YOUTUBE_START);
      });
      notify();
      
      const { data, error } = await supabase.functions.invoke<DownloadResult>('youtube-download', {
        body: { url },
      });
      
      if (cancelledFlag) return;
      
      if (error) {
        console.error('Supabase function error:', error);
        throw new Error(error.message || TRANSLATIONS.youtube.downloadError);
      }
      
      if (!data || !data.success) {
        throw new Error(data?.error || TRANSLATIONS.youtube.downloadFailed);
      }
      
      batch(() => {
        setCurrentStep(TRANSLATIONS.youtube.decoding);
        setProgress(VIDEO_PROCESSOR_CONFIG.PROGRESS.YOUTUBE_DECODING);
      });
      notify();
      
      const binaryString = atob(data.videoBase64);
      const bytesLen = binaryString.length;
      const bytes = new Uint8Array(bytesLen);
      for (let i = 0; i < bytesLen; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const videoBlob = new Blob([bytes], { 
        type: data.mimeType || FILE_CONFIG.DEFAULT_MIME_TYPE 
      });
      const fileName = `${data.title || 'youtube_video'}.mp4`;
      
      setProgress(VIDEO_PROCESSOR_CONFIG.PROGRESS.YOUTUBE_DECODED);
      notify();
      
      await processVideoBlob(videoBlob, fileName);
    } catch (error) {
      console.error('YouTube processing error:', error);
      const errorMessage = error instanceof Error 
        ? error.message 
        : TRANSLATIONS.youtube.processingError;
      batch(() => {
        setStatus('error');
        setCurrentStep(errorMessage);
      });
      notify();
    }
  };
  
  const reset = (): void => {
    cancelledFlag = true;
    cleanupBlobUrls();
    batch(() => {
      setStatus('idle');
      setProgress(0);
      setCurrentStep('');
      setChunks([]);
      setTotalChunks(0);
      setProcessedChunks(0);
    });
    notify();
  };
  
  const cancel = (): void => {
    cancelledFlag = true;
    reset();
  };
  
  return {
    getStatus: status,
    getProgress: progress,
    getCurrentStep: currentStep,
    getChunks: chunks,
    getTotalChunks: totalChunks,
    getProcessedChunks: processedChunks,
    subscribe: (callback: () => void): (() => void) => {
      subscribers.add(callback);
      return () => subscribers.delete(callback);
    },
    actions: {
      processVideo,
      processYoutubeUrl,
      reset,
      cancel
    }
  };
}

let globalStore: VideoProcessorStore | null = null;

export function getVideoProcessorStore(): VideoProcessorStore {
  if (!globalStore) {
    globalStore = createVideoProcessorStore();
  }
  return globalStore;
}
