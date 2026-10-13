import settings from '../../../shared/audio.json';

type Period = 'day' | 'night';

/** Stream long soundtracks; keep effects on their separate Web Audio mixer. */
export class MusicPlayer {
  private readonly tracks = {
    day: new Audio('/music/deuslower-fantasy-medieval-ambient-237371.mp3'),
    night: new Audio('/music/nastelbom-dark-epic-487720.mp3'),
  };
  private unlocked = false;
  private disposed = false;
  private active = false;

  constructor() {
    for (const track of Object.values(this.tracks)) {
      track.loop = true;
      track.preload = 'metadata';
      track.volume = 0;
    }
  }

  unlock(): void {
    if (this.disposed) return;
    this.unlocked = true;
    // Start both muted within the user's gesture so the night transition can play later.
    for (const track of Object.values(this.tracks)) void track.play().catch(() => {});
  }

  update(period: Period, playing: boolean, dt: number): void {
    if (!this.unlocked || this.disposed) return;
    if (playing && !this.active) {
      for (const track of Object.values(this.tracks)) void track.play().catch(() => {});
    }
    this.active = playing;
    const step = Math.max(0, dt) / settings.crossfadeSeconds;
    for (const key of ['day', 'night'] as const) {
      const track = this.tracks[key];
      const target = playing && key === period ? settings.music[key] : 0;
      track.volume = Math.min(1, Math.max(0, track.volume + Math.sign(target - track.volume) * Math.min(Math.abs(target - track.volume), step * settings.music[key])));
      if (!playing && track.volume === 0 && !track.paused) track.pause();
    }
  }

  dispose(): void {
    this.disposed = true;
    for (const track of Object.values(this.tracks)) {
      track.pause();
      track.removeAttribute('src');
      track.load();
    }
  }
}
