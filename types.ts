
export interface Hotspot {
  x: number; // percentage from left
  y: number; // percentage from top
  label: string; // e.g. "Pete's Hat", "Muddy Puddle"
  reaction: string; // "sparkle", "bounce", "shake"
}

export interface ComicPage {
  id: number;
  narration: string;
  dialogue: string;
  illustrationPrompt: string;
  imageUrl?: string;
  audioData?: string;
  hotspots?: Hotspot[];
}

export interface ComicStory {
  title: string;
  pages: ComicPage[];
  guestCharacterBlueprint?: string;
}

export enum AppStatus {
  IDLE = 'IDLE',
  ANALYZING_CHARACTER = 'ANALYZING_CHARACTER',
  GENERATING_STORY = 'GENERATING_STORY',
  GENERATING_IMAGES = 'GENERATING_IMAGES',
  READY = 'READY',
  ERROR = 'ERROR'
}

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}
