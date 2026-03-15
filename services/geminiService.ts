
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { ComicStory } from "../types";

const ART_STYLE = "Artistic children's book illustration style, watercolor and ink sketch, visible crayon-like texture, soft hand-drawn lines, simple charming backgrounds, white textured paper background, whimsical and friendly.";

async function withRetry<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
}

function cleanJsonResponse(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?/, '').replace(/```$/, '');
  }
  return cleaned.trim();
}

/**
 * Analyzes an image to create a character description for consistent generation.
 */
export const describeCharacterImage = async (base64Data: string, mimeType: string): Promise<string> => {
  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        {
          inlineData: {
            data: base64Data.split(',')[1] || base64Data,
            mimeType: mimeType
          }
        },
        {
          text: "Describe this character for a simple children's book. Focus on colors, basic shapes, and one key accessory. Keep the description concise and descriptive for an illustrator. Example: 'A fluffy orange dog with a blue collar and a wagging tail.'"
        }
      ]
    });
    return response.text || "A friendly mystery character";
  });
};

export const generateComicStory = async (topic: string, characters: string[], guestBlueprint?: string): Promise<ComicStory> => {
  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Format character list for the prompt
    const charList = characters.map((c, i) => `${i + 1}. ${c}`).join('\n');
    const guestInfo = guestBlueprint ? `\n\nNote: The last character listed above (Star #4) is a special guest. Here is their visual description: ${guestBlueprint}` : "";
    
    const prompt = `Create a narrative 6-page adventure comic for a 4-year-old.
    Topic: ${topic}.
    
    Characters:
    ${charList}${guestInfo}
    
    All listed characters must be included in the adventure.
    Page 1: Introduction and setting the scene.
    Page 2: The adventure begins / heading out.
    Page 3: A fun discovery or a small mystery.
    Page 4: Encountering a playful obstacle.
    Page 5: Working together to solve it.
    Page 6: Happy ending and celebration.

    For each page: Provide narration, one line of dialogue, an illustration prompt, and 2 interactive hotspots.

    Visual Rules:
    - Characters should look consistent.
    - Style: ${ART_STYLE}

    Return strictly valid JSON.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            pages: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.INTEGER },
                  narration: { type: Type.STRING },
                  dialogue: { type: Type.STRING },
                  illustrationPrompt: { type: Type.STRING },
                  hotspots: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        x: { type: Type.NUMBER },
                        y: { type: Type.NUMBER },
                        label: { type: Type.STRING },
                        reaction: { type: Type.STRING }
                      },
                      required: ["x", "y", "label", "reaction"]
                    }
                  }
                },
                required: ["id", "narration", "dialogue", "illustrationPrompt", "hotspots"]
              }
            }
          },
          required: ["title", "pages"]
        }
      }
    });

    const text = cleanJsonResponse(response.text || "{}");
    const data = JSON.parse(text);
    if (guestBlueprint) data.guestCharacterBlueprint = guestBlueprint;
    return data;
  });
};

export const generatePanelImage = async (prompt: string, characters: string[], guestBlueprint?: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const charStr = characters.join(", ");
  
  // If guestBlueprint is present, we assume it applies to the last character in the list
  const guestStr = guestBlueprint ? `. (IMPORTANT: The character named '${characters[characters.length - 1]}' has this specific appearance: ${guestBlueprint})` : "";
  
  const refinedPrompt = `Scene: ${prompt}. Characters involved: ${charStr}${guestStr}. Style: ${ART_STYLE}`;

  // Helper function to try generating with a specific model
  const tryGenerate = async (modelName: string) => {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: { parts: [{ text: refinedPrompt }] },
        config: { imageConfig: { aspectRatio: "4:3" } }
      });

      const parts = response.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
      
      const textPart = parts.find(p => p.text);
      if (textPart) {
        throw new Error(`Model ${modelName} returned text instead of image: ${textPart.text}`);
      }
      throw new Error(`Model ${modelName} returned no image data`);
    } catch (error) {
      console.warn(`Generation failed with ${modelName}:`, error);
      throw error;
    }
  };

  return withRetry(async () => {
    try {
      // Primary Model: High Quality
      return await tryGenerate('gemini-3.1-flash-image-preview');
    } catch (primaryError) {
      console.log("Falling back to standard model...");
      try {
        // Fallback Model: Standard
        return await tryGenerate('gemini-2.5-flash-image');
      } catch (fallbackError) {
        throw new Error("All image generation models failed.");
      }
    }
  });
};

export const generateNarration = async (text: string): Promise<string> => {
  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Narrate cheerfully for a toddler. Text: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("No audio generated");
    return base64Audio;
  });
};

export const decodeBase64Audio = (base64: string) => {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

export const playSparkleSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(800, audioContext.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, audioContext.currentTime + 0.1);
    gain.gain.setValueAtTime(0.1, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.start();
    osc.stop(audioContext.currentTime + 0.2);
  } catch (e) {
    console.warn("Could not play sparkle sound", e);
  }
};
