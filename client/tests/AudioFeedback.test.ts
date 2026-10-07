import { afterEach, expect, it, vi } from 'vitest';
import { AudioFeedback } from '../src/core/AudioFeedback';

const recordedBuffer = {} as AudioBuffer;
class AudioContextFixture {
  static latest: AudioContextFixture;
  state = 'running';
  currentTime = 1;
  destination = {};
  createGain = vi.fn(() => ({ gain: { value: 0 }, connect: vi.fn(), disconnect: vi.fn() }));
  createOscillator = vi.fn();
  createBufferSource = vi.fn(() => ({ buffer: null as AudioBuffer | null, connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), onended: null as (() => void) | null }));
  decodeAudioData = vi.fn(async () => recordedBuffer);
  resume = vi.fn(async () => {});
  close = vi.fn(async () => {});
  constructor() { AudioContextFixture.latest = this; }
}
function audioWithResponse(ok = true) {
  vi.stubGlobal('AudioContext', AudioContextFixture);
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok, arrayBuffer: async () => new ArrayBuffer(8) })));
  return new AudioFeedback();
}
afterEach(() => vi.unstubAllGlobals());

it('keeps idle gameplay silent after audio is unlocked', async () => {
  const audio = audioWithResponse();
  await audio.unlock();
  expect(AudioContextFixture.latest.createOscillator).not.toHaveBeenCalled();
  expect(AudioContextFixture.latest.createBufferSource).not.toHaveBeenCalled();
  audio.dispose();
});

it('plays the original resource reward as a one-shot without background or synthesized sound', async () => {
  const audio = audioWithResponse();
  await audio.unlock();
  audio.play('resource');
  const context = AudioContextFixture.latest;
  expect(context.createBufferSource).toHaveBeenCalledTimes(1);
  for (const source of context.createBufferSource.mock.results) {
    expect(source.value.buffer).toBe(recordedBuffer);
    expect(source.value.start).toHaveBeenCalledTimes(1);
  }
  expect(context.createOscillator).not.toHaveBeenCalled();
  audio.dispose();
});

it('never substitutes a procedural reward sound while loading or after an asset failure', async () => {
  const audio = audioWithResponse(false);
  const ready = audio.unlock();
  audio.play('resource');
  await ready;
  AudioContextFixture.latest.currentTime += 1;
  audio.play('resource');
  expect(AudioContextFixture.latest.createBufferSource).not.toHaveBeenCalled();
  expect(AudioContextFixture.latest.createOscillator).not.toHaveBeenCalled();
  audio.dispose();
});

it('does not revive audio when an asset finishes loading after disposal', async () => {
  const audio = audioWithResponse();
  const ready = audio.unlock();
  const context = AudioContextFixture.latest;
  audio.dispose();
  await ready;
  audio.play('resource');
  await audio.unlock();
  expect(context.createBufferSource).not.toHaveBeenCalled();
  expect(context.close).toHaveBeenCalledTimes(1);
  expect(context.resume).toHaveBeenCalledTimes(1);
});
