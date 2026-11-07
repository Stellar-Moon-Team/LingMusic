/**
 * 频谱主题。前六个与 LingChat 主程序的 constants/spectrum.ts 同源，
 * 「月白」是贴近参考图的白色细柱。
 */
export interface SpectrumPalette {
  id: string;
  label: string;
  from: string;
  to: string;
}

export const SPECTRUM_PALETTES: SpectrumPalette[] = [
  { id: "moon", label: "月白 Moon", from: "#ffffff", to: "#cfe6ff" },
  { id: "aurora", label: "极光 Aurora", from: "#79d9ff", to: "#a78bfa" },
  { id: "ocean", label: "深海 Ocean", from: "#22d3ee", to: "#3b82f6" },
  { id: "sakura", label: "樱 Sakura", from: "#ffb3d1", to: "#ff6f9c" },
  { id: "ember", label: "余烬 Ember", from: "#fbbf24", to: "#fb7185" },
  { id: "mint", label: "薄荷 Mint", from: "#5eead4", to: "#4ade80" },
  { id: "galaxy", label: "星河 Galaxy", from: "#818cf8", to: "#e879f9" },
];

export const CUSTOM_PALETTE = "custom";

export type SpectrumStyle = "symmetric" | "bars" | "mirror";

export const SPECTRUM_STYLES: { id: SpectrumStyle; label: string; hint: string }[] = [
  { id: "symmetric", label: "对称", hint: "低频居中，向两侧展开" },
  { id: "bars", label: "柱状", hint: "从左到右，低频到高频" },
  { id: "mirror", label: "镜像", hint: "以中线上下对称" },
];
