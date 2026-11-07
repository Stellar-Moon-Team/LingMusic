<template>
  <aside
    class="flex h-full w-[368px] flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0c0e1a]/70 text-white shadow-[0_20px_60px_rgba(0,0,0,0.55)] backdrop-blur-2xl"
  >
    <header class="flex items-center justify-between px-5 pt-5 pb-3">
      <div>
        <div class="text-[15px] font-semibold tracking-wide">展示设置</div>
        <div class="mt-0.5 text-xs text-white/45">每首曲子单独记忆</div>
      </div>
      <button
        class="grid h-8 w-8 place-items-center rounded-full text-white/60 transition hover:bg-white/10 hover:text-white"
        title="关闭 (S)"
        @click="$emit('close')"
      >
        <Icon name="close" :size="18" />
      </button>
    </header>

    <div class="flex-1 space-y-6 overflow-y-auto px-5 pb-6 [scrollbar-width:thin]">
      <!-- 曲目 -->
      <section>
        <h3 class="label">曲目</h3>
        <ul class="space-y-1.5">
          <li v-for="(t, i) in tracks" :key="t.id">
            <button
              class="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition"
              :class="i === trackIndex ? 'bg-white/12' : 'hover:bg-white/6'"
              @click="$emit('select-track', i)"
            >
              <img :src="t.poster" alt="" class="h-11 w-8 rounded-md object-cover" />
              <div class="min-w-0 flex-1">
                <div class="truncate text-sm font-medium">{{ t.title }}</div>
                <div class="truncate text-xs text-white/50">{{ t.artist }} · {{ t.album }}</div>
              </div>
              <span
                v-if="i === trackIndex"
                class="h-2 w-2 rounded-full"
                :style="{ background: colors.from, boxShadow: `0 0 8px ${colors.from}` }"
              ></span>
            </button>
          </li>
        </ul>
      </section>

      <!-- 背景 -->
      <section>
        <h3 class="label">背景</h3>
        <div class="grid grid-cols-3 gap-2">
          <button
            v-for="bg in backgrounds"
            :key="bg.id"
            class="relative aspect-video overflow-hidden rounded-lg ring-2 transition"
            :class="settings.background === bg.id ? 'ring-white' : 'ring-transparent hover:ring-white/30'"
            :title="bg.label"
            @click="settings.background = bg.id"
          >
            <img :src="bg.src" alt="" class="h-full w-full object-cover" loading="lazy" />
            <span
              class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-1.5 pt-3 pb-0.5 text-[11px]"
              >{{ bg.label }}</span
            >
          </button>
        </div>
      </section>

      <!-- 海报 -->
      <section>
        <h3 class="label">海报</h3>
        <label class="flex items-center gap-3 px-1 text-sm text-white/80">
          <span class="shrink-0">不透明度</span>
          <input
            v-model.number="settings.posterOpacity"
            class="seek flex-1"
            type="range"
            min="0.2"
            max="1"
            step="0.05"
            aria-label="海报不透明度"
            :style="{
              '--from': colors.from,
              '--to': colors.to,
              '--p': ((settings.posterOpacity - 0.2) / 0.8) * 100 + '%',
            }"
          />
          <span class="w-10 text-right text-xs text-white/60 tabular-nums">
            {{ Math.round(settings.posterOpacity * 100) }}%
          </span>
        </label>
      </section>

      <!-- 粒子 -->
      <section>
        <h3 class="label">背景粒子</h3>
        <div v-for="group in groups" :key="group" class="mb-2">
          <div class="mb-1.5 text-[11px] text-white/35">{{ group }}</div>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="p in particles.filter((x) => x.group === group)"
              :key="p.key"
              class="chip"
              :class="settings.particle === p.key ? 'chip-on' : ''"
              @click="settings.particle = p.key"
            >
              {{ p.label }}
            </button>
          </div>
        </div>
      </section>

      <!-- 频谱主题 -->
      <section>
        <h3 class="label">频谱主题</h3>
        <div class="grid grid-cols-2 gap-1.5">
          <button
            v-for="pal in palettes"
            :key="pal.id"
            class="pal"
            :class="settings.palette === pal.id ? 'pal-on' : ''"
            @click="settings.palette = pal.id"
          >
            <span
              class="h-4 w-4 shrink-0 rounded-full ring-1 ring-white/20"
              :style="{ background: `linear-gradient(135deg, ${pal.from}, ${pal.to})` }"
            ></span>
            {{ pal.label }}
          </button>
          <button
            class="pal"
            :class="settings.palette === 'custom' ? 'pal-on' : ''"
            @click="settings.palette = 'custom'"
          >
            <span
              class="h-4 w-4 shrink-0 rounded-full ring-1 ring-white/20"
              :style="{ background: `linear-gradient(135deg, ${settings.customFrom}, ${settings.customTo})` }"
            ></span>
            自定义
          </button>
        </div>
        <div v-if="settings.palette === 'custom'" class="mt-2 flex items-center gap-4 text-xs text-white/60">
          <label class="flex items-center gap-1.5">
            起始 <input v-model="settings.customFrom" type="color" class="swatch" />
          </label>
          <label class="flex items-center gap-1.5">
            结束 <input v-model="settings.customTo" type="color" class="swatch" />
          </label>
        </div>
      </section>

      <!-- 频谱样式 -->
      <section>
        <h3 class="label">底部频谱样式</h3>
        <div class="grid grid-cols-3 gap-1 rounded-xl bg-white/6 p-1">
          <button
            v-for="s in styles"
            :key="s.id"
            class="rounded-lg py-1.5 text-xs transition"
            :class="
              settings.spectrumStyle === s.id
                ? 'bg-white font-semibold text-[#0b0d18]'
                : 'text-white/70 hover:text-white'
            "
            :title="s.hint"
            @click="settings.spectrumStyle = s.id"
          >
            {{ s.label }}
          </button>
        </div>
      </section>

      <!-- MIDI 音轨 -->
      <section>
        <h3 class="label">MIDI 音轨</h3>
        <label class="flex items-center gap-3 px-1 text-sm text-white/80">
          <span class="shrink-0">流速</span>
          <!-- 对数刻度：中点为 1×，左右各跨一个数量级 -->
          <input
            v-model.number="rollSpeedLog"
            class="seek flex-1"
            type="range"
            min="-1"
            max="1"
            step="0.01"
            aria-label="MIDI 音轨流速"
            title="双击恢复 1×"
            :style="{
              '--from': colors.from,
              '--to': colors.to,
              '--p': ((rollSpeedLog + 1) / 2) * 100 + '%',
            }"
            @dblclick="settings.rollSpeed = 1"
          />
          <span class="w-12 text-right text-xs text-white/60 tabular-nums">
            ×{{ settings.rollSpeed.toFixed(settings.rollSpeed < 1 ? 2 : 1) }}
          </span>
        </label>
      </section>

      <!-- 动效 -->
      <section>
        <h3 class="label">动效</h3>
        <div class="space-y-1">
          <label v-for="opt in toggles" :key="opt.key" class="toggle-row">
            <span>{{ opt.label }}</span>
            <input v-model="settings[opt.key]" type="checkbox" class="sr-only" />
            <span class="switch" :style="settings[opt.key] ? { background: colors.from } : {}">
              <span class="knob" :class="settings[opt.key] ? 'translate-x-4 bg-[#0b0d18]' : 'bg-white'"></span>
            </span>
          </label>
        </div>
      </section>

      <section>
        <h3 class="label">快捷键</h3>
        <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs text-white/55">
          <template v-for="k in keys" :key="k[0]">
            <dt>
              <kbd class="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[11px] text-white/80">{{
                k[0]
              }}</kbd>
            </dt>
            <dd>{{ k[1] }}</dd>
          </template>
        </dl>
      </section>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed } from "vue";
