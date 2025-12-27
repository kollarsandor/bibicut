import { createSignal, batch } from '@/core/signal';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';
import type { VideoChunk } from '@/types/video';
import { VIDEO_PROCESSOR_CONFIG } from '@/constants/config';

export type DubbingStatus = 'idle' | 'preparing' | 'awaiting_dubbed' | 'merging' | 'replacing' | 'complete' | 'error';

export interface DubbedChunk {
  index: number;
  originalChunk: VideoChunk;
  dubbedBlob: Blob | null;
  status: 'pending' | 'uploaded' | 'processing' | 'complete' | 'error';
}

export interface DubbingWorkflowState {
  status: DubbingStatus;
  progress: number;
  currentStep: string;
  originalVideoBlob: Blob | null;
  originalVideoName: string;
  dubbedChunks: DubbedChunk[];
  mergedAudioBlob: Blob | null;
  finalVideoBlob: Blob | null;
  totalChunks: number;
  completedChunks: number;
}

export interface DubbingWorkflowActions {
  startWorkflow: (originalBlob: Blob, originalName: string, chunks: VideoChunk[]) => void;
  uploadDubbedChunk: (index: number, file: File) => Promise<void>;
  uploadAllDubbedChunks: (files: FileList) => Promise<void>;
  mergeAudioAndReplace: () => Promise<void>;
  downloadFinalVideo: () => void;
  downloadMergedAudio: () => void;
  reset: () => void;
}

export interface DubbingWorkflowStore {
  getStatus: () => DubbingStatus;
  getProgress: () => number;
  getCurrentStep: () => string;
  getOriginalVideoBlob: () => Blob | null;
  getOriginalVideoName: () => string;
  getDubbedChunks: () => DubbedChunk[];
  getMergedAudioBlob: () => Blob | null;
  getFinalVideoBlob: () => Blob | null;
  getTotalChunks: () => number;
  getCompletedChunks: () => number;
  subscribe: (callback: () => void) => () => void;
  actions: DubbingWorkflowActions;
}

let ffmpegInstance: FFmpeg | null = null;
let isFFmpegLoaded = false;

function getFFmpeg(): FFmpeg {
  if (!ffmpegInstance) {
    ffmpegInstance = new FFmpeg();
  }
  return ffmpegInstance;
}

async function loadFFmpegIfNeeded(): Promise<boolean> {
  if (isFFmpegLoaded) return true;
  
  try {
    const ffmpeg = getFFmpeg();
    const baseURL = VIDEO_PROCESSOR_CONFIG.FFMPEG_BASE_URL;
    
    const [coreURL, wasmURL] = await Promise.all([
      toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    ]);
    
    await ffmpeg.load({ coreURL, wasmURL });
    isFFmpegLoaded = true;
    return true;
  } catch (error) {
    console.error('FFmpeg load error:', error);
    return false;
  }
}

