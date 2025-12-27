import asyncio
import os
from pathlib import Path
from typing import List, Callable
from browser_use import Agent
from cerebras_llm import CerebrasLLM
from config import SUBFORMER_URL, SUBFORMER_EMAIL, SUBFORMER_PASSWORD, TARGET_LANGUAGE, DUBBED_DIR

class SubformerAgent:
    def __init__(self, progress_callback: Callable = None):
        self.llm = CerebrasLLM(model="qwen-3-32b")
        self.progress_callback = progress_callback
        self.is_logged_in = False
    
    async def report_progress(self, message: str, progress: float = 0):
        if self.progress_callback:
            await self.progress_callback(message, progress)
    
    async def login(self) -> bool:
        await self.report_progress("Bejelentkezés a Subformer-be...", 0)
        
        login_task = f"""
        1. Navigálj ide: {SUBFORMER_URL}
        2. Keresd meg a bejelentkezés gombot és kattints rá
        3. Írd be az email címet: {SUBFORMER_EMAIL}
        4. Írd be a jelszót: {SUBFORMER_PASSWORD}
        5. Kattints a bejelentkezés gombra
        6. Várj amíg betöltődik a főoldal
        """
        
        agent = Agent(
            task=login_task,
            llm=self.llm,
        )
        
        result = await agent.run()
        self.is_logged_in = True
        await self.report_progress("Bejelentkezés sikeres!", 100)
        return True
    
    async def dub_single_chunk(self, chunk_path: Path, chunk_index: int, total_chunks: int) -> Path:
        await self.report_progress(f"Chunk {chunk_index + 1}/{total_chunks} dubbingolása...", 0)
        
        output_filename = f"dubbed_chunk_{chunk_index:04d}.mp4"
        output_path = DUBBED_DIR / output_filename
        
        dub_task = f"""
        A feladatod a következő videó fájl magyar nyelvű szinkronizálása a Subformer weboldalon:
        
        1. Navigálj a Subformer főoldalára: {SUBFORMER_URL}
        2. Keresd meg a videó feltöltési területet
        3. Töltsd fel ezt a videó fájlt: {chunk_path.absolute()}
        4. Válaszd ki a cél nyelvet: {TARGET_LANGUAGE} (Magyar)
        5. Indítsd el a dubbingolási folyamatot
        6. Várd meg amíg elkészül a szinkronizált videó
        7. Töltsd le a kész videót
        8. Mentsd el ide: {output_path.absolute()}
        
        Fontos:
        - Győződj meg róla hogy a magyar nyelv van kiválasztva
        - Várj türelmesen amíg a feldolgozás befejeződik
        - A letöltött fájlt pontosan a megadott helyre mentsd
        """
        
        agent = Agent(
            task=dub_task,
            llm=self.llm,
        )
        
        result = await agent.run()
        
        progress = ((chunk_index + 1) / total_chunks) * 100
        await self.report_progress(f"Chunk {chunk_index + 1}/{total_chunks} dubbingolva!", progress)
        
        return output_path
    
    async def dub_all_chunks(self, chunks: List[Path]) -> List[Path]:
        await self.report_progress("Dubbingolási folyamat indítása...", 0)
        
        if not self.is_logged_in:
            await self.login()
        
        dubbed_chunks = []
        total = len(chunks)
        
        for i, chunk in enumerate(sorted(chunks)):
            dubbed_path = await self.dub_single_chunk(chunk, i, total)
            if dubbed_path.exists():
                dubbed_chunks.append(dubbed_path)
            else:
                await self.report_progress(f"HIBA: Chunk {i + 1} dubbingolása sikertelen!", 0)
        
        await self.report_progress("Összes chunk dubbingolva!", 100)
        return dubbed_chunks
    
    async def process_video_with_dubbing(
        self,
        video_chunks: List[Path],
        video_processor,
        original_video_path: Path
    ) -> dict:
        await self.report_progress("Teljes dubbingolási workflow indítása...", 0)
        
        dubbed_chunks = await self.dub_all_chunks(video_chunks)
        
        if not dubbed_chunks:
            return {"success": False, "error": "Nem sikerült dubbingolni egyetlen chunkot sem"}
        
        merged_dubbed_video = DUBBED_DIR / "merged_dubbed.mp4"
        await video_processor.merge_video_chunks(dubbed_chunks, merged_dubbed_video)
        
        dubbed_audio = DUBBED_DIR / "dubbed_audio.mp3"
        await video_processor.extract_audio(merged_dubbed_video, dubbed_audio)
        
        final_video = DUBBED_DIR / "final_video_hungarian.mp4"
        await video_processor.replace_audio(original_video_path, dubbed_audio, final_video)
        
        await self.report_progress("Workflow befejezve!", 100)
        
        return {
            "success": True,
            "dubbed_chunks": [str(p) for p in dubbed_chunks],
            "merged_dubbed_video": str(merged_dubbed_video),
            "dubbed_audio": str(dubbed_audio),
            "final_video": str(final_video)
        }
