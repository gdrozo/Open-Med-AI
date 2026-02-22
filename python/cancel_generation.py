import requests
import json

# Replace with the actual generation_id you want to cancel
# This ID would typically be obtained from the response of a /generate call
generation_id_to_cancel = "1" 

if generation_id_to_cancel == "YOUR_GENERATION_ID_HERE":
    print("Please replace 'YOUR_GENERATION_ID_HERE' with an actual generation ID to cancel.")
else:
    url = "http://0.0.0.0:8000/cancel"
    data = {"generation_id": generation_id_to_cancel}

    try:
        response = requests.post(url, data=data)
        response.raise_for_status()  # Raise an exception for HTTP errors (4xx or 5xx)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
    except requests.exceptions.RequestException as e:
        print(f"An error occurred: {e}")
        if hasattr(e, 'response') and e.response is not None:
            print(f"Server response: {e.response.text}")
