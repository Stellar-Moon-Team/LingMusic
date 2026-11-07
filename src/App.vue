<template>
  <div ref="rootRef" class="theme-root relative h-full w-full overflow-hidden select-none"
    :style="{ '--c-from': colors.from, '--c-to': colors.to }" :class="{ 'cursor-none': !uiVisible && started }"
    @mousemove="poke" @mousedown="poke">
    <!-- 背景图 + 粒子：铺满整个窗口 -->
    <BackgroundLayer :src="backgroundSrc" :drift="settings.drift" />
    <ParticleLayer :particle="settings.particle" />

    <!-- 1920×1080 舞台：等比缩放居中，任何窗口尺寸下构图都与参考图一致 -->
    <div class="absolute top-1/2 left-1/2 origin-center" :style="{
      width: STAGE_W + 'px',
      height: STAGE_H + 'px',
      transform: `translate(-50%, -50%) scale(${scale})`,
    }">
      <!-- 左上角标识 -->
      <div
        class="font-hand tx-soft absolute top-[26px] left-[44px] text-[58px] leading-none [text-shadow:0_0_2px_rgba(20,24,48,0.9),0_2px_0_rgba(20,24,48,0.85),0_0_18px_rgba(0,0,0,0.45)]">
        LingChat~
      </div>

      <!-- 海报 -->
      <div class="absolute"
        :style="{ left: POSTER.x + 'px', top: POSTER.y + 'px', width: POSTER_W + 'px', height: POSTER.h + 'px' }">
        <PosterCard :src="track.poster" :alt="track.title" :glow="rgba(colors.from, 0.55)"
          :opacity="settings.posterOpacity" />
      </div>

      <!-- 右上角：时间 + 横向示波线 -->
      <div
        class="font-title tx-from absolute text-right text-[34px] leading-none tracking-wider lining-nums tabular-nums [text-shadow:0_2px_14px_rgba(0,0,0,0.55)]"
        :style="{ right: STAGE_W - BOX.wave.x - BOX.wave.w + 'px', top: BOX.wave.y - 46 + 'px' }">
        {{ fmt(currentTime) }}<span class="tx-to ml-2 text-[22px] opacity-60">/ {{ fmt(duration) }}</span>
      </div>
      <canvas v-show="settings.wave" ref="waveCanvas" class="absolute" :style="boxStyle(BOX.wave)"></canvas>

      <!-- 标题 · 专辑 · 作曲 · 标语 -->
      <div class="absolute" :style="{ left: INFO.x + 'px', width: INFO.w + 'px', top: INFO.y + 'px' }">
        <TrackInfo :track="track" :line-index="lineIndex" :accent="colors.from" />
      </div>

      <!-- 标语左下：上下对称频谱 -->
      <canvas v-show="settings.scope" ref="scopeCanvas" class="absolute" :style="boxStyle(BOX.scope)"></canvas>

      <!-- 标语右下：发光 MIDI 音轨 -->
      <canvas v-show="showRoll" ref="rollCanvas" class="absolute" :style="boxStyle(BOX.roll)"></canvas>

      <!-- 底部柱状频谱 -->
      <canvas ref="barsCanvas" class="absolute bottom-0 left-0"
        :style="{ width: STAGE_W + 'px', height: SPEC_H + 'px' }"></canvas>

      <!-- 左右切歌 -->
      <Transition enter-active-class="transition duration-300" leave-active-class="transition duration-500"
        enter-from-class="opacity-0" leave-to-class="opacity-0">
        <div v-if="TRACKS.length > 1 && started && uiVisible">
          <button v-for="side in ([-1, 1] as const)" :key="side"
            class="absolute grid h-[54px] w-[54px] place-items-center rounded-full bg-white/12 text-white/85 ring-1 ring-white/15 backdrop-blur-md transition hover:scale-105 hover:bg-white/22"
            :style="{ left: (side < 0 ? 98 : 1772) + 'px', top: '520px' }" :title="side < 0 ? '上一首' : '下一首'"
            @click="selectTrack(trackIndex + side, true)">
            <Icon :name="side < 0 ? 'chevronLeft' : 'chevronRight'" :size="26" />
          </button>
        </div>
      </Transition>
    </div>

    <!-- 开始遮罩：浏览器要求用户手势后才能出声 -->
    <Transition leave-active-class="transition duration-700" leave-to-class="opacity-0">
      <button v-if="!started"
        class="absolute inset-0 z-30 flex cursor-pointer flex-col items-center justify-center gap-6 bg-black/45 backdrop-blur-[2px]"
        @click="start">
        <span
          class="grid h-24 w-24 place-items-center rounded-full border border-white/40 bg-white/10 text-white shadow-[0_0_60px_rgba(255,255,255,0.18)] backdrop-blur-md transition hover:scale-105">
          <Icon name="play" :size="38" />
        </span>
        <span class="font-serif-cn text-lg tracking-[0.4em] text-white/85">点击开始播放</span>
        <span class="text-xs tracking-widest text-white/45">{{ track.title }} · {{ track.artist }}</span>
      </button>
    </Transition>

    <!-- 底部播放条 -->
    <Transition enter-active-class="transition duration-300 ease-out"
      leave-active-class="transition duration-500 ease-in" enter-from-class="opacity-0 translate-y-4"
      leave-to-class="opacity-0 translate-y-4">
      <div v-if="started && uiVisible" class="absolute bottom-5 left-1/2 z-20 -translate-x-1/2"
        @mouseenter="hovering = true" @mouseleave="hovering = false">
        <TransportBar :playing="playing" :current="currentTime" :duration="duration" :volume="volume"
          :multi="TRACKS.length > 1" :colors="colors" @toggle="toggle" @prev="selectTrack(trackIndex - 1, true)"
          @next="selectTrack(trackIndex + 1, true)" @seek="seek" @volume="setVolume" @hide="hideLock = true"
          @fullscreen="toggleFullscreen" @settings="panelOpen = !panelOpen" />
      </div>
    </Transition>

    <!-- 设置面板 -->
    <Transition enter-active-class="transition duration-300 ease-out"
      leave-active-class="transition duration-200 ease-in" enter-from-class="opacity-0 translate-x-6"
      leave-to-class="opacity-0 translate-x-6">
      <div v-if="panelOpen && !hideLock" class="absolute top-5 right-5 bottom-24 z-40">
        <ControlPanel :settings="settings" :tracks="TRACKS" :track-index="trackIndex" :colors="colors"
          @close="panelOpen = false" @select-track="(i: number) => selectTrack(i, playing)" />
      </div>
    </Transition>

    <!-- 录屏模式提示 -->
    <Transition leave-active-class="transition duration-700" leave-to-class="opacity-0">
      <div v-if="hideHint"
        class="pointer-events-none absolute top-5 left-1/2 z-20 -translate-x-1/2 rounded-full bg-black/50 px-4 py-1.5 text-xs tracking-wider text-white/80 backdrop-blur">
        界面已隐藏 · 按 H 恢复
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import BackgroundLayer from "./components/BackgroundLayer.vue";
import ParticleLayer from "./components/ParticleLayer.vue";
import PosterCard from "./components/PosterCard.vue";
import TrackInfo from "./components/TrackInfo.vue";
import TransportBar from "./components/TransportBar.vue";
import ControlPanel from "./components/ControlPanel.vue";
import Icon from "./components/Icon.vue";
import { TRACKS } from "./data/tracks";
import { BACKGROUNDS } from "./data/backgrounds";
import { CUSTOM_PALETTE, SPECTRUM_PALETTES } from "./data/palettes";
import { defaultsFor, loadStored, saveStored, type ShowSettings } from "./data/settings";
import { useAudioEngine } from "./composables/useAudioEngine";
import { SpectrumEngine, rgba } from "./lib/spectrum";
import { NoteRoll } from "./lib/noteRoll";
import { loadMidi } from "./lib/midi";

