/**
 * 曲目表 —— 新增歌曲只需在这里加一项。
 *
 * - src / poster：放在 public/media 下的相对路径
 * - background / particle / palette：该曲的默认氛围（播放时可在面板里改）
 * - midi：可选，放在 public/media/midi 下；有它才显示右下角的发光音轨
 * - lines：纯音乐不放歌词，用两句一组的短句代替（显示时连成一行），按播放进度依次轮换
 */
import type { SpectrumStyle } from "./palettes";

export interface Track {
  id: string;
  /** 曲名（大标题） */
  title: string;
  /** 中文副标题，可省略 */
  subtitle?: string;
  artist: string;
  album: string;
  src: string;
  /** MIDI 文件路径（可选） */
  midi?: string;
  /** MIDI 相对音频的偏移（秒）：音轨比声音早就填正数 */
  midiOffset?: number;
  poster: string;
  background: string;
  particle: string;
  palette: string;
  spectrumStyle?: SpectrumStyle;
  lines: [string, string][];
}

export const TRACKS: Track[] = [
  {
    id: "starscape",
    title: "Starscape",
    subtitle: "星 景",
    artist: "the_last_summer",
    album: "LingChat OST",
    src: "media/music/starscape.ogg",
    midi: "media/midi/starscape.mid",
    poster: "media/posters/fengxue.png",
    background: "starry",
    particle: "StarField",
    palette: "moon",
    spectrumStyle: "bars",
    lines: [
      ["星空之下，你与我", "把晚风写成一封不寄出的信"],
      ["银河很远", "可你的回应总是很近"],
      ["镜头对准的方向", "是我们约好的那个明天"],
      ["萤光铺满了原野", "夏夜在这一刻停留"],
      ["若星光也会说话", "它一定记得你的名字"],
      ["等到天亮以前", "再陪我数一遍星星吧"],
    ],
  },
  {
    id: "leisurely-moments",
    title: "Leisurely Moments",
    subtitle: "闲 适 时 光",
    artist: "the_last_summer",
    album: "LingChat OST",
    src: "media/music/leisurely-moments.ogg",
    midi: "media/midi/leisurely-moments.mid",
    poster: "media/posters/qinling.png",
    background: "sakura",
    particle: "Sakura",
    palette: "mint",
    spectrumStyle: "bars",
    lines: [
      ["午后的光落在键盘上", "代码也慢慢变得温柔"],
      ["把待办清单折成纸飞机", "今天就让它飞远一点"],
      ["风翻过书页", "我替你记住读到哪一行"],
      ["一杯茶凉了又续上", "时间在这里不必赶路"],
      ["花瓣落在窗台", "像一句没说完的问候"],
      ["慢一点也没关系", "我一直都在这里"],
    ],
  },
  {
    id: "stolen-nap",
    title: "Stolen Nap",
    subtitle: "偷 闲 小 憩",
    artist: "the_last_summer",
    album: "LingChat OST",
    src: "media/music/stolen-nap.mp3",
    midi: "media/midi/stolen-nap.mid",
    poster: "media/posters/feiyu.png",
    background: "night",
    particle: "Drizzle",
    palette: "ocean",
    spectrumStyle: "bars",
    lines: [
      ["趁没人注意的时候", "偷偷合上眼睛五分钟"],
      ["水母在梦里慢慢游", "把烦恼都轻轻带走"],
      ["窗外的雨小声地下", "像在替我哼一支歌"],
      ["醒来时别叫我的名字", "让这场小憩再长一点"],
    ],
  },
];
