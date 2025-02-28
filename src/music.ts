import { playMusic } from './audioPlayer';
import { audioStore, getAudioId } from './storage';
import { Audio, AUDIO_ABORTED } from './types';

type ProcessOptions = {
  normalize?: boolean;
  trim?: boolean;
  fadeIn?: number;
  fadeOut?: number;
};

function getPeakValue(buffer: AudioBuffer): number {
  let peak = 0;
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < data.length; i++) {
      peak = Math.max(peak, Math.abs(data[i]));
    }
  }
  return peak;
}

function normalizeAudio(
  ctx: OfflineAudioContext,
  source: AudioBufferSourceNode,
  peak: number,
): AudioNode {
  const gain = ctx.createGain();
  gain.gain.value = peak > 0 ? 1 / peak : 1;
  source.connect(gain);
  return gain;
}

function addFadeIn(ctx: OfflineAudioContext, source: AudioNode, duration: number): AudioNode {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, 0);
  gain.gain.linearRampToValueAtTime(1, duration);
  source.connect(gain);
  return gain;
}

function addFadeOut(
  ctx: OfflineAudioContext,
  source: AudioNode,
  duration: number,
  totalDuration: number,
): AudioNode {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(1, totalDuration - duration);
  gain.gain.linearRampToValueAtTime(0, totalDuration);
  source.connect(gain);
  return gain;
}

function audioBufferToBlob(audioBuffer: AudioBuffer): Blob {
  const numOfChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16; // 16-bit audio

  let numOfFrames = audioBuffer.length;
  let buffer = new ArrayBuffer(44 + numOfFrames * numOfChannels * 2);
  let view = new DataView(buffer);

  // WAV HEADER
  writeString(view, 0, 'RIFF'); // ChunkID
  view.setUint32(4, 36 + numOfFrames * numOfChannels * 2, true); // ChunkSize
  writeString(view, 8, 'WAVE'); // Format
  writeString(view, 12, 'fmt '); // Subchunk1ID
  view.setUint32(16, 16, true); // Subchunk1Size
  view.setUint16(20, format, true); // AudioFormat
  view.setUint16(22, numOfChannels, true); // NumChannels
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, sampleRate * numOfChannels * 2, true); // ByteRate
  view.setUint16(32, numOfChannels * 2, true); // BlockAlign
  view.setUint16(34, bitDepth, true); // BitsPerSample
  writeString(view, 36, 'data'); // Subchunk2ID
  view.setUint32(40, numOfFrames * numOfChannels * 2, true); // Subchunk2Size

  // PCM Data
  let offset = 44;
  for (let channel = 0; channel < numOfChannels; channel++) {
    let channelData = audioBuffer.getChannelData(channel);
    for (let i = 0; i < numOfFrames; i++) {
      let sample = Math.max(-1, Math.min(1, channelData[i])); // Clamp samples to [-1, 1]
      sample = sample < 0 ? sample * 0x8000 : sample * 0x7fff; // Convert to 16-bit PCM
      view.setInt16(offset, sample, true);
      offset += 2;
    }
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

// Helper function to write strings to DataView
function writeString(view, offset, text) {
  for (let i = 0; i < text.length; i++) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
}

async function processAudio(buffer: AudioBuffer, options: ProcessOptions): Promise<Blob> {
  const ctx = new OfflineAudioContext(buffer.numberOfChannels, buffer.length, buffer.sampleRate);

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  let node: AudioNode = source;
  if (options.normalize) node = normalizeAudio(ctx, source, getPeakValue(buffer));
  if (options.fadeIn) node = addFadeIn(ctx, node, options.fadeIn);
  if (options.fadeOut) node = addFadeOut(ctx, node, options.fadeOut, buffer.duration);

  node.connect(ctx.destination);
  source.start();

  const renderedBuffer = await ctx.startRendering();
  return audioBufferToBlob(renderedBuffer);
}

export async function processAudioFile(file: File, options: ProcessOptions): Promise<Audio> {
  const audioContext = new AudioContext();
  const arrayBuffer = await file.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  const processed = await processAudio(audioBuffer, options);
  return {
    id: -1,
    name: file.name,
    type: file.type,
    data: processed,
    lastModified: Date.now(),
  };
}

export async function storeAudio(config: Audio) {
  config.id = getAudioId();
  await audioStore.add(config);
}

export async function handleAudioUpload(files: File[]) {
  const options: ProcessOptions = {
    normalize: true,
    fadeIn: 0.01,
    fadeOut: 0.01,
  };
  for (const file of files) {
    const processedAudio = await processAudioFile(file, options);
    await storeAudio(processedAudio);
  }
}

async function playAudioAsMusic(audio: Audio) {
  // Create blob URL from stored data
  const blob = new Blob([audio.data], { type: audio.type });
  const audioUrl = URL.createObjectURL(blob);
  let res = await playMusic(audioUrl);
  URL.revokeObjectURL(audioUrl);
  return res;
}

export async function playShuffledAudio() {
  while (true) {
    const music = await audioStore.getAll();
    const shuffledMusic = music.sort(() => Math.random() - 0.5);
    if (shuffledMusic.length === 0) return;
    for (const m of shuffledMusic) {
      let res = await playAudioAsMusic(m);
      if (res === AUDIO_ABORTED) return;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}
