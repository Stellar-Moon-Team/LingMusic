<template>
  <div
    class="flex items-center gap-4 rounded-2xl border border-white/10 bg-[#0d0f1c]/55 px-4 py-2.5 text-white shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl"
    :style="{ '--from': colors.from, '--to': colors.to, '--p': pct + '%' }"
  >
    <div class="flex items-center gap-1">
      <button class="btn" title="上一首" :disabled="!multi" @click="$emit('prev')">
        <Icon name="prev" :size="18" />
      </button>
      <button
        class="grid h-10 w-10 place-items-center rounded-full bg-white text-[#0b0d18] transition hover:scale-105 active:scale-95"
        :title="playing ? '暂停 (空格)' : '播放 (空格)'"
        @click="$emit('toggle')"
      >
        <Icon :name="playing ? 'pause' : 'play'" :size="18" />
      </button>
      <button class="btn" title="下一首" :disabled="!multi" @click="$emit('next')">
        <Icon name="next" :size="18" />
      </button>
    </div>

    <span class="w-11 text-right text-xs text-white/70 tabular-nums">{{ fmt(current) }}</span>
    <input
      class="seek w-[min(46vw,560px)]"
      type="range"
      min="0"
      :max="duration || 0"
      step="0.1"
      :value="current"
      aria-label="播放进度"
      @input="$emit('seek', Number(($event.target as HTMLInputElement).value))"
    />
    <span class="w-11 text-xs text-white/50 tabular-nums">{{ fmt(duration) }}</span>

    <div class="flex items-center gap-1.5">
      <button class="btn" :title="volume > 0 ? '静音' : '取消静音'" @click="toggleMute">
        <Icon :name="volume > 0 ? 'volume' : 'mute'" :size="18" />
      </button>
      <input
        class="seek w-20"
        type="range"
        min="0"
        max="1"
        step="0.01"
        :value="volume"
        :style="{ '--p': volume * 100 + '%' }"
        aria-label="音量"
        @input="$emit('volume', Number(($event.target as HTMLInputElement).value))"
      />
    </div>

    <div class="mx-1 h-6 w-px bg-white/10"></div>
    <button class="btn" title="隐藏界面，适合录屏 (H)" @click="$emit('hide')">
      <Icon name="eyeOff" :size="18" />
    </button>
    <button class="btn" title="全屏 (F)" @click="$emit('fullscreen')">
      <Icon name="fullscreen" :size="18" />
    </button>
    <button class="btn" title="展示设置 (S)" @click="$emit('settings')">
      <Icon name="settings" :size="18" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import Icon from "./Icon.vue";

const props = defineProps<{
  playing: boolean;
  current: number;
  duration: number;
  volume: number;
  multi: boolean;
  colors: { from: string; to: string };
}>();

const emit = defineEmits<{
  toggle: [];
  prev: [];
  next: [];
  seek: [t: number];
  volume: [v: number];
  hide: [];
  fullscreen: [];
  settings: [];
}>();

const pct = computed(() => (props.duration ? (props.current / props.duration) * 100 : 0));

const lastVolume = ref(0.85);
const toggleMute = () => {
  if (props.volume > 0) {
    lastVolume.value = props.volume;
    emit("volume", 0);
  } else emit("volume", lastVolume.value || 0.85);
};

const fmt = (s: number) => {
  if (!Number.isFinite(s) || s < 0) s = 0;
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
};
</script>

<style scoped>
@reference "tailwindcss";
.btn {
  @apply grid h-9 w-9 place-items-center rounded-full text-white/75 transition hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-30;
}
</style>
