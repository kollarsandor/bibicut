import asyncio
import sys
import signal
import json
from pathlib import Path
from typing import Optional
from config import (
    CEREBRAS_API_KEY, 
    SUBFORMER_EMAIL, 
    INPUT_DIR, 
    OUTPUT_DIR, 
    DUBBED_DIR,
    TEMP_DIR,
    WEBSOCKET_PORT,
    HTTP_PORT
)
from video_processor import VideoProcessor
from subformer_agent import SubformerAgent
from websocket_server import (
    start_websocket_server, 
    progress_callback, 
    update_status,
    broadcast_result,
    current_status
)
from http_server import start_http_server

shutdown_event = asyncio.Event()

def signal_handler(signum, frame):
    print("\nLeállítás...")
    shutdown_event.set()

async def run_standalone(video_path: Path):
    print(f"Videó feldolgozása: {video_path}")
    
    async def console_progress(message: str, progress: float):
        bar_length = 40
        filled = int(bar_length * progress / 100)
        bar = "█" * filled + "░" * (bar_length - filled)
        print(f"\r[{bar}] {progress:.1f}% - {message}", end="", flush=True)
    
    processor = VideoProcessor(console_progress)
    agent = SubformerAgent(console_progress)
    
    print("\n1. Videó darabolása...")
    chunks = await processor.split_video_to_chunks(video_path)
    print(f"\n   {len(chunks)} chunk létrehozva")
    
    print("\n2. Dubbingolás indítása...")
    result = await agent.process_video_with_dubbing(chunks, processor, video_path)
    
    if result["success"]:
        print("\n\n=== SIKERES FELDOLGOZÁS ===")
        print(f"Végső videó: {result['final_video']}")
        print(f"Magyar hang: {result['dubbed_audio']}")
        print(f"Összefűzött dubbed videó: {result['merged_dubbed_video']}")
    else:
        print(f"\n\nHIBA: {result.get('error')}")
    
    return result

async def run_servers():
    print("╔══════════════════════════════════════════════════════════════╗")
    print("║           SUBFORMER DUBBING BOT - SZERVER MÓD                ║")
    print("╚══════════════════════════════════════════════════════════════╝")
    print()
    
    if not CEREBRAS_API_KEY:
        print("⚠️  FIGYELMEZTETÉS: CEREBRAS_API_KEY nincs beállítva!")
        print("   Állítsd be a .env fájlban vagy környezeti változóként.")
        print()
    else:
        print("✓ CEREBRAS_API_KEY beállítva")
    
    if not SUBFORMER_EMAIL:
        print("⚠️  FIGYELMEZTETÉS: SUBFORMER_EMAIL nincs beállítva!")
        print()
    else:
        print(f"✓ SUBFORMER_EMAIL: {SUBFORMER_EMAIL}")
    
    print()
    print(f"📁 Input mappa: {INPUT_DIR.absolute()}")
    print(f"📁 Output mappa: {OUTPUT_DIR.absolute()}")
    print(f"📁 Dubbed mappa: {DUBBED_DIR.absolute()}")
    print()
    
    http_runner = await start_http_server()
    
    websocket_task = asyncio.create_task(start_websocket_server())
    
    print()
    print("═══════════════════════════════════════════════════════════════")
    print(f"🌐 HTTP API:     http://localhost:{HTTP_PORT}")
    print(f"🔌 WebSocket:    ws://localhost:{WEBSOCKET_PORT}")
    print("═══════════════════════════════════════════════════════════════")
    print()
    print("A szerver fut. Nyisd meg a webalkalmazást és kattints a")
    print("'Kapcsolódás a Bothoz' gombra a folytatáshoz.")
    print()
    print("Leállításhoz nyomj Ctrl+C-t.")
    print()
    
    try:
        await shutdown_event.wait()
    except asyncio.CancelledError:
        pass
    finally:
        await http_runner.cleanup()
        websocket_task.cancel()
        try:
            await websocket_task
        except asyncio.CancelledError:
            pass
        print("\nSzerver leállítva.")

