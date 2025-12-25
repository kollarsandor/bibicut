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

async function getVideoInfo(videoId: string): Promise<{title: string, formats: any[]}> {
  console.log('Fetching video info for:', videoId);
  
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const response = await fetch(watchUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch YouTube page: ${response.status}`);
  }
  
  const html = await response.text();
  
  const playerResponseMatch = html.match(/var ytInitialPlayerResponse\s*=\s*(\{.+?\});/s);
  if (!playerResponseMatch) {
    const altMatch = html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\});/s);
    if (!altMatch) {
      console.error('Could not find player response in page');
      throw new Error('Could not extract video information from YouTube');
    }
  }
  
  const jsonStr = playerResponseMatch ? playerResponseMatch[1] : html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\});/s)![1];
  
  let playerResponse;
  try {
    playerResponse = JSON.parse(jsonStr);
  } catch (e) {
    console.error('Failed to parse player response:', e);
    throw new Error('Failed to parse video information');
  }
  
  if (playerResponse.playabilityStatus?.status !== 'OK') {
    const reason = playerResponse.playabilityStatus?.reason || 'Video is not available';
    throw new Error(reason);
  }
  
  const title = playerResponse.videoDetails?.title || 'video';
  const formats: any[] = [];
  
  if (playerResponse.streamingData?.formats) {
    formats.push(...playerResponse.streamingData.formats);
  }
  if (playerResponse.streamingData?.adaptiveFormats) {
    formats.push(...playerResponse.streamingData.adaptiveFormats);
  }
  
  if (formats.length === 0) {
    throw new Error('No downloadable formats found for this video');
  }
  
  return { title, formats };
}

function selectBestFormat(formats: any[]): any {
  const mp4Formats = formats.filter(f => 
    f.mimeType?.includes('video/mp4') && 
    f.url &&
    f.qualityLabel
  );
  
  if (mp4Formats.length === 0) {
    const anyVideoWithUrl = formats.find(f => f.mimeType?.includes('video/') && f.url);
    if (anyVideoWithUrl) {
      return anyVideoWithUrl;
    }
    throw new Error('No suitable video format found');
  }
  
  const qualityOrder = ['1080p', '720p', '480p', '360p', '240p', '144p'];
  
  for (const quality of qualityOrder) {
    const format = mp4Formats.find(f => f.qualityLabel === quality);
    if (format) {
      return format;
    }
  }
  
  return mp4Formats[0];
}

async function downloadVideo(format: any): Promise<Uint8Array> {
  console.log('Downloading video from URL, quality:', format.qualityLabel);
  
  const response = await fetch(format.url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Range': 'bytes=0-',
    }
  });
  
  if (!response.ok && response.status !== 206) {
    throw new Error(`Failed to download video: ${response.status}`);
  }
  
  const arrayBuffer = await response.arrayBuffer();
  console.log('Downloaded video size:', arrayBuffer.byteLength, 'bytes');
  
  return new Uint8Array(arrayBuffer);
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
    
    const { title, formats } = await getVideoInfo(videoId);
    console.log('Found', formats.length, 'formats for video:', title);
    
    const selectedFormat = selectBestFormat(formats);
    console.log('Selected format:', selectedFormat.qualityLabel, selectedFormat.mimeType);
    
    const videoData = await downloadVideo(selectedFormat);
    
    const base64Video = btoa(
      videoData.reduce((data, byte) => data + String.fromCharCode(byte), '')
    );
    
    return new Response(
      JSON.stringify({
        success: true,
        title: title,
        quality: selectedFormat.qualityLabel,
        mimeType: selectedFormat.mimeType,
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