<div align="center">
<img width="1200" height="475" alt="Children's story AI" src="logo.png" />
</div>

# Children's Story AI - Gemini Live Agent Challenge

Children's Story AI is an immersive, multimodal story generator built with the [Google GenAI SDK](https://github.com/google/genai-js). It seamlessly weaves text, imagery, and audio to create interactive, personalized 6-page comic book adventures for children, fitting the **"Creative Storyteller"** category!

View the base app in AI Studio: https://ai.studio/apps/9926f7ae-b4ef-429b-be51-e6b3b41aa1bd

## 🚀 Spin-Up Instructions

Follow these steps to reproduce and run the project locally (I have tried with Antigravity)

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+ recommended)
- A Google Cloud Project with the **Gemini API** enabled (or a Gemini Developer API key).

### 1. Clone the repository
```bash
git clone <YOUR-REPO-URL-HERE>
cd children's-story-ai
```

### 2. Install dependencies
```bash
npm install
```

### 3. Configure the Environment
Create a `.env.local` file in the root of the project to securely house your API key:
```bash
echo "VITE_API_KEY=your_gemini_api_key_here" > .env.local
```
*(Note: As an alternative during local testing, you can also inject the key through the AI Studio UI when prompted by the application).*

### 4. Run the Development Server
```bash
npm run dev
```
The application will start, usually on `http://localhost:5173`. Open this URL in your browser to start generating stories!

### 5. Using the App
- **Characters:** Enter names for the main characters.
- **Multimodal Guest (Star #4):** Upload a photo! The app uses `gemini-3-flash-preview` to output a structural character blueprint, guaranteeing consistency across all generated images.
- **Story Generation:** Click a template (e.g., "Space Trip") or type a custom prompt. 
- The app will concurrently generate a structured JSON narrative, TTS audio via `gemini-2.5-flash-preview-tts`, and comic panel illustrations via `gemini-3.1-flash-image-preview`.
