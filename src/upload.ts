import { audioStore } from './storage';

interface MediaFile {
  id?: number;
  name: string;
  type: string;
  data: Blob;
  lastModified: number;
}

interface ProcessOptions {
  normalize?: boolean;
  trim?: boolean;
  fadeIn?: number;
  fadeOut?: number;
}

const getPeakValue = (buffer: AudioBuffer): number => {
  let peak = 0;
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < data.length; i++) {
      peak = Math.max(peak, Math.abs(data[i]));
    }
  }
  return peak;
};

const normalizeAudio = (
  ctx: OfflineAudioContext,
  source: AudioBufferSourceNode,
  peak: number,
): AudioNode => {
  const gain = ctx.createGain();
  gain.gain.value = peak > 0 ? 1 / peak : 1;
  source.connect(gain);
  return gain;
};

const addFadeIn = (ctx: OfflineAudioContext, source: AudioNode, duration: number): AudioNode => {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, 0);
  gain.gain.linearRampToValueAtTime(1, duration);
  source.connect(gain);
  return gain;
};

const addFadeOut = (
  ctx: OfflineAudioContext,
  source: AudioNode,
  duration: number,
  totalDuration: number,
): AudioNode => {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(1, totalDuration - duration);
  gain.gain.linearRampToValueAtTime(0, totalDuration);
  source.connect(gain);
  return gain;
};

const audioBufferToBlob = (audioBuffer: AudioBuffer): Blob => {
  const length = audioBuffer.length * audioBuffer.numberOfChannels * 4;
  const arrayBuffer = new ArrayBuffer(length);
  const view = new Float32Array(arrayBuffer);

  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const data = audioBuffer.getChannelData(channel);
    for (let i = 0; i < data.length; i++) {
      view[i * audioBuffer.numberOfChannels + channel] = data[i];
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
};

const processAudio = async (buffer: AudioBuffer, options: ProcessOptions): Promise<Blob> => {
  const ctx = new OfflineAudioContext(buffer.numberOfChannels, buffer.length, buffer.sampleRate);

  const source = ctx.createBufferSource();
  source.buffer = buffer;

  let node: AudioNode = source;

  if (options.normalize) {
    node = normalizeAudio(ctx, source, getPeakValue(buffer));
  }

  if (options.fadeIn) {
    node = addFadeIn(ctx, node, options.fadeIn);
  }

  if (options.fadeOut) {
    node = addFadeOut(ctx, node, options.fadeOut, buffer.duration);
  }

  node.connect(ctx.destination);
  source.start();

  const renderedBuffer = await ctx.startRendering();
  return audioBufferToBlob(renderedBuffer);
};

export const processFile = async (file: File, options: ProcessOptions = {}): Promise<MediaFile> => {
  const audioContext = new AudioContext();
  const arrayBuffer = await file.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  const processed = await processAudio(audioBuffer, options);

  return {
    name: file.name,
    type: file.type,
    data: processed,
    lastModified: Date.now(),
  };
};

export const handleFiles = (callback: (files: File[], options: ProcessOptions) => void) => {
  return (event: Event) => {
    event.preventDefault();
    const files: File[] = [];

    if (event instanceof DragEvent && event.dataTransfer) {
      files.push(...Array.from(event.dataTransfer.files));
    } else if (event.target instanceof HTMLInputElement && event.target.files) {
      files.push(...Array.from(event.target.files));
    }

    const audioFiles = files.filter((f) => f.type.startsWith('audio/'));
    const options: ProcessOptions = {
      normalize: true,
      fadeIn: 0.01,
      fadeOut: 0.01,
    };

    callback(audioFiles, options);
  };
};
