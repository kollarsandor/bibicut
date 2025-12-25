import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }
  return null;
}

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout = 15000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function downloadWithCobaltV10(url: string): Promise<{videoData: Uint8Array, filename: string}> {
  console.log('Trying Cobalt v10 API...');
  
  const cobaltResponse = await fetchWithTimeout('https://api.cobalt.tools/', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: url,
      videoQuality: '720',
      filenameStyle: 'basic',
      downloadMode: 'auto',
    })
  }, 20000);

  if (!cobaltResponse.ok) {
    const errorText = await cobaltResponse.text();
    console.error('Cobalt v10 API error:', cobaltResponse.status, errorText);
    throw new Error(`Cobalt API error: ${cobaltResponse.status}`);
  }

  const cobaltData = await cobaltResponse.json();
  console.log('Cobalt v10 response status:', cobaltData.status);

  if (cobaltData.status === 'error') {
    throw new Error(cobaltData.error?.code || 'Cobalt error');
  }

  if (cobaltData.status === 'tunnel' || cobaltData.status === 'redirect') {
    const downloadUrl = cobaltData.url;
    console.log('Downloading video from Cobalt...');

    const videoResponse = await fetchWithTimeout(downloadUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      }
    }, 120000);

    if (!videoResponse.ok) {
      throw new Error(`Download failed: ${videoResponse.status}`);
    }

    const arrayBuffer = await videoResponse.arrayBuffer();
    const videoData = new Uint8Array(arrayBuffer);
    const filename = cobaltData.filename || 'video.mp4';

    console.log('Cobalt download complete:', videoData.byteLength, 'bytes');
    return { videoData, filename };
  }

  if (cobaltData.status === 'picker' && cobaltData.picker?.length > 0) {
    const videoItem = cobaltData.picker.find((item: any) => item.type === 'video') || cobaltData.picker[0];
    if (videoItem?.url) {
      const videoResponse = await fetchWithTimeout(videoItem.url, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      }, 120000);

      if (!videoResponse.ok) throw new Error('Picker download failed');

      const arrayBuffer = await videoResponse.arrayBuffer();
      return { videoData: new Uint8Array(arrayBuffer), filename: 'video.mp4' };
    }
  }

  throw new Error('Cobalt: unexpected response');
}

async function downloadWithPipedAPI(videoId: string): Promise<{videoData: Uint8Array, title: string}> {
  const instances = [
    'https://pipedapi.kavin.rocks',
    'https://api.piped.yt',
    'https://pipedapi.in.projectsegfau.lt',
  ];

  for (const instance of instances) {
    try {
      console.log(`Trying Piped: ${instance}`);
      
      const infoResponse = await fetchWithTimeout(`${instance}/streams/${videoId}`, {
        headers: { 'Accept': 'application/json' },
      }, 10000);

      if (!infoResponse.ok) {
        console.log(`Piped ${instance}: ${infoResponse.status}`);
        continue;
      }

      const videoInfo = await infoResponse.json();
      if (!videoInfo.videoStreams?.length) continue;

      let selectedStream = videoInfo.videoStreams.find((s: any) => 
        s.mimeType?.includes('video/mp4') && !s.videoOnly && parseInt(s.quality) <= 720
      ) || videoInfo.videoStreams.find((s: any) => !s.videoOnly);

      if (!selectedStream?.url) continue;

      console.log('Piped stream quality:', selectedStream.quality);

      const videoResponse = await fetchWithTimeout(selectedStream.url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      }, 120000);

      if (!videoResponse.ok) continue;

      const arrayBuffer = await videoResponse.arrayBuffer();
      if (arrayBuffer.byteLength < 50000) continue;

      console.log('Piped download complete:', arrayBuffer.byteLength, 'bytes');
      return { videoData: new Uint8Array(arrayBuffer), title: videoInfo.title || 'video' };

    } catch (err) {
      console.log(`Piped ${instance} failed:`, err instanceof Error ? err.message : String(err));
    }
  }

  throw new Error('All Piped instances failed');
}

