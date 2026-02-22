import json
import base64
from pathlib import Path
from Utils import reassemble_objects, read_text_files_from_folder, read_single_text_file

def process_history(history: list[str]) -> list[dict]:
    """Reassemble history from chunks and parse as JSON."""
    try:
        messages = reassemble_objects(history)
        print(f"Processing {len(messages)} messages")
        return messages
    except json.JSONDecodeError as e:
        print(f"Error parsing history: {e}")
        raise ValueError("Invalid history format.")

def process_paths_in_messages(messages: list[dict]):
    """Iterate through messages to find and process paths (files/directories)."""
    for message in messages:
        if message.get("role") == "user" and "paths" in message:
            all_file_contents = []
            for path_str in message["paths"]:
                current_path = Path(path_str)
                if current_path.is_file():
                    file_data = read_single_text_file(path_str)
                    if file_data:
                        all_file_contents.append(file_data)
                elif current_path.is_dir():
                    folder_files = read_text_files_from_folder(path_str)
                    all_file_contents.extend(folder_files)
                else:
                    print(f"Path does not exist or is not a file/directory: {path_str}")

            if all_file_contents:
                current_content = message.get("content", "")
                if not isinstance(current_content, list):
                    current_content = [{"type": "text", "text": current_content}]
                for file_data in all_file_contents:
                    current_content.append(
                        {
                            "type": "text",
                            "text": f"\n--- File: {file_data['name']} ---\n{file_data['content']}\n",
                        }
                    )
                message["content"] = current_content
                print(f"Appended {len(all_file_contents)} files from paths to a user message.")

            # Remove the 'paths' key after processing
            del message["paths"]

def load_image_from_path(image_path: str) -> str | None:
    """Load and base64-encode an image from a file path."""
    if not image_path:
        return None
    
    image_file_path = Path(image_path)
    if not image_file_path.is_file():
        print(f"Warning: image_path '{image_path}' does not point to an existing file.")
        return None

    try:
        with open(image_file_path, "rb") as img_file:
            encoded_image = base64.b64encode(img_file.read()).decode("utf-8")
        print(f"Image loaded and encoded from path: {image_path}")
        return encoded_image
    except Exception as e:
        print(f"Error reading or encoding image from path {image_path}: {e}")
        raise RuntimeError(f"Failed to process image from path: {e}")
