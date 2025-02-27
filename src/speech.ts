import { appState } from './state';

let voices: SpeechSynthesisVoice[] = [];
speechSynthesis.onvoiceschanged = () => {
  console.log('voices changed');
  voices = speechSynthesis.getVoices();
};

function getBestVoice(): SpeechSynthesisVoice | null {
  // On MacOS, Alex is considered one of the highest quality voices
  const alex = voices.find((voice) => voice.name === 'Alex');
  console.log('voices', voices, alex);
  if (alex) return alex;

  // Otherwise prefer English voices
  const englishVoices = voices.filter((voice) => voice.lang.startsWith('en'));

  // Sort by local voices first (they tend to be higher quality)
  return (
    englishVoices.sort((a, b) => {
      if (a.localService && !b.localService) return -1;
      if (!a.localService && b.localService) return 1;
      return 0;
    })[0] || null
  );
}

export function cancelSpeech() {
  if (appState.activeUtterance) {
    speechSynthesis.cancel();
    appState.activeUtterance = null;
  }
}

export function speak(text: string): Promise<void> {
  // Cancel any existing speech
  cancelSpeech();

  return new Promise((resolve, reject) => {
    const utterance = new SpeechSynthesisUtterance(text);

    utterance.onend = () => {
      appState.activeUtterance = null;
      resolve();
    };

    utterance.onerror = (event) => {
      appState.activeUtterance = null;
      reject(new Error(`Speech synthesis failed: ${event.error}`));
    };

    utterance.voice = getBestVoice();

    // Optional: adjust for smoother speech
    utterance.rate = 0.9; // Slightly slower
    utterance.pitch = 1.0; // Natural pitch

    appState.activeUtterance = utterance;
    speechSynthesis.speak(utterance);
  });
}
