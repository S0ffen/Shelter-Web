import resourceSampleUrl from '../assets/audio/resource-get.wav?url';

export type SoundCue = 'flesh' | 'magic' | 'impact' | 'warning' | 'dawn' | 'repair' | 'resource';
/** Original CSNZ resource acquisition cue and synthesized combat/UI effects. No background audio. */
export class AudioFeedback {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private resourceSample: AudioBuffer | null = null;
  private sampleReady: Promise<void> | null = null;
  private disposed = false;
  private lastCue = new Map<SoundCue, number>();
  async unlock(): Promise<void> {
    if (this.disposed || typeof AudioContext === 'undefined')
      return;
    try {
      if (!this.context) {
        this.context = new AudioContext();
        this.master = this.context.createGain();
        this.master.gain.value = .22;
        this.master.connect(this.context.destination);
        const context = this.context;
        this.sampleReady = fetch(resourceSampleUrl).then(r => {
          if (!r.ok) throw Error('Audio unavailable');
          return r.arrayBuffer();
        }).then(data => context.decodeAudioData(data)).then(buffer => {
          if (!this.disposed) this.resourceSample = buffer;
        }).catch(() => {});
      }
      await Promise.all([this.context.resume(), this.sampleReady]);
    }
    catch { /* Audio is optional; gameplay remains available. */ }
  }
  play(cue: SoundCue): void {
    const context = this.context;
    if (!context || !this.master || context.state !== 'running')
      return;
    const now = context.currentTime;
    if (now - (this.lastCue.get(cue) ?? -1) < .075)
      return;
    this.lastCue.set(cue, now);
    const sample = cue === 'resource' ? this.resourceSample : null;
    if (sample) {
      const source = context.createBufferSource();
      source.buffer = sample;
      const gain = context.createGain();
      gain.gain.value = 1;
      source.connect(gain);
      gain.connect(this.master);
      source.start(now);
      source.onended = () => { source.disconnect(); gain.disconnect(); };
      return;
    }
    // A missing/loading acquisition sample must never be replaced with a different sound.
    if (cue === 'resource')
      return;
    const duration = cue === 'warning' ? .65 : cue === 'dawn' ? .8 : .16;
    const noiseCue = cue === 'flesh';
    const gain = context.createGain();
    gain.connect(this.master);
    gain.gain.setValueAtTime(.001, now);
    gain.gain.exponentialRampToValueAtTime(noiseCue ? .65 : .25, now + .01);
    gain.gain.exponentialRampToValueAtTime(.001, now + duration);
    if (noiseCue) {
      const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate), data = buffer.getChannelData(0);
      for (let i = 0;i < data.length;i++)
        data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      const noise = context.createBufferSource();
      noise.buffer = buffer;
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 800;
      noise.connect(filter);
      filter.connect(gain);
      noise.start(now);
      noise.stop(now + duration);
      noise.onended = () => { noise.disconnect(); filter.disconnect(); gain.disconnect(); };
    }
    const tone = context.createOscillator();
    tone.type = 'sine';
    const frequency = cue === 'magic' ? 740 : cue === 'warning' ? 165 : cue === 'dawn' ? 330 : cue === 'repair' ? 520 : cue === 'impact' ? 440 : 110;
    tone.frequency.setValueAtTime(frequency, now);
    tone.frequency.exponentialRampToValueAtTime(Math.max(40, frequency * (cue === 'dawn' ? 1.5 : .35)), now + duration);
    tone.connect(gain);
    tone.start(now);
    tone.stop(now + duration);
    tone.onended = () => {
      tone.disconnect(); if (!noiseCue)
        gain.disconnect();
    };
  }
  dispose(): void {
    this.disposed = true;
    this.resourceSample = null;
    void this.context?.close();
  }
}
