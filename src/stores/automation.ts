import { createSignal, createEffect } from '@/core/signal';
import type { AutomationStatus, AutomationResult, AutomationFiles } from '@/types/automation';

const WS_URL = 'ws://localhost:8765';
const HTTP_URL = 'http://localhost:8766';

interface AutomationState {
  connected: boolean;
  status: AutomationStatus;
  result: AutomationResult | null;
  files: AutomationFiles;
  error: string | null;
}

interface AutomationActions {
  connect: () => void;
  disconnect: () => void;
  startWorkflow: (videoPath: string) => Promise<void>;
  uploadVideo: (file: File) => Promise<string>;
  fetchFiles: () => Promise<void>;
  reset: () => void;
}

interface AutomationStore {
  getConnected: () => boolean;
  getStatus: () => AutomationStatus;
  getResult: () => AutomationResult | null;
  getFiles: () => AutomationFiles;
  getError: () => string | null;
  connect: () => void;
  disconnect: () => void;
  startWorkflow: (videoPath: string) => Promise<void>;
  uploadVideo: (file: File) => Promise<string>;
  fetchFiles: () => Promise<void>;
  reset: () => void;
}

const initialStatus: AutomationStatus = {
  status: 'idle',
  message: '',
  progress: 0,
  currentChunk: 0,
  totalChunks: 0,
  phase: 'waiting'
};

const initialFiles: AutomationFiles = {
  input: [],
  output: [],
  dubbed: []
};

let ws: WebSocket | null = null;
let reconnectTimeout: number | null = null;

function createAutomationStore(): AutomationStore {
  const [connected, setConnected] = createSignal(false);
  const [status, setStatus] = createSignal<AutomationStatus>(initialStatus);
  const [result, setResult] = createSignal<AutomationResult | null>(null);
  const [files, setFiles] = createSignal<AutomationFiles>(initialFiles);
  const [error, setError] = createSignal<string | null>(null);

  function connect() {
    if (ws && ws.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        setConnected(true);
        setError(null);
        console.log('Automation WebSocket connected');
      };

      ws.onclose = () => {
        setConnected(false);
        console.log('Automation WebSocket disconnected');
        
        if (reconnectTimeout) {
          clearTimeout(reconnectTimeout);
        }
        reconnectTimeout = window.setTimeout(() => {
          connect();
        }, 3000);
      };

      ws.onerror = (e) => {
        setError('WebSocket kapcsolódási hiba. Győződj meg róla, hogy a Python szerver fut.');
        console.error('WebSocket error:', e);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'status') {
            setStatus({
              status: data.data.status,
              message: data.data.message,
              progress: data.data.progress,
              currentChunk: data.data.current_chunk,
              totalChunks: data.data.total_chunks,
              phase: data.data.phase
            });
          } else if (data.type === 'result') {
            setResult({
              success: data.data.success,
              dubbedChunks: data.data.dubbed_chunks,
              mergedDubbedVideo: data.data.merged_dubbed_video,
              dubbedAudio: data.data.dubbed_audio,
              finalVideo: data.data.final_video,
              error: data.data.error
            });
          }
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e);
        }
      };
    } catch (e) {
      setError('Nem sikerült csatlakozni a szerverhez');
      console.error('WebSocket connection error:', e);
    }
  }

  function disconnect() {
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }
    
    if (ws) {
      ws.close();
      ws = null;
    }
    
    setConnected(false);
  }

  async function startWorkflow(videoPath: string) {
    try {
      const response = await fetch(`${HTTP_URL}/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ video_path: videoPath })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to start workflow');
      }

      setResult(null);
      setError(null);
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'Ismeretlen hiba';
      setError(errorMsg);
      throw e;
    }
  }

  async function uploadVideo(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('video', file);

    try {
      const response = await fetch(`${HTTP_URL}/upload`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to upload video');
      }

      const data = await response.json();
      return data.path;
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'Feltöltési hiba';
      setError(errorMsg);
      throw e;
    }
  }

  async function fetchFiles() {
    try {
      const response = await fetch(`${HTTP_URL}/files`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch files');
      }

      const data = await response.json();
      setFiles(data);
    } catch (e) {
      console.error('Failed to fetch files:', e);
    }
  }

  function reset() {
    setStatus(initialStatus);
    setResult(null);
    setError(null);
  }

  return {
    getConnected: connected,
    getStatus: status,
    getResult: result,
    getFiles: files,
    getError: error,
    connect,
    disconnect,
    startWorkflow,
    uploadVideo,
    fetchFiles,
    reset
  };
}

let automationStore: AutomationStore | null = null;

export function getAutomationStore(): AutomationStore {
  if (!automationStore) {
    automationStore = createAutomationStore();
  }
  return automationStore;
}

export type { AutomationStore, AutomationState, AutomationActions };