import Icon from "./Icon.vue";
import { BACKGROUNDS } from "../data/backgrounds";
import { PARTICLES } from "../data/particles";
import { SPECTRUM_PALETTES, SPECTRUM_STYLES } from "../data/palettes";
import type { ShowSettings } from "../data/settings";
import type { Track } from "../data/tracks";

const props = defineProps<{
  settings: ShowSettings;
  tracks: Track[];
  trackIndex: number;
  colors: { from: string; to: string };
}>();
defineEmits<{ close: []; "select-track": [i: number] }>();

const backgrounds = BACKGROUNDS;
const particles = PARTICLES;
const palettes = SPECTRUM_PALETTES;
const styles = SPECTRUM_STYLES;
const groups = ["氛围", "天气"] as const;

/** MIDI 流速 0.1×~10×，滑块按 log10 线性移动 */
const rollSpeedLog = computed({
  get: () => Math.log10(Math.min(10, Math.max(0.1, props.settings.rollSpeed || 1))),
  set: (v: number) => {
    const s = 10 ** v;
    // eslint-disable-next-line vue/no-mutating-props -- settings 是 App 传入的 reactive 对象，面板本就直接改它
    props.settings.rollSpeed = Number(s.toFixed(s < 1 ? 2 : 1));
  },
});

const toggles: { key: "pulse" | "wave" | "scope" | "roll" | "drift"; label: string }[] = [
  { key: "pulse", label: "海报随低频律动" },
  { key: "wave", label: "右上角示波线" },
  { key: "scope", label: "对称频谱" },
  { key: "roll", label: "发光 MIDI 音轨" },
  { key: "drift", label: "背景缓慢漂移" },
];

const keys: [string, string][] = [
  ["空格", "播放 / 暂停"],
  ["← →", "后退 / 前进 5 秒"],
  ["H", "隐藏全部界面（录屏用）"],
  ["F", "全屏"],
  ["S", "打开 / 关闭设置"],
];
</script>

<style scoped>
@reference "tailwindcss";
.label {
  @apply mb-2.5 text-[11px] font-semibold tracking-[0.2em] text-white/40;
}
.chip {
  @apply rounded-full border border-white/12 px-3 py-1 text-xs text-white/70 transition hover:border-white/30 hover:text-white;
}
.chip-on {
  @apply border-white bg-white font-semibold text-[#0b0d18] hover:text-[#0b0d18];
}
.pal {
  @apply flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-white/70 transition hover:bg-white/6;
}
.pal-on {
  @apply bg-white/14 text-white hover:bg-white/14;
}
.toggle-row {
  @apply flex cursor-pointer items-center justify-between rounded-lg px-1 py-1.5 text-sm text-white/80;
}
.switch {
  @apply relative h-5 w-9 rounded-full bg-white/15 transition-colors;
}
.knob {
  @apply absolute top-0.5 left-0.5 h-4 w-4 rounded-full shadow transition;
}
.swatch {
  @apply h-7 w-10 cursor-pointer rounded border border-white/20 bg-transparent p-0.5;
}
</style>
