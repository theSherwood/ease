import { playMusic } from './audioPlayer';
import { audioStore, getAudioId } from './storage';
import { Audio, AUDIO_ABORTED } from './types';

export type ProcessOptions = {
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
  const bitDepth = 16;

  let numOfFrames = audioBuffer.length;
  let buffer = new ArrayBuffer(44 + numOfFrames * numOfChannels * 2);
  let view = new DataView(buffer);

  // WAV HEADER (unchanged)
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + numOfFrames * numOfChannels * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numOfChannels * 2, true);
  view.setUint16(32, numOfChannels * 2, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, 'data');
  view.setUint32(40, numOfFrames * numOfChannels * 2, true);

  // PCM Data - Properly interleaved
  let offset = 44;
  const channels: Float32Array[] = [];
  for (let i = 0; i < numOfChannels; i++) {
    channels[i] = audioBuffer.getChannelData(i);
  }

  // Write interleaved data
  for (let i = 0; i < numOfFrames; i++) {
    for (let channel = 0; channel < numOfChannels; channel++) {
      let sample = Math.max(-1, Math.min(1, channels[channel][i]));
      sample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
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

export function uploadAudioFiles(callback: (files: File[]) => void) {
  return async (event: Event) => {
    event.preventDefault();
    let files: File[] = [];
    if (event instanceof DragEvent && event.dataTransfer) {
      files = await extractAudioFiles(event.dataTransfer.items);
    } else if (event.target instanceof HTMLInputElement && event.target.files) {
      files = await extractAudioFiles(event.target.files);
    }
    console.log('files', files);
    return callback(files);
  };
}

function isAudioFile(file: File): boolean {
  return file.name.endsWith('.mp3') || file.name.endsWith('.wav');
}

async function extractAudioFiles(items: DataTransferItemList | FileList): Promise<File[]> {
  let audioFiles: File[] = [];
  if (items instanceof DataTransferItemList) {
    for (const item of items) {
      if (item.kind === 'file') {
        const entry = item.webkitGetAsEntry();
        if (entry) await traverseFileTree(entry, audioFiles);
      }
    }
  } else if (items instanceof FileList) {
    for (const item of items) {
      if (isAudioFile(item)) audioFiles.push(item);
    }
  }
  return audioFiles;
}

async function traverseFileTree(entry: FileSystemEntry, files: File[]) {
  if (entry.isFile) {
    const file = await getFile(entry as FileSystemFileEntry);
    if (isAudioFile(file)) {
      files.push(file);
    }
  } else if (entry.isDirectory) {
    const reader = (entry as FileSystemDirectoryEntry).createReader();
    let entries = await readEntries(reader);
    for (const subEntry of entries) {
      await traverseFileTree(subEntry, files);
    }
  }
}

function getFile(entry: FileSystemFileEntry): Promise<File> {
  return new Promise((resolve) => entry.file(resolve));
}

function readEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  return new Promise((resolve) => reader.readEntries(resolve));
}
