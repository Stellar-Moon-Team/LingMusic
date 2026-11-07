/**
 * 频谱采样与绘制。
 *
 * 采样部分移植自 LingChat 主程序 utils/spectrumRender.ts：对数分频、高频倾斜补偿、
 * 快起慢落的包络、无声时切换到呼吸动画。绘制部分改成整屏宽的底部频谱：
 * 柱子按透明度分桶合并成少数几条路径，一百多根柱子带辉光也只需几次 fill。
 */
import type { SpectrumStyle } from "../data/palettes";

export interface SpectrumColors {
  from: string;
  to: string;
}

/** scope：标语下方那块对称频谱 —— 低频在左、高频在右，以中线上下镜像 */
export type BarsStyle = SpectrumStyle | "scope";

export interface BarsSpec {
  style: BarsStyle;
  /** 画布尺寸（舞台坐标） */
  w: number;
  h: number;
  bars: number;
  gap: number;
  glow: number;
  /** 舞台缩放 × DPR，决定画布实际像素 */
  pixelRatio: number;
  /** 相邻柱 1:2:1 平滑的遍数（默认 1），越多轮廓越圆润 */
  smoothPasses?: number;
  /** 柱高逐帧跟随比例（默认 1 = 不额外平滑），越小越柔 */
  ease?: number;
  /** 柱高整体缩放（默认 1） */
  gain?: number;
  /**
   * 自适应归一化：以本帧均值为基准，均值柱高被钉在 16%~46%（随相对响度变化），
   * 高出均值的频带按比例放大后软限幅 —— 再响再满的混音也不会整片顶格
   */
  normalize?: boolean;
  /** 只取频带轴的前多少（0~1，默认 1）；最高频段通常很弱，截掉能让柱子铺满 */
  bandRange?: number;
  /** 额外高频补偿：右端柱子乘以 (1 + tilt)，默认 0 */
  tilt?: number;
}

/** 每块画布的跨帧状态：上一帧柱高（逐帧平滑）与近期均值上限（归一化） */
const canvasState = new WeakMap<HTMLCanvasElement, { lens: Float32Array; meanRef: number }>();
/** 归一化：均值柱高的上下限、对比度指数、最终封顶 */
const NORM_BASE = 0.16;
const NORM_RANGE = 0.3;
const NORM_CONTRAST = 3.5;
const NORM_CEIL = 0.95;

const ALPHA_BUCKETS = 6;
/** 对称频谱额外的量程余量（dB） */
const WIDE_HEADROOM = 12;
/**
 * 对称频谱的高频补偿：按 dB 加（最高频段 +14dB），而不是像 levels 那样乘倍数。
 * 乘法补偿在满频混音里会把大半频带推过 1 被截平，加法只是把斜率掰正
 */
const WIDE_TILT_DB = 14;

