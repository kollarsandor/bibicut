import asyncio
import sys
from pathlib import Path
from config import CEREBRAS_API_KEY, SUBFORMER_EMAIL, INPUT_DIR
from video_processor import VideoProcessor
from subformer_agent import SubformerAgent
from websocket_server import start_websocket_server, progress_callback
from http_server import start_http_server

async def run_standalone(video_path: Path):
    print(f"Videó feldolgozása: {video_path}")
    
    processor = VideoProcessor(progress_callback)
    agent = SubformerAgent(progress_callback)
    
    print("1. Videó darabolása...")
    chunks = await processor.split_video_to_chunks(video_path)
    print(f"   {len(chunks)} chunk létrehozva")
    
    print("2. Dubbingolás indítása...")
    result = await agent.process_video_with_dubbing(chunks, processor, video_path)
    
    if result["success"]:
        print("\n=== SIKERES FELDOLGOZÁS ===")
        print(f"Végső videó: {result['final_video']}")
        print(f"Magyar hang: {result['dubbed_audio']}")
        print(f"Összefűzött dubbed videó: {result['merged_dubbed_video']}")
    else:
        print(f"\nHIBA: {result.get('error')}")
    
    return result

async def run_servers():
    print("Szerverek indítása...")
    print(f"CEREBRAS_API_KEY: {'beállítva' if CEREBRAS_API_KEY else 'HIÁNYZIK!'}")
    print(f"SUBFORMER_EMAIL: {'beállítva' if SUBFORMER_EMAIL else 'HIÁNYZIK!'}")
    
    http_runner = await start_http_server()
    await start_websocket_server()

def main():
    if len(sys.argv) > 1:
        if sys.argv[1] == "--server":
            print("Szerver mód indítása...")
            asyncio.run(run_servers())
        else:
            video_path = Path(sys.argv[1])
            if video_path.exists():
                asyncio.run(run_standalone(video_path))
            else:
                print(f"Hiba: A fájl nem található: {video_path}")
                sys.exit(1)
    else:
        print("Használat:")
        print("  python main.py <video_path>  - Egyetlen videó feldolgozása")
        print("  python main.py --server      - Szerver mód indítása (web UI-hoz)")
        print("")
        print("Szerver mód indítása...")
        asyncio.run(run_servers())

if __name__ == "__main__":
    main()
