import requests
import json
import os

# Define the API endpoint
API_URL = "http://localhost:8000/generate"

# Define the example path (ensure this path exists for testing)
example_path = "C:/Users/Usuario/Desktop/Patien info"

# Create a dummy file if the path is a file and doesn't exist for testing purposes
# Or create a dummy folder if the path is a folder and doesn't exist
if "Patien info" in example_path: # Assuming Patien info indicates a folder for simplicity in this example
    if not os.path.exists(example_path):
        os.makedirs(example_path, exist_ok=True)
        print(f"Created dummy folder: {example_path}")
    
    # Create a dummy file inside the folder for content
    dummy_file_path = os.path.join(example_path, "medical_record.txt")
    if not os.path.exists(dummy_file_path):
        with open(dummy_file_path, "w") as f:
            f.write("Patient Name: John Doe")
            f.write("DOB: 01/01/1980")
            f.write("Diagnosis: Common cold")
            f.write("Medication: Ibuprofen")
        print(f"Created dummy file: {dummy_file_path}")

# Construct the chat history with paths
messages = [
    {
        "role": "user",
        "content": "Hello, how are you?",
    },
    {
        "role": "assistant",
        "content": "I'm fine, thank you!",
    },
    {
        "role": "user",
        "content": "Summarize the patient info from the provided files.",
        "paths": [example_path] # Use the example path here
    }
]

# Prepare the form data
form_data = {
    "history": [json.dumps(msg) for msg in messages],
    "image_base64": "" # No image for this example
}

print(f"Sending request to {API_URL} with history: {messages}")

try:
    # Send the POST request with stream=True
    with requests.post(API_URL, data=form_data, stream=True) as response:
        response.raise_for_status() # Raise an exception for HTTP errors (4xx or 5xx)

        print("--- Streaming Response ---")
        previous_text_chunk = "" # Initialize variable to keep track of cumulative text
        buffer = b""
        for chunk in response.iter_content(chunk_size=None):
            if chunk:
                buffer += chunk
                while b"\n" in buffer:
                    line_data, buffer = buffer.split(b"\n", 1)
                    decoded_line = line_data.decode('utf-8').strip()
                    if decoded_line.startswith("data:"):
                        # Process Server-Sent Events (SSE) data
                        try:
                            json_data = json.loads(decoded_line[len("data:"):].strip())
                            msg_type = json_data.get("type")
                            if msg_type == "update" or (msg_type is None and "text" in json_data):
                                if "text" in json_data:
                                    current_text = json_data['text']
                                    if len(current_text) > len(previous_text_chunk):
                                        new_part = current_text[len(previous_text_chunk):]
                                        print(new_part, end='', flush=True) # Print only the new part
                                        previous_text_chunk = current_text # Update previous_text_chunk
                            elif msg_type == "complete":
                                print("\n--- Generation Complete ---")
                            elif msg_type == "error":
                                print(f"\nError: {json_data.get('message')}")
                            else:
                                pass # Ignore unknown types or keep alive
                        except json.JSONDecodeError:
                            pass
        print("\n--- End of Stream ---")

except requests.exceptions.RequestException as e:
    print(f"Request failed: {e}")
    if hasattr(e, 'response') and e.response is not None:
        print(f"Response status code: {e.response.status_code}")
        print(f"Response text: {e.response.text}")
except Exception as e:
    print(f"An unexpected error occurred: {e}")
