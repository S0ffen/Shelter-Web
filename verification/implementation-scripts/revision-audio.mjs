import fs from 'node:fs';
let p='client/src/core/AudioFeedback.ts',s=fs.readFileSync(p,'utf8').replaceAll('\r\n','\n');
s=s.replace('/** Local synthesized sound; initialized only by a player gesture. */','/** Gameplay excerpts for harvesting, synthesized effects and an original quiet musical bed. */');
s=s.replace('  private lastCue =',`  private samples = new Map<SoundCue,AudioBuffer>();
  private musicGain:GainNode|null=null;
  private nextMusic=0;
  private musicBeat=0;
  private disposed=false;
  private voices=new Set<OscillatorNode>();
  private lastCue =`);
s=s.replace('this.master.gain.value = .16','this.master.gain.value = .22');
s=s.replace('this.ambient.start();',`this.ambient.start();
        this.musicGain=this.context.createGain();this.musicGain.gain.value=0;this.musicGain.connect(this.master);
        const context=this.context;
        for(const cue of ['wood','iron'] as const)void fetch(import.meta.env.BASE_URL+'audio/shelter-'+cue+'.wav').then(r=>{if(!r.ok)throw Error('Audio unavailable');return r.arrayBuffer();}).then(data=>context.decodeAudioData(data)).then(buffer=>{if(!this.disposed)this.samples.set(cue,buffer);}).catch(()=>{});`);
s=s.replace('    const duration =',`    const sample=this.samples.get(cue);
    if(sample){const source=context.createBufferSource();source.buffer=sample;const gain=context.createGain();gain.gain.value=.75;source.connect(gain);gain.connect(this.master);source.start(now);source.onended=()=>{source.disconnect();gain.disconnect();};return;}
    const duration =`);
s=s.replace('  update(night:',`  private note(midi:number,start:number,duration:number,volume:number,type:OscillatorType='sine'):void {
    const context=this.context;if(!context||!this.musicGain)return;
    const voice=context.createOscillator(),gain=context.createGain();voice.type=type;voice.frequency.value=440*Math.pow(2,(midi-69)/12);
    gain.gain.setValueAtTime(.0001,start);gain.gain.exponentialRampToValueAtTime(volume,start+.2);gain.gain.exponentialRampToValueAtTime(.0001,start+duration);
    voice.connect(gain);gain.connect(this.musicGain);voice.start(start);voice.stop(start+duration+.05);this.voices.add(voice);
    voice.onended=()=>{voice.disconnect();gain.disconnect();this.voices.delete(voice);};
  }
  update(night:`);
s=s.replace('    this.ambient.frequency.setTargetAtTime',`    const now=this.context.currentTime;
    this.musicGain?.gain.setTargetAtTime(active?(night?.38:.48):0,now,.8);
    if(!active){this.nextMusic=now;return;}
    if(now>=this.nextMusic && this.context.state==='running') {
      const chords=night?[[50,53,57],[46,50,53],[53,56,60],[52,56,59]]:[[57,60,64],[53,57,60],[48,52,55],[52,55,59]];
      const chord=chords[Math.floor(this.musicBeat/4)%4],start=now+.04;
      if(this.musicBeat%4===0)for(const midi of chord)this.note(midi,start,7.8,.14);
      const melody=chord[[0,2,1,2][this.musicBeat%4]]+12;this.note(melody,start,1.8,.10,'triangle');
      if(night&&this.musicBeat%2===0)this.note(chord[0]-12,start,.75,.14);
      this.musicBeat++;this.nextMusic=now+2;
    }
    this.ambient.frequency.setTargetAtTime`);
s=s.replace('dispose(): void { this.ambient?.stop();', 'dispose(): void { this.disposed=true;for(const voice of this.voices)voice.stop();this.voices.clear();this.samples.clear();this.ambient?.stop();');
fs.writeFileSync(p,s);
fs.writeFileSync('client/public/audio/README.md',`# Audio reference\n\nHarvest samples extracted from the user-supplied gameplay:\nhttps://www.youtube.com/watch?v=w5bPBMt6yJ4\nCounter-Strike: Nexon Zombie Shelter Co-op: City of Damned, RockNRoll2brasil.\n\nWood: 00:50.47–00:50.81. Iron: 00:55.81–00:56.15.\nSource excerpt downloaded: 00:20–03:00 (verification/audio-reference).\nMono 44.1 kHz WAV, high-pass, very short fades; pitch unchanged.\nThese are short mixed gameplay excerpts, not clean game-install assets.\nAmbient music in AudioFeedback.ts is an original synthesized 32-second repeating sequence with different day/night voicings. No full music track was extracted.\n`);
