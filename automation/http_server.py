import asyncio
import json
import os
from pathlib import Path
from aiohttp import web
from config import HTTP_PORT, INPUT_DIR, OUTPUT_DIR, DUBBED_DIR

routes = web.RouteTableDef()

@routes.get("/status")
async def get_status(request):
    from websocket_server import current_status
    return web.json_response(current_status)

@routes.post("/upload")
async def upload_video(request):
    reader = await request.multipart()
    field = await reader.next()
    
    if field.name != "video":
        return web.json_response({"error": "No video field"}, status=400)
    
    filename = field.filename
    filepath = INPUT_DIR / filename
    
    size = 0
    with open(filepath, "wb") as f:
        while True:
            chunk = await field.read_chunk()
            if not chunk:
                break
            size += len(chunk)
            f.write(chunk)
    
    return web.json_response({
        "success": True,
        "filename": filename,
        "path": str(filepath),
        "size": size
    })

@routes.post("/start")
async def start_workflow(request):
    data = await request.json()
    video_path = data.get("video_path")
    
    if not video_path:
        return web.json_response({"error": "No video path provided"}, status=400)
    
    path = Path(video_path)
    if not path.exists():
        return web.json_response({"error": "Video file not found"}, status=404)
    
    from websocket_server import run_workflow
    asyncio.create_task(run_workflow(path))
    
    return web.json_response({"success": True, "message": "Workflow started"})

@routes.get("/files")
async def list_files(request):
    files = {
        "input": [str(f) for f in INPUT_DIR.iterdir() if f.is_file()],
        "output": [str(f) for f in OUTPUT_DIR.iterdir() if f.is_file()],
        "dubbed": [str(f) for f in DUBBED_DIR.iterdir() if f.is_file()]
    }
    return web.json_response(files)

@routes.get("/download/{filename}")
async def download_file(request):
    filename = request.match_info["filename"]
    
    for directory in [OUTPUT_DIR, DUBBED_DIR]:
        filepath = directory / filename
        if filepath.exists():
            return web.FileResponse(filepath)
    
    return web.json_response({"error": "File not found"}, status=404)

@routes.options("/{path:.*}")
async def cors_preflight(request):
    return web.Response(headers={
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
    })

@web.middleware
async def cors_middleware(request, handler):
    response = await handler(request)
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    return response

async def start_http_server():
    app = web.Application(middlewares=[cors_middleware])
    app.add_routes(routes)
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, "localhost", HTTP_PORT)
    await site.start()
    print(f"HTTP szerver fut: http://localhost:{HTTP_PORT}")
    return runner

if __name__ == "__main__":
    asyncio.run(start_http_server())
