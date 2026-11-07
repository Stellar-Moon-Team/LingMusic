import type { SpectrumStyle } from "./palettes";
import type { Track } from "./tracks";

/** 每首曲子各自记一份展示设置（存在本机浏览器里，切歌时自动换成该曲的） */
export interface ShowSettings {
  background: string;
  particle: string;
  palette: string;
  customFrom: string;
  customTo: string;
  spectrumStyle: SpectrumStyle;
  /** 海报与背景随低频律动 */
  pulse: boolean;
  /** 标题右上角的示波线 */
  wave: boolean;
  /** 标语下方的对称频谱 */
  scope: boolean;
  /** 发光 MIDI 音轨（曲目带 MIDI 时） */
  roll: boolean;
  /** 背景缓慢漂移 */
  drift: boolean;
  /** 海报不透明度（0.2~1） */
  posterOpacity: number;
  /** MIDI 音轨流速倍率（0.1~10） */
  rollSpeed: number;
}

export const defaultsFor = (track: Track): ShowSettings => ({
  background: track.background,
  particle: track.particle,
  palette: track.palette,
  customFrom: "#79d9ff",
  customTo: "#a78bfa",
  spectrumStyle: track.spectrumStyle ?? "bars",
  pulse: true,
  wave: true,
  scope: true,
  roll: true,
  drift: true,
  posterOpacity: 1,
  rollSpeed: 1,
});

// v2：布局改版后底部默认改为柱状，旧设置不再沿用
const KEY = "lingchat-ost:v2";

export interface Stored {
  trackId?: string;
  volume?: number;
  perTrack?: Record<string, Partial<ShowSettings>>;
}

export function loadStored(): Stored {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}") as Stored;
  } catch {
    return {};
  }
}

export function saveStored(data: Stored) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* 隐私模式等情况下存不了，不影响展示 */
  }
}
