import { AUDIO_ABORTED, AUDIO_FINISHED, AudioEndKind } from './types';

export class AudioPlayer {
  private audio: HTMLAudioElement | null = null;
  private currentResolver: ((AudioEndKind) => void) | null = null;

  play(audioUrl: string): Promise<AudioEndKind> {
    console.log('PLAY:', audioUrl);
    // Stop any existing audio
    this.stop();

    return new Promise((resolve, reject) => {
      this.currentResolver = resolve;
      this.audio = new Audio(audioUrl);

      // Handle natural completion
      this.audio.addEventListener('ended', () => {
        this.currentResolver?.(AUDIO_FINISHED);
        this.currentResolver = null;
        this.audio = null;
      });

      // Start playback
      this.audio.play().catch((error) => {
        reject(error);
        this.currentResolver = null;
        this.audio = null;
      });
    });
  }

  stop(): void {
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
      this.currentResolver?.(AUDIO_ABORTED);
      this.currentResolver = null;
      this.audio = null;
    }
  }

  setVolume(volume: number): void {
    if (this.audio) {
      this.audio.volume = volume;
    }
  }
}

const speechPlayer = new AudioPlayer();
const musicPlayer = new AudioPlayer();

export async function playSpeech(audioUrl: string) {
  musicPlayer.setVolume(0.5);
  let res = await speechPlayer.play(audioUrl);
  musicPlayer.setVolume(1);
  return res;
}
export async function playMusic(audioUrl: string) {
  return musicPlayer.play(audioUrl);
}

export function stopSpeech() {
  speechPlayer.stop();
}
export function stopMusic() {
  musicPlayer.stop();
}
