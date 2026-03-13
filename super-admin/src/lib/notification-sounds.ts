let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioContext;
}

function playTone(frequency: number, duration: number, type: OscillatorType = 'sine', volume = 0.3) {
  const ctx = getAudioContext();
  if (!ctx) return;

  // Resume context if suspended (browser autoplay policy)
  if (ctx.state === 'suspended') {
    ctx.resume();
  }

  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);

  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

  oscillator.connect(gain);
  gain.connect(ctx.destination);

  oscillator.start(ctx.currentTime);
  oscillator.stop(ctx.currentTime + duration);
}

/** Short two-tone chime for regular notifications */
export function playNotificationSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume();

  // First tone
  playTone(880, 0.15, 'sine', 0.2);

  // Second tone (higher) after short delay
  setTimeout(() => {
    playTone(1174.66, 0.2, 'sine', 0.15);
  }, 120);
}

/** Urgent repeating alarm for callouts */
export function playCalloutSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume();

  const pattern = [
    { freq: 784, delay: 0 },
    { freq: 1046.5, delay: 150 },
    { freq: 784, delay: 350 },
    { freq: 1046.5, delay: 500 },
    { freq: 1318.5, delay: 700 },
  ];

  for (const { freq, delay } of pattern) {
    setTimeout(() => playTone(freq, 0.2, 'sine', 0.25), delay);
  }
}

/** Soft pop sound for incoming chat messages */
export function playChatMessageSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume();

  // Short bubbly pop
  playTone(660, 0.08, 'sine', 0.2);
  setTimeout(() => playTone(880, 0.1, 'sine', 0.15), 70);
}

/** Soft confirmation sound for callout responses */
export function playCalloutResponseSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume();

  playTone(523.25, 0.1, 'sine', 0.15);
  setTimeout(() => playTone(659.25, 0.1, 'sine', 0.15), 100);
  setTimeout(() => playTone(783.99, 0.2, 'sine', 0.12), 200);
}
