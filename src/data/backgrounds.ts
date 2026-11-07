/** 背景图（public/media/bg）。新增背景：放进文件夹再在这里加一项 */
export interface BackgroundOption {
  id: string;
  label: string;
  src: string;
}

export const BACKGROUNDS: BackgroundOption[] = [
  { id: "starry", label: "星空", src: "media/bg/starry.png" },
  { id: "night", label: "夜晚", src: "media/bg/night.webp" },
  { id: "sunset", label: "夕阳", src: "media/bg/sunset.png" },
  { id: "sakura", label: "樱花", src: "media/bg/sakura.png" },
  { id: "booth", label: "占卜摊", src: "media/bg/booth.webp" },
];