async function downloadWithInvidious(videoId: string): Promise<{videoData: Uint8Array, title: string}> {
  const instances = [
    'https://vid.puffyan.us',
    'https://inv.tux.pizza',
    'https://invidious.privacyredirect.com',
  ];

  for (const instance of instances) {
    try {
      console.log(`Trying Invidious: ${instance}`);
      
      const infoResponse = await fetchWithTimeout(`${instance}/api/v1/videos/${videoId}`, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0',
        },
      }, 10000);

      if (!infoResponse.ok) {
        console.log(`Invidious ${instance}: ${infoResponse.status}`);
        continue;
      }

      const contentType = infoResponse.headers.get('content-type');
      if (!contentType?.includes('application/json')) continue;

      const videoInfo = await infoResponse.json();
      const formatStreams = videoInfo.formatStreams || [];
      
      let selectedFormat = formatStreams.find((f: any) => f.container === 'mp4' && f.url);
      if (!selectedFormat) continue;

      console.log('Invidious format:', selectedFormat.qualityLabel);

      const videoResponse = await fetchWithTimeout(selectedFormat.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Referer': instance,
        },
      }, 120000);

      if (!videoResponse.ok) continue;

      const arrayBuffer = await videoResponse.arrayBuffer();
      if (arrayBuffer.byteLength < 50000) continue;

      console.log('Invidious download complete:', arrayBuffer.byteLength, 'bytes');
      return { videoData: new Uint8Array(arrayBuffer), title: videoInfo.title || 'video' };

    } catch (err) {
      console.log(`Invidious ${instance} failed:`, err instanceof Error ? err.message : String(err));
    }
  }

  throw new Error('All Invidious instances failed');
}

async function tryAllDownloadMethods(videoId: string, fullUrl: string): Promise<{videoData: Uint8Array, title: string}> {
  const downloadMethods = [
    { name: 'Cobalt', fn: () => downloadWithCobaltV10(fullUrl).then(r => ({ videoData: r.videoData, title: r.filename.replace(/\.[^/.]+$/, '') })) },
    { name: 'Piped', fn: () => downloadWithPipedAPI(videoId) },
    { name: 'Invidious', fn: () => downloadWithInvidious(videoId) },
  ];

  const results = await Promise.allSettled(
    downloadMethods.map(async (method) => {
      try {
        const result = await method.fn();
        console.log(`${method.name} succeeded!`);
        return result;
      } catch (err) {
        console.log(`${method.name} failed:`, err instanceof Error ? err.message : String(err));
        throw err;
      }
    })
  );

  for (const result of results) {
    if (result.status === 'fulfilled') {
      return result.value;
    }
  }

  throw new Error('Minden letöltési módszer sikertelen. Kérlek töltsd le manuálisan a videót.');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    
    if (!url) {
      return new Response(
        JSON.stringify({ error: 'No URL provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('Processing:', url);
    
    const videoId = extractVideoId(url);
    if (!videoId) {
      return new Response(
        JSON.stringify({ error: 'Invalid YouTube URL' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('Video ID:', videoId);
    const fullUrl = `https://www.youtube.com/watch?v=${videoId}`;

    const { videoData, title } = await tryAllDownloadMethods(videoId, fullUrl);

    console.log('Encoding to base64...');
    let base64Video = '';
    const chunkSize = 65536;
    for (let i = 0; i < videoData.length; i += chunkSize) {
      const chunk = videoData.subarray(i, Math.min(i + chunkSize, videoData.length));
      base64Video += String.fromCharCode.apply(null, Array.from(chunk));
    }
    base64Video = btoa(base64Video);
    
    console.log('Success:', title, videoData.byteLength, 'bytes');
    
    return new Response(
      JSON.stringify({
        success: true,
        title: title,
        quality: '720p',
        mimeType: 'video/mp4',
        videoBase64: base64Video,
        size: videoData.byteLength
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Hiba történt';
    console.error('Error:', errorMessage);
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});