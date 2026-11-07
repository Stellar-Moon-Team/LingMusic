import { ref } from "vue";

/**
 * 全局唯一的音频引擎：一个 <audio> + 一张 Web Audio 图（source → analyser → 扬声器）。
 *
 * AudioContext 只能在用户手势之后启动，所以图是在第一次 play() 时才搭的；
 * createMediaElementSource 对同一个元素只能调用一次，因此元素与图都做成单例。
 */
const audio = new Audio();
audio.preload = "auto";
audio.crossOrigin = "anonymous";

const playing = ref(false);
const currentTime = ref(0);
const duration = ref(0);
const volume = ref(0.85);
const ready = ref(false);

let ctx: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let endedHandler: (() => void) | null = null;

audio.volume = volume.value;
if (import.meta.env.DEV) (window as unknown as { __ostAudio: HTMLAudioElement }).__ostAudio = audio;
audio.addEventListener("play", () => (playing.value = true));
audio.addEventListener("pause", () => (playing.value = false));
audio.addEventListener("timeupdate", () => (currentTime.value = audio.currentTime));
audio.addEventListener("loadedmetadata", () => {
  duration.value = Number.isFinite(audio.duration) ? audio.duration : 0;
  ready.value = true;
});
audio.addEventListener("ended", () => endedHandler?.());

let currentSrc = "";

function ensureGraph() {
  if (!ctx) {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    ctx = new Ctor();
    analyser = ctx.createAnalyser();
    // 4096 点：低频分辨率约 10.8Hz，铺 96 条对数频带时低频也不至于挤在同一个频点上
    analyser.fftSize = 4096;
    analyser.smoothingTimeConstant = 0.82;
    analyser.minDecibels = -95;
    analyser.maxDecibels = -25;
    const source = ctx.createMediaElementSource(audio);
    source.connect(analyser);
    analyser.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
}

export function useAudioEngine() {
  const load = (src: string, autoplay = false) => {
    if (src !== currentSrc) {
      currentSrc = src;
      ready.value = false;
      duration.value = 0;
      currentTime.value = 0;
      audio.pause();
      audio.src = src;
      audio.load();
    }
    if (autoplay) void play();
  };

  const play = async () => {
    // 先在用户手势里把 AudioContext 建好，再等音频就绪
    ensureGraph();
    try {
      await audio.play();
    } catch (e) {
      console.warn("[ost] 播放失败：", e);
    }
  };

  const pause = () => audio.pause();
  const toggle = () => (audio.paused ? play() : pause());

  const seek = (t: number) => {
    if (!Number.isFinite(t)) return;
    audio.currentTime = Math.max(0, Math.min(t, duration.value || t));
    currentTime.value = audio.currentTime;
  };

  const setVolume = (v: number) => {
    volume.value = Math.max(0, Math.min(1, v));
    audio.volume = volume.value;
  };

  const onEnded = (fn: () => void) => (endedHandler = fn);

  /** 分析节点；上下文没在跑（未播放过 / 被挂起）时返回 null，绘制侧据此走静息动画 */
  const getAnalyser = (): AnalyserNode | null =>
    ctx && ctx.state === "running" && !audio.paused ? analyser : null;

  const sampleRate = () => ctx?.sampleRate ?? 44100;

  /** 平滑的播放时间（timeupdate 只有约 4Hz，进度条与倒计时用这个） */
  const preciseTime = () => audio.currentTime;

  return {
    audio,
    playing,
    currentTime,
    duration,
    volume,
    ready,
    load,
    play,
    pause,
    toggle,
    seek,
    setVolume,
    onEnded,
    getAnalyser,
    sampleRate,
    preciseTime,
  };
}
