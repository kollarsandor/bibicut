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

async function downloadWithCobaltV10(url: string): Promise<{videoData: Uint8Array, filename: string}> {
  console.log('Requesting download from Cobalt v10 API...');
  
  const cobaltResponse = await fetch('https://api.cobalt.tools/', {
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
  });

  if (!cobaltResponse.ok) {
    const errorText = await cobaltResponse.text();
    console.error('Cobalt v10 API error:', cobaltResponse.status, errorText);
    throw new Error(`Cobalt API error: ${cobaltResponse.status}`);
  }

  const cobaltData = await cobaltResponse.json();
  console.log('Cobalt v10 response status:', cobaltData.status);

  if (cobaltData.status === 'error') {
    throw new Error(cobaltData.error?.code || 'Failed to process video');
  }

  if (cobaltData.status === 'tunnel' || cobaltData.status === 'redirect') {
    const downloadUrl = cobaltData.url;
    console.log('Downloading video...');

    const videoResponse = await fetch(downloadUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      }
    });

    if (!videoResponse.ok) {
      throw new Error(`Failed to download video: ${videoResponse.status}`);
    }

    const arrayBuffer = await videoResponse.arrayBuffer();
    const videoData = new Uint8Array(arrayBuffer);
    
    const contentDisposition = videoResponse.headers.get('content-disposition');
    let filename = cobaltData.filename || 'video.mp4';
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      if (filenameMatch && filenameMatch[1]) {
        filename = filenameMatch[1].replace(/['"]/g, '');
      }
    }

    console.log('Downloaded video size:', videoData.byteLength, 'bytes');
    return { videoData, filename };
  }

  if (cobaltData.status === 'picker') {
    const videoItem = cobaltData.picker?.find((item: any) => item.type === 'video') || cobaltData.picker?.[0];
    if (videoItem && videoItem.url) {
      console.log('Downloading from picker...');
      
      const videoResponse = await fetch(videoItem.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        }
      });

      if (!videoResponse.ok) {
        throw new Error(`Failed to download video: ${videoResponse.status}`);
      }

      const arrayBuffer = await videoResponse.arrayBuffer();
      return { videoData: new Uint8Array(arrayBuffer), filename: 'video.mp4' };
    }
  }

  throw new Error('Unexpected response from download service: ' + cobaltData.status);
}

