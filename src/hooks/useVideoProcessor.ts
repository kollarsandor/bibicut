import { useState, useCallback, useEffect } from 'react';
import { getVideoProcessorStore, type VideoProcessorStore } from '@/stores/videoProcessor';
import type { VideoChunk, ProcessingStatus } from '@/types/video';

interface UseVideoProcessorReturn {
  status: ProcessingStatus;
  progress: number;
  currentStep: string;
  chunks: VideoChunk[];
  totalChunks: number;
  processedChunks: number;
  processVideo: (file: File) => Promise<void>;
  processYoutubeUrl: (url: string) => Promise<void>;
  reset: () => void;
  cancel: () => void;
}

export const useVideoProcessor = (): UseVideoProcessorReturn => {
  const store = getVideoProcessorStore();
  
  const [status, setStatus] = useState<ProcessingStatus>(store.getStatus());
  const [progress, setProgress] = useState(store.getProgress());
  const [currentStep, setCurrentStep] = useState(store.getCurrentStep());
  const [chunks, setChunks] = useState<VideoChunk[]>(store.getChunks());
  const [totalChunks, setTotalChunks] = useState(store.getTotalChunks());
  const [processedChunks, setProcessedChunks] = useState(store.getProcessedChunks());
  
  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      setStatus(store.getStatus());
      setProgress(store.getProgress());
      setCurrentStep(store.getCurrentStep());
      setChunks(store.getChunks());
      setTotalChunks(store.getTotalChunks());
      setProcessedChunks(store.getProcessedChunks());
    });
    
    return unsubscribe;
  }, [store]);
  
  const processVideo = useCallback(
    async (file: File): Promise<void> => {
      await store.actions.processVideo(file);
    },
    [store]
  );
  
  const processYoutubeUrl = useCallback(
    async (url: string): Promise<void> => {
      await store.actions.processYoutubeUrl(url);
    },
    [store]
  );
  
  const reset = useCallback((): void => {
    store.actions.reset();
  }, [store]);
  
  const cancel = useCallback((): void => {
    store.actions.cancel();
  }, [store]);
  
  return {
    status,
    progress,
    currentStep,
    chunks,
    totalChunks,
    processedChunks,
    processVideo,
    processYoutubeUrl,
    reset,
    cancel,
  };
};