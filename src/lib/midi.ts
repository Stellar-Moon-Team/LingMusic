/**
 * 极简标准 MIDI 文件（SMF format 0 / 1）解析：只取音符、速度表和拍号，够画音轨用。
 *
 * 打击乐不进音轨：第 10 通道的音符，以及轨道名像鼓组（Kick / Snare / HiHat…）的整轨。
 * 它们每轨只有一两个固定音高，画出来是横穿旋律的几排点，反而干扰。
 */

const DRUM_NAME = /kick|snare|hi-?hat|\bhats?\b|clap|drum|perc|cymbal|crash|\bride\b|\btoms?\b|shaker|tambourine|\b(808|909)\b/i;

export interface MidiNote {
  /** MIDI 音高（60 = 中央 C） */
  pitch: number;
  /** 起止时间（秒） */
  start: number;
  end: number;
  /** 力度 0~1 */
  velocity: number;
  /** 所属声部（只计有音符的轨道，从 0 开始） */
  track: number;
}

export interface MidiData {
  /** 按 start 排序 */
  notes: MidiNote[];
  /** 各声部名称（轨道名 meta，没有则为空串） */
  tracks: string[];
  lo: number;
  hi: number;
  duration: number;
  /** 最长音符时长，用于可见区间查找 */
  maxNoteLen: number;
  /** 每小节起点（秒），画小节线用 */
  bars: number[];
}

interface RawNote {
  tick: number;
  endTick: number;
  pitch: number;
  vel: number;
  track: number;
}

