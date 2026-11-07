<template>
  <div class="float-y relative h-full w-full transition-opacity duration-300" :style="{ opacity }">
    <!-- 背后的染色光晕，随低频轻微呼吸 -->
    <div class="absolute -inset-6 rounded-[44px] blur-3xl" :style="{
      background: `radial-gradient(ellipse at 50% 55%, ${glow} 0%, transparent 70%)`,
      opacity: 'calc(0.35 + var(--bass, 0) * 0.5)',
    }"></div>
    <Transition enter-active-class="transition duration-700 ease-out"
      leave-active-class="transition duration-500 ease-in absolute inset-0" enter-from-class="opacity-0 scale-95"
      leave-to-class="opacity-0 scale-95">
      <div :key="src"
        class="relative h-full w-full overflow-hidden rounded-[30px] shadow-[0_28px_70px_-8px_rgba(0,0,0,0.72),0_8px_24px_rgba(0,0,0,0.45),0_0_0_1px_rgba(255,255,255,0.14)]"
        style="transform: scale(calc(1 + var(--kick, 0) * 0.018)); transition: transform 80ms linear">
        <img :src="src" :alt="alt" class="h-full w-full object-cover" draggable="false" />
        <!-- 玻璃高光 -->
        <div class="pointer-events-none absolute inset-0 rounded-[30px]" style="
            background: linear-gradient(135deg, rgba(255, 255, 255, 0.16) 0%, transparent 32%),
              linear-gradient(to top, rgba(0, 0, 0, 0.12), transparent 30%);
            box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.18);
          "></div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ src: string; alt: string; glow: string; opacity?: number }>(), { opacity: 1 });
</script>
