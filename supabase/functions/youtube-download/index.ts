import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TIMEOUTS = {
  API_REQUEST: 15000,
  VIDEO_DOWNLOAD: 120000,
};

const MIN_VIDEO_SIZE = 50000;

const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://api.piped.yt',
  'https://pipedapi.in.projectsegfau.lt',
];

const INVIDIOUS_INSTANCES = [
  'https://vid.puffyan.us',
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
  for (const instance of PIPED_INSTANCES) {
    try {
      const infoResponse = await fetchWithTimeout(`${instance}/streams/${videoId}`, { headers: { 'Accept': 'application/json' } }, TIMEOUTS.API_REQUEST);
      if (!infoResponse.ok) continue;
      const videoInfo = await infoResponse.json();
      if (!videoInfo.videoStreams?.length) continue;
      const selectedStream = videoInfo.videoStreams.find((s: { mimeType?: string; videoOnly?: boolean; quality?: string }) => s.mimeType?.includes('video/mp4') && !s.videoOnly && parseInt(s.quality || '0') <= 720) || videoInfo.videoStreams.find((s: { videoOnly?: boolean }) => !s.videoOnly);
      if (!selectedStream?.url) continue;
      const videoResponse = await fetchWithTimeout(selectedStream.url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }, TIMEOUTS.VIDEO_DOWNLOAD);
      if (!videoResponse.ok) continue;
      const arrayBuffer = await videoResponse.arrayBuffer();
      if (arrayBuffer.byteLength < MIN_VIDEO_SIZE) continue;
      return { videoData: new Uint8Array(arrayBuffer), title: videoInfo.title || 'video' };
    } catch { continue; }
  }
  throw new Error('Piped failed');
}

async function downloadFromInvidious(videoId: string): Promise<{videoData: Uint8Array, title: string}> {
  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      const infoResponse = await fetchWithTimeout(`${instance}/api/v1/videos/${videoId}`, { headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' } }, TIMEOUTS.API_REQUEST);
      if (!infoResponse.ok) continue;
      const contentType = infoResponse.headers.get('content-type');
      if (!contentType?.includes('application/json')) continue;
      const videoInfo = await infoResponse.json();
      const formatStreams = videoInfo.formatStreams || [];
      const selectedFormat = formatStreams.find((f: { container?: string; url?: string }) => f.container === 'mp4' && f.url);
      if (!selectedFormat) continue;
      const videoResponse = await fetchWithTimeout(selectedFormat.url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': instance } }, TIMEOUTS.VIDEO_DOWNLOAD);
      if (!videoResponse.ok) continue;
      const arrayBuffer = await videoResponse.arrayBuffer();
      if (arrayBuffer.byteLength < MIN_VIDEO_SIZE) continue;
      return { videoData: new Uint8Array(arrayBuffer), title: videoInfo.title || 'video' };
    } catch { continue; }
  }
  throw new Error('Invidious failed');
}

async function downloadVideo(videoId: string): Promise<{videoData: Uint8Array, title: string}> {
  const methods = [
    () => downloadFromPiped(videoId),
    () => downloadFromInvidious(videoId),
  ];
  const results = await Promise.allSettled(methods.map(fn => fn()));
  for (const result of results) {
    if (result.status === 'fulfilled') return result.value;
  }
  throw new Error('Minden letöltési módszer sikertelen. Kérlek töltsd le manuálisan a videót.');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }
  try {
    const { url } = await req.json();
    if (!url) {
      return new Response(JSON.stringify({ error: 'No URL provided' }), { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
    }
    const videoId = extractVideoId(url);
    if (!videoId) {
      return new Response(JSON.stringify({ error: 'Invalid YouTube URL' }), { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
    }
    const { videoData, title } = await downloadVideo(videoId);
    let base64Video = '';
    const chunkSize = 65536;
    for (let i = 0; i < videoData.length; i += chunkSize) {
      const chunk = videoData.subarray(i, Math.min(i + chunkSize, videoData.length));
      base64Video += String.fromCharCode.apply(null, Array.from(chunk));
    }
    base64Video = btoa(base64Video);
    return new Response(JSON.stringify({ success: true, title, quality: '720p', mimeType: 'video/mp4', videoBase64: base64Video, size: videoData.byteLength }), { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Hiba történt';
    return new Response(JSON.stringify({ error: errorMessage }), { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
  }
});