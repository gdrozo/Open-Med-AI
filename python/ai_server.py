import uvicorn
import starlette.formparsers
import starlette.requests
from pathlib import Path
from Inference import InferenceService
from ServerUtils import process_history, process_paths_in_messages, load_image_from_path
from fastapi import FastAPI, Form
from fastapi.responses import StreamingResponse, JSONResponse


# Increase the maximum part size for multipart form data
NEW_MAX_PART_SIZE = 100 * 1024 * 1024  # 100MB

starlette.formparsers.MultiPartParser.max_part_size = NEW_MAX_PART_SIZE
if starlette.formparsers.MultiPartParser.__init__.__kwdefaults__:
    starlette.formparsers.MultiPartParser.__init__.__kwdefaults__["max_part_size"] = (
        NEW_MAX_PART_SIZE
    )
if starlette.requests.Request.form.__kwdefaults__:
    starlette.requests.Request.form.__kwdefaults__["max_part_size"] = NEW_MAX_PART_SIZE

from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

inference_service: InferenceService = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global inference_service
    inference_service = InferenceService()
    yield

app = FastAPI(title="MedGemma API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {"message": "MedGemma API is running."}


import httpx
import json
import asyncio

RUST_SERVER_URL = "http://127.0.0.1:8001/db"

@app.post("/generate")
async def generate_endpoint(
    history: list[str] = Form(...), 
    image_path: str = Form(None),
    chat_id: int = Form(...)
):
    try:
        # Reassemble history from chunks
        try:
            messages = process_history(history)
        except ValueError as e:
            return JSONResponse(content={"error": str(e)}, status_code=400)

        # Process file/directory paths within user messages
        process_paths_in_messages(messages)

        # Load image if provided
        try:
            final_image_base64 = load_image_from_path(image_path)
        except RuntimeError as e:
            return JSONResponse(content={"error": str(e)}, status_code=400)

        # Generate response using InferenceService
        generator = inference_service.generate(messages=messages, image_base64=final_image_base64)

        async def stream_response():
            full_text = ""
            last_saved_text = ""
            message_id = None
            save_threshold = 150 # Save every 150 characters

            try:
                print("Generating response...")
                async for chunk in generator:
                    yield f"data: {chunk}\n\n"

                    try:
                        data = json.loads(chunk)
                        # We look for "text" in the update
                        if "text" in data:
                            full_text = data["text"]

                            # Check if we should save to DB
                            if len(full_text) - len(last_saved_text) >= save_threshold:
                                async with httpx.AsyncClient() as client:
                                    if message_id is None:
                                        print("Creating message entry " + full_text)
                                        # Create the message entry
                                        res = await client.post(
                                            f"{RUST_SERVER_URL}/chats/{chat_id}/messages",
                                            json={"role": "assistant", "content": full_text}
                                        )
                                        if res.status_code == 201:
                                            message_id = res.json()
                                            last_saved_text = full_text
                                    else:
                                        # Update existing message entry
                                        await client.patch(
                                            f"{RUST_SERVER_URL}/messages/{message_id}",
                                            json={"content": full_text}
                                        )
                                        last_saved_text = full_text
                    except (json.JSONDecodeError, KeyError, Exception) as e:
                        # Non-text chunks or errors are ignored for DB persistence
                        print("Non-text chunk or error: " + str(e))
            except Exception as e:
                print(f"Error in stream_response: {e}")
            finally:
                # Final save if there's any unsaved content
                if full_text and full_text != last_saved_text:
                    print("Final save triggering...")
                    try:
                        async def final_save():
                            async with httpx.AsyncClient() as client:
                                if message_id is None:
                                    await client.post(
                                        f"{RUST_SERVER_URL}/chats/{chat_id}/messages",
                                        json={"role": "assistant", "content": full_text}
                                    )
                                else:
                                    await client.patch(
                                        f"{RUST_SERVER_URL}/messages/{message_id}",
                                        json={"content": full_text}
                                    )
                        # Shield the saving process so it finishes even if the request task is cancelled
                        await asyncio.shield(final_save())
                        print("Final save completed.")
                    except Exception as e:
                        print(f"Final save failed: {e}")

        return StreamingResponse(stream_response(), media_type="text/event-stream")
    except Exception as e:
        print(f"Unhandled exception in generate_endpoint: {e}")
        return JSONResponse(content={"error": f"Internal server error: {e}"}, status_code=500)

@app.post("/cancel")
async def cancel_generation_endpoint(generation_id: str = Form(...)):
    if inference_service.cancel_generation(generation_id):
        return {"message": f"Generation {generation_id} cancelled successfully."}
    else:
        return JSONResponse(content={"message": f"Generation {generation_id} not found or already finished."}, status_code=404)


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
