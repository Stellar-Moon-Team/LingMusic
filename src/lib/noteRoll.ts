/**
 * 发光 MIDI 音轨：横向卷帘。音符从右侧流向播放线，经过时点亮并在播放线上迸出光点；
 * 左侧一条小键盘随发声的音高亮起。
 */
import type { MidiData, MidiNote } from "./midi";
import { hexToRgb, prepare, rgba, type SpectrumColors } from "./spectrum";

/** 流速 1× 时播放线左侧显示多久的过去、右侧多久的未来（秒）；流速越快，可见时间窗越短 */
const PAST = 1.6;
const FUTURE = 3.4;
/** 音符起音后光点持续时间 */
const HIT = 0.45;
const KEY_W = 12;
const KEY_GAP = 6;
const PAD_Y = 8;
/** 音域上下各留的空行 */
const MARGIN = 2;

const BLACK = new Set([1, 3, 6, 8, 10]);

/** 两色之间插值，返回可带透明度的取色函数 */
function mix(a: string, b: string, k: number): (alpha?: number) => string {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  const [r, g, bl] = [0, 1, 2].map((i) => Math.round(x[i]! + (y[i]! - x[i]!) * k));
  return (alpha = 1) => `rgba(${r}, ${g}, ${bl}, ${alpha})`;
}

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const r = Math.min(h / 2, w / 2);
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

export class NoteRoll {
  private data: MidiData | null = null;
  /** 每个音高的键盘亮度（缓慢衰减） */
  private keyGlow = new Float32Array(128);
  private keyTrack = new Int8Array(128);
  private lastNow = 0;
  /** 流速倍率（1 = 默认） */
  speed = 1;

  setData(data: MidiData | null) {
    this.data = data;
    this.keyGlow.fill(0);
  }

  get hasData() {
    return !!this.data && this.data.notes.length > 0;
  }

