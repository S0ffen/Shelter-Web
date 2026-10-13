import './style.css';
import { Game } from './core/Game';

const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas')!;
const root = document.querySelector<HTMLElement>('#app')!;

try {
  const game = new Game(canvas, root);
  window.addEventListener('pagehide', () => game.dispose(), { once: true });
  if (import.meta.hot) import.meta.hot.dispose(() => game.dispose());
} catch (error) {
  console.error('Unable to start Fantasy Shelter:', error);
  root.innerHTML = '<div class="startup-error"><h1>Unable to enter the ruins.</h1><p>This prototype requires WebGL and hardware acceleration. Refresh the page or check the browser console.</p></div>';
}
