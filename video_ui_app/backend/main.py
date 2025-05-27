import os
import shutil
import uuid
import asyncio # For SSE Queues
import json # For SSE message formatting
import sys # For sys.path modification

# Add the project root directory to sys.path
# This allows importing the 'deoldify' module from the project root
# The backend is in video_ui_app/backend/, so root is two levels up.
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)
# Ensure that the current backend directory is also in path for relative imports if needed
# though explicit relative imports (.colorize_filter) are preferred.
# BACKEND_DIR = os.path.dirname(__file__)
# if BACKEND_DIR not in sys.path:
# sys.path.insert(0, BACKEND_DIR)


from fastapi import FastAPI, File, UploadFile, Form, HTTPException, BackgroundTasks, Request
from fastapi.responses import JSONResponse, StreamingResponse, FileResponse
from pathlib import Path
import logging

# Assuming colorize_filter.py is in the same directory (now backend.colorize_filter)
# The sys.path modification above should make 'deoldify' available to colorize_filter.py
from .colorize_filter import (
    colorize_video,
    DEFAULT_RENDER_FACTOR,
    DEFAULT_SATURATION_SCALE,
    DEFAULT_CLAHE_CLIP_LIMIT,
    DEFAULT_BLEND_FACTOR
)

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# Define base directory for the application
BASE_DIR = Path(__file__).resolve().parent
UPLOADS_DIR = BASE_DIR / "uploads"
PROCESSED_VIDEOS_DIR = BASE_DIR / "processed_videos"

# Create directories if they don't exist
os.makedirs(UPLOADS_DIR, exist_ok=True)
os.makedirs(PROCESSED_VIDEOS_DIR, exist_ok=True)

# Global dictionary to store task statuses
tasks_status: dict[str, dict] = {}
# Global dictionary for SSE listener queues
sse_listeners: dict[str, asyncio.Queue] = {}

async def send_sse_update(task_id: str, update_data: dict):
    """Helper to put data into the SSE queue for a task."""
    if task_id in sse_listeners:
        try:
            await sse_listeners[task_id].put(json.dumps(update_data))
        except asyncio.QueueFull:
            logger.warn(f"SSE Queue full for task_id {task_id}. Message dropped: {update_data}")
        except Exception as e:
            logger.error(f"Error sending SSE update for task {task_id}: {e}", exc_info=True)


def run_colorization_task(
    task_id: str, 
    input_path_str: str, 
    intermediate_output_path_str: str,
    params: dict,
    original_filename_for_status: str # Added to store original filename
):
    input_path = Path(input_path_str)
    
    # Update task status with original input path at the beginning
    if task_id in tasks_status:
        tasks_status[task_id]["original_input_path"] = input_path_str
        tasks_status[task_id]["original_filename"] = original_filename_for_status # Store it

    async def progress_callback_for_task_async(progress_update: dict):
        logger.info(f"Task {task_id} progress: {progress_update}")
        current_status = tasks_status.get(task_id, {})
        current_status.update(progress_update)
        # Ensure original_input_path is preserved if current_status was re-fetched
        if "original_input_path" not in current_status:
            current_status["original_input_path"] = input_path_str
        if "original_filename" not in current_status:
             current_status["original_filename"] = original_filename_for_status
        tasks_status[task_id] = current_status
        await send_sse_update(task_id, current_status)

    def progress_callback_sync(progress_update: dict):
        asyncio.run(progress_callback_for_task_async(progress_update))

    try:
        logger.info(f"Task {task_id}: Starting colorization for {input_path_str}")
        initial_progress = {"status": "processing", "message": "Colorization process initializing.", "stage": "start_task"}
        progress_callback_sync(initial_progress)

        final_video_path_str = colorize_video(
            input_path=input_path_str,
            output_path=intermediate_output_path_str,
            render_factor=params["render_factor"],
            saturation_scale=params["saturation_scale"],
            clahe_clip_limit=params["clahe_clip_limit"],
            blend_factor=params["blend_factor"],
            progress_callback=progress_callback_sync
        )
        
        final_video_path = Path(final_video_path_str)
        final_video_filename = final_video_path.name

        logger.info(f"Task {task_id}: Colorization successful. Final video at: {final_video_path_str}")
        completion_status = {
            "status": "completed",
            "message": "Video processing completed successfully.",
            "output_filename": final_video_filename,
            "final_path": str(final_video_path),
            "original_input_path": input_path_str, # Ensure it's here on completion
            "original_filename": original_filename_for_status,
            "task_id": task_id
        }
        tasks_status[task_id] = completion_status
        asyncio.run(send_sse_update(task_id, completion_status))

    except FileNotFoundError as e:
        logger.error(f"Task {task_id}: File not found error - {e}")
        error_status = {"status": "failed", "message": f"File not found: {e}", "stage": "error_file_not_found", "original_input_path": input_path_str, "original_filename": original_filename_for_status, "task_id": task_id}
        tasks_status[task_id] = error_status
        asyncio.run(send_sse_update(task_id, error_status))
    except RuntimeError as e:
        logger.error(f"Task {task_id}: Runtime error during processing - {e}")
        error_status = {"status": "failed", "message": f"Video processing runtime error: {e}", "stage": "error_runtime", "original_input_path": input_path_str, "original_filename": original_filename_for_status, "task_id": task_id}
        tasks_status[task_id] = error_status
        asyncio.run(send_sse_update(task_id, error_status))
    except Exception as e:
        logger.error(f"Task {task_id}: An unexpected error occurred - {e}", exc_info=True)
        error_status = {"status": "failed", "message": f"An unexpected error occurred: {e}", "stage": "error_unexpected", "original_input_path": input_path_str, "original_filename": original_filename_for_status, "task_id": task_id}
        tasks_status[task_id] = error_status
        asyncio.run(send_sse_update(task_id, error_status))
    finally:
        if task_id in sse_listeners:
            asyncio.run(sse_listeners[task_id].put(None)) 
        
        # Do NOT delete input_path here if it's original_input_path. It will be managed by cache endpoints.
        # Only delete if it was a temporary copy specific to this run_colorization_task IF that was the design.
        # Current design: input_path_str IS the path in UPLOADS_DIR.
        # logger.info(f"Task {task_id}: File processing finished. Original input file {input_path_str} is preserved for now.")