  /** 第一个可能在 [t0, ∞) 内可见的音符下标 */
  private firstVisible(t0: number): number {
    const notes = this.data!.notes;
    const from = t0 - this.data!.maxNoteLen;
    let lo = 0;
    let hi = notes.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (notes[mid]!.start < from) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  /**
   * @param t 当前 MIDI 时间（秒，已扣除偏移）
   * @param now 动画时钟（ms），只用于光晕衰减
   */
  draw(
    canvas: HTMLCanvasElement | null,
    w: number,
    h: number,
    pixelRatio: number,
    colors: SpectrumColors,
    t: number,
    now: number,
  ) {
    if (!canvas || !this.data) return;
    const c = prepare(canvas, w, h, pixelRatio);
    if (!c) return;
    const dt = this.lastNow ? Math.min(0.1, (now - this.lastNow) / 1000) : 0;
    this.lastNow = now;

    const { notes, lo, hi, bars } = this.data;
    const nTracks = Math.max(1, this.data.tracks.length);
    const pLo = lo - MARGIN;
    const rows = hi - lo + 1 + MARGIN * 2;
    const rowH = (h - PAD_Y * 2) / rows;
    const x0 = KEY_W + KEY_GAP;
    const span = w - x0;
    const k = Math.max(0.1, this.speed);
    const pastSec = PAST / k;
    const futureSec = FUTURE / k;
    const pps = span / (pastSec + futureSec);
    const px = x0 + pastSec * pps;
    const yOf = (pitch: number) => PAD_Y + (rows - 1 - (pitch - pLo)) * rowH;
    const xOf = (sec: number) => px + (sec - t) * pps;
    const tint = Array.from({ length: nTracks }, (_, i) =>
      mix(colors.from, colors.to, nTracks > 1 ? i / (nTracks - 1) : 0),
    );
    const trackColors = tint.map((f) => f());

    // —— 底纹：每个 C 一条横线，小节线竖向 —— //
    c.fillStyle = "rgba(255,255,255,0.06)";
    for (let p = Math.ceil(pLo / 12) * 12; p <= hi + MARGIN; p += 12) {
      c.fillRect(x0, Math.round(yOf(p) + rowH) - 0.5, span, 1);
    }
    c.fillStyle = "rgba(255,255,255,0.07)";
    for (const b of bars) {
      const x = xOf(b);
      if (x < x0 || x > w) continue;
      c.fillRect(Math.round(x) - 0.5, PAD_Y, 1, h - PAD_Y * 2);
    }

    // —— 音符 —— //
    const t0 = t - pastSec;
    const t1 = t + futureSec;
    const noteH = Math.max(4, rowH * 1.25);
    const sounding: MidiNote[] = [];
    // 未发声的音符按声部合并成路径：过去的淡、未来的亮一些
    const future: Path2D[] = trackColors.map(() => new Path2D());
    const past: Path2D[] = trackColors.map(() => new Path2D());
    for (let i = this.firstVisible(t0); i < notes.length; i++) {
      const n = notes[i]!;
      if (n.start > t1) break;
      if (n.end < t0) continue;
      if (n.start <= t && n.end >= t) {
        sounding.push(n);
        continue;
      }
      const xa = xOf(n.start);
      const xb = Math.max(xa + noteH, xOf(n.end));
      const y = yOf(n.pitch) + (rowH - noteH) / 2;
      const path = n.end < t ? past[n.track]! : future[n.track]!;
      const r = Math.min(noteH / 2, (xb - xa) / 2);
      path.roundRect(xa, y, xb - xa, noteH, r);
    }

    c.shadowBlur = 0;
    for (let k = 0; k < nTracks; k++) {
      c.fillStyle = trackColors[k]!;
      c.globalAlpha = 0.3;
      c.fill(past[k]!);
      c.globalAlpha = 0.8;
      c.shadowColor = trackColors[k]!;
      c.shadowBlur = 8;
      c.fill(future[k]!);
      c.shadowBlur = 0;
    }

    // 发声中的音符：高亮 + 白芯 + 播放线上的光点
    for (const n of sounding) {
      const col = trackColors[n.track]!;
      const xa = xOf(n.start);
      const xb = Math.max(xa + noteH, xOf(n.end));
      const y = yOf(n.pitch) + (rowH - noteH) / 2;
      c.globalAlpha = 0.75 + 0.25 * n.velocity;
      c.fillStyle = col;
      c.shadowColor = col;
      c.shadowBlur = 16;
      c.beginPath();
      roundRect(c, xa, y - 0.5, xb - xa, noteH + 1);
      c.fill();
      c.shadowBlur = 0;
      c.globalAlpha = 0.85;
      c.fillStyle = "#fff";
      c.beginPath();
      roundRect(c, Math.max(xa, px - 40) + 1, y + noteH * 0.3, Math.max(2, Math.min(xb, px + 2) - Math.max(xa, px - 40) - 2), noteH * 0.4);
      c.fill();

      const age = t - n.start;
      if (age < HIT) {
        const k = 1 - age / HIT;
        const cy = y + noteH / 2;
        const rad = 6 + 16 * k * (0.5 + n.velocity);
        const g = c.createRadialGradient(px, cy, 0, px, cy, rad);
        g.addColorStop(0, `rgba(255,255,255,${0.9 * k})`);
        g.addColorStop(0.35, tint[n.track]!(0.5 * k));
        g.addColorStop(1, "rgba(255,255,255,0)");
        c.globalAlpha = 1;
        c.fillStyle = g;
        c.beginPath();
        c.arc(px, cy, rad, 0, Math.PI * 2);
        c.fill();
      }
      // 按住的键保持常亮，松开后才开始衰减
      this.keyGlow[n.pitch] = Math.max(this.keyGlow[n.pitch]!, 0.4 + 0.6 * n.velocity);
      this.keyTrack[n.pitch] = n.track;
    }
    c.globalAlpha = 1;

    // —— 两端淡出（只作用于卷帘区） —— //
    c.globalCompositeOperation = "destination-in";
    const mask = c.createLinearGradient(x0, 0, w, 0);
    mask.addColorStop(0, "rgba(0,0,0,0)");
    mask.addColorStop(0.12, "rgba(0,0,0,1)");
    mask.addColorStop(0.85, "rgba(0,0,0,1)");
    mask.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = mask;
    c.fillRect(x0, 0, span, h);
    c.globalCompositeOperation = "source-over";

    // —— 播放线 —— //
    const line = c.createLinearGradient(0, 0, 0, h);
    line.addColorStop(0, rgba(colors.from, 0));
    line.addColorStop(0.2, rgba(colors.from, 0.75));
    line.addColorStop(0.8, rgba(colors.to, 0.75));
    line.addColorStop(1, rgba(colors.to, 0));
    c.fillStyle = line;
    c.shadowColor = colors.from;
    c.shadowBlur = 8;
    c.fillRect(px - 0.75, 0, 1.5, h);
    c.shadowBlur = 0;

    // —— 左侧小键盘 —— //
    const decay = Math.pow(0.04, dt); // 约 1 秒衰减到 4%
    for (let p = pLo; p < pLo + rows; p++) {
      const y = yOf(p);
      const black = BLACK.has(((p % 12) + 12) % 12);
      c.fillStyle = black ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.2)";
      c.fillRect(0, y + 0.5, black ? KEY_W * 0.62 : KEY_W, Math.max(1, rowH - 1));
      const g = p >= 0 && p < 128 ? this.keyGlow[p]! : 0;
      if (g > 0.01) {
        const col = trackColors[this.keyTrack[p]!] ?? colors.from;
        c.globalAlpha = g;
        c.fillStyle = col;
        c.shadowColor = col;
        c.shadowBlur = 10;
        c.fillRect(0, y, KEY_W, rowH);
        c.shadowBlur = 0;
        c.globalAlpha = 1;
        this.keyGlow[p] = g * decay;
      }
    }
  }
}
