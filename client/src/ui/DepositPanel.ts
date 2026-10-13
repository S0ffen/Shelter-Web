import type { Simulation } from '../domain/Simulation';
import type { ResourceCounts } from '../domain/types';

/** Warehouse/individual panels and +1/+5 transfers follow CSNZ's WarehouseDlg.res. */
export class DepositPanel {
  readonly element: HTMLElement;
  open = false;
  onClose: () => void = () => {};
  onTransfer: () => void = () => {};
  private sim: Simulation | null = null;
  constructor(root: HTMLElement) {
    this.element = document.createElement('section');
    this.element.className = 'deposit-overlay';
    this.element.hidden = true;
    this.element.setAttribute('role', 'dialog');
    this.element.setAttribute('aria-modal', 'true');
    this.element.setAttribute('aria-label', 'Shelter storage');
    this.element.innerHTML = `<div class="deposit-card"><header><div><small>DEPOSIT</small><h2>Shelter storage</h2></div><button data-close aria-label="Close storage">✕</button></header>
      ${(['deposit', 'withdraw'] as const).map(direction => `<section class="deposit-inventory"><h3>${direction === 'deposit' ? 'SHELTER · SHARED STORAGE' : 'BACKPACK · CARRIED'}</h3>${(['wood', 'iron'] as const).map(kind => `<div class="deposit-row"><span>${kind === 'wood' ? 'Wood' : 'Iron'}</span><strong data-count="${direction}-${kind}"></strong><div>${[1, 5].map(amount => `<button data-direction="${direction}" data-kind="${kind}" data-amount="${amount}" aria-label="${direction === 'deposit' ? 'Deposit' : 'Withdraw'} ${amount} ${kind === 'wood' ? 'Wood' : 'Iron'}">+${amount}</button>`).join('')}</div></div>`).join('')}<p>${direction === 'deposit' ? '↑ Deposit materials from your backpack' : '↓ Withdraw materials into your backpack'}</p></section>`).join('')}
      <form class="deposit-choice"><h3>CHOOSE AMOUNT</h3><div>${(['wood', 'iron'] as const).map(kind => `<label>${kind === 'wood' ? 'Wood' : 'Iron'}<input name="${kind}" type="number" min="0" step="1" value="0" required></label>`).join('')}</div><nav><button type="button" data-direction="deposit" data-custom>Deposit selected</button><button type="button" data-direction="withdraw" data-custom>Withdraw selected</button></nav></form>
      <button class="deposit-all" data-direction="deposit" data-all>Deposit all</button><p class="deposit-result" role="status" aria-live="polite"></p><footer>Building uses your backpack first, then Shelter storage.<br>Escape / E · return to game</footer></div>`;
    root.appendChild(this.element);
    this.element.addEventListener('click', event => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
      if (!button || button.disabled || !this.sim) return;
      if (button.hasAttribute('data-close')) { this.onClose(); return; }
      const amount = { wood: 0, iron: 0 };
      if (button.hasAttribute('data-all')) Object.assign(amount, this.sim.carried);
      else if (button.hasAttribute('data-custom')) {
        const form = this.element.querySelector<HTMLFormElement>('form')!;
        if (!form.reportValidity()) return;
        for (const kind of ['wood', 'iron'] as const) amount[kind] = this.element.querySelector<HTMLInputElement>(`input[name="${kind}"]`)!.valueAsNumber;
      } else if (button.dataset.kind === 'wood' || button.dataset.kind === 'iron') amount[button.dataset.kind] = Number(button.dataset.amount);
      else return;
      this.transfer(button.dataset.direction === 'withdraw', amount);
    });
    this.element.querySelector('form')!.addEventListener('submit', event => { event.preventDefault(); this.element.querySelector<HTMLButtonElement>('[data-custom][data-direction="deposit"]')!.click(); });
    this.element.addEventListener('keydown', event => {
      if (event.code === 'Escape' || event.code === 'KeyE') { event.preventDefault(); this.onClose(); }
      if (event.code === 'KeyN') event.preventDefault();
      if (event.key === 'Tab') {
        const targets = [...this.element.querySelectorAll<HTMLElement>('button:not(:disabled), input')];
        const first = targets[0], last = targets.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    });
  }
  show(sim: Simulation): void {
    if (!sim.canUseDeposit()) return;
    this.sim = sim; this.open = true; this.element.hidden = false;
    this.element.querySelector<HTMLElement>('.deposit-result')!.textContent = 'Choose the transfer direction and amount.';
    for (const input of this.element.querySelectorAll<HTMLInputElement>('input')) input.value = '0';
    this.update(sim); this.element.querySelector<HTMLButtonElement>('[data-close]')!.focus();
  }
  hide(): void { this.open = false; this.element.hidden = true; }
  update(sim: Simulation): void {
    if (!this.open) return;
    for (const kind of ['wood', 'iron'] as const) {
      this.element.querySelector<HTMLElement>(`[data-count="deposit-${kind}"]`)!.textContent = `${sim.resources[kind]} / ${sim.resourceManager.capacity[kind]}`;
      this.element.querySelector<HTMLElement>(`[data-count="withdraw-${kind}"]`)!.textContent = `${sim.carried[kind]} / ${sim.carriedManager.capacity[kind]}`;
    }
    for (const button of this.element.querySelectorAll<HTMLButtonElement>('[data-direction]')) {
      const withdrawing = button.dataset.direction === 'withdraw';
      const source = withdrawing ? sim.resources : sim.carried, target = withdrawing ? sim.carriedManager : sim.resourceManager;
      const kinds = button.dataset.kind ? [button.dataset.kind as keyof ResourceCounts] : ['wood', 'iron'] as const;
      button.disabled = !sim.canUseDeposit() || !kinds.some(kind => source[kind] > 0 && target.counts[kind] < target.capacity[kind]);
    }
  }
  private transfer(withdraw: boolean, requested: ResourceCounts): void {
    if (!this.sim) return;
    const actual = withdraw ? this.sim.withdrawResources(requested) : this.sim.depositResources(requested);
    this.element.querySelector<HTMLElement>('.deposit-result')!.textContent = actual.wood || actual.iron
      ? `${withdraw ? 'Withdrawn' : 'Deposited'} ${actual.wood} Wood · ${actual.iron} Iron` : 'No materials or available space.';
    this.update(this.sim);
    if (actual.wood || actual.iron) this.onTransfer();
  }
}
