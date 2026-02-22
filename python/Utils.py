import json
from typing import List, Dict, Any
import os
from pathlib import Path

def reassemble_objects(chunks: List[str]) -> List[Dict[str, Any]]:
    """
    Reassembles chunks into a complete object.

    Args:
        chunks: A list of string chunks, where each chunk is a JSON string
                representing a message.

    Returns:
        A list of dictionaries, where each dictionary represents a message in the history.

    Raises:
        json.JSONDecodeError: If any of the chunks are not valid JSON.
    """
    messages = []
    for i, chunk in enumerate(chunks):
        try:
            message = json.loads(chunk)
            messages.append(message)
        except json.JSONDecodeError as e:
            print(f"Error decoding JSON chunk {i}: {e} - Chunk content: {chunk[:200]}...") # Log partial chunk for debugging
            raise # Re-raise the exception to indicate a parsing failure

    print(f"Reassembled messages: {messages}")
    return messages



def read_text_files_from_folder(folder_path: str):
    folder_content = []
    supported_extensions = [
        ".txt",
        ".md",
        ".py",
        ".js",
        ".ts",
        ".tsx",
        ".html",
        ".css",
        ".json",
        ".xml",
        ".yaml",
        ".yml",
        ".csv",
    ]  # Extend as needed
    script_dir = Path(__file__).parent
    project_root = None
    # Attempt to find the project root by looking for common project files in parent directories
    for parent in script_dir.parents:
        if (parent / "package.json").exists() or (
            parent / "implementation_plan.md"
        ).exists():
            project_root = parent
            break
    if project_root is None:
        # Fallback: if project root cannot be determined, use the directory where ai_server.py is located.
        # This might not be ideal but ensures a base path.
        project_root = script_dir
        print(
            f"Warning: Could not determine project root. Using script directory as base: {project_root}"
        )
    else:
        print(f"Determined project root: {project_root}")
    # Resolve the provided folder_path relative to the determined project root
    final_folder_path = project_root / folder_path
    print(f"Attempting to read from resolved folder path: {final_folder_path}")
    if not final_folder_path.is_dir():
        print(
            f"Provided path is not a valid directory or does not exist: {final_folder_path}"
        )
        return folder_content
    for root, _, files in os.walk(final_folder_path):
        for file_name in files:
            file_extension = Path(file_name).suffix.lower()
            if file_extension in supported_extensions:
                file_path = Path(root) / file_name
                try:
                    with open(file_path, "r", encoding="utf-8") as f:
                        content = f.read()
                        # Store file name relative to the resolved folder path for better context in AI response
                        relative_file_name = file_path.relative_to(final_folder_path)
                        folder_content.append(
                            {"name": str(relative_file_name), "content": content}
                        )
                except Exception as e:
                    print(f"Error reading file {file_path}: {e}")
    return folder_content


def read_single_text_file(file_path_str: str):
    supported_extensions = [
        ".txt", ".md", ".py", ".js", ".ts", ".tsx", ".html", ".css", ".json",
        ".xml", ".yaml", ".yml", ".csv",
    ]
    file_path = Path(file_path_str)
    
    if not file_path.is_file():
        print(f"Provided path is not a valid file or does not exist: {file_path}")
        return None

    file_extension = file_path.suffix.lower()
    if file_extension not in supported_extensions:
        print(f"Skipping unsupported file type: {file_path}")
        return None

    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
            return {"name": str(file_path), "content": content}
    except Exception as e:
        print(f"Error reading file {file_path}: {e}")
        return None
