<template>
  <div class="absolute inset-0 overflow-hidden bg-[#05060d]">
    <Transition
      enter-active-class="transition-opacity duration-[1400ms] ease-out"
      leave-active-class="transition-opacity duration-[1400ms] ease-in"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div :key="src" class="absolute inset-0">
        <img
          :src="src"
          alt=""
          class="h-full w-full object-cover"
          :class="drift ? 'kenburns' : 'scale-[1.04]'"
          style="filter: brightness(calc(0.6 + var(--bass, 0) * 0.16)) saturate(1.08)"
          draggable="false"
        />
      </div>
    </Transition>

    <!-- 压暗：右侧文字区、底部频谱区、四周暗角 -->
    <div
      class="absolute inset-0"
      style="
        background:
          linear-gradient(to left, rgba(6, 7, 16, 0.55) 0%, rgba(6, 7, 16, 0.18) 45%, transparent 70%),
          linear-gradient(to top, rgba(4, 5, 12, 0.7) 0%, rgba(4, 5, 12, 0) 26%),
          radial-gradient(ellipse at 50% 45%, transparent 55%, rgba(0, 0, 0, 0.5) 100%);
      "
    ></div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ src: string; drift: boolean }>();
</script>
