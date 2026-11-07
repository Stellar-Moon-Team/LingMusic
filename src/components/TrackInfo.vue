<template>
  <div class="flex flex-col items-center text-center">
    <!-- 曲名，右下角挂专辑名 -->
    <Transition mode="out-in" enter-active-class="transition duration-700 ease-out"
      leave-active-class="transition duration-300 ease-in" enter-from-class="opacity-0 translate-y-4 blur-sm"
      leave-to-class="opacity-0 -translate-y-2">
      <div :key="track.id" class="inline-flex flex-col items-end">
        <h1
          class="font-playfair tx-grad font-medium whitespace-nowrap [filter:drop-shadow(0_4px_22px_rgba(0,0,0,0.45))]"
          :style="{ fontSize: titleSize + 'px', lineHeight: 1, letterSpacing: '0.02em' }">
          {{ track.title }}
        </h1>
        <div
          class="font-title tx-to mt-8 mr-1 text-[40px] leading-none font-medium tracking-[0.04em] [text-shadow:0_2px_14px_rgba(0,0,0,0.55)]">
          「 {{ track.album }} 」
        </div>
      </div>
    </Transition>

    <!-- 作曲 -->
    <div class="mt-6 flex items-center gap-4 [text-shadow:0_2px_14px_rgba(0,0,0,0.55)]">
      <span class="font-title tx-soft text-[28px] tracking-[0.12em] opacity-75">Composer</span>
      <span class="h-px w-16" :style="{ background: accent, boxShadow: `0 0 6px ${accent}` }"></span>
      <span class="font-title tx-from text-[32px] italic">{{ track.artist }}</span>
    </div>

    <!-- 标语：一行，按播放进度轮换（纯音乐，代替歌词） -->
    <div class="mt-9 h-[48px]">
      <Transition mode="out-in" leave-active-class="transition duration-700 ease-in" leave-to-class="opacity-0 blur-sm">
        <p :key="track.id + '-' + lineIndex"
          class="font-slogan text-[32px] leading-[1.5] tracking-[0.12em] whitespace-nowrap [text-shadow:0_2px_4px_rgba(0,0,0,0.55),0_0_24px_rgba(0,0,0,0.45)]">
          <span v-for="(ch, ci) in Array.from(slogan)" :key="ci" class="char-in"
            :style="{ animationDelay: `${(ci * 0.06).toFixed(2)}s`, color: charColor(ci) }">{{ ch }}</span>
        </p>
      </Transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { Track } from "../data/tracks";

const props = defineProps<{
  track: Track;
  lineIndex: number;
  accent: string;
}>();

/** 两句连成一行；前句已以标点结尾就不再补逗号 */
const slogan = computed(() => {
  const [a = "", b = ""] = props.track.lines[props.lineIndex] ?? props.track.lines[0] ?? [];
  if (!b) return a;
  return /[，。！？、,.!?…]$/.test(a) ? a + b : `${a}，${b}`;
});

/** 标语逐字从主题起始色渐变到结束色 */
const charColor = (i: number) => {
  const n = Array.from(slogan.value).length;
  const k = n > 1 ? Math.round((i / (n - 1)) * 100) : 0;
  return `color-mix(in oklab, var(--t-from) ${100 - k}%, var(--t-to))`;
};

/** 曲名越长字号越小，给以后的长曲名留余地 */
const titleSize = computed(() => {
  const len = Array.from(props.track.title).reduce(
    (n, ch) => n + (/[　-鿿＀-￯]/.test(ch) ? 1 : 0.52),
    0,
  );
  return Math.round(Math.max(72, Math.min(150, 760 / Math.max(1, len))));
});
</script>
