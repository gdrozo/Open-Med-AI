# Open Med AI

Open Med AI is a privacy-first, locally-deployable medical assistant powered by the **google/medgemma-1.5-4b-it** model. It leverages agentic reasoning to assist clinicians in processing multimodal medical data while ensuring sensitive patient health information (PHI) remains secure on local infrastructure.

## 🚀 Getting Started

Follow these steps to set up and run Open Med AI on your local machine.

### 1. Environment Setup

The project requires a Python environment for the MedGemma inference engine. Run the provided batch file to create a virtual environment and install the necessary Python dependencies:

```bash
.\setup_env.bat
```

> **Note:** You must have access to the `google/medgemma-1.5-4b-it` model on Hugging Face.

### 2. Install Dependencies

Install the frontend and Tauri dependencies using `pnpm`:

```bash
pnpm i
```

### 3. Run the Application

Start the development environment (this will launch the AI server and the Tauri application):

```bash
pnpm tauri dev
```

---

## 🩺 Problem Statement

**The Problem Domain:**
Modern healthcare environments are saturated with fragmented, unstructured data—ranging from handwritten notes and PDF lab reports to high-dimensional medical imaging. Existing AI solutions often fail in these settings because they rely on cloud-based infrastructures that present unacceptable privacy risks for Sensitive Patient Health Information (PHI) and require constant, high-speed internet connectivity. Clinicians are burdened with high cognitive loads as they manually synthesize imaging findings with textual histories.

**Impact Potential:**
Open Med AI addresses this by providing a privacy-first, locally-deployable assistant that acts as a clinical force multiplier. Automating the initial synthesis of lab reports and imaging into a unified draft can reduce administrative documentation time by **20-30%**. By enabling offline, local execution, Open Med AI brings state-of-the-art clinical reasoning to regional hospitals and secure clinics where cloud-AI is currently non-viable.

## 💡 Overall Solution

Open Med AI leverages **MedGemma 1.5** as the core of a sophisticated agentic reasoning pipeline:

1.  **Multimodal Synthesis:** Processes both visual tokens (X-rays, CT scans) and textual tokens (EHR data, lab reports) in a single context.
2.  **Folder-Based Knowledge Retrieval:** Allows clinicians to point the system to a local directory for longitudinal history analysis without needing a centralized database.
3.  **Dynamic Clinical Workflows:** Switches roles effortlessly—from generating structured diagnostic reports to drafting nursing checklists or explaining complex medication interactions.

## 🛠 Technical Details

- **Inference Engine (Python/FastAPI):** Powered by **4-bit quantization (BitsAndBytes)** to allow the 4B MedGemma model to run efficiently on consumer-grade NVIDIA GPUs.
- **Security & Performance (Tauri + Rust):** Packaged as a native Tauri app for a minimal security footprint and high-speed local file system access.
- **Premium Interface (Solid.js + TypeScript):** A high-performance, reactive frontend designed for clinical efficiency with a "Human-in-the-loop" approach.
- **Deployment Versatility:** Modular design suitable for local services, hospital network resources, or secure private clouds.

---

## 👥 Your Team

- **German David Rozo Cruz** - [Developer]
