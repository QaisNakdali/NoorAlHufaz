/* ضغط الصور محليًا قبل الحفظ + ألوان الأسماء */

/** يضغط صورة مرفوعة إلى مربع بحجم محدّد ويعيدها كـ dataURL */
export function compressImage(file: File, size = 320, square = true): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement("canvas");
        let sw = img.width;
        let sh = img.height;
        let sx = 0;
        let sy = 0;
        if (square) {
          const s = Math.min(sw, sh);
          sx = (sw - s) / 2;
          sy = Math.max(0, (sh - s) / 3); // انحياز للأعلى لالتقاط الوجه
          sw = sh = s;
        }
        c.width = size;
        c.height = size;
        const x = c.getContext("2d");
        if (!x) {
          reject(new Error("canvas"));
          return;
        }
        x.imageSmoothingEnabled = true;
        x.imageSmoothingQuality = "high";
        x.drawImage(img, sx, sy, sw, sh, 0, 0, size, size);
        resolve(c.toDataURL("image/jpeg", 0.82));
      } catch (e) {
        reject(e as Error);
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image"));
    };
    img.src = url;
  });
}

/** لون ثابت مشتق من الاسم لحروف الطلاب بلا صور */
export function nameColor(name: string): { background: string; color: string } {
  const hues = [262, 205, 150, 20, 330, 45, 285, 180];
  let h = 0;
  for (const ch of name.trim() || "؟") h = (h * 31 + (ch.codePointAt(0) ?? 0)) % 997;
  const hue = hues[h % hues.length];
  return {
    background: `hsl(${hue} 72% 88%)`,
    color: `hsl(${hue} 58% 34%)`,
  };
}
