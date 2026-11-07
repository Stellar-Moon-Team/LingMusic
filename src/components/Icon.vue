<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path v-for="(d, i) in paths[name]" :key="i" :d="d" />
  </svg>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ name: string; size?: number }>(), { size: 20 });

const paths: Record<string, string[]> = {
  play: ["M7 4.5v15l12-7.5z"],
  pause: ["M8 5v14", "M16 5v14"],
  prev: ["M18 5.5v13L9 12z", "M6 5v14"],
  next: ["M6 5.5v13L15 12z", "M18 5v14"],
  settings: [
    "M4 7h10",
    "M18 7h2",
    "M16 5v4",
    "M4 17h4",
    "M12 17h8",
    "M10 15v4",
  ],
  fullscreen: ["M4 9V4h5", "M20 9V4h-5", "M4 15v5h5", "M20 15v5h-5"],
  volume: ["M4 9.5v5h3.5L12 19V5L7.5 9.5z", "M15.5 9a4 4 0 0 1 0 6", "M18 6.5a7.5 7.5 0 0 1 0 11"],
  mute: ["M4 9.5v5h3.5L12 19V5L7.5 9.5z", "M16 9.5l5 5", "M21 9.5l-5 5"],
  eyeOff: [
    "M3 3l18 18",
    "M10.6 6.1A9.8 9.8 0 0 1 12 6c5 0 8.5 4.2 9.5 6-.4.8-1.3 2.1-2.6 3.3",
    "M6.4 7.6C4.6 8.8 3.2 10.6 2.5 12c1 1.8 4.5 6 9.5 6 1.6 0 3-.4 4.3-1",
    "M9.9 10a3 3 0 0 0 4.2 4.2",
  ],
  close: ["M6 6l12 12", "M18 6L6 18"],
  chevronLeft: ["M14.5 5.5L8 12l6.5 6.5"],
  chevronRight: ["M9.5 5.5L16 12l-6.5 6.5"],
  check: ["M5 12.5l4.5 4.5L19 7.5"],
};
</script>
