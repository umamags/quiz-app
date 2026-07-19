let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    audioCtx = new Ctx();
  }
  return audioCtx;
}

// Chrome creates a new AudioContext suspended, and its currentTime stays
// frozen at 0 until resume() actually completes. Scheduling tones before
// that finishes is the classic "first click makes no sound" bug, so we
// await it here before reading currentTime.
async function ensureAudioRunning() {
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') {
    try { await ctx.resume(); } catch (e) { /* ignore */ }
  }
  return ctx;
}

function playTone(ctx, freq, startTime, duration, type, gainPeak) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, startTime);
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(gainPeak, startTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.02);
}

export async function playHappySound() {
  const ctx = await ensureAudioRunning();
  const now = ctx.currentTime;
  playTone(ctx, 523.25, now, 0.12, 'triangle', 0.2);        // C5
  playTone(ctx, 659.25, now + 0.1, 0.12, 'triangle', 0.2);  // E5
  playTone(ctx, 783.99, now + 0.2, 0.22, 'triangle', 0.22); // G5
}

export async function playUhOhSound() {
  const ctx = await ensureAudioRunning();
  const now = ctx.currentTime;
  playTone(ctx, 311.13, now, 0.18, 'sawtooth', 0.18);        // Eb4
  playTone(ctx, 233.08, now + 0.16, 0.28, 'sawtooth', 0.18); // Bb3
}
