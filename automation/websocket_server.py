import asyncio
import json
import logging
from typing import Set, Optional
import websockets
from websockets.server import WebSocketServerProtocol
from pathlib import Path
from config import WEBSOCKET_PORT, INPUT_DIR, OUTPUT_DIR, DUBBED_DIR

logger = logging.getLogger(__name__)

connected_clients: Set[WebSocketServerProtocol] = set()

current_status = {
    "status": "idle",
    "message": "",
    "progress": 0,
    "current_chunk": 0,
    "total_chunks": 0,
    "phase": "waiting"
}

current_workflow_task: Optional[asyncio.Task] = None

async def broadcast_message(message: dict):
    if connected_clients:
        message_str = json.dumps(message, ensure_ascii=False)
        await asyncio.gather(
            *[client.send(message_str) for client in connected_clients],
            return_exceptions=True
        )

async def broadcast_status():
    await broadcast_message({"type": "status", "data": current_status})

async def update_status(
    status: str, 
    message: str, 
    progress: float = 0, 
    phase: str = None, 
    current_chunk: int = None, 
    total_chunks: int = None
):
    global current_status
    current_status["status"] = status
    current_status["message"] = message
    current_status["progress"] = progress
    if phase is not None:
        current_status["phase"] = phase
    if current_chunk is not None:
        current_status["current_chunk"] = current_chunk
    if total_chunks is not None:
        current_status["total_chunks"] = total_chunks
    await broadcast_status()

async def progress_callback(message: str, progress: float):
    await update_status("processing", message, progress)

async def broadcast_result(result: dict):
    await broadcast_message({"type": "result", "data": result})

async def handle_client(websocket: WebSocketServerProtocol, path: str = ""):
    client_id = id(websocket)
    logger.info(f"Client connected: {client_id}")
    connected_clients.add(websocket)
    
    try:
        await websocket.send(json.dumps({
            "type": "status", 
            "data": current_status
        }, ensure_ascii=False))
        
        async for message in websocket:
            try:
                data = json.loads(message)
                await handle_message(data, websocket)
            except json.JSONDecodeError as e:
                logger.error(f"Invalid JSON from client {client_id}: {e}")
                await websocket.send(json.dumps({
                    "type": "error",
                    "data": {"message": "Invalid JSON format"}
                }))
    except websockets.exceptions.ConnectionClosed:
        logger.info(f"Client disconnected: {client_id}")
    except Exception as e:
        logger.error(f"Error handling client {client_id}: {e}")
    finally:
        connected_clients.discard(websocket)

async def handle_message(data: dict, websocket: WebSocketServerProtocol):
    action = data.get("action")
    
    if action == "start_workflow":
        video_path = data.get("video_path")
        if video_path:
            global current_workflow_task
            if current_workflow_task and not current_workflow_task.done():
                await websocket.send(json.dumps({
                    "type": "error",
                    "data": {"message": "Már fut egy workflow. Várd meg a befejezését vagy állítsd le."}
                }))
                return
            
            current_workflow_task = asyncio.create_task(run_workflow(Path(video_path)))
            await websocket.send(json.dumps({
                "type": "ack",
                "data": {"message": "Workflow elindítva", "video_path": video_path}
            }))
        else:
            await websocket.send(json.dumps({
                "type": "error",
                "data": {"message": "Nincs megadva video_path"}
            }))
    
    elif action == "get_status":
        await websocket.send(json.dumps({
            "type": "status", 
            "data": current_status
        }, ensure_ascii=False))
    
    elif action == "cancel":
        global current_workflow_task
        if current_workflow_task and not current_workflow_task.done():
            current_workflow_task.cancel()
            await update_status("cancelled", "Workflow megszakítva", 0, "cancelled")
            await websocket.send(json.dumps({
                "type": "ack",
                "data": {"message": "Workflow megszakítva"}
            }))
        else:
            await websocket.send(json.dumps({
                "type": "error",
                "data": {"message": "Nincs futó workflow"}
            }))
    
    elif action == "reset":
        global current_status
        current_status = {
            "status": "idle",
            "message": "",
            "progress": 0,
            "current_chunk": 0,
            "total_chunks": 0,
            "phase": "waiting"
        }
        await broadcast_status()
    
    elif action == "ping":
        await websocket.send(json.dumps({
            "type": "pong",
            "data": {"timestamp": data.get("timestamp", 0)}
        }))
    
    else:
        await websocket.send(json.dumps({
            "type": "error",
            "data": {"message": f"Ismeretlen action: {action}"}
        }))

async def run_workflow(video_path: Path):
    from video_processor import VideoProcessor
    from subformer_agent import SubformerAgent
    
    try:
        if not video_path.exists():
            await update_status("error", f"A videó fájl nem található: {video_path}", 0, "error")
            return
        
        await update_status("processing", "Workflow inicializálása...", 0, "initializing")
        
        processor = VideoProcessor(progress_callback)
        agent = SubformerAgent(progress_callback)
        
        await update_status("processing", "Videó darabolása 1 perces részekre...", 0, "splitting")
        chunks = await processor.split_video_to_chunks(video_path)
        
        await update_status(
            "processing", 
            f"Dubbingolás indítása ({len(chunks)} chunk)...", 
            0, 
            "dubbing", 
            0, 
            len(chunks)
        )
        result = await agent.process_video_with_dubbing(chunks, processor, video_path)
        
        if result["success"]:
            await update_status("completed", "Workflow sikeresen befejezve!", 100, "completed")
            await broadcast_result(result)
        else:
            await update_status("error", result.get("error", "Ismeretlen hiba"), 0, "error")
            await broadcast_result(result)
    
    except asyncio.CancelledError:
        await update_status("cancelled", "Workflow megszakítva", 0, "cancelled")
        raise
    except Exception as e:
        logger.error(f"Workflow error: {e}")
        await update_status("error", str(e), 0, "error")
        await broadcast_result({
            "success": False,
            "error": str(e)
        })

async def start_websocket_server():
    async with websockets.serve(
        handle_client, 
        "0.0.0.0", 
        WEBSOCKET_PORT,
        ping_interval=30,
        ping_timeout=10
    ):
        logger.info(f"WebSocket server running on ws://0.0.0.0:{WEBSOCKET_PORT}")
        await asyncio.Future()

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(start_websocket_server())