// ===== 舞台尺寸 =====
const STAGE_W = 1920;
const STAGE_H = 1080;
// 位置参照布局草图（1920×1080 舞台坐标）
const POSTER = { x: 196, y: 204, h: 676 };
const POSTER_W = Math.round((POSTER.h * 832) / 1216);
/** 右侧信息区：标题块水平居中于此 */
const INFO = { x: 985, w: 815, y: 240 };
type Box = { x: number; y: number; w: number; h: number };
const BOX = {
  wave: { x: 1490, y: 172, w: 310, h: 90 },
  scope: { x: 985, y: 690, w: 370, h: 120 },
  roll: { x: 1430, y: 640, w: 370, h: 220 },
} satisfies Record<string, Box>;
const boxStyle = (b: Box) => ({ left: b.x + "px", top: b.y + "px", width: b.w + "px", height: b.h + "px" });
const SPEC_H = 110;
const SPEC_BARS = 72;

const rootRef = ref<HTMLElement | null>(null);
const barsCanvas = ref<HTMLCanvasElement | null>(null);
const waveCanvas = ref<HTMLCanvasElement | null>(null);
const scopeCanvas = ref<HTMLCanvasElement | null>(null);
const rollCanvas = ref<HTMLCanvasElement | null>(null);

const viewport = reactive({ w: window.innerWidth, h: window.innerHeight });
const scale = computed(() => Math.min(viewport.w / STAGE_W, viewport.h / STAGE_H));
const onResize = () => {
  viewport.w = window.innerWidth;
  viewport.h = window.innerHeight;
};