export function createDubbingWorkflowStore(): DubbingWorkflowStore {
  const [status, setStatus] = createSignal<DubbingStatus>('idle');
  const [progress, setProgress] = createSignal(0);
  const [currentStep, setCurrentStep] = createSignal('');
  const [originalVideoBlob, setOriginalVideoBlob] = createSignal<Blob | null>(null);
  const [originalVideoName, setOriginalVideoName] = createSignal('');
  const [dubbedChunks, setDubbedChunks] = createSignal<DubbedChunk[]>([]);
  const [mergedAudioBlob, setMergedAudioBlob] = createSignal<Blob | null>(null);
  const [finalVideoBlob, setFinalVideoBlob] = createSignal<Blob | null>(null);
  const [totalChunks, setTotalChunks] = createSignal(0);
  const [completedChunks, setCompletedChunks] = createSignal(0);
  
  const subscribers = new Set<() => void>();
  
  const notify = (): void => {
    const subs = Array.from(subscribers);
    for (let i = 0; i < subs.length; i++) {
      subs[i]();
    }
  };
  
  const startWorkflow = (originalBlob: Blob, originalName: string, chunks: VideoChunk[]): void => {
    const dubbedChunksList: DubbedChunk[] = [];
    for (let i = 0; i < chunks.length; i++) {
      dubbedChunksList.push({
        index: i,
        originalChunk: chunks[i],
        dubbedBlob: null,
        status: 'pending'
      });
    }
    
    batch(() => {
      setStatus('awaiting_dubbed');
      setProgress(0);
      setCurrentStep('Feltöltésre vár a magyar nyelvű dubbolt videók. Töltsd le a részeket, dubbold le subformer.com-on, majd töltsd vissza.');
      setOriginalVideoBlob(originalBlob);
      setOriginalVideoName(originalName);
      setDubbedChunks(dubbedChunksList);
      setMergedAudioBlob(null);
      setFinalVideoBlob(null);
      setTotalChunks(chunks.length);
      setCompletedChunks(0);
    });
    notify();
  };
  
  const uploadDubbedChunk = async (index: number, file: File): Promise<void> => {
    const chunks = dubbedChunks();
    if (index < 0 || index >= chunks.length) return;
    
    const blob = new Blob([await file.arrayBuffer()], { type: file.type || 'video/mp4' });
    
    const newChunks = [...chunks];
    newChunks[index] = {
      ...newChunks[index],
      dubbedBlob: blob,
      status: 'uploaded'
    };
    
    let completed = 0;
    for (let i = 0; i < newChunks.length; i++) {
      if (newChunks[i].dubbedBlob !== null) {
        completed++;
      }
    }
    
    batch(() => {
      setDubbedChunks(newChunks);
      setCompletedChunks(completed);
      setProgress((completed / newChunks.length) * 50);
      setCurrentStep(`${completed}/${newChunks.length} dubbolt részlet feltöltve`);
    });
    notify();
  };
  
  const uploadAllDubbedChunks = async (files: FileList): Promise<void> => {
    const fileArray: File[] = [];
    for (let i = 0; i < files.length; i++) {
      fileArray.push(files[i]);
    }
    
    fileArray.sort((a, b) => {
      const numA = parseInt(a.name.match(/\d+/)?.[0] || '0', 10);
      const numB = parseInt(b.name.match(/\d+/)?.[0] || '0', 10);
      return numA - numB;
    });
    
    const chunks = dubbedChunks();
    const newChunks = [...chunks];
    
    for (let i = 0; i < fileArray.length && i < chunks.length; i++) {
      const file = fileArray[i];
      const blob = new Blob([await file.arrayBuffer()], { type: file.type || 'video/mp4' });
      newChunks[i] = {
        ...newChunks[i],
        dubbedBlob: blob,
        status: 'uploaded'
      };
    }
    
    let completed = 0;
    for (let i = 0; i < newChunks.length; i++) {
      if (newChunks[i].dubbedBlob !== null) {
        completed++;
      }
    }
    
    batch(() => {
      setDubbedChunks(newChunks);
      setCompletedChunks(completed);
      setProgress((completed / newChunks.length) * 50);
      setCurrentStep(`${completed}/${newChunks.length} dubbolt részlet feltöltve`);
    });
    notify();
  };
  
  const mergeAudioAndReplace = async (): Promise<void> => {
    const chunks = dubbedChunks();
    const original = originalVideoBlob();
    
    if (!original) {
      batch(() => {
        setStatus('error');
        setCurrentStep('Nincs eredeti videó');
      });
      notify();
      return;
    }
    
    for (let i = 0; i < chunks.length; i++) {
      if (!chunks[i].dubbedBlob) {
        batch(() => {
          setStatus('error');
          setCurrentStep(`Hiányzó dubbolt részlet: ${i + 1}`);
        });
        notify();
        return;
      }
    }
    
    batch(() => {
      setStatus('merging');
      setProgress(50);
      setCurrentStep('FFmpeg betöltése...');
    });
    notify();
    
    const loaded = await loadFFmpegIfNeeded();
    if (!loaded) {
      batch(() => {
        setStatus('error');
        setCurrentStep('FFmpeg betöltése sikertelen');
      });
      notify();
      return;
    }
    
    const ffmpeg = getFFmpeg();
    
    try {
      batch(() => {
        setCurrentStep('Dubbolt videók hanganyagának kinyerése...');
        setProgress(55);
      });
      notify();
      
      const audioFiles: string[] = [];
      
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const inputName = `dubbed_${String(i).padStart(4, '0')}.mp4`;
        const audioName = `audio_${String(i).padStart(4, '0')}.aac`;
        
        const arrayBuffer = await chunk.dubbedBlob!.arrayBuffer();
        await ffmpeg.writeFile(inputName, new Uint8Array(arrayBuffer));
        
        await ffmpeg.exec([
          '-i', inputName,
          '-vn',
          '-acodec', 'aac',
          '-ar', '44100',
          '-ac', '2',
          '-b:a', '192k',
          audioName
        ]);
        
        audioFiles.push(audioName);
        await ffmpeg.deleteFile(inputName);
        
        const progressValue = 55 + ((i + 1) / chunks.length) * 15;
        batch(() => {
          setProgress(progressValue);
          setCurrentStep(`Hanganyag kinyerése: ${i + 1}/${chunks.length}`);
        });
        notify();
      }
      
      batch(() => {
        setCurrentStep('Hanganyagok összefűzése...');
        setProgress(70);
      });
      notify();
      
      let concatList = '';
      for (let i = 0; i < audioFiles.length; i++) {
        concatList += `file '${audioFiles[i]}'\n`;
      }
      
      const encoder = new TextEncoder();
      await ffmpeg.writeFile('concat_list.txt', encoder.encode(concatList));
      
      await ffmpeg.exec([
        '-f', 'concat',
        '-safe', '0',
        '-i', 'concat_list.txt',
        '-c:a', 'aac',
        '-b:a', '192k',
        'merged_audio.aac'
      ]);
      
      for (let i = 0; i < audioFiles.length; i++) {
        await ffmpeg.deleteFile(audioFiles[i]);
      }
      await ffmpeg.deleteFile('concat_list.txt');
      
      batch(() => {
        setCurrentStep('MP3 konvertálás...');
        setProgress(75);
      });
      notify();
      
      await ffmpeg.exec([
        '-i', 'merged_audio.aac',
        '-c:a', 'aac',
        '-b:a', '192k',
        'merged_audio.mp3'
      ]);
      
      const mergedAudioData = await ffmpeg.readFile('merged_audio.mp3');
      const mergedAudioUint8 = mergedAudioData instanceof Uint8Array 
        ? mergedAudioData 
        : new TextEncoder().encode(mergedAudioData as string);
      const mergedAudioBuffer = new Uint8Array(mergedAudioUint8).buffer as ArrayBuffer;
      const mergedBlob = new Blob([mergedAudioBuffer], { type: 'audio/mpeg' });
      setMergedAudioBlob(mergedBlob);
      
      batch(() => {
        setStatus('replacing');
        setCurrentStep('Eredeti videó betöltése...');
        setProgress(80);
      });
      notify();
      
      const originalArrayBuffer = await original.arrayBuffer();
      await ffmpeg.writeFile('original_video.mp4', new Uint8Array(originalArrayBuffer));
      
      batch(() => {
        setCurrentStep('Hangcsere az eredeti videón...');
        setProgress(85);
      });
      notify();
      
      await ffmpeg.exec([
        '-i', 'original_video.mp4',
        '-i', 'merged_audio.aac',
        '-c:v', 'copy',
        '-map', '0:v:0',
        '-map', '1:a:0',
        '-shortest',
        'final_video.mp4'
      ]);
      
      batch(() => {
        setCurrentStep('Végleges videó mentése...');
        setProgress(95);
      });
      notify();
      
      const finalVideoData = await ffmpeg.readFile('final_video.mp4');
      const finalVideoUint8 = finalVideoData instanceof Uint8Array 
        ? finalVideoData 
        : new TextEncoder().encode(finalVideoData as string);
      const finalVideoBuffer = new Uint8Array(finalVideoUint8).buffer as ArrayBuffer;
      const finalBlob = new Blob([finalVideoBuffer], { type: 'video/mp4' });

      await ffmpeg.deleteFile('original_video.mp4');
      await ffmpeg.deleteFile('merged_audio.aac');
      await ffmpeg.deleteFile('merged_audio.mp3');
      await ffmpeg.deleteFile('final_video.mp4');
      
      batch(() => {
        setFinalVideoBlob(finalBlob);
        setStatus('complete');
        setCurrentStep('Magyar szinkronos videó elkészült!');
        setProgress(100);
      });
      notify();
      
    } catch (error) {
      console.error('Merge error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Ismeretlen hiba';
      batch(() => {
        setStatus('error');
        setCurrentStep(`Hiba: ${errorMessage}`);
      });
      notify();
    }
  };
  
  const downloadFinalVideo = (): void => {
    const blob = finalVideoBlob();
    if (!blob) return;
    
    const name = originalVideoName();
    const baseName = name.replace(/\.[^/.]+$/, '');
    const fileName = `${baseName}_magyar_szinkron.mp4`;
    
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };
  
  const downloadMergedAudio = (): void => {
    const blob = mergedAudioBlob();
    if (!blob) return;
    
    const name = originalVideoName();
    const baseName = name.replace(/\.[^/.]+$/, '');
    const fileName = `${baseName}_magyar_hang.mp3`;
    
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };
  
  const reset = (): void => {
    batch(() => {
      setStatus('idle');
      setProgress(0);
      setCurrentStep('');
      setOriginalVideoBlob(null);
      setOriginalVideoName('');
      setDubbedChunks([]);
      setMergedAudioBlob(null);
      setFinalVideoBlob(null);
      setTotalChunks(0);
      setCompletedChunks(0);
    });
    notify();
  };
  
  return {
    getStatus: status,
    getProgress: progress,
    getCurrentStep: currentStep,
    getOriginalVideoBlob: originalVideoBlob,
    getOriginalVideoName: originalVideoName,
    getDubbedChunks: dubbedChunks,
    getMergedAudioBlob: mergedAudioBlob,
    getFinalVideoBlob: finalVideoBlob,
    getTotalChunks: totalChunks,
    getCompletedChunks: completedChunks,
    subscribe: (callback: () => void): (() => void) => {
      subscribers.add(callback);
      return () => subscribers.delete(callback);
    },
    actions: {
      startWorkflow,
      uploadDubbedChunk,
      uploadAllDubbedChunks,
      mergeAudioAndReplace,
      downloadFinalVideo,
      downloadMergedAudio,
      reset
    }
  };
}

let globalDubbingStore: DubbingWorkflowStore | null = null;

export function getDubbingWorkflowStore(): DubbingWorkflowStore {
  if (!globalDubbingStore) {
    globalDubbingStore = createDubbingWorkflowStore();
  }
  return globalDubbingStore;
}
