# Note Tube - Browser Extension

Note Tube is a powerful browser extension designed to supercharge your YouTube learning experience.

## What it Does
Note Tube injects an interactive side-panel directly into YouTube, giving you an AI-powered assistant and a dedicated workspace to take notes, ask questions, and summarize tutorials—without ever leaving the video page or juggling multiple tabs.

## The Problem it Solves
Switching back and forth between YouTube and a separate note-taking app is distracting and inefficient. You lose context, miss important timestamps, and constantly have to pause and rewind. Note Tube solves this by embedding a smart learning companion right into YouTube. It syncs your notes with the video timeline and provides an AI that understands the video context to answer your questions on the fly.

## Key Features
- **Smart Timestamped Notes**: Take notes that are automatically linked to the exact moment in the video. Click a timestamp later to jump right back to that spot.
- **AI Chat Assistant**: Ask questions about the tutorial you're watching, and the AI will provide contextual answers based on the video's content.
- **Voice Input**: Use your microphone to quickly dictate notes or chat with the AI, powered by Whisper speech-to-text.
- **AI Text Enhancement**: Instantly rewrite and polish your notes using our built-in AI rewriting tools.
- **Cloud Sync**: All your notes and chat history are securely saved and synced to your Note Tube account, allowing you to access them from any device and download them whenever you want.
- **Smart Grouping**: Organize your tutorials into custom folders and collections. Easily switch between different study groups to keep your workspace clutter-free and highly focused.

## Gallery

![Extension Popup](assets/01.png)

![Note Taking Interface](assets/2.png)

![AI Chat Assistant](assets/3.png)

![Scientific Calculator](assets/4.png)

## Tech Stack
- **Frontend**: Vanilla HTML, CSS, JavaScript
- **API Communication**: `fetch` API interacting with our [FastAPI Backend](https://github.com/SHubhamanjk/note-tube-backend)
- **Styling**: Modern vanilla CSS with dynamic glassmorphism, responsive design, and fluid micro-animations
- **Browser APIs**: Chrome Extension API (Manifest V3, Service Workers, Content Scripts)

## Backend Repository
The backend API powering this extension is built with FastAPI and MongoDB. You can find the source code here:
[Note Tube Backend](https://github.com/SHubhamanjk/note-tube-backend)

## Future Roadmap & Challenges

We have ambitious plans for the future of Note Tube! Some upcoming features in our roadmap include:
- **Interactive Quizzes**: Auto-generate quizzes directly from the video content to test your knowledge.
- **Mind Maps**: Visually map out complex concepts and topics covered in long tutorials.
- **Fully AI-Powered Notes**: Automatically structure and summarize notes based on the video context with minimal manual input.

### Current Challenges
As we scale these features, we are actively working through a few technical hurdles:
- **AI Cost at Scale**: Generating context-heavy features (like interactive quizzes and full-length summaries) requires significant LLM usage, which poses a challenge for maintaining cost-efficiency as our user base grows.
- **Consistent Video Transcripts**: Reliably extracting highly accurate transcripts from every YouTube video remains a challenge due to varying caption availability, language barriers, and auto-generation inconsistencies.
