import torch
from transformers import (
    AutoProcessor,
    AutoModelForImageTextToText,
    BitsAndBytesConfig,
    TextIteratorStreamer,
    StoppingCriteria,
    StoppingCriteriaList,
)
from PIL import Image
import io
import threading
import base64
import json
import asyncio
import uuid
from typing import List, Dict, Any
import queue
import traceback



def get_next_token(streamer):
    try:
        return next(streamer)
    except StopIteration:
        return None


class CustomStoppingCriteria(StoppingCriteria):
    def __init__(self, stop_event: threading.Event):
        super().__init__()
        self.stop_event = stop_event

    def __call__(self, input_ids: torch.LongTensor, scores: torch.FloatTensor, **kwargs) -> bool:
        return self.stop_event.is_set()


class InferenceService:
    def __init__(self):
        self.model = None
        self.processor = None
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        # Store cancellation events
        self.active_generations: Dict[str, threading.Event] = {}
        self.load_model()

    def load_model(self):
        """
        Loads the Med Gemma model and processor.
        """
        # Configure 4-bit quantization for efficient model loading
        quantization_config = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_quant_type="nf4",
            bnb_4bit_compute_dtype=torch.bfloat16,
            bnb_4bit_use_double_quant=True,
        )
        
        # TODO: Replace "google/gemma-2b" with the actual Med Gemma model ID
        model_id = "google/medgemma-1.5-4b-it" 

        self.processor = AutoProcessor.from_pretrained(model_id)
        self.model = AutoModelForImageTextToText.from_pretrained(
            model_id,
            quantization_config=quantization_config,
            device_map=self.device,
        )

    async def generate(self, messages: List[Dict[str, str]], image_base64: str = None, generation_id: str = None):
        if generation_id is None:
            generation_id = str(uuid.uuid4())

        stop_event = threading.Event()
        self.active_generations[generation_id] = stop_event
        
        try:
            if image_base64:

                # Ensure <image> token is present in the prompt for Gemma 3 models
                for i in range(len(messages) - 1, -1, -1):
                    if messages[i].get("role") == "user":
                        content = messages[i].get("content", "")
                        if isinstance(content, str):
                            if "<image>" not in content:
                                messages[i]["content"] = [{"type": "image"}, {"type": "text", "text": content}]
                        elif isinstance(content, list):
                            has_image = any(item.get("type") == "image" for item in content)
                            if not has_image:
                                messages[i]["content"].insert(0, {"type": "image"})
                        print(messages)
                        break

            chat_template = self.processor.tokenizer.apply_chat_template(
                messages, tokenize=False, add_generation_prompt=True
            )
            if image_base64:
                image_bytes = base64.b64decode(image_base64)
                image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
                inputs = self.processor(text=chat_template, images=image, return_tensors="pt").to(self.device)
            else:
                inputs = self.processor(text=chat_template, return_tensors="pt").to(self.device)

            streamer = TextIteratorStreamer(self.processor.tokenizer, skip_prompt=True, timeout=120.0)
            stopping_criteria = StoppingCriteriaList([CustomStoppingCriteria(stop_event)])

            generation_kwargs = dict(
                **inputs,
                streamer=streamer,
                stopping_criteria=stopping_criteria,
                max_new_tokens=2000,
                do_sample=True,
                top_p=0.9,
                temperature=0.6,
            )
            thread = threading.Thread(target=self.model.generate, kwargs=generation_kwargs)
            thread.start()

            generated_text = ""
            print("InferenceService: Starting to iterate streamer...") # DEBUG PRINT
            try:
                while True:
                    new_text = await asyncio.to_thread(get_next_token, streamer)
                    if new_text is None:
                        break
                    
                    #print(f"InferenceService: Streamer yielded: '{new_text}'") # DEBUG PRINT
                    generated_text += new_text
                    yield json.dumps({"type": "update", "text": generated_text, "generation_id": generation_id})

                    if stop_event.is_set():
                        break
            except queue.Empty:
                yield json.dumps({"type": "error", "message": "Generation timed out.", "generation_id": generation_id})
                return
            
            print("InferenceService: Finished iterating streamer.") # DEBUG PRINT
            
            yield json.dumps({"type": "complete", "text": generated_text, "generation_id": generation_id})

        except Exception as e:
            error_msg = f"{str(e)}\n{traceback.format_exc()}"
            yield json.dumps({"type": "error", "message": error_msg, "generation_id": generation_id})
        finally:
            stop_event.set()
            if generation_id in self.active_generations:
                del self.active_generations[generation_id]

    def cancel_generation(self, generation_id: str):
        if generation_id in self.active_generations:
            self.active_generations[generation_id].set()
            return True
        return False
