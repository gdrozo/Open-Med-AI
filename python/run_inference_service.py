from Inference import InferenceService
import torch

if __name__ == "__main__":
    print("Attempting to create an instance of InferenceService...")
    try:
        service = InferenceService()
        print(f"InferenceService instance created. Device being used: {service.device}")

        if service.model is not None:
            print("service.model attribute is NOT None. Model loading was likely attempted.")
        else:
            print("service.model attribute IS None. Model loading might have failed or not been assigned.")
        
        if service.processor is not None:
            print("service.processor attribute is NOT None. Processor loading was likely attempted.")
        else:
            print("service.processor attribute IS None. Processor loading might have failed or not been assigned.")

    except Exception as e:
        print(f"An error occurred while creating InferenceService instance or during model loading: {e}")
