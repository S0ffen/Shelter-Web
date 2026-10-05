import type { BuildingKind } from '../building/Building';

export class InputManager {
  private readonly keys = new Set<string>();
  private readonly abort = new AbortController();
  private lookX = 0;
  private lookY = 0;
  onAttack: () => void = () => {};
  onRestart: () => void = () => {};
  onNextNight: () => void = () => {};
  onBuildToggle: () => void = () => {};
  onBuildSelect: (kind: BuildingKind) => void = () => {};
  onBuildRotate: () => void = () => {};
  onBuildCancel: () => void = () => {};
  onLockChange: (locked: boolean) => void = () => {};
  onLockError: () => void = () => {};

  constructor(private readonly canvas: HTMLCanvasElement) {
    const options = { signal: this.abort.signal };
    document.addEventListener('keydown', event => {
      if (!this.locked) return;
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyR', 'KeyB', 'KeyQ', 'KeyN', 'Digit1', 'Digit2', 'Digit3', 'Space'].includes(event.code)) event.preventDefault();
      this.keys.add(event.code);
      if (event.code === 'KeyR' && !event.repeat) this.onRestart();
      if (event.code === 'KeyN' && !event.repeat) this.onNextNight();
      if (event.code === 'KeyB' && !event.repeat) this.onBuildToggle();
      if (event.code === 'KeyQ' && !event.repeat) this.onBuildRotate();
      if (!event.repeat) {
        const kinds: Record<string, BuildingKind> = { Digit1: 'storehouse', Digit2: 'arcane-core', Digit3: 'magic-tower' };
        if (kinds[event.code]) this.onBuildSelect(kinds[event.code]);
      }
    }, options);
    document.addEventListener('keyup', event => this.keys.delete(event.code), options);
    document.addEventListener('mousemove', event => {
      if (!this.locked) return;
      this.lookX += event.movementX;
      this.lookY += event.movementY;
    }, options);
    document.addEventListener('mousedown', event => {
      if (this.locked && event.button === 0) this.onAttack();
      if (this.locked && event.button === 2) this.onBuildCancel();
    }, options);
    canvas.addEventListener('contextmenu', event => event.preventDefault(), options);
    document.addEventListener('pointerlockchange', () => {
      this.clear();
      this.onLockChange(this.locked);
    }, options);
    document.addEventListener('pointerlockerror', () => this.onLockError(), options);
    window.addEventListener('blur', () => this.release(), options);
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.release(); }, options);
  }

  get locked(): boolean { return document.pointerLockElement === this.canvas; }
  down(code: string): boolean { return this.locked && this.keys.has(code); }
  consumeLook(): { x: number; y: number } {
    const look = { x: this.lookX, y: this.lookY };
    this.lookX = this.lookY = 0;
    return look;
  }

  requestLock(): void {
    this.canvas.focus();
    const request = this.canvas.requestPointerLock();
    if (request) request.catch(() => this.onLockError());
  }

  release(): void {
    this.clear();
    if (this.locked) document.exitPointerLock();
  }

  clear(): void { this.keys.clear(); this.lookX = this.lookY = 0; }
  dispose(): void { this.release(); this.abort.abort(); }
}
