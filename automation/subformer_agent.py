import asyncio
import logging
from pathlib import Path
from typing import List, Callable, Optional
from browser_use import Agent
from cerebras_llm import CerebrasLLM
from config import (
    SUBFORMER_URL, 
    SUBFORMER_EMAIL, 
    SUBFORMER_PASSWORD, 
    TARGET_LANGUAGE, 
    DUBBED_DIR,
    MAX_RETRIES,
    RETRY_DELAY,
    BROWSER_HEADLESS,
    BROWSER_TIMEOUT
)

logger = logging.getLogger(__name__)

class SubformerAgent:
    def __init__(self, progress_callback: Optional[Callable] = None):
        self.llm = CerebrasLLM(model="qwen-3-32b")
        self.progress_callback = progress_callback
        self.is_logged_in = False
        self.browser_context = None
    
    async def report_progress(self, message: str, progress: float = 0, phase: str = None, current_chunk: int = None, total_chunks: int = None):
        if self.progress_callback:
            try:
                result = self.progress_callback(message, progress)
                if asyncio.iscoroutine(result):
                    await result
            except Exception as e:
                logger.error(f"Progress callback error: {e}")
    
    async def login(self) -> bool:
        await self.report_progress("Bejelentkezés a Subformer-be...", 0)
        
        if not SUBFORMER_EMAIL or not SUBFORMER_PASSWORD:
            raise ValueError(
                "SUBFORMER_EMAIL és SUBFORMER_PASSWORD szükséges! "
                "Állítsd be a .env fájlban."
            )
        
        login_task = f"""
        Feladatod a bejelentkezés a Subformer weboldalra:
        
        1. Navigálj ide: {SUBFORMER_URL}
        2. Keresd meg és kattints a bejelentkezés/login gombra
        3. Add meg az email címet a megfelelő mezőbe: {SUBFORMER_EMAIL}
        4. Add meg a jelszót a megfelelő mezőbe: {SUBFORMER_PASSWORD}
        5. Kattints a bejelentkezés/submit gombra
        6. Várj amíg a bejelentkezés sikeres és megjelenik a főoldal
        
        Ha bármilyen pop-up vagy cookie banner jelenik meg, zárd be őket.
        Ha már be vagy jelentkezve, folytasd a főoldalra navigálással.
        """
        
        for attempt in range(MAX_RETRIES):
            try:
                agent = Agent(
                    task=login_task,
                    llm=self.llm,
                )
                
                await agent.run()
                self.is_logged_in = True
                await self.report_progress("Bejelentkezés sikeres!", 100)
                return True
            except Exception as e:
                logger.warning(f"Login attempt {attempt + 1} failed: {e}")
                if attempt < MAX_RETRIES - 1:
                    await asyncio.sleep(RETRY_DELAY)
        
        raise RuntimeError("Nem sikerült bejelentkezni a Subformer-be")
    
    async def dub_single_chunk(self, chunk_path: Path, chunk_index: int, total_chunks: int) -> Optional[Path]:
        progress_base = (chunk_index / total_chunks) * 100
        await self.report_progress(
            f"Chunk {chunk_index + 1}/{total_chunks} dubbingolása...", 
            progress_base,
            "dubbing",
            chunk_index + 1,
            total_chunks
        )
        
        output_filename = f"dubbed_chunk_{chunk_index:04d}.mp4"
        output_path = DUBBED_DIR / output_filename
        
        dub_task = f"""
        Feladatod a videó magyar nyelvű szinkronizálása a Subformer weboldalon:
        
        LÉPÉSEK:
        1. Ha nem vagy a Subformer főoldalán ({SUBFORMER_URL}), navigálj oda
        2. Keresd meg a videó feltöltési területet (drag & drop vagy file input)
        3. Töltsd fel ezt a videó fájlt: {chunk_path.absolute()}
        4. Válaszd ki a forrás nyelvet ha szükséges (automatic/angol)
        5. Válaszd ki a cél nyelvet: {TARGET_LANGUAGE} / Magyar / Hungarian
        6. Kattints a dubbingolás/szinkronizálás indítása gombra
        7. Várd meg türelmesen amíg a feldolgozás befejeződik (ez néhány percig tarthat)
        8. Amikor elkészült, keresd meg és kattints a letöltés gombra
        9. Mentsd el a letöltött fájlt ide: {output_path.absolute()}
        
        FONTOS:
        - A magyar nyelvet válaszd célnyelvként
        - Várj türelmesen amíg a feldolgozás befejeződik
        - Ha hiba történik, próbáld újra
        - A letöltött fájlt pontosan a megadott helyre mentsd
        """
        
        for attempt in range(MAX_RETRIES):
            try:
                agent = Agent(
                    task=dub_task,
                    llm=self.llm,
                )
                
                await agent.run()
                
                if output_path.exists() and output_path.stat().st_size > 0:
                    progress = ((chunk_index + 1) / total_chunks) * 100
                    await self.report_progress(
                        f"Chunk {chunk_index + 1}/{total_chunks} dubbingolva!", 
                        progress,
                        "dubbing",
                        chunk_index + 1,
                        total_chunks
                    )
                    return output_path
                else:
                    logger.warning(f"Dubbed file not found or empty: {output_path}")
            except Exception as e:
                logger.error(f"Dubbing attempt {attempt + 1} failed for chunk {chunk_index}: {e}")
            
            if attempt < MAX_RETRIES - 1:
                await asyncio.sleep(RETRY_DELAY)
        
        await self.report_progress(
            f"HIBA: Chunk {chunk_index + 1} dubbingolása sikertelen!", 
            progress_base,
            "error",
            chunk_index + 1,
            total_chunks
        )
        return None
    
    async def dub_all_chunks(self, chunks: List[Path]) -> List[Path]:
        await self.report_progress("Dubbingolási folyamat indítása...", 0, "dubbing", 0, len(chunks))
        
        if not self.is_logged_in:
            await self.login()
        
        dubbed_chunks = []
        total = len(chunks)
        sorted_chunks = sorted(chunks)
        
        for i, chunk in enumerate(sorted_chunks):
            dubbed_path = await self.dub_single_chunk(chunk, i, total)
            if dubbed_path:
                dubbed_chunks.append(dubbed_path)
            else:
                logger.warning(f"Chunk {i + 1} dubbing failed, continuing...")
        
        if dubbed_chunks:
            await self.report_progress(
                f"Dubbingolás kész: {len(dubbed_chunks)}/{total} chunk sikeresen feldolgozva", 
                100, 
                "dubbing",
                total,
                total
            )
        else:
            await self.report_progress("HIBA: Egyetlen chunk dubbingolása sem sikerült!", 0, "error")
        
        return dubbed_chunks
    
    async def process_video_with_dubbing(
        self,
        video_chunks: List[Path],
        video_processor,
        original_video_path: Path
    ) -> dict:
        await self.report_progress("Teljes dubbingolási workflow indítása...", 0, "initializing")
        
        try:
            dubbed_chunks = await self.dub_all_chunks(video_chunks)
            
            if not dubbed_chunks:
                return {
                    "success": False, 
                    "error": "Nem sikerült dubbingolni egyetlen chunkot sem"
                }
            
            await self.report_progress("Dubbingolt videók összeillesztése...", 0, "merging")
            merged_dubbed_video = DUBBED_DIR / "merged_dubbed.mp4"
            await video_processor.merge_video_chunks(dubbed_chunks, merged_dubbed_video)
            
            await self.report_progress("Magyar hang kinyerése...", 0, "extracting")
            dubbed_audio = DUBBED_DIR / "dubbed_audio.mp3"
            await video_processor.extract_audio(merged_dubbed_video, dubbed_audio)
            
            await self.report_progress("Hang cseréje az eredeti videón...", 0, "replacing")
            final_video = DUBBED_DIR / "final_video_hungarian.mp4"
            await video_processor.replace_audio(original_video_path, dubbed_audio, final_video)
            
            await self.report_progress("Workflow sikeresen befejezve!", 100, "completed")
            
            return {
                "success": True,
                "dubbed_chunks": [str(p) for p in dubbed_chunks],
                "merged_dubbed_video": str(merged_dubbed_video),
                "dubbed_audio": str(dubbed_audio),
                "final_video": str(final_video)
            }
        except Exception as e:
            logger.error(f"Workflow error: {e}")
            await self.report_progress(f"HIBA: {str(e)}", 0, "error")
            return {
                "success": False,
                "error": str(e)
            }