async function downloadWithInvidious(videoId: string): Promise<{videoData: Uint8Array, title: string}> {
  const instances = [
    'https://vid.puffyan.us',
    'https://inv.tux.pizza',
    'https://invidious.privacyredirect.com',
    'https://iv.nboeck.de',
    'https://invidious.protokolla.fi',
  ];

  let lastError: Error | null = null;

  for (const instance of instances) {
    try {
      console.log(`Trying Invidious instance: ${instance}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const infoResponse = await fetch(`${instance}/api/v1/videos/${videoId}`, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      if (!infoResponse.ok) {
        console.log(`Instance ${instance} returned ${infoResponse.status}`);
        continue;
      }

      const contentType = infoResponse.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.log(`Instance ${instance} returned non-JSON response`);
        continue;
      }

      const videoInfo = await infoResponse.json();
      console.log('Video title:', videoInfo.title);

      const formatStreams = videoInfo.formatStreams || [];
      
      let selectedFormat = formatStreams.find((f: any) => 
        f.container === 'mp4' && f.qualityLabel
      );

      if (!selectedFormat && formatStreams.length > 0) {
        selectedFormat = formatStreams[0];
      }

      if (!selectedFormat || !selectedFormat.url) {
        console.log('No suitable format found on this instance');
        continue;
      }

      console.log('Selected format:', selectedFormat.qualityLabel);

      const videoController = new AbortController();
      const videoTimeoutId = setTimeout(() => videoController.abort(), 60000);

      const videoResponse = await fetch(selectedFormat.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': instance,
        },
        signal: videoController.signal,
      });

      clearTimeout(videoTimeoutId);

      if (!videoResponse.ok) {
        console.log(`Failed to download: ${videoResponse.status}`);
        continue;
      }

      const arrayBuffer = await videoResponse.arrayBuffer();
      console.log('Downloaded:', arrayBuffer.byteLength, 'bytes');

      if (arrayBuffer.byteLength < 10000) {
        console.log('Downloaded file too small, skipping');
        continue;
      }

      return {
        videoData: new Uint8Array(arrayBuffer),
        title: videoInfo.title || 'video'
      };

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.log(`Instance ${instance} failed:`, errorMsg);
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError || new Error('All Invidious instances failed');
}

async function downloadWithPipedAPI(videoId: string): Promise<{videoData: Uint8Array, title: string}> {
  const instances = [
    'https://pipedapi.kavin.rocks',
    'https://api.piped.yt',
    'https://pipedapi.in.projectsegfau.lt',
    'https://pipedapi.darkness.services',
  ];

  let lastError: Error | null = null;

  for (const instance of instances) {
    try {
      console.log(`Trying Piped instance: ${instance}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const infoResponse = await fetch(`${instance}/streams/${videoId}`, {
        headers: {
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!infoResponse.ok) {
        console.log(`Piped instance ${instance} returned ${infoResponse.status}`);
        continue;
      }

      const videoInfo = await infoResponse.json();
      console.log('Piped video title:', videoInfo.title);

      const videoStreams = videoInfo.videoStreams || [];
      
      let selectedStream = videoStreams.find((s: any) => 
        s.mimeType?.includes('video/mp4') && 
        s.videoOnly === false &&
        parseInt(s.quality) <= 720
      );

      if (!selectedStream) {
        selectedStream = videoStreams.find((s: any) => 
          s.mimeType?.includes('video/mp4') && s.videoOnly === false
        );
      }

      if (!selectedStream) {
        selectedStream = videoStreams.find((s: any) => s.videoOnly === false);
      }

      if (!selectedStream || !selectedStream.url) {
        console.log('No suitable stream found');
        continue;
      }

      console.log('Selected quality:', selectedStream.quality);

      const videoController = new AbortController();
      const videoTimeoutId = setTimeout(() => videoController.abort(), 60000);

      const videoResponse = await fetch(selectedStream.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        signal: videoController.signal,
      });

      clearTimeout(videoTimeoutId);

      if (!videoResponse.ok) {
        console.log(`Failed to download from Piped: ${videoResponse.status}`);
        continue;
      }

      const arrayBuffer = await videoResponse.arrayBuffer();
      console.log('Piped downloaded:', arrayBuffer.byteLength, 'bytes');

      if (arrayBuffer.byteLength < 10000) {
        console.log('Downloaded file too small');
        continue;
      }

      return {
        videoData: new Uint8Array(arrayBuffer),
        title: videoInfo.title || 'video'
      };

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.log(`Piped instance ${instance} failed:`, errorMsg);
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError || new Error('All Piped instances failed');
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
    
    console.log('Processing YouTube URL:', url);
    
    const videoId = extractVideoId(url);
    if (!videoId) {
      return new Response(
        JSON.stringify({ error: 'Invalid YouTube URL' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('Extracted video ID:', videoId);
    const fullUrl = `https://www.youtube.com/watch?v=${videoId}`;

    let videoData: Uint8Array;
    let title = 'youtube_video';

    try {
      console.log('Trying Cobalt v10 API...');
      const cobaltResult = await downloadWithCobaltV10(fullUrl);
      videoData = cobaltResult.videoData;
      title = cobaltResult.filename.replace(/\.[^/.]+$/, '') || 'youtube_video';
    } catch (cobaltError) {
      console.log('Cobalt failed:', cobaltError instanceof Error ? cobaltError.message : String(cobaltError));
      
      try {
        console.log('Trying Piped API...');
        const pipedResult = await downloadWithPipedAPI(videoId);
        videoData = pipedResult.videoData;
        title = pipedResult.title;
      } catch (pipedError) {
        console.log('Piped failed:', pipedError instanceof Error ? pipedError.message : String(pipedError));
        
        try {
          console.log('Trying Invidious API...');
          const invidiousResult = await downloadWithInvidious(videoId);
          videoData = invidiousResult.videoData;
          title = invidiousResult.title;
        } catch (invidiousError) {
          console.error('All download methods failed');
          throw new Error('Nem sikerült letölteni a videót. A YouTube videók letöltése jelenleg nem elérhető. Kérlek töltsd le a videót manuálisan és használd a fájl feltöltést.');
        }
      }
    }

    console.log('Converting to base64, size:', videoData.byteLength);
    let base64Video = '';
    const chunkSize = 32768;
    for (let i = 0; i < videoData.length; i += chunkSize) {
      const chunk = videoData.subarray(i, Math.min(i + chunkSize, videoData.length));
      base64Video += String.fromCharCode.apply(null, Array.from(chunk));
    }
    base64Video = btoa(base64Video);
    
    console.log('Success! Title:', title);
    
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
    const errorMessage = err instanceof Error ? err.message : 'Failed to process YouTube video';
    console.error('Error processing YouTube video:', errorMessage);
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: String(err)
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});