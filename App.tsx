
import React, { useState, useRef, useEffect } from 'react';
import { AppStatus, ComicStory } from './types';
import { generateComicStory, generatePanelImage, generateNarration, describeCharacterImage } from './services/geminiService';
import ComicBook from './components/ComicBook';
import Loader from './components/Loader';

const ADVENTURE_IDEAS = [
  { emoji: "🚀", title: "Space Trip", prompt: "A Space Adventure to Mars", color: "bg-indigo-100 border-indigo-300 text-indigo-800" },
  { emoji: "🏖️", title: "Beach Day", prompt: "A Trip to the Sunny Beach", color: "bg-yellow-100 border-yellow-300 text-yellow-800" },
  { emoji: "🦁", title: "Jungle Fun", prompt: "Finding Treasure in the Jungle", color: "bg-green-100 border-green-300 text-green-800" },
  { emoji: "🦕", title: "Dino Land", prompt: "Exploring the Dinosaur World", color: "bg-purple-100 border-purple-300 text-purple-800" }
];

const App: React.FC = () => {
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [story, setStory] = useState<ComicStory | null>(null);
  const [topic, setTopic] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [hasApiKey, setHasApiKey] = useState(false);
  
  // Character State
  const [characters, setCharacters] = useState<string[]>(["Pete the Cat", "Peppa Pig", "Mickey Mouse"]);

  // Guest character state
  const [guestPhoto, setGuestPhoto] = useState<string | null>(null);
  const [guestMimeType, setGuestMimeType] = useState<string | null>(null);
  const [guestName, setGuestName] = useState<string>("");
  const [showHelp, setShowHelp] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const checkApiKey = async () => {
      // If the key is injected via environment variables (e.g. .env file), use it.
      // Note: process.env.API_KEY is replaced by Vite at build time.
      if (typeof process.env.API_KEY === 'string' && process.env.API_KEY.length > 0) {
        setHasApiKey(true);
        return;
      }

      if (window.aistudio) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(hasKey);
      } else {
        setHasApiKey(true); // Fallback for local dev
      }
    };
    checkApiKey();
  }, []);

  const handleConnectApiKey = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setHasApiKey(true);
    }
  };

  const handleCharacterChange = (index: number, value: string) => {
    const newChars = [...characters];
    newChars[index] = value;
    setCharacters(newChars);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setGuestPhoto(reader.result as string);
        setGuestMimeType(file.type);
      };
      reader.readAsDataURL(file);
    }
  };

  const startCreation = async (selectedTopic: string) => {
    try {
      setError(null);
      setStory(null);
      let guestBlueprint: string | undefined = undefined;

      // 1. Analyze guest character if uploaded
      if (guestPhoto && guestMimeType) {
        setStatus(AppStatus.ANALYZING_CHARACTER);
        guestBlueprint = await describeCharacterImage(guestPhoto, guestMimeType);
      }

      // 2. Generate the Story Structure
      setStatus(AppStatus.GENERATING_STORY);
      
      const storyCharacters = [...characters];
      if (guestPhoto && guestName.trim()) {
        storyCharacters.push(guestName.trim());
      } else if (guestPhoto) {
        storyCharacters.push("The New Friend");
      }

      const newStory = await generateComicStory(selectedTopic, storyCharacters, guestBlueprint);
      setStory(newStory);
      
      // 3. Generate Images and Audio concurrently
      setStatus(AppStatus.GENERATING_IMAGES);
      
      const updatedPages = [...newStory.pages];
      
      for (let i = 0; i < updatedPages.length; i++) {
        const page = updatedPages[i];
        let imageUrl = page.imageUrl;
        let audioData = page.audioData;

        try {
          // Generate Image with Guest Blueprint if exists
          try {
            imageUrl = await generatePanelImage(page.illustrationPrompt, storyCharacters, guestBlueprint);
          } catch (imgErr) {
            console.error(`Error generating image for page ${i + 1}:`, imgErr);
          }
          
          // Generate Audio
          try {
            const narrationText = `${page.narration}. ${page.dialogue}`;
            audioData = await generateNarration(narrationText);
          } catch (audioErr) {
            console.error(`Error generating audio for page ${i + 1}:`, audioErr);
          }
          
          updatedPages[i] = { ...page, imageUrl, audioData };
          setStory(prev => prev ? { ...prev, pages: [...updatedPages] } : null);
        } catch (pageErr) {
          console.error(`Error processing page ${i + 1}:`, pageErr);
        }
      }

      setStatus(AppStatus.READY);
    } catch (err: any) {
      console.error("Critical Generation Error:", err);
      setError("Oops! The magic glitter spilled. Try again!");
      setStatus(AppStatus.IDLE);
    }
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (topic.trim()) {
      startCreation(topic);
    }
  };

  return (
    <div className="min-h-screen pb-20">
      <header className="pt-8 pb-4 text-center relative">
        <h1 className="text-4xl md:text-6xl font-comic text-blue-600 tracking-tight drop-shadow-sm -rotate-2 inline-block bg-white px-6 py-2 rounded-2xl border-4 border-blue-200 shadow-md transform hover:scale-105 transition-transform cursor-default">
          Children's <span className="text-pink-500">Story AI</span>
        </h1>
        <button 
          onClick={() => setShowHelp(true)}
          className="absolute top-8 right-8 w-12 h-12 bg-yellow-400 text-white rounded-full font-comic text-2xl hover:bg-yellow-500 border-b-4 border-yellow-600 active:border-b-0 active:translate-y-1 flex items-center justify-center shadow-lg"
        >
          ?
        </button>
      </header>

      {/* Help Modal */}
      {showHelp && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-[3rem] max-w-lg w-full border-8 border-blue-100 shadow-2xl relative">
            <button 
              onClick={() => setShowHelp(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-2xl font-bold"
            >
              ✕
            </button>
            <h2 className="text-3xl font-comic text-blue-600 mb-4 text-center">How to play! ✨</h2>
            <div className="space-y-4 text-lg text-gray-700 font-comic">
              <p>1. <strong>Name your friends:</strong> Type names for your story characters in the boxes.</p>
              <p>2. <strong>Add a friend:</strong> Upload a photo of you or a toy to be Star #4!</p>
              <p>3. <strong>Pick an adventure:</strong> Click a picture to start, or type your own idea!</p>
              <p>4. <strong>Wait for magic:</strong> We'll draw your story and make it talk!</p>
              <p>5. <strong>Read & Play:</strong> Click the sparkles to hear the story!</p>
            </div>
          </div>
        </div>
      )}

      <main className="container mx-auto px-4 max-w-4xl">
        {!hasApiKey ? (
          <div className="bg-white p-8 rounded-[3rem] shadow-xl border-8 border-white ring-4 ring-blue-100 text-center animate-in slide-in-from-bottom-4 duration-500 mt-10">
            <h2 className="text-3xl font-comic text-blue-600 mb-4">✨ Unlock the Magic! ✨</h2>
            <p className="text-xl text-gray-600 mb-8 font-comic">
              To create amazing stories with high-quality pictures, we need a special magic key!
            </p>
            <button
              onClick={handleConnectApiKey}
              className="btn-kid px-8 py-4 bg-pink-500 text-white rounded-full font-comic text-2xl hover:bg-pink-600 border-b-8 border-pink-700 active:border-b-0 active:translate-y-2"
            >
              🔑 Connect Magic Key
            </button>
            <div className="mt-8 space-y-2">
              <p className="text-sm text-gray-400">
                (Select a paid Google Cloud project API key for full features)
              </p>
              <a 
                href="https://ai.google.dev/gemini-api/docs/billing" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-xs text-blue-400 underline hover:text-blue-600 block"
              >
                Learn about billing
              </a>
            </div>
          </div>
        ) : (
          <>
        {status === AppStatus.IDLE && (
          <div className="bg-white p-6 md:p-8 rounded-[3rem] shadow-xl border-8 border-white ring-4 ring-blue-100 animate-in slide-in-from-bottom-4 duration-500">
            
            {/* Character Selection - Anthropomorphic Grid */}
            <div className="mb-12">
              <h2 className="text-3xl font-comic text-center mb-8 text-blue-600 flex items-center justify-center gap-3 drop-shadow-sm">
                <span>🎭</span> Meet the Story Team!
              </h2>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Character 1 - Blue Bear Style */}
                <div className="relative group">
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-20 h-10 bg-blue-200 rounded-t-full z-0 flex justify-between px-1">
                     <div className="w-6 h-6 bg-blue-300 rounded-full -mt-2"></div>
                     <div className="w-6 h-6 bg-blue-300 rounded-full -mt-2"></div>
                  </div>
                  <div className="bg-blue-50 p-6 pt-8 rounded-[2rem] border-4 border-blue-200 shadow-lg relative z-10 hover:scale-105 transition-transform duration-300">
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-white px-3 py-1 rounded-full text-sm font-bold text-blue-400 shadow-sm border-2 border-blue-100 whitespace-nowrap">
                      Star #1
                    </div>
                    <div className="text-4xl text-center mb-3"></div>
                    <input
                      type="text"
                      value={characters[0]}
                      onChange={(e) => handleCharacterChange(0, e.target.value)}
                      className="w-full p-3 rounded-xl border-2 border-blue-200 bg-white text-center font-bold text-gray-700 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                      placeholder="Character Name"
                    />
                  </div>
                </div>

                {/* Character 2 - Green Frog Style */}
                <div className="relative group mt-4 sm:mt-0">
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-16 h-8 bg-green-200 rounded-t-full z-0"></div>
                  <div className="bg-green-50 p-6 pt-8 rounded-[2rem] border-4 border-green-200 shadow-lg relative z-10 hover:scale-105 transition-transform duration-300">
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-white px-3 py-1 rounded-full text-sm font-bold text-green-500 shadow-sm border-2 border-green-100 whitespace-nowrap">
                      Star #2
                    </div>
                    <div className="text-4xl text-center mb-3"></div>
                    <input
                      type="text"
                      value={characters[1]}
                      onChange={(e) => handleCharacterChange(1, e.target.value)}
                      className="w-full p-3 rounded-xl border-2 border-green-200 bg-white text-center font-bold text-gray-700 focus:outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100"
                      placeholder="Character Name"
                    />
                  </div>
                </div>

                {/* Character 3 - Yellow Cat Style */}
                <div className="relative group mt-4 lg:mt-0">
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-20 h-8 z-0 flex justify-between px-2">
                     <div className="w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-b-[20px] border-b-yellow-200 transform -rotate-12"></div>
                     <div className="w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-b-[20px] border-b-yellow-200 transform rotate-12"></div>
                  </div>
                  <div className="bg-yellow-50 p-6 pt-8 rounded-[2rem] border-4 border-yellow-200 shadow-lg relative z-10 hover:scale-105 transition-transform duration-300">
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-white px-3 py-1 rounded-full text-sm font-bold text-yellow-500 shadow-sm border-2 border-yellow-100 whitespace-nowrap">
                      Star #3
                    </div>
                    <div className="text-4xl text-center mb-3"></div>
                    <input
                      type="text"
                      value={characters[2]}
                      onChange={(e) => handleCharacterChange(2, e.target.value)}
                      className="w-full p-3 rounded-xl border-2 border-yellow-200 bg-white text-center font-bold text-gray-700 focus:outline-none focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100"
                      placeholder="Character Name"
                    />
                  </div>
                </div>

                {/* Character 4 - Guest Star (Pink Bunny/Robot Style) */}
                <div className="relative group mt-4 lg:mt-0">
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-20 h-10 z-0 flex justify-center gap-1">
                     <div className="w-4 h-10 bg-pink-200 rounded-full transform -rotate-12 origin-bottom"></div>
                     <div className="w-4 h-10 bg-pink-200 rounded-full transform rotate-12 origin-bottom"></div>
                  </div>
                  <div className="bg-pink-50 p-4 pt-8 rounded-[2rem] border-4 border-pink-200 shadow-lg relative z-10 hover:scale-105 transition-transform duration-300 h-full flex flex-col items-center justify-between">
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-white px-3 py-1 rounded-full text-sm font-bold text-pink-500 shadow-sm border-2 border-pink-100 whitespace-nowrap">
                      Star #4 (Guest)
                    </div>
                    
                    {!guestPhoto ? (
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full flex-1 min-h-[100px] flex flex-col items-center justify-center border-2 border-dashed border-pink-300 rounded-xl bg-white/50 hover:bg-white transition-colors gap-2 p-2"
                      >
                        <span className="text-3xl">📸</span>
                        <span className="text-xs font-bold text-pink-400">Add Photo Friend</span>
                      </button>
                    ) : (
                      <div className="relative w-full aspect-square mb-2">
                        <img 
                          src={guestPhoto} 
                          alt="Guest" 
                          className="w-full h-full object-cover rounded-xl border-2 border-white shadow-sm"
                        />
                        <button 
                          onClick={() => {
                            setGuestPhoto(null);
                            setGuestName("");
                          }}
                          className="absolute -top-2 -right-2 bg-red-500 text-white w-6 h-6 rounded-full shadow-md hover:bg-red-600 border border-white font-bold text-xs flex items-center justify-center"
                        >
                          ✕
                        </button>
                      </div>
                    )}

                    {guestPhoto && (
                      <input
                        type="text"
                        value={guestName}
                        onChange={(e) => setGuestName(e.target.value)}
                        className="w-full mt-2 p-2 rounded-lg border-2 border-pink-200 bg-white text-center font-bold text-gray-700 text-sm focus:outline-none focus:border-pink-400"
                        placeholder="Name?"
                      />
                    )}
                    
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handlePhotoUpload} 
                      className="hidden" 
                      accept="image/*"
                    />
                  </div>
                </div>

              </div>
              
              {/* Helper text for guest photo */}
              <div className="text-center mt-4">
                 <p className="text-sm text-gray-400 font-comic bg-white/50 inline-block px-4 py-1 rounded-full">
                   ✨ Tip: For Star #4, upload a photo with just 1 person!
                 </p>
              </div>
            </div>

            <h2 className="text-2xl font-comic text-center mb-6 text-gray-700">
              Pick an Adventure! 👇
            </h2>

            <div className="grid grid-cols-2 gap-4 mb-8">
              {ADVENTURE_IDEAS.map((idea) => (
                <button
                  key={idea.title}
                  onClick={() => startCreation(idea.prompt)}
                  className={`btn-kid p-6 rounded-3xl border-b-8 transition-all flex flex-col items-center justify-center gap-3 ${idea.color} hover:brightness-110`}
                >
                  <span className="text-5xl md:text-6xl filter drop-shadow-sm">{idea.emoji}</span>
                  <span className="text-xl md:text-2xl font-comic font-bold">{idea.title}</span>
                </button>
              ))}
            </div>

            <div className="relative mb-12 bg-gray-50 p-2 rounded-3xl border-2 border-gray-100">
              <form onSubmit={handleCustomSubmit} className="relative">
                <input
                  type="text"
                  placeholder="✨ Or type your own idea here..."
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full p-5 pr-32 rounded-2xl bg-white border-2 border-gray-200 focus:outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100 text-xl font-bold text-gray-700 placeholder-gray-300"
                />
                <button
                  type="submit"
                  className="btn-kid absolute right-2 top-2 bottom-2 px-6 rounded-xl bg-blue-500 text-white font-comic text-xl hover:bg-blue-600 border-b-4 border-blue-700 active:border-b-0 active:translate-y-1"
                >
                  GO!
                </button>
              </form>
            </div>

            {/* Old Guest Character Upload Removed */}

            {error && (
              <div className="mt-8 p-6 bg-red-100 border-4 border-red-200 rounded-3xl text-center animate-bounce">
                <p className="text-red-600 font-comic text-xl">{error}</p>
                <button 
                  onClick={() => setError(null)}
                  className="mt-2 text-red-500 font-bold underline"
                >
                  Try Again
                </button>
              </div>
            )}
          </div>
        )}

        {(status === AppStatus.ANALYZING_CHARACTER || status === AppStatus.GENERATING_STORY || status === AppStatus.GENERATING_IMAGES) && (
          <div className="bg-white rounded-[3rem] shadow-xl p-12 min-h-[500px] flex flex-col items-center justify-center border-8 border-white ring-4 ring-purple-100">
            <Loader 
              message={
                status === AppStatus.ANALYZING_CHARACTER ? "Scanning your photo friend... 🤖" :
                status === AppStatus.GENERATING_STORY ? `Writing a story with ${characters[0]}, ${characters[1]} & ${characters[2]}... ✍️` : 
                "Painting the pictures! 🎨"
              } 
            />
            {status === AppStatus.GENERATING_IMAGES && story && (
              <div className="w-full max-w-md mt-10 p-2 bg-gray-100 rounded-full border-4 border-gray-200">
                <div 
                  className="bg-gradient-to-r from-blue-400 to-pink-400 h-6 rounded-full transition-all duration-500 shadow-inner" 
                  style={{ width: `${(story.pages.filter(p => p.imageUrl).length / story.pages.length) * 100}%` }}
                ></div>
              </div>
            )}
          </div>
        )}

        {status === AppStatus.READY && story && (
          <div className="animate-in fade-in zoom-in duration-700">
            <ComicBook story={story} />
            
            <div className="mt-12 flex justify-center pb-12">
              <button
                onClick={() => setStatus(AppStatus.IDLE)}
                className="btn-kid px-8 py-4 bg-yellow-400 text-yellow-900 border-b-8 border-yellow-600 rounded-full font-comic text-2xl hover:bg-yellow-300 active:border-b-0 active:translate-y-2"
              >
                🔄 Read Another Story!
              </button>
            </div>
          </div>
        )}
        </>
      )}
      </main>

      {/* Decorative background elements */}
      <div className="fixed bottom-0 left-0 p-4 pointer-events-none opacity-20 z-[-1]">
         <div className="text-9xl transform -rotate-12">🐾</div>
      </div>
      <div className="fixed top-0 right-0 p-4 pointer-events-none opacity-20 z-[-1]">
         <div className="text-9xl transform rotate-12">🎨</div>
      </div>
    </div>
  );
};

export default App;
