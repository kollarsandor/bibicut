import { useState, useCallback } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

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

  const processVideo = useCallback(async (file: File) => {
    const loaded = await loadFFmpeg();
    if (!loaded) return;

    try {
      setStatus('processing');
      setCurrentStep('Videó feldolgozása...');
      setProgress(35);
      setChunks([]);
      setProcessedChunks(0);

      // Write input file
      const inputName = 'input' + file.name.substring(file.name.lastIndexOf('.'));
      await ffmpeg.writeFile(inputName, await fetchFile(file));
      setProgress(40);

      // Get video duration
      setCurrentStep('Videó hosszának megállapítása...');
      
      // Create a video element to get duration
      const videoUrl = URL.createObjectURL(file);
      const videoDuration = await new Promise<number>((resolve) => {
        const video = document.createElement('video');
        video.src = videoUrl;
        video.onloadedmetadata = () => {
          resolve(video.duration);
          URL.revokeObjectURL(videoUrl);
        };
      });

      const chunkDuration = 60; // 1 minute in seconds
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
        const arrayBuffer = uint8Array.slice().buffer as ArrayBuffer;
        const blob = new Blob([arrayBuffer], { type: 'video/mp4' });

        newChunks.push({
          name: outputName,
          startTime,
          endTime,
          blob,
        });

        setProcessedChunks(i + 1);
        setProgress(45 + ((i + 1) / numChunks) * 50);

        // Clean up chunk file
        await ffmpeg.deleteFile(outputName);
      }

      // Clean up input file
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
    reset,
  };
};
