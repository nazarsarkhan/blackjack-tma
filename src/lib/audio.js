const toneMap = {
  shuffle: [180, 240, 160],
  deal: [520, 660],
  tap: [740],
  win: [440, 554, 740],
  blackjack: [392, 523, 659, 880],
  lose: [330, 240],
  push: [460, 460]
};

function createContext() {
  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextCtor) {
    return null;
  }

  if (!window.__blackjackAudioContext) {
    window.__blackjackAudioContext = new AudioContextCtor();
  }

  return window.__blackjackAudioContext;
}

export async function unlockAudio() {
  const context = createContext();
  if (!context) {
    return;
  }

  if (context.state === "suspended") {
    await context.resume();
  }
}

export async function playSound(type, enabled = true) {
  if (!enabled) {
    return;
  }

  const context = createContext();
  if (!context) {
    return;
  }

  if (context.state === "suspended") {
    await context.resume();
  }

  const frequencies = toneMap[type] ?? toneMap.tap;
  const startAt = context.currentTime + 0.01;

  frequencies.forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = type === "lose" ? "triangle" : "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, startAt + index * 0.08);
    gain.gain.exponentialRampToValueAtTime(0.06, startAt + index * 0.08 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + index * 0.08 + 0.16);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(startAt + index * 0.08);
    oscillator.stop(startAt + index * 0.08 + 0.18);
  });
}
