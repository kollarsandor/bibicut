export interface DubbingWorkflowElement {
  element: HTMLElement;
  update: (state: DubbingWorkflowState) => void;
  destroy: () => void;
}

export interface DubbingWorkflowState {
  status: 'idle' | 'processing' | 'completed' | 'error' | 'cancelled';
  message: string;
  progress: number;
  currentChunk: number;
  totalChunks: number;
  phase: string;
  connected: boolean;
  result: {
    success: boolean;
    dubbedChunks?: string[];
    mergedDubbedVideo?: string;
    dubbedAudio?: string;
    finalVideo?: string;
    error?: string;
  } | null;
}

export function createDubbingWorkflowElement(
  onStartWorkflow: (videoPath: string) => void,
  onUploadVideo: (file: File) => Promise<string>,
  onConnect: () => void,
  onDisconnect: () => void
): DubbingWorkflowElement {
  const container = document.createElement('div');
  container.className = 'dubbing-workflow bg-card border border-border rounded-xl p-6 space-y-6';

  const headerSection = document.createElement('div');
  headerSection.className = 'flex items-center justify-between';
  headerSection.innerHTML = `
    <div class="flex items-center gap-3">
      <div class="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
        <svg class="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/>
        </svg>
      </div>
      <div>
        <h2 class="text-lg font-semibold text-foreground">Magyar Szinkron Bot</h2>
        <p class="text-sm text-muted-foreground">Automatikus dubbingolás Subformer.com-on</p>
      </div>
    </div>
    <div class="connection-status flex items-center gap-2">
      <span class="status-dot w-2 h-2 rounded-full bg-destructive"></span>
      <span class="status-text text-sm text-muted-foreground">Nincs kapcsolat</span>
    </div>
  `;

  const connectionSection = document.createElement('div');
  connectionSection.className = 'connection-controls flex gap-3';
  connectionSection.innerHTML = `
    <button class="connect-btn flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors">
      Kapcsolódás a Bothoz
    </button>
    <button class="disconnect-btn flex-1 px-4 py-2 bg-secondary text-secondary-foreground rounded-lg font-medium hover:bg-secondary/80 transition-colors hidden">
      Lecsatlakozás
    </button>
  `;

  const uploadSection = document.createElement('div');
  uploadSection.className = 'upload-section space-y-4 hidden';
  uploadSection.innerHTML = `
    <div class="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/50 transition-colors cursor-pointer upload-zone">
      <svg class="w-12 h-12 mx-auto text-muted-foreground mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
      </svg>
      <p class="text-foreground font-medium">Videó feltöltése a szerverhez</p>
      <p class="text-sm text-muted-foreground mt-1">Kattints vagy húzd ide a videót</p>
      <input type="file" accept="video/*" class="hidden video-input">
    </div>
    <div class="uploaded-file hidden p-4 bg-secondary/50 rounded-lg flex items-center justify-between">
      <div class="flex items-center gap-3">
        <svg class="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/>
        </svg>
        <div>
          <p class="font-medium text-foreground file-name">video.mp4</p>
          <p class="text-sm text-muted-foreground file-path">/path/to/video.mp4</p>
        </div>
      </div>
      <button class="start-workflow-btn px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors">
        Dubbingolás Indítása
      </button>
    </div>
  `;

  const progressSection = document.createElement('div');
  progressSection.className = 'progress-section hidden space-y-4';
  progressSection.innerHTML = `
    <div class="flex items-center justify-between">
      <span class="phase-text text-sm font-medium text-foreground">Feldolgozás...</span>
      <span class="progress-text text-sm text-muted-foreground">0%</span>
    </div>
    <div class="w-full h-3 bg-secondary rounded-full overflow-hidden">
      <div class="progress-bar h-full bg-primary rounded-full transition-all duration-300" style="width: 0%"></div>
    </div>
    <p class="status-message text-sm text-muted-foreground"></p>
    <div class="chunk-info hidden">
      <p class="text-sm text-muted-foreground">
        Chunk: <span class="current-chunk">0</span> / <span class="total-chunks">0</span>
      </p>
    </div>
  `;

  const resultSection = document.createElement('div');
  resultSection.className = 'result-section hidden space-y-4';
  resultSection.innerHTML = `
    <div class="success-result hidden p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
      <div class="flex items-center gap-3 mb-4">
        <svg class="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <span class="font-medium text-green-500">Dubbingolás Sikeres!</span>
      </div>
      <div class="space-y-2">
        <a class="final-video-link block p-3 bg-background rounded-lg hover:bg-secondary/50 transition-colors" href="#" download>
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <svg class="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/>
              </svg>
              <span class="text-foreground">Végső Videó (Magyar Hang)</span>
            </div>
            <svg class="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
            </svg>
          </div>
        </a>
        <a class="audio-link block p-3 bg-background rounded-lg hover:bg-secondary/50 transition-colors" href="#" download>
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <svg class="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"/>
              </svg>
              <span class="text-foreground">Magyar Hang (MP3)</span>
            </div>
            <svg class="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
            </svg>
          </div>
        </a>
      </div>
    </div>
    <div class="error-result hidden p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
      <div class="flex items-center gap-3">
        <svg class="w-6 h-6 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <span class="error-message font-medium text-destructive">Hiba történt</span>
      </div>
    </div>
  `;

  const instructionsSection = document.createElement('div');
  instructionsSection.className = 'instructions-section p-4 bg-secondary/30 rounded-lg';
  instructionsSection.innerHTML = `
    <h3 class="font-medium text-foreground mb-3">Telepítési Útmutató</h3>
    <ol class="space-y-2 text-sm text-muted-foreground">
      <li class="flex items-start gap-2">
        <span class="font-medium text-primary">1.</span>
        <span>Töltsd le az <code class="px-1 py-0.5 bg-background rounded">automation</code> mappát</span>
      </li>
      <li class="flex items-start gap-2">
        <span class="font-medium text-primary">2.</span>
        <span>Futtasd: <code class="px-1 py-0.5 bg-background rounded">./install.sh</code> (Mac/Linux) vagy <code class="px-1 py-0.5 bg-background rounded">install.bat</code> (Windows)</span>
      </li>
      <li class="flex items-start gap-2">
        <span class="font-medium text-primary">3.</span>
        <span>Másold le a <code class="px-1 py-0.5 bg-background rounded">.env.example</code> fájlt <code class="px-1 py-0.5 bg-background rounded">.env</code>-nek és add meg az API kulcsokat</span>
      </li>
      <li class="flex items-start gap-2">
        <span class="font-medium text-primary">4.</span>
        <span>Indítsd el: <code class="px-1 py-0.5 bg-background rounded">python main.py --server</code></span>
      </li>
      <li class="flex items-start gap-2">
        <span class="font-medium text-primary">5.</span>
        <span>Kattints a "Kapcsolódás a Bothoz" gombra</span>
      </li>
    </ol>
  `;

  container.appendChild(headerSection);
  container.appendChild(connectionSection);
  container.appendChild(uploadSection);
  container.appendChild(progressSection);
  container.appendChild(resultSection);
  container.appendChild(instructionsSection);

  const connectBtn = connectionSection.querySelector('.connect-btn') as HTMLButtonElement;
  const disconnectBtn = connectionSection.querySelector('.disconnect-btn') as HTMLButtonElement;
  const uploadZone = uploadSection.querySelector('.upload-zone') as HTMLDivElement;
  const videoInput = uploadSection.querySelector('.video-input') as HTMLInputElement;
  const uploadedFile = uploadSection.querySelector('.uploaded-file') as HTMLDivElement;
  const startWorkflowBtn = uploadSection.querySelector('.start-workflow-btn') as HTMLButtonElement;

  let currentVideoPath = '';

  connectBtn.addEventListener('click', () => {
    onConnect();
  });

  disconnectBtn.addEventListener('click', () => {
    onDisconnect();
  });

  uploadZone.addEventListener('click', () => {
    videoInput.click();
  });

  uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.classList.add('border-primary');
  });

  uploadZone.addEventListener('dragleave', () => {
    uploadZone.classList.remove('border-primary');
  });

  uploadZone.addEventListener('drop', async (e) => {
    e.preventDefault();
    uploadZone.classList.remove('border-primary');
    
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      await handleFileUpload(files[0]);
    }
  });

  videoInput.addEventListener('change', async () => {
    if (videoInput.files && videoInput.files.length > 0) {
      await handleFileUpload(videoInput.files[0]);
    }
  });

  async function handleFileUpload(file: File) {
    try {
      uploadZone.innerHTML = `
        <div class="flex items-center justify-center gap-3">
          <svg class="w-6 h-6 text-primary animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
          </svg>
          <span class="text-foreground">Feltöltés folyamatban...</span>
        </div>
      `;

      currentVideoPath = await onUploadVideo(file);
      
      const fileName = uploadedFile.querySelector('.file-name') as HTMLParagraphElement;
      const filePath = uploadedFile.querySelector('.file-path') as HTMLParagraphElement;
      
      fileName.textContent = file.name;
      filePath.textContent = currentVideoPath;
      
      uploadZone.classList.add('hidden');
      uploadedFile.classList.remove('hidden');
    } catch (e) {
      uploadZone.innerHTML = `
        <svg class="w-12 h-12 mx-auto text-destructive mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <p class="text-destructive font-medium">Feltöltés sikertelen</p>
        <p class="text-sm text-muted-foreground mt-1">Kattints az újrapróbálkozáshoz</p>
      `;
    }
  }

  startWorkflowBtn.addEventListener('click', () => {
    if (currentVideoPath) {
      onStartWorkflow(currentVideoPath);
    }
  });

  function update(state: DubbingWorkflowState) {
    const statusDot = headerSection.querySelector('.status-dot') as HTMLSpanElement;
    const statusText = headerSection.querySelector('.status-text') as HTMLSpanElement;

    if (state.connected) {
      statusDot.classList.remove('bg-destructive');
      statusDot.classList.add('bg-green-500');
      statusText.textContent = 'Kapcsolódva';
      
      connectBtn.classList.add('hidden');
      disconnectBtn.classList.remove('hidden');
      uploadSection.classList.remove('hidden');
      instructionsSection.classList.add('hidden');
    } else {
      statusDot.classList.remove('bg-green-500');
      statusDot.classList.add('bg-destructive');
      statusText.textContent = 'Nincs kapcsolat';
      
      connectBtn.classList.remove('hidden');
      disconnectBtn.classList.add('hidden');
      uploadSection.classList.add('hidden');
      instructionsSection.classList.remove('hidden');
    }

    if (state.status === 'processing') {
      progressSection.classList.remove('hidden');
      resultSection.classList.add('hidden');
      
      const progressBar = progressSection.querySelector('.progress-bar') as HTMLDivElement;
      const progressText = progressSection.querySelector('.progress-text') as HTMLSpanElement;
      const phaseText = progressSection.querySelector('.phase-text') as HTMLSpanElement;
      const statusMessage = progressSection.querySelector('.status-message') as HTMLParagraphElement;
      const chunkInfo = progressSection.querySelector('.chunk-info') as HTMLDivElement;
      const currentChunk = progressSection.querySelector('.current-chunk') as HTMLSpanElement;
      const totalChunks = progressSection.querySelector('.total-chunks') as HTMLSpanElement;
      
      progressBar.style.width = `${state.progress}%`;
      progressText.textContent = `${Math.round(state.progress)}%`;
      statusMessage.textContent = state.message;
      
      const phaseNames: Record<string, string> = {
        'initializing': 'Inicializálás...',
        'splitting': 'Videó darabolása...',
        'dubbing': 'Dubbingolás folyamatban...',
        'merging': 'Videó összeillesztése...',
        'extracting': 'Hang kinyerése...',
        'replacing': 'Hang cseréje...',
        'completed': 'Befejezve!',
        'error': 'Hiba történt',
        'cancelled': 'Megszakítva'
      };
      
      phaseText.textContent = phaseNames[state.phase] || state.phase;
      
      if (state.totalChunks > 0) {
        chunkInfo.classList.remove('hidden');
        currentChunk.textContent = String(state.currentChunk);
        totalChunks.textContent = String(state.totalChunks);
      } else {
        chunkInfo.classList.add('hidden');
      }
    } else if (state.status === 'completed' || state.status === 'error') {
      progressSection.classList.add('hidden');
      resultSection.classList.remove('hidden');
      
      const successResult = resultSection.querySelector('.success-result') as HTMLDivElement;
      const errorResult = resultSection.querySelector('.error-result') as HTMLDivElement;
      
      if (state.result?.success) {
        successResult.classList.remove('hidden');
        errorResult.classList.add('hidden');
        
        const finalVideoLink = successResult.querySelector('.final-video-link') as HTMLAnchorElement;
        const audioLink = successResult.querySelector('.audio-link') as HTMLAnchorElement;
        
        if (state.result.finalVideo) {
          const filename = state.result.finalVideo.split('/').pop();
          finalVideoLink.href = `http://localhost:8766/download/${filename}`;
        }
        
        if (state.result.dubbedAudio) {
          const filename = state.result.dubbedAudio.split('/').pop();
          audioLink.href = `http://localhost:8766/download/${filename}`;
        }
      } else {
        successResult.classList.add('hidden');
        errorResult.classList.remove('hidden');
        
        const errorMessage = errorResult.querySelector('.error-message') as HTMLSpanElement;
        errorMessage.textContent = state.result?.error || state.message || 'Ismeretlen hiba';
      }
    } else {
      progressSection.classList.add('hidden');
      resultSection.classList.add('hidden');
    }
  }

  function destroy() {
    container.remove();
  }

  return {
    element: container,
    update,
    destroy
  };
}