export function parseMidi(buf: ArrayBuffer): MidiData {
  const d = new Uint8Array(buf);
  const view = new DataView(buf);
  const str = (p: number, n: number) => String.fromCharCode(...d.subarray(p, p + n));
  if (str(0, 4) !== "MThd") throw new Error("不是 MIDI 文件");
  const headLen = view.getUint32(4);
  const ntracks = view.getUint16(10);
  const division = view.getUint16(12);

  let pos = 8 + headLen;
  const tempos: { tick: number; us: number }[] = [];
  const sigs: { tick: number; num: number; den: number }[] = [];
  const raw: RawNote[] = [];
  const names: string[] = [];
  let lastTick = 0;

  for (let t = 0; t < ntracks && pos + 8 <= d.length; t++) {
    const len = view.getUint32(pos + 4);
    const isTrack = str(pos, 4) === "MTrk";
    let p = pos + 8;
    const end = Math.min(d.length, p + len);
    pos = p + len;
    if (!isTrack) continue;

    const vlq = () => {
      let v = 0;
      for (;;) {
        const b = d[p++]!;
        v = (v << 7) | (b & 0x7f);
        if (b < 0x80 || p >= end) return v;
      }
    };
    const voice = names.length; // 有音符时才占用这个声部号
    const open = new Map<number, { notes: { tick: number; vel: number }[]; head: number }>();
    let tick = 0;
    let status = 0;
    let name = "";
    let hasNotes = false;

    while (p < end) {
      tick += vlq();
      let st = d[p]!;
      if (st >= 0x80) {
        p++;
        if (st < 0xf0) status = st;
      } else st = status; // running status

      if (st === 0xff) {
        const type = d[p++]!;
        const l = vlq();
        if (type === 0x03 && !name) name = new TextDecoder().decode(d.subarray(p, p + l));
        else if (type === 0x51 && l === 3) tempos.push({ tick, us: (d[p]! << 16) | (d[p + 1]! << 8) | d[p + 2]! });
        else if (type === 0x58 && l >= 2) sigs.push({ tick, num: d[p]!, den: 2 ** d[p + 1]! });
        p += l;
      } else if (st === 0xf0 || st === 0xf7) {
        const l = vlq();
        p += l;
      } else {
        const hi = st & 0xf0;
        const key = ((st & 0x0f) << 8) | d[p]!;
        if (hi === 0xc0 || hi === 0xd0) {
          p += 1;
          continue;
        }
        const a = d[p]!;
        const b = d[p + 1]!;
        p += 2;
        if ((st & 0x0f) === 9) {
          // 第 10 通道（GM 打击乐）
        } else if (hi === 0x90 && b > 0) {
          const queue = open.get(key) ?? { notes: [], head: 0 };
          queue.notes.push({ tick, vel: b });
          open.set(key, queue);
        } else if (hi === 0x80 || hi === 0x90) {
          const queue = open.get(key);
          if (queue && queue.head < queue.notes.length) {
            const on = queue.notes[queue.head++]!;
            if (queue.head === queue.notes.length) open.delete(key);
            else if (queue.head >= 4096 && queue.head * 2 >= queue.notes.length) {
              queue.notes = queue.notes.slice(queue.head);
              queue.head = 0;
            }
            raw.push({ tick: on.tick, endTick: tick, pitch: a, vel: on.vel, track: voice });
            hasNotes = true;
          }
        }
      }
    }
    // 没收到 note-off 的音符收在轨道末尾
    for (const [key, queue] of open)
      for (let i = queue.head; i < queue.notes.length; i++) {
        const on = queue.notes[i]!;
        raw.push({ tick: on.tick, endTick: tick, pitch: key & 0xff, vel: on.vel, track: voice });
        hasNotes = true;
      }
    if (hasNotes && DRUM_NAME.test(name)) {
      // 鼓组轨：丢掉已收集的音符，不占声部号
      for (let i = raw.length - 1; i >= 0; i--) if (raw[i]!.track === voice) raw.splice(i, 1);
    } else if (hasNotes) names.push(name);
    lastTick = Math.max(lastTick, tick);
  }

  // tick → 秒（分段速度表）
  const smpte = division & 0x8000;
  let toSec: (tick: number) => number;
  if (smpte) {
    const fps = 256 - (division >> 8);
    const perFrame = division & 0xff;
    toSec = (tick) => tick / (fps * perFrame);
  } else {
    tempos.sort((x, y) => x.tick - y.tick);
    if (!tempos.length || tempos[0]!.tick > 0) tempos.unshift({ tick: 0, us: 500000 });
    const segs: { tick: number; sec: number; spt: number }[] = [];
    let sec = 0;
    for (let i = 0; i < tempos.length; i++) {
      const tp = tempos[i]!;
      if (i > 0) sec += (tp.tick - segs[i - 1]!.tick) * segs[i - 1]!.spt;
      segs.push({ tick: tp.tick, sec, spt: tp.us / 1e6 / division });
    }
    toSec = (tick) => {
      let lo = 0;
      let hi = segs.length - 1;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (segs[mid]!.tick <= tick) lo = mid;
        else hi = mid - 1;
      }
      const s = segs[lo]!;
      return s.sec + (tick - s.tick) * s.spt;
    };
  }

  const notes: MidiNote[] = raw
    .map((n) => ({
      pitch: n.pitch,
      start: toSec(n.tick),
      end: Math.max(toSec(n.endTick), toSec(n.tick) + 0.04),
      velocity: n.vel / 127,
      track: n.track,
    }))
    .sort((x, y) => x.start - y.start || x.pitch - y.pitch);

  let lo = 127;
  let hi = 0;
  let duration = 0;
  let maxNoteLen = 0;
  for (const n of notes) {
    lo = Math.min(lo, n.pitch);
    hi = Math.max(hi, n.pitch);
    duration = Math.max(duration, n.end);
    maxNoteLen = Math.max(maxNoteLen, n.end - n.start);
  }

  // 小节线：按拍号逐小节累加（只在 PPQ 时间制下有意义）
  const bars: number[] = [];
  if (!smpte) {
    sigs.sort((x, y) => x.tick - y.tick);
    let sigIdx = 0;
    let sig = { num: 4, den: 4 };
    for (let tick = 0, guard = 0; tick <= lastTick && guard < 5000; guard++) {
      while (sigIdx < sigs.length && sigs[sigIdx]!.tick <= tick) sig = sigs[sigIdx++]!;
      bars.push(toSec(tick));
      tick += Math.round(division * sig.num * (4 / sig.den));
    }
  }

  return { notes, tracks: names, lo, hi, duration, maxNoteLen, bars };
}

const cache = new Map<string, Promise<MidiData | null>>();

/** 取回并解析；失败返回 null（音轨面板就不显示），同一地址只请求一次 */
export function loadMidi(url: string): Promise<MidiData | null> {
  let p = cache.get(url);
  if (!p) {
    p = fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.arrayBuffer();
      })
      .then(parseMidi)
      .catch((e) => {
        console.warn("[ost] MIDI 加载失败：", url, e);
        return null;
      });
    cache.set(url, p);
  }
  return p;
}
