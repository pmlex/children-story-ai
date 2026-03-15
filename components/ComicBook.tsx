
import React, { useState, useEffect, useRef } from 'react';
import { ComicStory, Hotspot } from '../types';
import { playSparkleSound, decodeBase64Audio } from '../services/geminiService';
import { jsPDF } from 'jspdf';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

interface ComicBookProps {
  story: ComicStory;
}

/**
 * Encodes raw PCM samples into a standard WAV container.
 */
function encodeWAV(samples: Int16Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, samples.length * 2, true);

  for (let i = 0; i < samples.length; i++) {
    view.setInt16(44 + i * 2, samples[i], true);
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

const SparkleEffect: React.FC<{ x: number; y: number; onComplete: () => void }> = ({ x, y, onComplete }) => {
  useEffect(() => {
    const timer = setTimeout(onComplete, 800);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div 
      className="absolute pointer-events-none z-50 animate-ping text-5xl"
      style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)' }}
    >
      ✨
    </div>
  );
};

const ComicBook: React.FC<ComicBookProps> = ({ story }) => {
  const [currentPage, setCurrentPage] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [sparkles, setSparkles] = useState<{ id: number; x: number; y: number }[]>([]);
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);

  const page = story.pages[currentPage];

  useEffect(() => {
    stopAudio();
  }, [currentPage]);

  useEffect(() => {
    return () => stopAudio();
  }, []);

  const stopAudio = () => {
    if (sourceRef.current) {
      try {
        sourceRef.current.stop();
      } catch (e) {}
      sourceRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
    setIsPlaying(false);
    setIsPaused(false);
  };

  const triggerTransition = (nextPageIdx: number) => {
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentPage(nextPageIdx);
      setIsTransitioning(false);
    }, 400);
  };

  const handleNext = () => {
    if (currentPage < story.pages.length - 1 && !isTransitioning) {
      triggerTransition(currentPage + 1);
    }
  };

  const handlePrev = () => {
    if (currentPage > 0 && !isTransitioning) {
      triggerTransition(currentPage - 1);
    }
  };

  const handlePlayAudio = async () => {
    if (!page.audioData) return;

    if (!isPlaying) {
      setIsPlaying(true);
      setIsPaused(false);
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioCtxRef.current = ctx;

      try {
        const bytes = decodeBase64Audio(page.audioData);
        const dataInt16 = new Int16Array(bytes.buffer);
        const buffer = ctx.createBuffer(1, dataInt16.length, 24000);
        const channelData = buffer.getChannelData(0);
        for (let i = 0; i < dataInt16.length; i++) {
          channelData[i] = dataInt16[i] / 32768.0;
        }

        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        sourceRef.current = source;

        source.onended = () => {
          if (sourceRef.current === source) {
            setIsPlaying(false);
            setIsPaused(false);
            audioCtxRef.current = null;
            sourceRef.current = null;
          }
        };
        source.start();
      } catch (err) {
        console.error("Audio playback error:", err);
        stopAudio();
      }
    } 
    else if (audioCtxRef.current) {
      if (audioCtxRef.current.state === 'running') {
        await audioCtxRef.current.suspend();
        setIsPaused(true);
      } else if (audioCtxRef.current.state === 'suspended') {
        await audioCtxRef.current.resume();
        setIsPaused(false);
      }
    }
  };

  const handleHotspotClick = (hs: Hotspot) => {
    playSparkleSound();
    const newSparkle = { id: Date.now(), x: hs.x, y: hs.y };
    setSparkles(prev => [...prev, newSparkle]);
  };

  const downloadFullStorybookPDF = async () => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'px',
      format: [600, 800]
    });

    const safeTitle = story.title;
    
    for (let i = 0; i < story.pages.length; i++) {
      const p = story.pages[i];
      if (i > 0) doc.addPage();

      doc.setFillColor(240, 249, 255);
      doc.rect(0, 0, 600, 800, 'F');

      doc.setTextColor(30, 64, 175);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.text(safeTitle, 40, 40);
      doc.setFontSize(14);
      doc.text(`${i + 1}`, 560, 40, { align: 'right' });

      if (p.imageUrl) {
        try {
          doc.addImage(p.imageUrl, 'PNG', 40, 70, 520, 390);
        } catch (e) {
          console.error("Failed to add image to PDF", e);
        }
      }

      doc.setTextColor(55, 65, 81);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(20);
      const splitText = doc.splitTextToSize(p.narration, 520);
      doc.text(splitText, 40, 500);

      if (p.dialogue) {
        const dText = `"${p.dialogue}"`;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(22);
        doc.setTextColor(17, 24, 39);
        const dTextWidth = doc.getTextWidth(dText);
        
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(191, 219, 254);
        doc.roundedRect(300 - (dTextWidth / 2) - 20, 680, dTextWidth + 40, 60, 15, 15, 'FD');
        doc.text(dText, 300, 715, { align: 'center' });
      }
    }

    doc.save(`${story.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_storybook.pdf`);
  };

  const downloadAudioFile = () => {
    if (!page.audioData) return;
    
    try {
      const bytes = decodeBase64Audio(page.audioData);
      const dataInt16 = new Int16Array(bytes.buffer);
      const wavBlob = encodeWAV(dataInt16, 24000);
      
      const url = URL.createObjectURL(wavBlob);
      const safeTitle = story.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const link = document.createElement('a');
      link.href = url;
      link.download = `${safeTitle}-page-${currentPage + 1}.wav`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 100);
    } catch (err) {
      console.error("Failed to download audio:", err);
    }
  };

  const downloadAllAsZip = async () => {
    try {
      const zip = new JSZip();
      const safeTitle = story.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      
      for (let i = 0; i < story.pages.length; i++) {
        const p = story.pages[i];
        
        // Add Image
        if (p.imageUrl) {
          // Extract base64 data from data URL
          const base64Data = p.imageUrl.split(',')[1];
          if (base64Data) {
            zip.file(`page-${i + 1}.png`, base64Data, { base64: true });
          }
        }
        
        // Add Audio
        if (p.audioData) {
          const bytes = decodeBase64Audio(p.audioData);
          const dataInt16 = new Int16Array(bytes.buffer);
          const wavBlob = encodeWAV(dataInt16, 24000);
          zip.file(`page-${i + 1}.wav`, wavBlob);
        }
      }
      
      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, `${safeTitle}_assets.zip`);
    } catch (err) {
      console.error("Failed to create zip file:", err);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-2 md:p-4">
      <div className="flex flex-col md:flex-row items-center justify-between mb-6 gap-4">
        <h1 className="text-3xl md:text-5xl font-comic text-blue-800 drop-shadow-sm text-center md:text-left bg-white px-6 py-2 rounded-2xl border-4 border-blue-100 rotate-1">
          {story.title}
        </h1>
        <div className="flex gap-4">
          <button 
            type="button"
            onClick={downloadFullStorybookPDF}
            className="btn-kid flex flex-col items-center justify-center w-20 h-20 bg-blue-500 text-white rounded-2xl hover:bg-blue-600 border-b-4 border-blue-700 active:border-b-0 active:translate-y-1"
            title="Save PDF"
          >
            <span className="text-3xl">📕</span>
            <span className="text-xs font-bold">PDF</span>
          </button>
          
          <button 
            type="button"
            onClick={downloadAudioFile}
            className="btn-kid flex flex-col items-center justify-center w-20 h-20 bg-pink-500 text-white rounded-2xl hover:bg-pink-600 border-b-4 border-pink-700 active:border-b-0 active:translate-y-1"
            title="Save Audio"
          >
            <span className="text-3xl">🎵</span>
            <span className="text-xs font-bold">Audio</span>
          </button>

          <button 
            type="button"
            onClick={downloadAllAsZip}
            className="btn-kid flex flex-col items-center justify-center w-20 h-20 bg-purple-500 text-white rounded-2xl hover:bg-purple-600 border-b-4 border-purple-700 active:border-b-0 active:translate-y-1"
            title="Download All (ZIP)"
          >
            <span className="text-3xl">📦</span>
            <span className="text-xs font-bold">ZIP</span>
          </button>
        </div>
      </div>

      <div className={`relative bg-white rounded-[2rem] shadow-2xl overflow-hidden border-8 border-white ring-4 ring-blue-100 transition-opacity duration-400 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}>
        {page.imageUrl ? (
          <div className="relative aspect-[4/3] bg-blue-50">
            <img src={page.imageUrl} alt={page.narration} className="w-full h-full object-contain" />
            
            {page.hotspots?.map((hs, idx) => (
              <button
                key={idx}
                onClick={() => handleHotspotClick(hs)}
                className="absolute w-16 h-16 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-yellow-300 bg-white/30 hover:bg-white/50 transition-transform hover:scale-125 animate-pulse shadow-lg flex items-center justify-center group"
                style={{ left: `${hs.x}%`, top: `${hs.y}%` }}
              >
                <span className="text-2xl drop-shadow-md">✨</span>
              </button>
            ))}

            {sparkles.map(s => (
              <SparkleEffect key={s.id} x={s.x} y={s.y} onComplete={() => setSparkles(prev => prev.filter(p => p.id !== s.id))} />
            ))}
          </div>
        ) : (
          <div className="aspect-[4/3] bg-gray-100 flex items-center justify-center">
            <p className="text-gray-400 font-comic text-2xl">Drawing...</p>
          </div>
        )}

        {/* Text Section */}
        <div className="p-6 md:p-8 bg-blue-50 border-t-4 border-blue-100">
          <p className="text-2xl md:text-4xl font-comic text-gray-800 mb-6 leading-relaxed text-center">
            {page.narration}
          </p>
          
          {page.dialogue && (
            <div className="flex justify-center mt-4">
              <div className="bg-white px-8 py-4 rounded-3xl border-4 border-blue-200 shadow-sm relative inline-block transform -rotate-1">
                <p className="text-xl md:text-3xl font-bold text-blue-900 text-center">
                  "{page.dialogue}"
                </p>
                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-6 h-6 bg-white border-r-4 border-b-4 border-blue-200 rotate-45"></div>
              </div>
            </div>
          )}
        </div>

        {/* Floating Play Button */}
        <button
          onClick={handlePlayAudio}
          disabled={!page.audioData}
          className={`btn-kid absolute top-4 right-4 w-20 h-20 rounded-full shadow-xl flex items-center justify-center border-4 border-white ${
            !page.audioData ? 'bg-gray-200 cursor-not-allowed' : 'bg-green-500 hover:bg-green-600'
          }`}
        >
          {isPlaying && !isPaused ? (
             <span className="text-4xl animate-pulse">⏸️</span>
          ) : (
             <span className="text-4xl">🔊</span>
          )}
        </button>
      </div>

      {/* Navigation - Big and Chunky */}
      <div className="flex items-center justify-between mt-8 gap-4">
        <button
          onClick={handlePrev}
          disabled={currentPage === 0}
          className={`btn-kid flex-1 py-6 rounded-3xl font-comic text-2xl font-bold border-b-8 flex items-center justify-center gap-2 ${
            currentPage === 0 
              ? 'bg-gray-200 text-gray-400 border-gray-300 cursor-not-allowed' 
              : 'bg-orange-400 text-white border-orange-600 hover:bg-orange-500 active:border-b-0 active:translate-y-2'
          }`}
        >
          <span className="text-3xl">👈</span> Back
        </button>
        
        <div className="hidden md:flex flex-col items-center">
           <span className="font-comic text-3xl text-blue-800 bg-white px-6 py-2 rounded-2xl border-4 border-blue-100 rotate-2 shadow-sm">
             Page {currentPage + 1}
           </span>
        </div>

        <button
          onClick={handleNext}
          disabled={currentPage === story.pages.length - 1}
          className={`btn-kid flex-1 py-6 rounded-3xl font-comic text-2xl font-bold border-b-8 flex items-center justify-center gap-2 ${
            currentPage === story.pages.length - 1 
              ? 'bg-gray-200 text-gray-400 border-gray-300 cursor-not-allowed' 
              : 'bg-green-500 text-white border-green-700 hover:bg-green-600 active:border-b-0 active:translate-y-2'
          }`}
        >
          Next <span className="text-3xl">👉</span>
        </button>
      </div>
    </div>
  );
};

export default ComicBook;
