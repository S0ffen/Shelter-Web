import { afterEach, expect, it, vi } from 'vitest';
import { MusicPlayer } from '../src/core/MusicPlayer';
import settings from '../../shared/audio.json';

class Track {
  static all: Track[] = [];
  loop = false;
  preload = '';
  volume = 1;
  paused = true;
  play = vi.fn(async () => { this.paused = false; });
  pause = vi.fn(() => { this.paused = true; });
  removeAttribute = vi.fn();
  load = vi.fn();
  constructor(readonly src: string) { Track.all.push(this); }
}
function setup() {
  Track.all = [];
  vi.stubGlobal('Audio', Track);
  const player = new MusicPlayer();
  return { player, day: Track.all[0], night: Track.all[1] };
}
afterEach(() => vi.unstubAllGlobals());

it('waits for a gesture and smoothly crossfades the supplied day/night tracks', () => {
  const { player, day, night } = setup();
  player.update('day', true, 10);
  expect(day.play).not.toHaveBeenCalled(); expect(day.volume).toBe(0);
  player.unlock(); player.update('day', true, 2);
  expect(day.loop && night.loop).toBe(true);
  expect(day.volume).toBeCloseTo(settings.music.day); expect(night.volume).toBe(0);
  player.update('night', true, 1);
  expect(day.volume).toBeCloseTo(settings.music.day / 2);
  expect(night.volume).toBeCloseTo(settings.music.night / 2);
  player.update('night', true, 1);
  expect(day.volume).toBe(0); expect(night.volume).toBeCloseTo(settings.music.night);
  // Render frames do not repeatedly restart the tracks.
  const calls = night.play.mock.calls.length;
  player.update('night', true, 10); expect(night.play).toHaveBeenCalledTimes(calls);
  player.dispose();
});

it('fades out and pauses with the run, resumes without resetting, and releases media on disposal', () => {
  const { player, day, night } = setup();
  player.unlock(); player.update('day', true, 2); player.update('day', false, 2);
  expect(day.volume).toBe(0); expect(day.paused && night.paused).toBe(true);
  player.update('day', true, 2); expect(day.paused).toBe(false);
  player.dispose();
  expect(day.paused && night.paused).toBe(true);
  expect(day.removeAttribute).toHaveBeenCalledWith('src');
  const calls = day.play.mock.calls.length;
  player.unlock(); player.update('day', true, 2);
  expect(day.play).toHaveBeenCalledTimes(calls);
});

it('handles an unavailable track without breaking gameplay', async () => {
  const { player, day } = setup();
  day.play.mockRejectedValue(new Error('Media unavailable'));
  expect(() => { player.unlock(); player.update('day', true, 1); }).not.toThrow();
  await Promise.resolve(); player.dispose();
});
