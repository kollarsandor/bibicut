import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TIMEOUTS = {
  API_REQUEST: 20000,
  VIDEO_DOWNLOAD: 180000,
};

const MIN_VIDEO_SIZE = 50000;

const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.adminforge.de',
  'https://api.piped.yt',
  'https://pipedapi.darkness.services',
  'https://pipedapi.moomoo.me',
];

const INVIDIOUS_INSTANCES = [
  'https://inv.nadeko.net',
  'https://invidious.nerdvpn.de',
  'https://invidious.protokolla.fi',
  'https://inv.tux.pizza',
  'https://invidious.privacyredirect.com',
];

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function downloadFromPiped(videoId: string): Promise<{videoData: Uint8Array, title: string}> {
  const errors: string[] = [];
  
  for (const instance of PIPED_INSTANCES) {
    try {
      console.log(`Trying Piped instance: ${instance}`);
      
      const infoResponse = await fetchWithTimeout(
        `${instance}/streams/${videoId}`, 
        { headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }, 
        TIMEOUTS.API_REQUEST
      );
      
      if (!infoResponse.ok) {
        console.log(`Piped ${instance} returned status: ${infoResponse.status}`);
        continue;
      }
      
      const videoInfo = await infoResponse.json();
      
      if (!videoInfo.videoStreams?.length && !videoInfo.audioStreams?.length) {
        console.log(`Piped ${instance} returned no streams`);
        continue;
      }
      
      const videoStreams = videoInfo.videoStreams || [];
      const selectedStream = 
        videoStreams.find((s: { mimeType?: string; videoOnly?: boolean; quality?: string }) => 
          s.mimeType?.includes('video/mp4') && !s.videoOnly && parseInt(s.quality || '0') <= 720
        ) || 
        videoStreams.find((s: { mimeType?: string; videoOnly?: boolean }) => 
          s.mimeType?.includes('video/mp4') && !s.videoOnly
        ) ||
        videoStreams.find((s: { videoOnly?: boolean }) => !s.videoOnly);
      
      if (!selectedStream?.url) {
        console.log(`Piped ${instance} no suitable stream found`);
        continue;
      }
      
      console.log(`Downloading from Piped: ${selectedStream.quality || 'unknown quality'}`);
      
      const videoResponse = await fetchWithTimeout(
        selectedStream.url, 
        { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }, 
        TIMEOUTS.VIDEO_DOWNLOAD
      );
      
      if (!videoResponse.ok) {
        console.log(`Piped video download failed: ${videoResponse.status}`);
        continue;
      }
      
      const arrayBuffer = await videoResponse.arrayBuffer();
      
      if (arrayBuffer.byteLength < MIN_VIDEO_SIZE) {
        console.log(`Piped video too small: ${arrayBuffer.byteLength} bytes`);
        continue;
      }
      
      console.log(`Piped download successful: ${arrayBuffer.byteLength} bytes`);
      return { videoData: new Uint8Array(arrayBuffer), title: videoInfo.title || 'video' };
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.log(`Piped ${instance} error: ${errorMsg}`);
      errors.push(`${instance}: ${errorMsg}`);
      continue;
    }
  }
  
  throw new Error(`Piped failed: ${errors.join(', ')}`);
}

async function downloadFromInvidious(videoId: string): Promise<{videoData: Uint8Array, title: string}> {
  const errors: string[] = [];
  
  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      console.log(`Trying Invidious instance: ${instance}`);
      
      const infoResponse = await fetchWithTimeout(
        `${instance}/api/v1/videos/${videoId}`, 
        { headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }, 
        TIMEOUTS.API_REQUEST
      );
      
      if (!infoResponse.ok) {
        console.log(`Invidious ${instance} returned status: ${infoResponse.status}`);
        continue;
      }
      
      const contentType = infoResponse.headers.get('content-type');
      if (!contentType?.includes('application/json')) {
        console.log(`Invidious ${instance} returned non-JSON content`);
        continue;
      }
      
      const videoInfo = await infoResponse.json();
      const formatStreams = videoInfo.formatStreams || [];
      const adaptiveFormats = videoInfo.adaptiveFormats || [];
      
      const selectedFormat = 
        formatStreams.find((f: { container?: string; url?: string; qualityLabel?: string }) => 
          f.container === 'mp4' && f.url && parseInt(f.qualityLabel || '0') <= 720
        ) ||
        formatStreams.find((f: { container?: string; url?: string }) => 
          f.container === 'mp4' && f.url
        ) ||
        adaptiveFormats.find((f: { container?: string; url?: string; type?: string }) => 
          f.container === 'mp4' && f.url && f.type?.includes('video')
        );
      
      if (!selectedFormat) {
        console.log(`Invidious ${instance} no suitable format found`);
        continue;
      }
      
      console.log(`Downloading from Invidious: ${selectedFormat.qualityLabel || 'unknown quality'}`);
      
      const videoResponse = await fetchWithTimeout(
        selectedFormat.url, 
        { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Referer': instance } }, 
        TIMEOUTS.VIDEO_DOWNLOAD
      );
      
      if (!videoResponse.ok) {
        console.log(`Invidious video download failed: ${videoResponse.status}`);
        continue;
      }
      
      const arrayBuffer = await videoResponse.arrayBuffer();
      
      if (arrayBuffer.byteLength < MIN_VIDEO_SIZE) {
        console.log(`Invidious video too small: ${arrayBuffer.byteLength} bytes`);
        continue;
      }
      
      console.log(`Invidious download successful: ${arrayBuffer.byteLength} bytes`);
      return { videoData: new Uint8Array(arrayBuffer), title: videoInfo.title || 'video' };
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.log(`Invidious ${instance} error: ${errorMsg}`);
      errors.push(`${instance}: ${errorMsg}`);
      continue;
    }
  }
  
  throw new Error(`Invidious failed: ${errors.join(', ')}`);
}

async function downloadVideo(videoId: string): Promise<{videoData: Uint8Array, title: string}> {
  console.log(`Starting download for video ID: ${videoId}`);
  
  try {
    return await downloadFromPiped(videoId);
  } catch (pipedError) {
    console.log(`Piped failed, trying Invidious...`);
    
    try {
      return await downloadFromInvidious(videoId);
    } catch (invidiousError) {
      console.log(`All methods failed`);
      throw new Error('Minden letöltési módszer sikertelen. A YouTube API-k jelenleg nem elérhetőek. Kérlek töltsd le manuálisan a videót és használd a fájlfeltöltést.');
    }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }
  
  try {
    const { url } = await req.json();
    
    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: 'URL megadása kötelező' }), 
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }
    
    const videoId = extractVideoId(url);
    
    if (!videoId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Érvénytelen YouTube URL' }), 
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`Processing YouTube URL: ${url}, Video ID: ${videoId}`);
    
    const { videoData, title } = await downloadVideo(videoId);
    
    let base64Video = '';
    const chunkSize = 65536;
    for (let i = 0; i < videoData.length; i += chunkSize) {
      const chunk = videoData.subarray(i, Math.min(i + chunkSize, videoData.length));
      base64Video += String.fromCharCode.apply(null, Array.from(chunk));
    }
    base64Video = btoa(base64Video);
    
    console.log(`Successfully processed video: ${title}, size: ${videoData.byteLength} bytes`);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        title, 
        quality: '720p', 
        mimeType: 'video/mp4', 
        videoBase64: base64Video, 
        size: videoData.byteLength 
      }), 
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
    
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Ismeretlen hiba történt';
    console.error(`Error: ${errorMessage}`);
    
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }), 
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  }
});
