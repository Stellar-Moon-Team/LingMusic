<template>
  <!-- isolate：粒子画布自带 z-index:-1，这里圈出层叠上下文，免得沉到背景图下面 -->
  <div class="pointer-events-none absolute inset-0 isolate overflow-hidden">
    <component :is="option.component" v-if="option?.component" :key="option.key" v-bind="option.props" />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { PARTICLES } from "../data/particles";

const props = defineProps<{ particle: string }>();
const option = computed(() => PARTICLES.find((p) => p.key === props.particle));
</script>