@app.get("/")
async def read_root():
    return {"message": "Video Colorization API"}

@app.get("/api/videos")
async def list_all_videos(): # Renamed to avoid confusion with previous simpler list_videos
    # Returns a list of all tasks with their details
    # Filter for completed if needed, but for admin UI, all tasks are useful
    video_list = []
    for task_id, data in tasks_status.items():
        video_list.append({
            "task_id": task_id,
            "status": data.get("status"),
            "message": data.get("message"),
            "output_filename": data.get("output_filename"),
            "final_path": data.get("final_path"),
            "original_input_path": data.get("original_input_path"),
            "original_filename": data.get("original_filename"), # Added
            "stage": data.get("stage") # Added for more detail
        })
    return video_list

def get_directory_info(dir_path: Path):
    count = 0
    size_bytes = 0
    if dir_path.exists() and dir_path.is_dir():
        for entry in os.scandir(dir_path):
            if entry.is_file():
                count += 1
                try:
                    size_bytes += entry.stat().st_size
                except FileNotFoundError: # File might be deleted between scandir and stat
                    logger.warn(f"File {entry.path} not found during size calculation, might have been deleted.")
                    continue
    return {"count": count, "size_bytes": size_bytes}

@app.get("/api/cache/info")
async def get_cache_info():
    processed_info = get_directory_info(PROCESSED_VIDEOS_DIR)
    uploads_info = get_directory_info(UPLOADS_DIR)
    return {
        "processed_files": processed_info,
        "uploaded_files": uploads_info,
        "tasks_in_memory": len(tasks_status)
    }

@app.delete("/api/cache/all")
async def clear_all_cache():
    deleted_files_count = 0
    # Clear PROCESSED_VIDEOS_DIR
    for entry in os.scandir(PROCESSED_VIDEOS_DIR):
        if entry.is_file():
            try:
                os.remove(entry.path)
                deleted_files_count +=1
            except Exception as e:
                logger.error(f"Error deleting file {entry.path}: {e}")
    # Clear UPLOADS_DIR
    for entry in os.scandir(UPLOADS_DIR):
        if entry.is_file():
            try:
                os.remove(entry.path)
                deleted_files_count +=1
            except Exception as e:
                logger.error(f"Error deleting file {entry.path}: {e}")
    
    # Clear tasks_status (or mark as deleted)
    # For simplicity, we clear it. A more robust system might mark tasks.
    tasks_to_remove = list(tasks_status.keys()) # Avoid dict size change during iteration
    for task_id in tasks_to_remove:
        del tasks_status[task_id]
        # If SSE is active for any of these, they will eventually error out or close
        if task_id in sse_listeners:
            asyncio.run(sse_listeners[task_id].put(None)) # Signal end
            # No need to del sse_listeners[task_id] here, event_generator's finally does it

    logger.info(f"Cleared all cache. Deleted {deleted_files_count} files. Cleared all task statuses.")
    return JSONResponse(content={"message": "All cache cleared successfully.", "deleted_files": deleted_files_count, "cleared_tasks": len(tasks_to_remove)})

