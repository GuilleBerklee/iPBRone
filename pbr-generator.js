export class PBRGenerator {
  static computeLuminance(imageData) {
    const data = imageData.data;
    const L = new Float32Array(imageData.width * imageData.height);
    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      L[p] = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
    }
    return L;
  }

  static clampIndex(i, n) {
    return i < 0 ? 0 : (i >= n ? n - 1 : i);
  }

  static clamp(val, min = 0, max = 1) {
    return Math.min(max, Math.max(min, val));
  }

  static hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16) / 255,
      g: parseInt(result[2], 16) / 255,
      b: parseInt(result[3], 16) / 255
    } : { r: 1, g: 1, b: 1 };
  }

  static boxBlur(src, w, h, radius) {
    if (radius < 1) return src.slice();

    const boxBlurH = (input) => {
      const out = new Float32Array(w * h);
      const windowSize = radius * 2 + 1;
      for (let y = 0; y < h; y++) {
        const rowStart = y * w;
        let sum = 0;
        for (let k = -radius; k <= radius; k++) sum += input[rowStart + this.clampIndex(k, w)];
        for (let x = 0; x < w; x++) {
          out[rowStart + x] = sum / windowSize;
          sum += input[rowStart + this.clampIndex(x + radius + 1, w)] - input[rowStart + this.clampIndex(x - radius, w)];
        }
      }
      return out;
    };

    const boxBlurV = (input) => {
      const out = new Float32Array(w * h);
      const windowSize = radius * 2 + 1;
      for (let x = 0; x < w; x++) {
        let sum = 0;
        for (let k = -radius; k <= radius; k++) sum += input[this.clampIndex(k, h) * w + x];
        for (let y = 0; y < h; y++) {
          out[y * w + x] = sum / windowSize;
          sum += input[this.clampIndex(y + radius + 1, h) * w + x] - input[this.clampIndex(y - radius, h) * w + x];
        }
      }
      return out;
    };

    return boxBlurV(boxBlurH(src));
  }

  static generateAlbedo(imageData, lowFreq, w, h, opts = {}) {
    const { contrast = 1.0, tint = '#ffffff', saturation = 1.0 } = opts;
    const data = imageData.data;
    const out = new ImageData(w, h);
    const od = out.data;
    const { r: tr, g: tg, b: tb } = this.hexToRgb(tint);
    let meanLow = 0;
    
    for (let i = 0; i < lowFreq.length; i++) meanLow += lowFreq[i];
    meanLow /= lowFreq.length;

    for (let p = 0, j = 0; p < w * h; p++, j += 4) {
      const factor = Math.min(Math.max(meanLow / Math.max(lowFreq[p], 0.02), 0.35), 2.8);
      
      let r = (data[j] * factor) / 255;
      let g = (data[j + 1] * factor) / 255;
      let b = (data[j + 2] * factor) / 255;

      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      r = lum + (r - lum) * saturation;
      g = lum + (g - lum) * saturation;
      b = lum + (b - lum) * saturation;

      r = (r - 0.5) * contrast + 0.5;
      g = (g - 0.5) * contrast + 0.5;
      b = (b - 0.5) * contrast + 0.5;

      r *= tr;
      g *= tg;
      b *= tb;

      od[j]     = Math.min(255, Math.max(0, r * 255));
      od[j + 1] = Math.min(255, Math.max(0, g * 255));
      od[j + 2] = Math.min(255, Math.max(0, b * 255));
      od[j + 3] = 255;
    }
    return out;
  }

  static generateNormal(Lsmooth, w, h, opts = {}) {
    const { strength = 2.5, intensity = 1.0 } = opts;
    const out = new ImageData(w, h);
    const od = out.data;

    const getL = (x, y) => {
      const val = Lsmooth[y * w + x];
      return this.clamp((val - 0.5) * intensity + 0.5, 0, 1);
    };

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const xm = this.clampIndex(x - 1, w), xp = this.clampIndex(x + 1, w);
        const ym = this.clampIndex(y - 1, h), yp = this.clampIndex(y + 1, h);

        const gx = (getL(xp, y) - getL(xm, y)) * 0.5;
        const gy = (getL(x, yp) - getL(x, ym)) * 0.5;

        const nx = -gx * strength;
        const ny = -gy * strength;
        const nz = 1.0;

        const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
        const idx = (y * w + x) * 4;

        od[idx]     = Math.min(255, Math.max(0, ((nx / len) * 0.5 + 0.5) * 255));
        od[idx + 1] = Math.min(255, Math.max(0, ((ny / len) * 0.5 + 0.5) * 255));
        od[idx + 2] = Math.min(255, Math.max(0, ((nz / len) * 0.5 + 0.5) * 255));
        od[idx + 3] = 255;
      }
    }
    return out;
  }

  static generateHeight(L, w, h, opts = {}) {
    const { contrast = 1.0, offset = 0.0, strength = 1.0 } = opts;
    const lowFreq = this.boxBlur(L, w, h, 2);
    const out = new ImageData(w, h);
    const od = out.data;

    for (let p = 0, j = 0; p < w * h; p++, j += 4) {
      let val = lowFreq[p] * strength;
      val = (val - 0.5) * contrast + 0.5 + offset;
      val = this.clamp(val, 0, 1);
      
      const g = Math.min(255, Math.max(0, val * 255));
      od[j] = od[j + 1] = od[j + 2] = g;
      od[j + 3] = 255;
    }
    return out;
  }

  static generateRoughness(L, w, h, opts = {}) {
    const { contrast = 1.0, low = 0.0, high = 1.0, offset = 0.0, invert = false } = opts;
    const L2 = new Float32Array(L.length);
    for (let i = 0; i < L.length; i++) L2[i] = L[i] * L[i];

    const meanL = this.boxBlur(L, w, h, 3);
    const meanL2 = this.boxBlur(L2, w, h, 3);
    const std = new Float32Array(L.length);
    let maxStd = 1e-5;

    for (let i = 0; i < L.length; i++) {
      const v = Math.max(0, meanL2[i] - meanL[i] * meanL[i]);
      std[i] = Math.sqrt(v);
      if (std[i] > maxStd) maxStd = std[i];
    }

    const out = new ImageData(w, h);
    const od = out.data;

    for (let p = 0, j = 0; p < w * h; p++, j += 4) {
      let val = std[p] / maxStd;
      if (invert) val = 1 - val;
      val += offset;
      val = (val - 0.5) * contrast + 0.5;
      val = low + val * (high - low);
      val = this.clamp(val, 0, 1);

      const g = Math.min(255, Math.max(0, val * 255));
      od[j] = od[j + 1] = od[j + 2] = g;
      od[j + 3] = 255;
    }
    return out;
  }

  static generateAO(L, w, h, opts = {}) {
    const { amount = 3.0, contrast = 1.0 } = opts;
    const local = this.boxBlur(L, w, h, 4);
    const out = new ImageData(w, h);
    const od = out.data;

    for (let p = 0, j = 0; p < w * h; p++, j += 4) {
      const occlusion = Math.max(0, local[p] - L[p]) * amount;
      let val = 1 - occlusion;
      val = (val - 0.5) * contrast + 0.5;
      val = this.clamp(val, 0, 1);

      const g = Math.min(255, Math.max(0, val * 255));
      od[j] = od[j + 1] = od[j + 2] = g;
      od[j + 3] = 255;
    }
    return out;
  }

  static generateMetallic(w, h, value) {
    const out = new ImageData(w, h);
    const od = out.data;
    const g = Math.min(255, Math.max(0, value * 255));

    for (let i = 0; i < od.length; i += 4) {
      od[i] = od[i + 1] = od[i + 2] = g;
      od[i + 3] = 255;
    }
    return out;
  }
}