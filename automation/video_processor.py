import asyncio
import subprocess
import shutil
from pathlib import Path
from typing import List, Callable
from config import TEMP_DIR, OUTPUT_DIR, CHUNK_DURATION_SECONDS

class VideoProcessor:
    def __init__(self, progress_callback: Callable = None):
        self.progress_callback = progress_callback
    
    async def report_progress(self, message: str, progress: float = 0):
        if self.progress_callback:
            await self.progress_callback(message, progress)
    
    async def split_video_to_chunks(self, video_path: Path) -> List[Path]:
        await self.report_progress("Videó darabolása elkezdődött...", 0)
        
        chunks_dir = TEMP_DIR / "chunks"
        chunks_dir.mkdir(exist_ok=True)
        
        duration = await self.get_video_duration(video_path)
        num_chunks = int(duration / CHUNK_DURATION_SECONDS) + (1 if duration % CHUNK_DURATION_SECONDS > 0 else 0)
        
        chunks = []
        for i in range(num_chunks):
            start_time = i * CHUNK_DURATION_SECONDS
            chunk_path = chunks_dir / f"chunk_{i:04d}.mp4"
            
            cmd = [
                "ffmpeg", "-y",
                "-i", str(video_path),
                "-ss", str(start_time),
                "-t", str(CHUNK_DURATION_SECONDS),
                "-c:v", "libx264",
                "-c:a", "aac",
                "-strict", "experimental",
                str(chunk_path)
            ]
            
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            await process.communicate()
            
            if chunk_path.exists():
                chunks.append(chunk_path)
                progress = ((i + 1) / num_chunks) * 100
                await self.report_progress(f"Chunk {i + 1}/{num_chunks} létrehozva", progress)
        
        return chunks
    
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
        stdout, _ = await process.communicate()
        return float(stdout.decode().strip())
    
    async def merge_video_chunks(self, chunks: List[Path], output_path: Path) -> Path:
        await self.report_progress("Videó részek összeillesztése...", 0)
        
        list_file = TEMP_DIR / "concat_list.txt"
        with open(list_file, "w") as f:
            for chunk in sorted(chunks):
                f.write(f"file '{chunk.absolute()}'\n")
        
        cmd = [
            "ffmpeg", "-y",
            "-f", "concat",
            "-safe", "0",
            "-i", str(list_file),
            "-c:v", "libx264",
            "-c:a", "aac",
            str(output_path)
        ]
        
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        await process.communicate()
        
        await self.report_progress("Videó összeillesztés kész!", 100)
        return output_path
    
    async def extract_audio(self, video_path: Path, output_path: Path) -> Path:
        await self.report_progress("Hang kinyerése...", 0)
        
        cmd = [
            "ffmpeg", "-y",
            "-i", str(video_path),
            "-vn",
            "-acodec", "libmp3lame",
            "-ab", "192k",
            str(output_path)
        ]
        
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        await process.communicate()
        
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
            str(output_path)
        ]
        
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        await process.communicate()
        
        await self.report_progress("Hang csere kész!", 100)
        return output_path
    
    async def cleanup_temp(self):
        if TEMP_DIR.exists():
            shutil.rmtree(TEMP_DIR)
            TEMP_DIR.mkdir(exist_ok=True)