export function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([\da-f]{3}|[\da-f]{6})$/i.exec((hex || "").trim());
  if (!m) return [255, 255, 255];
  let h = m[1]!;
  if (h.length === 3)
    h = h
      .split("")
      .map((ch) => ch + ch)
      .join("");
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgba(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/** 画布按像素比铺底；返回已清空、已设好变换的上下文 */
export function prepare(
  canvas: HTMLCanvasElement,
  w: number,
  h: number,
  pixelRatio: number,
): CanvasRenderingContext2D | null {
  const c = canvas.getContext("2d");
  if (!c) return null;
  const pr = Math.max(0.5, Math.min(pixelRatio, 3));
  const bw = Math.round(w * pr);
  const bh = Math.round(h * pr);
  if (canvas.width !== bw || canvas.height !== bh) {
    canvas.width = bw;
    canvas.height = bh;
  }
  c.setTransform(pr, 0, 0, pr, 0, 0);
  c.clearRect(0, 0, w, h);
  return c;
}

function capsule(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const r = Math.max(0, Math.min(w / 2, h / 2));
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

export class SpectrumEngine {
  private readonly bands: number;
  private levels: Float32Array;
  /**
   * 同样的频带，但量程上限多留 WIDE_HEADROOM dB。
   * 响的混音（lofi 之类）会把 levels 整片顶到 1，对称频谱读这一份才看得出起伏
   */
  private wideLevels: Float32Array;
  private freqData: Float32Array<ArrayBuffer> = new Float32Array(0);
  private timeData: Uint8Array<ArrayBuffer> = new Uint8Array(0);
  private bandEdges = new Int32Array(0);
  private bandSampleRate = 0;
  private idleMix = 1;
  private clock = 0;
  /** 示波线：每个折点的平滑振幅（0~1）。点数少 = 折线粗犷，不会细碎抽动 */
  private wave = new Float32Array(26);
  /** 每帧的原始低频能量（不经过包络平滑，给律动检测用，免得被平滑吃掉鼓点） */
  private rawBass = 0;
  /** 示波正弦的相位（弧度） */
  private wavePhase = 0;

  /** 低频能量（0~1，平滑后），给海报律动用 */
  bass = 0;
  /** 低频瞬时冲击（相对近期均值的超出量，0~1） */
  kick = 0;
  private bassAvg = 0;

  /**
   * @param smoothing 包络跟随速度（每帧向目标靠拢的比例）。
   *   rise 越小柱子升得越缓，fall 越小落得越慢；两者都调小整体就更「柔」
   */
  constructor(
    bands = 96,
    private readonly smoothing = { rise: 0.18, fall: 0.06 },
  ) {
    this.bands = Math.max(2, Math.floor(bands));
    this.levels = new Float32Array(this.bands);
    this.wideLevels = new Float32Array(this.bands);
  }

  private ensureBands(binCount: number, sampleRate: number) {
    if (this.bandEdges.length === this.bands + 1 && this.bandSampleRate === sampleRate) return;
    const nyquist = sampleRate / 2;
    const lo = 58;
    const hi = Math.min(11000, nyquist * 0.9);
    const edges = new Int32Array(this.bands + 1);
    for (let i = 0; i <= this.bands; i++) {
      const f = lo * Math.pow(hi / lo, i / this.bands);
      edges[i] = Math.min(binCount - 1, Math.max(0, Math.round((f / nyquist) * binCount)));
    }
    for (let i = 1; i <= this.bands; i++) {
      if (edges[i]! <= edges[i - 1]!) edges[i] = Math.min(binCount - 1, edges[i - 1]! + 1);
    }
    this.bandEdges = edges;
    this.bandSampleRate = sampleRate;
  }

  /** 采样一帧 */
  update(analyser: AnalyserNode | null, sampleRate: number, now: number) {
    const dt = this.clock ? Math.min(0.05, (now - this.clock) / 1000) : 0;
    this.clock = now;
    // 示波相位：静息时慢慢流动，有声音时随响度加快
    let loud = 0;
    for (let i = 0; i < this.wave.length; i++) loud += this.wave[i]!;
    loud /= this.wave.length;
    this.wavePhase = (this.wavePhase + dt * (0.9 + 2.6 * loud)) % (Math.PI * 200);
    let peak = 0;
    const bassBands = Math.max(1, Math.round(this.bands * 0.12));
    let rawBassSum = 0;
    if (analyser) {
      if (this.freqData.length !== analyser.frequencyBinCount)
        this.freqData = new Float32Array(analyser.frequencyBinCount);
      if (this.timeData.length !== analyser.fftSize)
        this.timeData = new Uint8Array(analyser.fftSize);
      // 用浮点 dB：字节数据在 maxDecibels 处就被截断了
      analyser.getFloatFrequencyData(this.freqData);
      const minDb = analyser.minDecibels;
      const span = analyser.maxDecibels - minDb;
      analyser.getByteTimeDomainData(this.timeData);
      this.ensureBands(analyser.frequencyBinCount, sampleRate);
      for (let i = 0; i < this.bands; i++) {
        const start = this.bandEdges[i]!;
        const end = Math.max(start + 1, this.bandEdges[i + 1]!);
        let maxDb = -Infinity;
        for (let k = start; k < end && k < this.freqData.length; k++) {
          if (this.freqData[k]! > maxDb) maxDb = this.freqData[k]!;
        }
        // 高频能量天然偏弱，倾斜补偿一下
        const tilt = 1 + 0.95 * (i / (this.bands - 1)); // 只用于 levels
        const v = Math.min(1, Math.max(0, (maxDb - minDb) / span) * tilt);
        const pos = i / (this.bands - 1);
        const vw = Math.min(
          1,
          Math.max(0, (maxDb + WIDE_TILT_DB * pos - minDb) / (span + WIDE_HEADROOM)),
        );
        const prev = this.levels[i]!;
        this.levels[i] =
          prev + (v - prev) * (v > prev ? this.smoothing.rise : this.smoothing.fall);
        const prevW = this.wideLevels[i]!;
        this.wideLevels[i] =
          prevW + (vw - prevW) * (vw > prevW ? this.smoothing.rise : this.smoothing.fall);
        if (this.levels[i]! > peak) peak = this.levels[i]!;
        if (i < bassBands) rawBassSum += v;
      }
      this.rawBass = rawBassSum / bassBands;
      // 示波：不取原始采样点（那会随相位乱跳），而是把时域分成若干段、取每段的平均振幅，
      // 再做很慢的时间平滑 —— 得到的是「响度轮廓」，起伏柔和
      const seg = Math.floor(this.timeData.length / this.wave.length);
      for (let i = 0; i < this.wave.length; i++) {
        let acc = 0;
        for (let k = i * seg, end = k + seg; k < end; k++) acc += Math.abs(this.timeData[k]! - 128);
        const target = Math.min(1, (acc / seg / 128) * 5.5);
        const prev = this.wave[i]!;
        this.wave[i] = prev + (target - prev) * (target > prev ? 0.12 : 0.05);
      }
    } else {
      this.rawBass *= 0.9;
      for (let i = 0; i < this.bands; i++) {
        this.levels[i] = this.levels[i]! * 0.94;
        this.wideLevels[i] = this.wideLevels[i]! * 0.94;
      }
      for (let i = 0; i < this.wave.length; i++) this.wave[i] = this.wave[i]! * 0.95;
    }

    const bassNow = this.rawBass;
    this.bass += (bassNow - this.bass) * 0.12;
    this.bassAvg += (bassNow - this.bassAvg) * 0.02;
    const k = Math.max(0, Math.min(1, (bassNow - this.bassAvg) * 3.2));
    this.kick = k > this.kick ? k : this.kick * 0.9;

    this.idleMix += ((peak < 0.035 ? 1 : 0) - this.idleMix) * 0.05;
  }

  /** 频带轴上 [p0, p1) 区间的平均能量，与静息动画按 idleMix 混合 */
  private sample(p0: number, p1: number, spatial: number, wide = false): number {
    const src = wide ? this.wideLevels : this.levels;
    const start = Math.min(this.bands - 1, Math.floor(p0 * this.bands));
    const end = Math.max(start + 1, Math.round(p1 * this.bands));
    let v = 0;
    let n = 0;
    for (let k = start; k < end && k < this.bands; k++) {
      v += src[k]!;
      n++;
    }
    v /= Math.max(1, n);
    if (this.idleMix <= 0.001) return v;
    const t = this.clock * 0.0016;
    const idle = Math.max(
      0.04,
      0.13 + 0.07 * Math.sin(spatial * 6.2 - t * 1.6) + 0.035 * Math.sin(spatial * 2.3 + t),
    );
    return v * (1 - this.idleMix) + idle * this.idleMix;
  }

  /** 第 i 根柱子取哪段频带 */
  private barValue(i: number, bars: number, style: BarsStyle, range = 1): number {
    if (style === "symmetric") {
      // 低频在中间，向两侧对称展开
      const half = bars / 2;
      const d = Math.abs(i + 0.5 - half) / half; // 0(中心) ~ 1(边缘)
      const step = 1 / half;
      return this.sample(Math.max(0, d - step / 2), Math.min(1, d + step / 2), d);
    }
    const p = (i / bars) * range;
    return this.sample(p, ((i + 1) / bars) * range, p, style === "scope");
  }

  /** 底部整屏频谱 */
  drawBars(canvas: HTMLCanvasElement | null, spec: BarsSpec, colors: SpectrumColors) {
    if (!canvas) return;
    const c = prepare(canvas, spec.w, spec.h, spec.pixelRatio);
    if (!c) return;
    const { w, h, bars, gap, glow, style } = spec;
    const barW = (w - gap * (bars - 1)) / bars;
    const pad = glow * 0.9;
    const mirror = style === "mirror" || style === "scope";
    const centered = style === "symmetric";
    const midY = h / 2;
    const maxLen = mirror ? midY - pad : h - pad * 2;
    const minLen = barW * 0.9;

    const grad = c.createLinearGradient(0, 0, w, 0);
    if (centered) {
      grad.addColorStop(0, colors.to);
      grad.addColorStop(0.5, colors.from);
      grad.addColorStop(1, colors.to);
    } else {
      grad.addColorStop(0, colors.from);
      grad.addColorStop(1, colors.to);
    }

    if (mirror) {
      c.globalAlpha = 0.14;
      c.fillStyle = grad;
      c.fillRect(0, midY - 0.5, w, 1);
    }

    // 按透明度分桶，同桶的柱子合成一条路径
    const buckets: number[][] = Array.from({ length: ALPHA_BUCKETS }, () => []);
    const lens = new Float32Array(bars);
    let raw = new Float32Array(bars);
    let tmp = new Float32Array(bars);
    const range = spec.bandRange ?? 1;
    const tilt = spec.tilt ?? 0;
    for (let i = 0; i < bars; i++)
      raw[i] = Math.min(1, this.barValue(i, bars, style, range) * (1 + tilt * (i / (bars - 1))));
    // 相邻柱 1:2:1 加权，轮廓更圆润，不会一根高一根矮地锯齿
    for (let pass = 0; pass < (spec.smoothPasses ?? 1); pass++) {
      for (let i = 0; i < bars; i++) {
        const l = raw[Math.max(0, i - 1)]!;
        const r = raw[Math.min(bars - 1, i + 1)]!;
        tmp[i] = (l + raw[i]! * 2 + r) / 4;
      }
      [raw, tmp] = [tmp, raw];
    }
    const gain = spec.gain ?? 1;
    const ease = spec.ease ?? 1;
    let st = canvasState.get(canvas);
    if (!st || st.lens.length !== bars) {
      st = { lens: new Float32Array(bars).fill(-1), meanRef: 0.3 };
      canvasState.set(canvas, st);
    }
    const prev = st.lens;
    let mean = 1;
    let meanH = 0;
    if (spec.normalize) {
      let sum = 0;
      for (let i = 0; i < bars; i++) sum += raw[i]!;
      mean = Math.max(1e-3, sum / bars);
      // 近几秒的均值上限：快升慢落（约 4 秒衰减一半），下限防止静音段被放大
      st.meanRef = mean > st.meanRef ? st.meanRef + (mean - st.meanRef) * 0.1 : st.meanRef * 0.997;
      st.meanRef = Math.max(0.3, st.meanRef);
      // 本帧均值对应的柱高：越接近近期最响，柱子整体越高，但最多 46%
      meanH = NORM_BASE + NORM_RANGE * Math.min(1, mean / st.meanRef);
    }
    const idleW = this.idleMix;
    for (let i = 0; i < bars; i++) {
      const v = raw[i]!;
      let shaped: number;
      if (spec.normalize) {
        // 相对均值的倍数放大对比（dB 归一化后的数值差距很小，需要指数拉开），
        // tanh 软限幅并封顶在 95%，只有明显突出的频带才接近顶端
        const x = meanH * Math.pow(v / mean, NORM_CONTRAST);
        const live = Math.tanh(1.25 * x) * NORM_CEIL;
        // 静息动画不做对比放大，否则呼吸波形会被拉成尖刺
        const rest = Math.min(1, Math.pow(v, 1.15) * 1.2) * 0.8;
        shaped = (live * (1 - idleW) + rest * idleW) * gain;
      } else {
        // 轻微的 gamma，让中等音量的柱子更舒展
        shaped = Math.min(1, Math.pow(v, 1.15) * 1.2) * gain;
      }
      if (ease < 1) {
        const p = prev[i]!;
        shaped = p < 0 ? shaped : p + (shaped - p) * ease;
        prev[i] = shaped;
      }
      lens[i] = Math.max(minLen, Math.min(maxLen, shaped * maxLen));
      const a = Math.min(1, v * 1.5);
      buckets[Math.min(ALPHA_BUCKETS - 1, Math.floor(a * ALPHA_BUCKETS))]!.push(i);
    }

    c.fillStyle = grad;
    c.shadowColor = colors.from;
    c.shadowBlur = glow;
    for (let b = 0; b < ALPHA_BUCKETS; b++) {
      const list = buckets[b]!;
      if (!list.length) continue;
      c.globalAlpha = 0.38 + 0.62 * ((b + 0.5) / ALPHA_BUCKETS);
      c.beginPath();
      for (const i of list) {
        const len = lens[i]!;
        const x = i * (barW + gap);
        if (mirror) capsule(c, x, midY - len, barW, len * 2);
        else capsule(c, x, h - pad - len, barW, len);
      }
      c.fill();
    }
    c.globalAlpha = 1;
    c.shadowBlur = 0;
  }

  /** 横向示波线（标题右上角）：两股相位错开的正弦，振幅由各段响度控制 */
  drawWave(
    canvas: HTMLCanvasElement | null,
    w: number,
    h: number,
    pixelRatio: number,
    colors: SpectrumColors,
  ) {
    if (!canvas) return;
    const c = prepare(canvas, w, h, pixelRatio);
    if (!c) return;
    const cy = h / 2;
    const amp = h / 2 - 8;
    const n = this.wave.length;
    const t = this.clock * 0.002;
    const fade = 30; // 两端淡出的长度

    const grad = c.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, rgba(colors.to, 0));
    grad.addColorStop(fade / w, colors.to);
    grad.addColorStop(1 - fade / w, colors.from);
    grad.addColorStop(1, rgba(colors.from, 0));

    // 各段响度做余弦插值，得到沿横轴平滑变化的振幅包络
    const levelAt = (u: number) => {
      const f = u * (n - 1);
      const i0 = Math.floor(f);
      const i1 = Math.min(n - 1, i0 + 1);
      const k = (1 - Math.cos((f - i0) * Math.PI)) / 2;
      const live = this.wave[i0]! * (1 - k) + this.wave[i1]! * k;
      const idle = 0.16 + 0.05 * Math.sin(u * 4 - t * 0.6);
      return live * (1 - this.idleMix) + idle * this.idleMix;
    };
    const steps = Math.ceil(w / 3);
    const cycles = 3.5; // 整条线上的波峰数
    const strand = (phase: number, scale: number) => {
      c.beginPath();
      for (let s = 0; s <= steps; s++) {
        const u = s / steps;
        const env = Math.sin(u * Math.PI); // 两端收拢
        const a = (0.12 + 0.88 * Math.min(1, levelAt(u))) * amp * env * scale;
        const wave =
          Math.sin(u * cycles * Math.PI * 2 - this.wavePhase + phase) * 0.82 +
          Math.cos(u * cycles * 0.5 * Math.PI * 2 + this.wavePhase * 0.6) * 0.18;
        const x = u * w;
        const y = cy + wave * a;
        if (s === 0) c.moveTo(x, y);
        else c.lineTo(x, y);
      }
      c.stroke();
    };
    c.strokeStyle = grad;
    c.lineJoin = "round";
    c.lineCap = "round";
    c.shadowColor = colors.from;
    // 副线：反相、细、淡，和主线交织
    c.globalAlpha = 0.35;
    c.lineWidth = 1.2;
    c.shadowBlur = 4;
    strand(Math.PI * 0.85, 0.7);
    c.globalAlpha = 1;
    c.lineWidth = 2.2;
    c.shadowBlur = 10;
    strand(0, 1);
    c.shadowBlur = 0;
  }
}