// ===== 音频 =====
const {
  playing,
  currentTime,
  duration,
  volume,
  load,
  play,
  toggle,
  seek,
  setVolume,
  onEnded,
  getAnalyser,
  sampleRate,
  preciseTime,
} = useAudioEngine();

// ===== 曲目与设置 =====
const stored = loadStored();
const initialIndex = Math.max(0, TRACKS.findIndex((t) => t.id === stored.trackId));
const trackIndex = ref(initialIndex);
const track = computed(() => TRACKS[trackIndex.value]!);

const settingsFor = (i: number): ShowSettings => {
  const t = TRACKS[i]!;
  return { ...defaultsFor(t), ...(stored.perTrack?.[t.id] ?? {}) };
};
const settings = reactive<ShowSettings>(settingsFor(initialIndex));
if (typeof stored.volume === "number") setVolume(stored.volume);

const persist = () => {
  stored.trackId = track.value.id;
  stored.volume = volume.value;
  stored.perTrack = { ...(stored.perTrack ?? {}), [track.value.id]: { ...settings } };
  saveStored(stored);
};
watch(settings, persist, { deep: true });
watch(volume, persist);

const selectTrack = (i: number, autoplay: boolean) => {
  const n = TRACKS.length;
  const next = ((i % n) + n) % n;
  if (next !== trackIndex.value) {
    trackIndex.value = next;
    Object.assign(settings, settingsFor(next));
    persist();
  }
  load(track.value.src, autoplay);
};

onEnded(() => {
  if (TRACKS.length > 1) selectTrack(trackIndex.value + 1, true);
  else {
    seek(0);
    void play();
  }
});

// ===== MIDI 音轨 =====
const roll = new NoteRoll();
const rollReady = ref(false);
watch(
  () => track.value.midi,
  (url) => {
    roll.setData(null);
    rollReady.value = false;
    if (!url) return;
    void loadMidi(url).then((data) => {
      if (track.value.midi !== url) return; // 期间切了歌
      roll.setData(data);
      rollReady.value = roll.hasData;
    });
  },
  { immediate: true },
);
const showRoll = computed(() => settings.roll && rollReady.value);

const fmt = (s: number) => {
  if (!Number.isFinite(s) || s < 0) s = 0;
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
};

const backgroundSrc = computed(
  () => (BACKGROUNDS.find((b) => b.id === settings.background) ?? BACKGROUNDS[0]!).src,
);

const colors = computed(() => {
  if (settings.palette === CUSTOM_PALETTE) return { from: settings.customFrom, to: settings.customTo };
  const p = SPECTRUM_PALETTES.find((x) => x.id === settings.palette) ?? SPECTRUM_PALETTES[0]!;
  return { from: p.from, to: p.to };
});

/** 标语按播放进度均分轮换 */
const lineIndex = computed(() => {
  const n = track.value.lines.length;
  if (n <= 1 || !duration.value) return 0;
  return Math.min(n - 1, Math.floor(currentTime.value / (duration.value / n)));
});

// ===== 开始 / 界面显隐 =====
const started = ref(false);
const panelOpen = ref(false);
const hideLock = ref(false);
const hideHint = ref(false);
const idle = ref(false);
const hovering = ref(false);
let idleTimer = 0;
let hintTimer = 0;

const uiVisible = computed(
  () => !hideLock.value && (!idle.value || panelOpen.value || hovering.value || !playing.value),
);

const poke = () => {
  idle.value = false;
  clearTimeout(idleTimer);
  idleTimer = window.setTimeout(() => (idle.value = true), 2600);
};

