import { useState, useCallback, useRef, useEffect } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';
import { supabase } from '@/lib/supabaseClient';
import type { VideoChunk, ProcessingStatus, DownloadResult } from '@/types/video';
import { VIDEO_PROCESSOR_CONFIG, FILE_CONFIG } from '@/constants/config';
import { TRANSLATIONS } from '@/constants/translations';

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
  const ffmpegRef = useRef<FFmpeg | null>(null);
  const cancelledRef = useRef<boolean>(false);
  const blobUrlsRef = useRef<string[]>([]);

  const [isLoaded, setIsLoaded] = useState(false);
  const [status, setStatus] = useState<ProcessingStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');
  const [chunks, setChunks] = useState<VideoChunk[]>([]);
  const [totalChunks, setTotalChunks] = useState(0);
  const [processedChunks, setProcessedChunks] = useState(0);

  useEffect(() => {
    return () => {
      blobUrlsRef.current.forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch (e) {
          /* cleanup best effort */
        }
      });
      blobUrlsRef.current = [];
    };
  }, []);

  const getFFmpeg = useCallback(() => {
    if (!ffmpegRef.current) {
      ffmpegRef.current = new FFmpeg();
    }
    return ffmpegRef.current;
  }, []);

  const loadFFmpeg = useCallback(async (): Promise<boolean> => {
    if (isLoaded) return true;

    try {
      setStatus('loading');
      setCurrentStep(TRANSLATIONS.processing.loadingFfmpeg);
      setProgress(VIDEO_PROCESSOR_CONFIG.PROGRESS.FFMPEG_LOADING);

      const ffmpeg = getFFmpeg();
      const baseURL = VIDEO_PROCESSOR_CONFIG.FFMPEG_BASE_URL;

      const [coreURL, wasmURL] = await Promise.all([
        toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      ]);

      await ffmpeg.load({ coreURL, wasmURL });

      setIsLoaded(true);
      setProgress(VIDEO_PROCESSOR_CONFIG.PROGRESS.FFMPEG_LOADED);
      return true;
    } catch (error) {
      console.error('FFmpeg load error:', error);
      setStatus('error');
      setCurrentStep(TRANSLATIONS.processing.ffmpegLoadError);
      return false;
    }
  }, [isLoaded, getFFmpeg]);

  const getVideoDuration = useCallback((blob: Blob): Promise<number> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      const url = URL.createObjectURL(blob);
      blobUrlsRef.current.push(url);

      video.preload = 'metadata';
      video.src = url;

      const cleanup = () => {
        const index = blobUrlsRef.current.indexOf(url);
        if (index > -1) {
          blobUrlsRef.current.splice(index, 1);
        }
        URL.revokeObjectURL(url);
      };

      video.onloadedmetadata = () => {
        cleanup();
        resolve(video.duration);
      };

      video.onerror = () => {
        cleanup();
        reject(new Error(TRANSLATIONS.processing.metadataError));
      };
    });
  }, []);

  const processVideoBlob = useCallback(
    async (blob: Blob, fileName: string): Promise<void> => {
      cancelledRef.current = false;
      const loaded = await loadFFmpeg();
      if (!loaded || cancelledRef.current) return;

      const ffmpeg = getFFmpeg();

      try {
        setStatus('processing');
        setCurrentStep(TRANSLATIONS.processing.preparingVideo);
        setProgress(VIDEO_PROCESSOR_CONFIG.PROGRESS.VIDEO_PREPARING);
        setChunks([]);
        setProcessedChunks(0);

        const [arrayBuffer, videoDuration] = await Promise.all([blob.arrayBuffer(), getVideoDuration(blob)]);

        if (cancelledRef.current) return;

        const extension = fileName.includes('.') ? fileName.substring(fileName.lastIndexOf('.')) : FILE_CONFIG.DEFAULT_VIDEO_EXTENSION;
        const inputName = 'input' + extension;

        await ffmpeg.writeFile(inputName, new Uint8Array(arrayBuffer));
        setProgress(VIDEO_PROCESSOR_CONFIG.PROGRESS.VIDEO_PREPARED);

        const minutes = Math.floor(videoDuration / 60);
        const seconds = Math.floor(videoDuration % 60);
        setCurrentStep(TRANSLATIONS.processing.videoDuration(minutes, seconds));

        const chunkDuration = VIDEO_PROCESSOR_CONFIG.CHUNK_DURATION_SECONDS;
        const numChunks = Math.ceil(videoDuration / chunkDuration);
        setTotalChunks(numChunks);
        setProgress(VIDEO_PROCESSOR_CONFIG.PROGRESS.PROCESSING_START);

        const newChunks: VideoChunk[] = [];
        const batchSize = VIDEO_PROCESSOR_CONFIG.BATCH_SIZE;

        for (let batchStart = 0; batchStart < numChunks; batchStart += batchSize) {
          if (cancelledRef.current) return;

          const batchEnd = Math.min(batchStart + batchSize, numChunks);
          const batchPromises: Promise<VideoChunk>[] = [];

          for (let i = batchStart; i < batchEnd; i++) {
            const startTime = i * chunkDuration;
            const endTime = Math.min((i + 1) * chunkDuration, videoDuration);
            const outputName = `part_${String(i + 1).padStart(VIDEO_PROCESSOR_CONFIG.PADDING_DIGITS, '0')}.mp4`;

            const processChunk = async (): Promise<VideoChunk> => {
              await ffmpeg.exec([
                '-ss',
                startTime.toString(),
                '-i',
                inputName,
                '-t',
                chunkDuration.toString(),
                '-c',
                'copy',
                '-avoid_negative_ts',
                'make_zero',
                '-movflags',
                '+faststart',
                outputName,
              ]);

              const data = await ffmpeg.readFile(outputName);
              const uint8Array = data instanceof Uint8Array ? data : new TextEncoder().encode(data as string);
              const chunkBlob = new Blob([new Uint8Array(uint8Array)], { type: FILE_CONFIG.DEFAULT_MIME_TYPE });

              await ffmpeg.deleteFile(outputName);

              return {
                name: outputName,
                startTime,
                endTime,
                blob: chunkBlob,
              };
            };

            batchPromises.push(processChunk());
          }

          setCurrentStep(TRANSLATIONS.processing.processingChunks(batchStart + 1, batchEnd, numChunks));

          const batchResults = await Promise.all(batchPromises);
          newChunks.push(...batchResults);

          setProcessedChunks(batchEnd);
          const progressValue =
            VIDEO_PROCESSOR_CONFIG.PROGRESS.PROCESSING_START +
            (batchEnd / numChunks) * VIDEO_PROCESSOR_CONFIG.PROGRESS.PROCESSING_RANGE;
          setProgress(progressValue);
        }

        await ffmpeg.deleteFile(inputName);

        newChunks.sort((a, b) => a.startTime - b.startTime);

        setChunks(newChunks);
        setStatus('complete');
        setCurrentStep(TRANSLATIONS.processing.allChunksComplete);
        setProgress(VIDEO_PROCESSOR_CONFIG.PROGRESS.COMPLETE);
      } catch (error) {
        console.error('Processing error:', error);
        setStatus('error');
        const errorMessage = error instanceof Error ? error.message : TRANSLATIONS.processing.processingError;
        setCurrentStep(errorMessage);
      }
    },
    [loadFFmpeg, getFFmpeg, getVideoDuration]
  );

  const processVideo = useCallback(
    async (file: File): Promise<void> => {
      await processVideoBlob(file, file.name);
    },
    [processVideoBlob]
  );

  const processYoutubeUrl = useCallback(
    async (url: string): Promise<void> => {
      cancelledRef.current = false;

      try {
        setStatus('loading');
        setCurrentStep(TRANSLATIONS.youtube.downloading);
        setProgress(VIDEO_PROCESSOR_CONFIG.PROGRESS.YOUTUBE_START);

        const { data, error } = await supabase.functions.invoke<DownloadResult>('youtube-download', {
          body: { url },
        });

        if (cancelledRef.current) return;

        if (error) {
          console.error('Supabase function error:', error);
          throw new Error(error.message || TRANSLATIONS.youtube.downloadError);
        }

        if (!data || !data.success) {
          throw new Error(data?.error || TRANSLATIONS.youtube.downloadFailed);
        }

        setCurrentStep(TRANSLATIONS.youtube.decoding);
        setProgress(VIDEO_PROCESSOR_CONFIG.PROGRESS.YOUTUBE_DECODING);

        const binaryString = atob(data.videoBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        const videoBlob = new Blob([bytes], { type: data.mimeType || FILE_CONFIG.DEFAULT_MIME_TYPE });
        const fileName = `${data.title || 'youtube_video'}.mp4`;

        setProgress(VIDEO_PROCESSOR_CONFIG.PROGRESS.YOUTUBE_DECODED);
        await processVideoBlob(videoBlob, fileName);
      } catch (error) {
        console.error('YouTube processing error:', error);
        setStatus('error');
        const errorMessage = error instanceof Error ? error.message : TRANSLATIONS.youtube.processingError;
        setCurrentStep(errorMessage);
      }
    },
    [processVideoBlob]
  );

  const reset = useCallback((): void => {
    cancelledRef.current = true;
    setStatus('idle');
    setProgress(0);
    setCurrentStep('');
    setChunks([]);
    setTotalChunks(0);
    setProcessedChunks(0);
  }, []);

  const cancel = useCallback((): void => {
    cancelledRef.current = true;
    reset();
  }, [reset]);

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