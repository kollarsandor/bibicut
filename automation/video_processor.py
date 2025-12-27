import asyncio
import subprocess
import shutil
import logging
from pathlib import Path
from typing import List, Callable, Optional
from config import TEMP_DIR, OUTPUT_DIR, CHUNK_DURATION_SECONDS, MAX_RETRIES, RETRY_DELAY

logger = logging.getLogger(__name__)

class VideoProcessor:
    def __init__(self, progress_callback: Optional[Callable] = None):
        self.progress_callback = progress_callback
    
    async def report_progress(self, message: str, progress: float = 0):
        if self.progress_callback:
            try:
                result = self.progress_callback(message, progress)
                if asyncio.iscoroutine(result):
                    await result
            except Exception as e:
                logger.error(f"Progress callback error: {e}")
    
    async def run_ffmpeg(self, cmd: List[str], description: str = "") -> bool:
        for attempt in range(MAX_RETRIES):
            try:
                process = await asyncio.create_subprocess_exec(
                    *cmd,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )
                stdout, stderr = await process.communicate()
                
                if process.returncode == 0:
                    return True
                
                logger.warning(f"FFmpeg attempt {attempt + 1} failed: {stderr.decode()}")
                
                if attempt < MAX_RETRIES - 1:
                    await asyncio.sleep(RETRY_DELAY)
            except Exception as e:
                logger.error(f"FFmpeg error: {e}")
                if attempt < MAX_RETRIES - 1:
                    await asyncio.sleep(RETRY_DELAY)
        
        return False
    
    async def get_video_duration(self, video_path: Path) -> float:
        cmd = [
            "ffprobe",
            "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            str(video_path)
        ]
        
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await process.communicate()
        
        try:
            return float(stdout.decode().strip())
        except ValueError:
            logger.error(f"Could not get video duration: {stderr.decode()}")
            return 0.0
    
    async def get_video_info(self, video_path: Path) -> dict:
        cmd = [
            "ffprobe",
            "-v", "error",
            "-select_streams", "v:0",
            "-show_entries", "stream=width,height,r_frame_rate,codec_name",
            "-of", "json",
            str(video_path)
        ]
        
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await process.communicate()
        
        try:
            import json
            data = json.loads(stdout.decode())
            stream = data.get("streams", [{}])[0]
            return {
                "width": stream.get("width", 0),
                "height": stream.get("height", 0),
                "fps": stream.get("r_frame_rate", "30/1"),
                "codec": stream.get("codec_name", "unknown")
            }
        except Exception as e:
            logger.error(f"Could not get video info: {e}")
            return {}
    
    async def split_video_to_chunks(self, video_path: Path, chunk_duration: int = None) -> List[Path]:
        await self.report_progress("Videó darabolása elkezdődött...", 0)
        
        if chunk_duration is None:
            chunk_duration = CHUNK_DURATION_SECONDS
        
        chunks_dir = TEMP_DIR / "chunks"
        if chunks_dir.exists():
            shutil.rmtree(chunks_dir)
        chunks_dir.mkdir(exist_ok=True)
        
        duration = await self.get_video_duration(video_path)
        if duration <= 0:
            raise ValueError(f"Nem sikerült meghatározni a videó hosszát: {video_path}")
        
        num_chunks = int(duration / chunk_duration) + (1 if duration % chunk_duration > 0 else 0)
        
        chunks = []
        for i in range(num_chunks):
            start_time = i * chunk_duration
            chunk_path = chunks_dir / f"chunk_{i:04d}.mp4"
            
            cmd = [
                "ffmpeg", "-y",
                "-ss", str(start_time),
                "-i", str(video_path),
                "-t", str(chunk_duration),
                "-c:v", "libx264",
                "-preset", "fast",
                "-crf", "23",
                "-c:a", "aac",
                "-b:a", "128k",
                "-movflags", "+faststart",
                str(chunk_path)
            ]
            
            success = await self.run_ffmpeg(cmd, f"Chunk {i + 1}/{num_chunks}")
            
            if success and chunk_path.exists() and chunk_path.stat().st_size > 0:
                chunks.append(chunk_path)
                progress = ((i + 1) / num_chunks) * 100
                await self.report_progress(f"Chunk {i + 1}/{num_chunks} létrehozva", progress)
            else:
                logger.warning(f"Chunk {i + 1} creation failed")
        
        if not chunks:
            raise RuntimeError("Nem sikerült egyetlen chunkot sem létrehozni")
        
        return chunks
    
    async def merge_video_chunks(self, chunks: List[Path], output_path: Path) -> Path:
        await self.report_progress("Videó részek összeillesztése...", 0)
        
        if not chunks:
            raise ValueError("Nincsenek összeillesztendő chunkok")
        
        list_file = TEMP_DIR / "concat_list.txt"
        with open(list_file, "w", encoding="utf-8") as f:
            for chunk in sorted(chunks):
                escaped_path = str(chunk.absolute()).replace("'", "'\\''")
                f.write(f"file '{escaped_path}'\n")
        
        cmd = [
            "ffmpeg", "-y",
            "-f", "concat",
            "-safe", "0",
            "-i", str(list_file),
            "-c:v", "libx264",
            "-preset", "fast",
            "-crf", "23",
            "-c:a", "aac",
            "-b:a", "192k",
            "-movflags", "+faststart",
            str(output_path)
        ]
        
        success = await self.run_ffmpeg(cmd, "Merging video chunks")
        
        if not success or not output_path.exists():
            raise RuntimeError("Nem sikerült összeilleszteni a videó részleteket")
        
        await self.report_progress("Videó összeillesztés kész!", 100)
        return output_path
    
    async def extract_audio(self, video_path: Path, output_path: Path, format: str = "mp3") -> Path:
        await self.report_progress("Hang kinyerése...", 0)
        
        if format == "mp3":
            codec = ["libmp3lame", "-ab", "192k"]
        elif format == "aac":
            codec = ["aac", "-b:a", "192k"]
        elif format == "wav":
            codec = ["pcm_s16le"]
        else:
            codec = ["copy"]
        
        cmd = [
            "ffmpeg", "-y",
            "-i", str(video_path),
            "-vn",
            "-acodec", codec[0]
        ]
        
        if len(codec) > 1:
            cmd.extend(codec[1:])
        
        cmd.append(str(output_path))
        
        success = await self.run_ffmpeg(cmd, "Extracting audio")
        
        if not success or not output_path.exists():
            raise RuntimeError("Nem sikerült kinyerni a hangot")
        
        await self.report_progress("Hang kinyerés kész!", 100)
        return output_path
    
    async def replace_audio(self, video_path: Path, audio_path: Path, output_path: Path) -> Path:
        await self.report_progress("Hang cseréje a videón...", 0)
        
        cmd = [
            "ffmpeg", "-y",
            "-i", str(video_path),
            "-i", str(audio_path),
            "-c:v", "copy",
            "-map", "0:v:0",
            "-map", "1:a:0",
            "-shortest",
            "-movflags", "+faststart",
            str(output_path)
        ]
        
        success = await self.run_ffmpeg(cmd, "Replacing audio")
        
        if not success or not output_path.exists():
            raise RuntimeError("Nem sikerült cserélni a hangot")
        
        await self.report_progress("Hang csere kész!", 100)
        return output_path
    
    async def merge_audio_files(self, audio_files: List[Path], output_path: Path) -> Path:
        await self.report_progress("Hangfájlok összefűzése...", 0)
        
        if not audio_files:
            raise ValueError("Nincsenek összefűzendő hangfájlok")
        
        list_file = TEMP_DIR / "audio_concat_list.txt"
        with open(list_file, "w", encoding="utf-8") as f:
            for audio in sorted(audio_files):
                escaped_path = str(audio.absolute()).replace("'", "'\\''")
                f.write(f"file '{escaped_path}'\n")
        
        cmd = [
            "ffmpeg", "-y",
            "-f", "concat",
            "-safe", "0",
            "-i", str(list_file),
            "-c:a", "libmp3lame",
            "-b:a", "192k",
            str(output_path)
        ]
        
        success = await self.run_ffmpeg(cmd, "Merging audio files")
        
        if not success or not output_path.exists():
            raise RuntimeError("Nem sikerült összefűzni a hangfájlokat")
        
        await self.report_progress("Hangfájlok összefűzése kész!", 100)
        return output_path
    
    async def cleanup_temp(self):
        if TEMP_DIR.exists():
            shutil.rmtree(TEMP_DIR)
            TEMP_DIR.mkdir(exist_ok=True)
    
    async def cleanup_all(self):
        for dir_path in [TEMP_DIR, OUTPUT_DIR]:
            if dir_path.exists():
                shutil.rmtree(dir_path)
                dir_path.mkdir(exist_ok=True)
