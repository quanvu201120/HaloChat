let audioContext: AudioContext | null = null;
let toneTimer: ReturnType<typeof setInterval> | null = null;

function getAudioContext() {
  const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return null;

  audioContext = audioContext || new AudioContextClass();
  return audioContext;
}

export function unlockCallTone() {
  void getAudioContext()?.resume().catch(() => {});
}

function playToneNote(frequency: number, startDelay: number, duration: number, volume = 0.08) {
  const context = getAudioContext();
  if (!context) return;

  void context.resume().then(() => {
    const startAt = context.currentTime + startDelay;
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, startAt);
    gain.gain.setValueAtTime(0.001, startAt);
    gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, startAt + duration);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(startAt);
    oscillator.stop(startAt + duration + 0.03);
  }).catch(() => {});
}

function playCallChime(frequency: number, startDelay: number, duration: number, volume = 0.075) {
  playToneNote(frequency, startDelay, duration, volume);
  playToneNote(frequency * 1.5, startDelay + 0.01, duration * 0.75, volume * 0.32);
}

export function stopCallTone() {
  if (toneTimer) {
    clearInterval(toneTimer);
    toneTimer = null;
  }
  navigator.vibrate?.(0);
}

export function startCallTone(mode: 'incoming' | 'outgoing') {
  stopCallTone();

  const playPattern = () => {
    if (mode === 'incoming') {
      playCallChime(784, 0, 0.16, 0.085);
      playCallChime(1175, 0.18, 0.18, 0.078);
      playCallChime(988, 0.46, 0.16, 0.072);
      playCallChime(1175, 0.64, 0.2, 0.07);
      navigator.vibrate?.([180, 80, 180]);
      return;
    }

    playCallChime(523, 0, 0.14, 0.055);
    playCallChime(659, 0.2, 0.14, 0.05);
  };

  playPattern();
  toneTimer = setInterval(playPattern, mode === 'incoming' ? 1450 : 1800);
}
