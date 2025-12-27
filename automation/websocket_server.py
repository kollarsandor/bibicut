import asyncio
import json
import websockets
from pathlib import Path
from typing import Set
from config import WEBSOCKET_PORT, INPUT_DIR, OUTPUT_DIR

connected_clients: Set[websockets.WebSocketServerProtocol] = set()
current_status = {
    "status": "idle",
    "message": "",
    "progress": 0,
    "current_chunk": 0,
    "total_chunks": 0,
    "phase": "waiting"
}

async def broadcast_status():
    if connected_clients:
        message = json.dumps({"type": "status", "data": current_status})
        await asyncio.gather(
            *[client.send(message) for client in connected_clients],
            return_exceptions=True
        )

async def update_status(status: str, message: str, progress: float = 0, phase: str = None, current_chunk: int = None, total_chunks: int = None):
    global current_status
    current_status["status"] = status
    current_status["message"] = message
    current_status["progress"] = progress
    if phase:
        current_status["phase"] = phase
    if current_chunk is not None:
        current_status["current_chunk"] = current_chunk
    if total_chunks is not None:
        current_status["total_chunks"] = total_chunks
    await broadcast_status()

async def progress_callback(message: str, progress: float):
    await update_status("processing", message, progress)

async def handle_client(websocket: websockets.WebSocketServerProtocol, path: str):
    connected_clients.add(websocket)
    try:
        await websocket.send(json.dumps({"type": "status", "data": current_status}))
        
        async for message in websocket:
            data = json.loads(message)
            await handle_message(data, websocket)
    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        connected_clients.discard(websocket)

async def handle_message(data: dict, websocket: websockets.WebSocketServerProtocol):
    action = data.get("action")
    
    if action == "start_workflow":
        video_path = data.get("video_path")
        if video_path:
            asyncio.create_task(run_workflow(Path(video_path)))
    
    elif action == "get_status":
        await websocket.send(json.dumps({"type": "status", "data": current_status}))
    
    elif action == "cancel":
        await update_status("cancelled", "Workflow megszakítva", 0, "cancelled")

async def run_workflow(video_path: Path):
    from video_processor import VideoProcessor
    from subformer_agent import SubformerAgent
    
    try:
        await update_status("processing", "Workflow indítása...", 0, "initializing")
        
        processor = VideoProcessor(progress_callback)
        agent = SubformerAgent(progress_callback)
        
        await update_status("processing", "Videó darabolása...", 0, "splitting")
        chunks = await processor.split_video_to_chunks(video_path)
        
        await update_status("processing", "Dubbingolás...", 0, "dubbing", 0, len(chunks))
        result = await agent.process_video_with_dubbing(chunks, processor, video_path)
        
        if result["success"]:
            await update_status("completed", "Workflow sikeresen befejezve!", 100, "completed")
            await broadcast_result(result)
        else:
            await update_status("error", result.get("error", "Ismeretlen hiba"), 0, "error")
    
    except Exception as e:
        await update_status("error", str(e), 0, "error")

async def broadcast_result(result: dict):
    if connected_clients:
        message = json.dumps({"type": "result", "data": result})
        await asyncio.gather(
            *[client.send(message) for client in connected_clients],
            return_exceptions=True
        )

async def start_websocket_server():
    server = await websockets.serve(handle_client, "localhost", WEBSOCKET_PORT)
    print(f"WebSocket szerver fut: ws://localhost:{WEBSOCKET_PORT}")
    await server.wait_closed()

if __name__ == "__main__":
    asyncio.run(start_websocket_server())
