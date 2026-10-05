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
  root.innerHTML = '<div class="startup-error"><h1>Nie udało się otworzyć ruin.</h1><p>Prototyp wymaga przeglądarki z WebGL i włączoną akceleracją sprzętową. Odśwież stronę lub sprawdź konsolę przeglądarki.</p></div>';
}
