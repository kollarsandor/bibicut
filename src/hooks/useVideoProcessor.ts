import { useState, useCallback, useRef } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { supabase } from '@/lib/supabaseClient';

interface VideoChunk {
  name: string;
  startTime: number;
  endTime: number;
  blob: Blob;
}

type ProcessingStatus = 'idle' | 'loading' | 'processing' | 'complete' | 'error';

export const useVideoProcessor = () => {
  const ffmpegRef = useRef<FFmpeg | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [status, setStatus] = useState<ProcessingStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');
  const [chunks, setChunks] = useState<VideoChunk[]>([]);
  const [totalChunks, setTotalChunks] = useState(0);
  const [processedChunks, setProcessedChunks] = useState(0);

  const getFFmpeg = useCallback(() => {
    if (!ffmpegRef.current) {
      ffmpegRef.current = new FFmpeg();
    }
    return ffmpegRef.current;
  }, []);

  const loadFFmpeg = useCallback(async () => {
    if (isLoaded) return true;
    
    try {
      setStatus('loading');
      setCurrentStep('FFmpeg betöltése...');
      setProgress(10);
      
      const ffmpeg = getFFmpeg();
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
      
      const [coreURL, wasmURL] = await Promise.all([
        toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      ]);
      
      await ffmpeg.load({ coreURL, wasmURL });
      
      setIsLoaded(true);
      setProgress(30);
      return true;
    } catch (error) {
      console.error('FFmpeg load error:', error);
      setStatus('error');
      setCurrentStep('Hiba a FFmpeg betöltésekor');
      return false;
    }
  }, [isLoaded, getFFmpeg]);

  const getVideoDuration = useCallback((blob: Blob): Promise<number> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      const url = URL.createObjectURL(blob);
      
      video.preload = 'metadata';
      video.src = url;
      
      video.onloadedmetadata = () => {
        URL.revokeObjectURL(url);
        resolve(video.duration);
      };
      
      video.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Nem sikerült a videó metaadatainak betöltése'));
      };
    });
  }, []);

  const processVideoBlob = useCallback(async (blob: Blob, fileName: string) => {
    const loaded = await loadFFmpeg();
    if (!loaded) return;

    const ffmpeg = getFFmpeg();

    try {
      setStatus('processing');
      setCurrentStep('Videó előkészítése...');
      setProgress(35);
      setChunks([]);
      setProcessedChunks(0);

      const [arrayBuffer, videoDuration] = await Promise.all([
        blob.arrayBuffer(),
        getVideoDuration(blob),
      ]);

      const extension = fileName.includes('.') ? fileName.substring(fileName.lastIndexOf('.')) : '.mp4';
      const inputName = 'input' + extension;
      
      await ffmpeg.writeFile(inputName, new Uint8Array(arrayBuffer));
      setProgress(40);

      setCurrentStep('Videó hossza: ' + Math.floor(videoDuration / 60) + ' perc ' + Math.floor(videoDuration % 60) + ' mp');

      const chunkDuration = 60;
      const numChunks = Math.ceil(videoDuration / chunkDuration);
      setTotalChunks(numChunks);
      setProgress(45);

      const newChunks: VideoChunk[] = [];
      const batchSize = 3;

      for (let batchStart = 0; batchStart < numChunks; batchStart += batchSize) {
        const batchEnd = Math.min(batchStart + batchSize, numChunks);
        const batchPromises: Promise<VideoChunk>[] = [];

        for (let i = batchStart; i < batchEnd; i++) {
          const startTime = i * chunkDuration;
          const endTime = Math.min((i + 1) * chunkDuration, videoDuration);
          const outputName = `part_${String(i + 1).padStart(3, '0')}.mp4`;
          const chunkIndex = i;

          const processChunk = async (): Promise<VideoChunk> => {
            await ffmpeg.exec([
              '-ss', startTime.toString(),
              '-i', inputName,
              '-t', chunkDuration.toString(),
              '-c', 'copy',
              '-avoid_negative_ts', 'make_zero',
              '-movflags', '+faststart',
              outputName
            ]);

            const data = await ffmpeg.readFile(outputName);
            const uint8Array = data instanceof Uint8Array ? data : new TextEncoder().encode(data as string);
            const chunkBlob = new Blob([new Uint8Array(uint8Array)], { type: 'video/mp4' });

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

        setCurrentStep(`Részletek ${batchStart + 1}-${batchEnd}/${numChunks} feldolgozása...`);

        const batchResults = await Promise.all(batchPromises);
        newChunks.push(...batchResults);

        setProcessedChunks(batchEnd);
        setProgress(45 + (batchEnd / numChunks) * 50);
      }

      await ffmpeg.deleteFile(inputName);

      newChunks.sort((a, b) => a.startTime - b.startTime);

      setChunks(newChunks);
      setStatus('complete');
      setCurrentStep('Minden részlet elkészült!');
      setProgress(100);
    } catch (error) {
      console.error('Processing error:', error);
      setStatus('error');
      const errorMessage = error instanceof Error ? error.message : 'Hiba a feldolgozás során';
      setCurrentStep(errorMessage);
    }
  }, [loadFFmpeg, getFFmpeg, getVideoDuration]);

  const processVideo = useCallback(async (file: File) => {
    await processVideoBlob(file, file.name);
  }, [processVideoBlob]);

  const processYoutubeUrl = useCallback(async (url: string) => {
    try {
      setStatus('loading');
      setCurrentStep('YouTube videó letöltése...');
      setProgress(5);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000);

      const { data, error } = await supabase.functions.invoke('youtube-download', {
        body: { url }
      });

      clearTimeout(timeoutId);

      if (error) {
        console.error('Supabase function error:', error);
        throw new Error(error.message || 'Hiba a YouTube videó letöltésekor');
      }

      if (!data.success) {
        throw new Error(data.error || 'Nem sikerült letölteni a YouTube videót');
      }

      setCurrentStep('Videó dekódolása...');
      setProgress(25);

      const binaryString = atob(data.videoBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const videoBlob = new Blob([bytes], { type: data.mimeType || 'video/mp4' });
      const fileName = `${data.title || 'youtube_video'}.mp4`;

      setProgress(30);
      await processVideoBlob(videoBlob, fileName);

    } catch (error) {
      console.error('YouTube processing error:', error);
      setStatus('error');
      const errorMessage = error instanceof Error ? error.message : 'Hiba a YouTube videó feldolgozásakor';
      setCurrentStep(errorMessage);
    }
  }, [processVideoBlob]);

  const reset = useCallback(() => {
    setStatus('idle');
    setProgress(0);
    setCurrentStep('');
    setChunks([]);
    setTotalChunks(0);
    setProcessedChunks(0);
  }, []);

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
  };
};