import { defineAsyncComponent, type Component } from "vue";

/**
 * 背景粒子（组件来自 LingChat 主程序 src/components/game/standard/particles，原样拷贝）。
 * 异步加载：没选中的特效不进首屏包。
 */
export interface ParticleOption {
  key: string;
  label: string;
  group: "氛围" | "天气";
  component: Component | null;
  props?: Record<string, unknown>;
}

const lazy = (loader: () => Promise<unknown>) =>
  defineAsyncComponent(loader as () => Promise<Component>);

export const PARTICLES: ParticleOption[] = [
  { key: "None", label: "无", group: "氛围", component: null },
  {
    key: "StarField",
    label: "星空",
    group: "氛围",
    component: lazy(() => import("../particles/StarField.vue")),
    props: { starCount: 220, scrollSpeed: 0.18 },
  },
  {
    key: "BA",
    label: "星辉",
    group: "氛围",
    component: lazy(() => import("../particles/BAParticles.vue")),
  },
  {
    key: "MeteorShower",
    label: "流星雨",
    group: "氛围",
    component: lazy(() => import("../particles/MeteorShower.vue")),
  },
  {
    key: "Fireflies",
    label: "萤火虫",
    group: "氛围",
    component: lazy(() => import("../particles/Fireflies.vue")),
  },
  {
    key: "Sakura",
    label: "樱花",
    group: "氛围",
    component: lazy(() => import("../particles/Sakura.vue")),
  },
  {
    key: "Fireworks",
    label: "烟花",
    group: "氛围",
    component: lazy(() => import("../particles/Fireworks.vue")),
  },
  {
    key: "Drizzle",
    label: "小雨",
    group: "天气",
    component: lazy(() => import("../particles/Drizzle.vue")),
  },
  {
    key: "Rain",
    label: "雨",
    group: "天气",
    component: lazy(() => import("../particles/Rain.vue")),
  },
  {
    key: "Thunderstorm",
    label: "雷阵雨",
    group: "天气",
    component: lazy(() => import("../particles/Thunderstorm.vue")),
  },
  {
    key: "Snow",
    label: "雪",
    group: "天气",
    component: lazy(() => import("../particles/Snow.vue")),
  },
  {
    key: "Blizzard",
    label: "雪暴",
    group: "天气",
    component: lazy(() => import("../particles/Blizzard.vue")),
  },
  {
    key: "Fog",
    label: "雾",
    group: "天气",
    component: lazy(() => import("../particles/Fog.vue")),
  },
];
