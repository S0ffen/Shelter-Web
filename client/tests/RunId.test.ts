import { afterEach, expect, it, vi } from 'vitest';
import { createRunId } from '../src/domain/RunId';
import { Simulation } from '../src/domain/Simulation';
import { captureRun, parseRun, restoreRun } from '../src/persistence/RunSnapshot';

const randomValues = globalThis.crypto.getRandomValues.bind(globalThis.crypto);
const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
afterEach(() => vi.unstubAllGlobals());

it('uses the native UUID function when available', () => {
  const randomUUID = vi.fn(() => '12345678-1234-4321-8123-123456789abc');
  const getRandomValues = vi.fn();
  vi.stubGlobal('crypto', { randomUUID, getRandomValues });
  expect(createRunId()).toBe('12345678-1234-4321-8123-123456789abc');
  expect(randomUUID).toHaveBeenCalledOnce(); expect(getRandomValues).not.toHaveBeenCalled();
});

it('generates UUID v4 version and variant bits without randomUUID on HTTP origins', () => {
  vi.stubGlobal('crypto', { getRandomValues: (bytes: Uint8Array) => bytes.fill(255) });
  expect(createRunId()).toBe('ffffffff-ffff-4fff-bfff-ffffffffffff');
});

it('starts and resets a run on HTTP LAN origins and preserves its checkpoint identity', () => {
  vi.stubGlobal('crypto', { getRandomValues: randomValues });
  const ids = Array.from({ length: 100 }, createRunId);
  expect(ids.every(id => uuidV4.test(id))).toBe(true); expect(new Set(ids).size).toBe(100);
  const sim = new Simulation({ settings: { dayPatrolCount: 0 } }); sim.start();
  const previous = sim.runId;
  sim.reset(); sim.start();
  expect(sim.runId).toMatch(uuidV4); expect(sim.runId).not.toBe(previous);
  const saved = parseRun(captureRun(sim)); expect(saved).not.toBeNull();
  const restored = new Simulation(); restoreRun(restored, saved!);
  expect(restored.runId).toBe(sim.runId);
});

it('reports a missing random generator instead of misdiagnosing WebGL', () => {
  vi.stubGlobal('crypto', {});
  expect(createRunId).toThrow('This browser cannot generate run identifiers');
});
