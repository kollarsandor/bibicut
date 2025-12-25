import { useState, useCallback } from 'react';
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
  const [ffmpeg] = useState(() => new FFmpeg());
  const [isLoaded, setIsLoaded] = useState(false);
  const [status, setStatus] = useState<ProcessingStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');
  const [chunks, setChunks] = useState<VideoChunk[]>([]);
  const [totalChunks, setTotalChunks] = useState(0);
  const [processedChunks, setProcessedChunks] = useState(0);

  const loadFFmpeg = useCallback(async () => {
    if (isLoaded) return true;
    
    try {
      setStatus('loading');
      setCurrentStep('FFmpeg betöltése...');
      setProgress(10);
      
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
      
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });
      
      setIsLoaded(true);
      setProgress(30);
      return true;
    } catch (error) {
      console.error('FFmpeg load error:', error);
      setStatus('error');
      setCurrentStep('Hiba a FFmpeg betöltésekor');
      return false;
    }
  }, [ffmpeg, isLoaded]);

  const processVideoBlob = useCallback(async (blob: Blob, fileName: string) => {
    const loaded = await loadFFmpeg();
    if (!loaded) return;

    try {
      setStatus('processing');
      setCurrentStep('Videó feldolgozása...');
      setProgress(35);
      setChunks([]);
      setProcessedChunks(0);

      const extension = fileName.includes('.') ? fileName.substring(fileName.lastIndexOf('.')) : '.mp4';
      const inputName = 'input' + extension;
      
      const arrayBuffer = await blob.arrayBuffer();
      await ffmpeg.writeFile(inputName, new Uint8Array(arrayBuffer));
      setProgress(40);

      setCurrentStep('Videó hosszának megállapítása...');
      
      const videoUrl = URL.createObjectURL(blob);
      const videoDuration = await new Promise<number>((resolve, reject) => {
        const video = document.createElement('video');
        video.src = videoUrl;
        video.onloadedmetadata = () => {
          resolve(video.duration);
          URL.revokeObjectURL(videoUrl);
        };
        video.onerror = () => {
          URL.revokeObjectURL(videoUrl);
          reject(new Error('Nem sikerült a videó metaadatainak betöltése'));
        };
      });

      const chunkDuration = 60;
      const numChunks = Math.ceil(videoDuration / chunkDuration);
      setTotalChunks(numChunks);
      setProgress(45);

      const newChunks: VideoChunk[] = [];

      for (let i = 0; i < numChunks; i++) {
        const startTime = i * chunkDuration;
        const endTime = Math.min((i + 1) * chunkDuration, videoDuration);
        const outputName = `part_${String(i + 1).padStart(3, '0')}.mp4`;
        
        setCurrentStep(`Részlet ${i + 1}/${numChunks} vágása...`);

        await ffmpeg.exec([
          '-ss', startTime.toString(),
          '-i', inputName,
          '-t', chunkDuration.toString(),
          '-c', 'copy',
          '-avoid_negative_ts', 'make_zero',
          outputName
        ]);

        const data = await ffmpeg.readFile(outputName);
        const uint8Array = data instanceof Uint8Array ? data : new TextEncoder().encode(data as string);
        const chunkArrayBuffer = uint8Array.slice().buffer as ArrayBuffer;
        const chunkBlob = new Blob([chunkArrayBuffer], { type: 'video/mp4' });

        newChunks.push({
          name: outputName,
          startTime,
          endTime,
          blob: chunkBlob,
        });

        setProcessedChunks(i + 1);
        setProgress(45 + ((i + 1) / numChunks) * 50);

        await ffmpeg.deleteFile(outputName);
      }

      await ffmpeg.deleteFile(inputName);

      setChunks(newChunks);
      setStatus('complete');
      setCurrentStep('Minden részlet elkészült!');
      setProgress(100);
    } catch (error) {
      console.error('Processing error:', error);
      setStatus('error');
      setCurrentStep('Hiba a feldolgozás során');
    }
  }, [ffmpeg, loadFFmpeg]);

  const processVideo = useCallback(async (file: File) => {
    await processVideoBlob(file, file.name);
  }, [processVideoBlob]);

  const processYoutubeUrl = useCallback(async (url: string) => {
    try {
      setStatus('loading');
      setCurrentStep('YouTube videó letöltése...');
      setProgress(5);

      const { data, error } = await supabase.functions.invoke('youtube-download', {
        body: { url }
      });

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