async def run_batch(video_paths: list):
    print(f"Batch feldolgozás: {len(video_paths)} videó")
    
    results = []
    for i, video_path in enumerate(video_paths):
        print(f"\n[{i+1}/{len(video_paths)}] {video_path}")
        result = await run_standalone(Path(video_path))
        results.append(result)
    
    print("\n\n=== BATCH ÖSSZESÍTŐ ===")
    success_count = sum(1 for r in results if r.get("success"))
    print(f"Sikeres: {success_count}/{len(results)}")
    
    return results

def print_help():
    print("""
Subformer Dubbing Bot - Automatikus magyar szinkronizálás

Használat:
  python main.py                     Szerver mód indítása (web UI-hoz)
  python main.py --server            Szerver mód indítása (web UI-hoz)
  python main.py <video_path>        Egyetlen videó feldolgozása
  python main.py --batch <f1> <f2>   Több videó feldolgozása
  python main.py --help              Súgó megjelenítése
  python main.py --status            Aktuális státusz lekérdezése

Példák:
  python main.py video.mp4
  python main.py --server
  python main.py --batch video1.mp4 video2.mp4 video3.mp4

Konfiguráció (.env fájl):
  CEREBRAS_API_KEY=your_api_key
  SUBFORMER_EMAIL=your_email
  SUBFORMER_PASSWORD=your_password

Mappák:
  input/   - Ide másold a feldolgozandó videókat
  output/  - Itt lesznek a végső videók
  dubbed/  - Itt lesznek a dubbingolt részletek
  temp/    - Átmeneti fájlok

További információ: https://github.com/browser-use/browser-use
""")

def check_dependencies():
    import shutil
    
    errors = []
    
    if not shutil.which("ffmpeg"):
        errors.append("FFmpeg nem található. Telepítsd: https://ffmpeg.org/download.html")
    
    if not shutil.which("ffprobe"):
        errors.append("FFprobe nem található. Telepítsd az FFmpeg-gel együtt.")
    
    try:
        import playwright
    except ImportError:
        errors.append("Playwright nincs telepítve. Futtasd: pip install playwright && playwright install")
    
    try:
        import browser_use
    except ImportError:
        errors.append("browser-use nincs telepítve. Futtasd: pip install browser-use")
    
    try:
        import websockets
    except ImportError:
        errors.append("websockets nincs telepítve. Futtasd: pip install websockets")
    
    try:
        import aiohttp
    except ImportError:
        errors.append("aiohttp nincs telepítve. Futtasd: pip install aiohttp")
    
    if errors:
        print("\n⚠️  Hiányzó függőségek:\n")
        for error in errors:
            print(f"  • {error}")
        print("\nFuttasd: pip install -r requirements.txt")
        print("Majd: playwright install")
        return False
    
    return True

def main():
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    if len(sys.argv) > 1:
        arg = sys.argv[1]
        
        if arg == "--help" or arg == "-h":
            print_help()
            return
        
        if arg == "--check":
            if check_dependencies():
                print("✓ Minden függőség telepítve van.")
            return
        
        if arg == "--status":
            print(json.dumps(current_status, indent=2, ensure_ascii=False))
            return
        
        if arg == "--server":
            if not check_dependencies():
                sys.exit(1)
            asyncio.run(run_servers())
            return
        
        if arg == "--batch":
            if len(sys.argv) < 3:
                print("Hiba: Add meg a videó fájlokat!")
                print("Példa: python main.py --batch video1.mp4 video2.mp4")
                sys.exit(1)
            
            video_paths = sys.argv[2:]
            for path in video_paths:
                if not Path(path).exists():
                    print(f"Hiba: A fájl nem található: {path}")
                    sys.exit(1)
            
            if not check_dependencies():
                sys.exit(1)
            
            asyncio.run(run_batch(video_paths))
            return
        
        video_path = Path(arg)
        if video_path.exists():
            if not check_dependencies():
                sys.exit(1)
            asyncio.run(run_standalone(video_path))
        else:
            print(f"Hiba: A fájl nem található: {video_path}")
            print("Használat: python main.py --help")
            sys.exit(1)
    else:
        if not check_dependencies():
            sys.exit(1)
        asyncio.run(run_servers())

if __name__ == "__main__":
    main()