let quietHide = false;
watch(hideLock, (v) => {
  clearTimeout(hintTimer);
  hideHint.value = v && !quietHide;
  quietHide = false;
  if (v) hintTimer = window.setTimeout(() => (hideHint.value = false), 1800);
});

const start = () => {
  started.value = true;
  void play();
  poke();
};

const toggleFullscreen = () => {
  if (document.fullscreenElement) void document.exitFullscreen();
  else void document.documentElement.requestFullscreen?.();
};

const onKey = (e: KeyboardEvent) => {
  const tag = (e.target as HTMLElement | null)?.tagName;
  if (tag === "INPUT" && (e.target as HTMLInputElement).type !== "range") return;
  switch (e.key) {
    case " ":
      e.preventDefault();
      if (!started.value) start();
      else void toggle();
      break;
    case "ArrowLeft":
      seek(currentTime.value - 5);
      break;
    case "ArrowRight":
      seek(currentTime.value + 5);
      break;
    case "h":
    case "H":
      hideLock.value = !hideLock.value;
      break;
    case "f":
    case "F":
      toggleFullscreen();
      break;
    case "s":
    case "S":
      if (!hideLock.value) panelOpen.value = !panelOpen.value;
      break;
    case "Escape":
      panelOpen.value = false;
      break;
  }
};

// ===== 每帧：频谱、示波线、低频律动 =====
const engine = new SpectrumEngine(96);
let rafId = 0;

const frame = (now: number) => {
  rafId = requestAnimationFrame(frame);
  if (document.hidden) return;
  engine.update(getAnalyser(), sampleRate(), now);
  const pr = scale.value * Math.min(window.devicePixelRatio || 1, 2);
  engine.drawBars(
    barsCanvas.value,
    {
      style: settings.spectrumStyle,
      w: STAGE_W,
      h: SPEC_H,
      bars: SPEC_BARS,
      gap: 11,
      glow: 8,
      pixelRatio: pr,
    },
    colors.value,
  );
  if (settings.wave) engine.drawWave(waveCanvas.value, BOX.wave.w, BOX.wave.h, pr, colors.value);
  if (settings.scope)
    engine.drawBars(
      scopeCanvas.value,
      {
        style: "scope",
        w: BOX.scope.w,
        h: BOX.scope.h,
        bars: 58,
        gap: 3.4,
        glow: 6,
        pixelRatio: pr,
        smoothPasses: 2,
        ease: 0.24,
        gain: 0.9,
        normalize: true,
        bandRange: 0.82,
      },
      colors.value,
    );
  if (showRoll.value) {
    roll.speed = settings.rollSpeed;
    roll.draw(
      rollCanvas.value,
      BOX.roll.w,
      BOX.roll.h,
      pr,
      colors.value,
      preciseTime() - (track.value.midiOffset ?? 0),
      now,
    );
  }
  const root = rootRef.value;
  if (root) {
    root.style.setProperty("--kick", settings.pulse ? engine.kick.toFixed(3) : "0");
    root.style.setProperty("--bass", settings.pulse ? engine.bass.toFixed(3) : "0");
  }
};

onMounted(() => {
  window.addEventListener("resize", onResize);
  window.addEventListener("keydown", onKey);
  rafId = requestAnimationFrame(frame);
  poke();
  load(track.value.src);
  applyQuery();
});

/**
 * 地址栏参数（录屏 / OBS 浏览器源用）：
 * - ?autoplay  打开即播放（浏览器允许自动播放时生效，否则仍显示开始遮罩）
 * - ?clean     打开即隐藏界面（等同按 H）
 * - ?t=60      从第 60 秒开始
 */
const applyQuery = () => {
  const q = new URLSearchParams(location.search);
  const t = Number(q.get("t"));
  if (t > 0) {
    const jump = () => seek(t);
    if (duration.value) jump();
    else watch(duration, (d) => d && jump(), { once: true });
  }
  if (q.has("clean")) {
    quietHide = true;
    hideLock.value = true;
  }
  if (q.has("autoplay")) {
    void play().then(() => {
      if (playing.value) started.value = true;
    });
  }
};

onBeforeUnmount(() => {
  window.removeEventListener("resize", onResize);
  window.removeEventListener("keydown", onKey);
  cancelAnimationFrame(rafId);
  clearTimeout(idleTimer);
  clearTimeout(hintTimer);
});
</script>
