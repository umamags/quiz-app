import '@testing-library/jest-dom/vitest';

// jsdom has no AudioContext; the app already no-ops on playback errors, so a
// minimal stub is enough to let sound-triggering code paths run in tests.
class StubAudioContext {
  constructor() { this.state = 'running'; this.currentTime = 0; this.destination = {}; }
  createOscillator() {
    return { type: '', frequency: { setValueAtTime() {} }, connect() {}, start() {}, stop() {} };
  }
  createGain() {
    return {
      gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} },
      connect() {},
    };
  }
  resume() { return Promise.resolve(); }
}
window.AudioContext = StubAudioContext;