@app.delete("/api/cache/video/{task_id}")
async def clear_video_from_cache(task_id: str):
    task_info = tasks_status.get(task_id)
    if not task_info:
        raise HTTPException(status_code=404, detail=f"Task ID {task_id} not found.")

    deleted_files_log = []

    final_video_path_str = task_info.get("final_path")
    if final_video_path_str:
        final_video_path = Path(final_video_path_str)
        if final_video_path.exists():
            try:
                os.remove(final_video_path)
                deleted_files_log.append(f"Deleted processed video: {final_video_path_str}")
            except Exception as e:
                logger.error(f"Error deleting processed file {final_video_path_str} for task {task_id}: {e}")
                # Potentially raise HTTPException or return error in response

    original_input_path_str = task_info.get("original_input_path")
    if original_input_path_str:
        original_input_path = Path(original_input_path_str)
        if original_input_path.exists():
            # Check if it's the same as final_video_path to avoid double delete error if they were same
            if not (final_video_path_str and final_video_path_str == original_input_path_str):
                try:
                    os.remove(original_input_path)
                    deleted_files_log.append(f"Deleted original uploaded video: {original_input_path_str}")
                except Exception as e:
                    logger.error(f"Error deleting original file {original_input_path_str} for task {task_id}: {e}")
    
    # Remove the task from memory
    del tasks_status[task_id]
    # Signal SSE listener if active
    if task_id in sse_listeners:
         asyncio.run(sse_listeners[task_id].put(None)) # Signal end
         # No need to del sse_listeners[task_id] here, event_generator's finally does it

    logger.info(f"Cleared cache for Task ID {task_id}. Log: {deleted_files_log}")
    return JSONResponse(content={"message": f"Cache cleared for Task ID {task_id}.", "details": deleted_files_log})


@app.get("/api/videos/download/{task_id}")
async def download_video(task_id: str):
    task_info = tasks_status.get(task_id)
    if not task_info:
        raise HTTPException(status_code=404, detail="Task ID not found.")
    
    if task_info.get("status") != "completed":
        raise HTTPException(status_code=400, detail="Video processing is not completed.")
        
    final_path_str = task_info.get("final_path")
    output_filename = task_info.get("output_filename", "video.mp4") # Default filename if not found

    if not final_path_str:
        raise HTTPException(status_code=404, detail="Processed video file path not found in task details.")
        
    final_path = Path(final_path_str)
    if not final_path.exists() or not final_path.is_file():
        logger.error(f"File not found at path for task {task_id}: {final_path_str}")
        raise HTTPException(status_code=404, detail="Processed video file not found on server.")

    return FileResponse(path=final_path, filename=output_filename, media_type='video/mp4')


