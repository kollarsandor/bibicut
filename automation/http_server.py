import asyncio
import json
import os
import logging
import mimetypes
from pathlib import Path
from aiohttp import web
from config import HTTP_PORT, INPUT_DIR, OUTPUT_DIR, DUBBED_DIR, TEMP_DIR

logger = logging.getLogger(__name__)

routes = web.RouteTableDef()

@routes.get("/")
async def index(request):
    return web.json_response({
        "name": "Subformer Dubbing Bot API",
        "version": "1.0.0",
        "endpoints": {
            "GET /status": "Get current workflow status",
            "POST /upload": "Upload video file",
            "POST /start": "Start dubbing workflow",
            "GET /files": "List all files",
            "GET /download/{filename}": "Download output file",
            "DELETE /cleanup": "Clean temporary files"
        }
    })

@routes.get("/health")
async def health(request):
    return web.json_response({"status": "ok"})

@routes.get("/status")
async def get_status(request):
    from websocket_server import current_status
    return web.json_response(current_status)

@routes.post("/upload")
async def upload_video(request):
    try:
        reader = await request.multipart()
        field = await reader.next()
        
        if not field or field.name != "video":
            return web.json_response(
                {"error": "No video field in request"}, 
                status=400
            )
        
        filename = field.filename
        if not filename:
            return web.json_response(
                {"error": "No filename provided"}, 
                status=400
            )
        
        safe_filename = "".join(c for c in filename if c.isalnum() or c in "._-")
        filepath = INPUT_DIR / safe_filename
        
        size = 0
        with open(filepath, "wb") as f:
            while True:
                chunk = await field.read_chunk()
                if not chunk:
                    break
                size += len(chunk)
                f.write(chunk)
        
        logger.info(f"Uploaded file: {filepath} ({size} bytes)")
        
        return web.json_response({
            "success": True,
            "filename": safe_filename,
            "path": str(filepath.absolute()),
            "size": size
        })
    except Exception as e:
        logger.error(f"Upload error: {e}")
        return web.json_response(
            {"error": str(e)}, 
            status=500
        )

@routes.post("/start")
async def start_workflow(request):
    try:
        data = await request.json()
        video_path = data.get("video_path")
        
        if not video_path:
            return web.json_response(
                {"error": "No video_path provided"}, 
                status=400
            )
        
        path = Path(video_path)
        if not path.exists():
            return web.json_response(
                {"error": f"Video file not found: {video_path}"}, 
                status=404
            )
        
        from websocket_server import run_workflow, current_workflow_task
        
        asyncio.create_task(run_workflow(path))
        
        return web.json_response({
            "success": True, 
            "message": "Workflow started",
            "video_path": video_path
        })
    except json.JSONDecodeError:
        return web.json_response(
            {"error": "Invalid JSON"}, 
            status=400
        )
    except Exception as e:
        logger.error(f"Start workflow error: {e}")
        return web.json_response(
            {"error": str(e)}, 
            status=500
        )

@routes.get("/files")
async def list_files(request):
    def get_file_info(path: Path) -> dict:
        stat = path.stat()
        return {
            "name": path.name,
            "path": str(path.absolute()),
            "size": stat.st_size,
            "modified": stat.st_mtime
        }
    
    files = {
        "input": [],
        "output": [],
        "dubbed": [],
        "temp": []
    }
    
    for name, directory in [
        ("input", INPUT_DIR),
        ("output", OUTPUT_DIR),
        ("dubbed", DUBBED_DIR),
        ("temp", TEMP_DIR)
    ]:
        if directory.exists():
            files[name] = [
                get_file_info(f) 
                for f in directory.iterdir() 
                if f.is_file()
            ]
    
    return web.json_response(files)

@routes.get("/download/{filename}")
async def download_file(request):
    filename = request.match_info["filename"]
    
    safe_filename = "".join(c for c in filename if c.isalnum() or c in "._-")
    
    for directory in [DUBBED_DIR, OUTPUT_DIR, INPUT_DIR]:
        filepath = directory / safe_filename
        if filepath.exists() and filepath.is_file():
            content_type, _ = mimetypes.guess_type(str(filepath))
            if not content_type:
                content_type = "application/octet-stream"
            
            return web.FileResponse(
                filepath,
                headers={
                    "Content-Disposition": f'attachment; filename="{safe_filename}"',
                    "Content-Type": content_type
                }
            )
    
    return web.json_response(
        {"error": f"File not found: {filename}"}, 
        status=404
    )

@routes.delete("/cleanup")
async def cleanup(request):
    try:
        from video_processor import VideoProcessor
        processor = VideoProcessor()
        await processor.cleanup_temp()
        
        return web.json_response({
            "success": True,
            "message": "Temporary files cleaned up"
        })
    except Exception as e:
        logger.error(f"Cleanup error: {e}")
        return web.json_response(
            {"error": str(e)}, 
            status=500
        )

@routes.post("/cancel")
async def cancel_workflow(request):
    try:
        from websocket_server import current_workflow_task, update_status
        
        if current_workflow_task and not current_workflow_task.done():
            current_workflow_task.cancel()
            await update_status("cancelled", "Workflow cancelled", 0, "cancelled")
            return web.json_response({
                "success": True,
                "message": "Workflow cancelled"
            })
        else:
            return web.json_response({
                "success": False,
                "message": "No running workflow to cancel"
            })
    except Exception as e:
        logger.error(f"Cancel error: {e}")
        return web.json_response(
            {"error": str(e)}, 
            status=500
        )

@routes.options("/{path:.*}")
async def cors_preflight(request):
    return web.Response(headers={
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization"
    })

@web.middleware
async def cors_middleware(request, handler):
    if request.method == "OPTIONS":
        return web.Response(headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization"
        })
    
    response = await handler(request)
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, DELETE, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    return response

@web.middleware
async def error_middleware(request, handler):
    try:
        return await handler(request)
    except web.HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unhandled error: {e}")
        return web.json_response(
            {"error": "Internal server error"}, 
            status=500
        )

async def start_http_server():
    app = web.Application(middlewares=[error_middleware, cors_middleware])
    app.add_routes(routes)
    
    runner = web.AppRunner(app)
    await runner.setup()
    
    site = web.TCPSite(runner, "0.0.0.0", HTTP_PORT)
    await site.start()
    
    logger.info(f"HTTP server running on http://0.0.0.0:{HTTP_PORT}")
    
    return runner

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(start_http_server())