@app.post("/api/process_video") # This endpoint is defined after its dependencies like run_colorization_task
async def process_video_endpoint(
    background_tasks: BackgroundTasks,
    video_file: UploadFile = File(...),
    render_factor: int = Form(DEFAULT_RENDER_FACTOR),
    saturation_scale: float = Form(DEFAULT_SATURATION_SCALE),
    clahe_clip_limit: float = Form(DEFAULT_CLAHE_CLIP_LIMIT),
    blend_factor: float = Form(DEFAULT_BLEND_FACTOR)
):
    task_id = str(uuid.uuid4())
    logger.info(f"Received request to process video. Generated Task ID: {task_id}")

    try:
        original_filename = video_file.filename
        safe_filename = "".join(c if c.isalnum() or c in ['.', '_'] else '_' for c in original_filename)
        # Save uploaded file with a name that includes its task_id for easier tracking
        unique_input_filename = f"{task_id}_{safe_filename}"
        input_path = UPLOADS_DIR / unique_input_filename

        with open(input_path, "wb") as buffer:
            shutil.copyfileobj(video_file.file, buffer)
        logger.info(f"Task {task_id}: Uploaded video saved to {input_path}")

        intermediate_base_filename = f"{Path(safe_filename).stem}_color.mp4" # Intermediate name before _final
        intermediate_output_path = PROCESSED_VIDEOS_DIR / intermediate_base_filename
        
        params = {
            "render_factor": render_factor,
            "saturation_scale": saturation_scale,
            "clahe_clip_limit": clahe_clip_limit,
            "blend_factor": blend_factor
        }

        # Initialize task status with original input path
        tasks_status[task_id] = {
            "status": "queued", 
            "message": "Task queued for processing.",
            "original_filename": original_filename, # Store original filename
            "task_id": task_id,
            "original_input_path": str(input_path) # Store path of the file in UPLOADS_DIR
        }
        
        background_tasks.add_task(
            run_colorization_task,
            task_id,
            str(input_path),
            str(intermediate_output_path),
            params,
            original_filename # Pass for status storage within the task runner
        )
        logger.info(f"Task {task_id}: Added to background tasks.")

        return JSONResponse(
            status_code=202,
            content={
                "message": "Video processing started",
                "task_id": task_id
            }
        )
    except Exception as e:
        logger.error(f"Task {task_id}: Error in /api/process_video endpoint before starting task - {e}", exc_info=True)
        tasks_status[task_id] = {"status": "failed", "message": f"Error setting up task: {e}"}
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred during task setup: {e}")


@app.get("/api/process_status/{task_id}")
async def get_process_status_http(task_id: str):
    logger.info(f"HTTP request for status of Task ID: {task_id}")
    status_info = tasks_status.get(task_id)
    if not status_info:
        logger.warn(f"Task ID: {task_id} not found for HTTP status check.")
        raise HTTPException(status_code=404, detail="Task ID not found")
    return JSONResponse(content=status_info)

@app.get("/api/stream_progress/{task_id}")
async def stream_progress(task_id: str, request: Request):
    if task_id not in tasks_status: # Check if task was ever initialized
         logger.warn(f"SSE stream request for non-existent Task ID: {task_id}")
         # This is a bit tricky. Client might connect before process_video fully initializes the task in tasks_status.
         # For now, require task to be in tasks_status. A more robust solution might involve a brief wait or a specific "pending_init" status.
         # However, process_video initializes tasks_status[task_id] *before* returning, so this should be rare.
         return StreamingResponse((f"data: {json.dumps({'status': 'error', 'message': 'Task ID not found or not yet initialized.'})}\n\n"), media_type="text/event-stream", status_code=404)


    queue = asyncio.Queue()
    sse_listeners[task_id] = queue
    logger.info(f"SSE listener queue created for Task ID: {task_id}")

    async def event_generator():
        try:
            current_status = tasks_status.get(task_id) # Get the very latest status
            if current_status:
                yield f"data: {json.dumps(current_status)}\n\n"
            else: # Should not happen if task_id was in tasks_status above
                yield f"data: {json.dumps({'status': 'connecting', 'message': 'SSE connected, awaiting task details.'})}\n\n"

            while True:
                if await request.is_disconnected():
                    logger.info(f"Client disconnected for Task ID: {task_id}")
                    break
                
                message = await queue.get()
                if message is None: 
                    logger.info(f"SSE stream ended for Task ID: {task_id} (sentinel received).")
                    yield f"data: {json.dumps(tasks_status.get(task_id, {'status': 'closed', 'message': 'Stream closed.'}))}\n\n" # Send final status if available
                    break
                
                yield f"data: {message}\n\n"
                # No sleep needed here, queue.get() is awaitable
        except asyncio.CancelledError:
            logger.info(f"SSE event_generator for Task ID {task_id} was cancelled (client disconnected).")
        finally:
            logger.info(f"Cleaning up SSE listener for Task ID: {task_id}")
            if task_id in sse_listeners:
                del sse_listeners[task_id]
                logger.info(f"SSE listener queue removed for Task ID: {task_id}")

    return StreamingResponse(event_generator(), media_type="text/event-stream")


if __name__ == "__main__":
    import uvicorn
    logger.info("Starting Uvicorn server for local development.")
    uvicorn.run(app, host="0.0.0.0", port=8000)
