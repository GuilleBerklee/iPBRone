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

  static rgbToHsl(r, g, b) {
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if (max === min) {
      h = s = 0;
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    return [h, s, l];
  }

  static hslToRgb(h, s, l) {
    let r, g, b;
    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }
    return [r, g, b];
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

  static applyBlurSharp(data, w, h, amount) {
    if (!amount || amount === 0) return data.slice();
    if (amount > 0) {
      return this.boxBlur(data, w, h, Math.round(amount));
    } else {
      const blurRadius = Math.max(1, Math.round(Math.abs(amount)));
      const blurred = this.boxBlur(data, w, h, blurRadius);
      const factor = Math.abs(amount) * 0.35;
      const out = new Float32Array(data.length);
      for (let i = 0; i < data.length; i++) {
        out[i] = this.clamp(data[i] + (data[i] - blurred[i]) * factor);
      }
      return out;
    }
  }

  static generateAlbedo(imageData, lowFreq, w, h, opts = {}) {
    const { brightness = 0.0, contrast = 1.0, saturation = 1.0, hue = 0 } = opts;
    const data = imageData.data;
    const out = new ImageData(w, h);
    const od = out.data;

    for (let j = 0; j < data.length; j += 4) {
      let r = data[j] / 255;
      let g = data[j + 1] / 255;
      let b = data[j + 2] / 255;

      r += brightness;
      g += brightness;
      b += brightness;

      r = (r - 0.5) * contrast + 0.5;
      g = (g - 0.5) * contrast + 0.5;
      b = (b - 0.5) * contrast + 0.5;

      let [hVal, sVal, lVal] = this.rgbToHsl(this.clamp(r), this.clamp(g), this.clamp(b));
      hVal = (hVal + hue / 360) % 1;
      if (hVal < 0) hVal += 1;
      sVal = this.clamp(sVal * saturation);
      [r, g, b] = this.hslToRgb(hVal, sVal, lVal);

      od[j]     = Math.min(255, Math.max(0, r * 255));
      od[j + 1] = Math.min(255, Math.max(0, g * 255));
      od[j + 2] = Math.min(255, Math.max(0, b * 255));
      od[j + 3] = 255;
    }
    return out;
  }

  static generateNormal(L, w, h, opts = {}) {
    const {
      strength = 2.5,
      level = 1.0,
      blurSharp = 0,
      filter = 'sobel',
      invertR = false,
      invertG = false,
      invertHeight = false,
      zRange = 1.0
    } = opts;

    let srcL = L;
    if (invertHeight) {
      srcL = new Float32Array(L.length);
      for (let i = 0; i < L.length; i++) srcL[i] = 1.0 - L[i];
    }

    const processedL = this.applyBlurSharp(srcL, w, h, blurSharp);
    const out = new ImageData(w, h);
    const od = out.data;

    const getL = (x, y) => processedL[this.clampIndex(y, h) * w + this.clampIndex(x, w)];

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const tl = getL(x - 1, y - 1), tc = getL(x, y - 1), tr = getL(x + 1, y - 1);
        const l  = getL(x - 1, y),                       r  = getL(x + 1, y);
        const bl = getL(x - 1, y + 1), bc = getL(x, y + 1), br = getL(x + 1, y + 1);

        let gx = 0, gy = 0;
        if (filter === 'scharr') {
          gx = (-3 * tl + 3 * tr - 10 * l + 10 * r - 3 * bl + 3 * br) / 32;
          gy = (-3 * tl - 10 * tc - 3 * tr + 3 * bl + 10 * bc + 3 * br) / 32;
        } else {
          gx = (-1 * tl + 1 * tr - 2 * l + 2 * r - 1 * bl + 1 * br) / 8;
          gy = (-1 * tl - 2 * tc - 1 * tr + 1 * bl + 2 * bc + 1 * br) / 8;
        }

        let nx = -gx * strength * level;
        let ny = -gy * strength * level;
        let nz = 1.0 / Math.max(0.01, zRange);

        if (invertR) nx = -nx;
        if (invertG) ny = -ny;

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
    const { contrast = 1.0, blurSharp = 0, invert = false } = opts;
    let srcL = L;
    if (invert) {
      srcL = new Float32Array(L.length);
      for (let i = 0; i < L.length; i++) srcL[i] = 1.0 - L[i];
    }

    const processedL = this.applyBlurSharp(srcL, w, h, blurSharp);
    const out = new ImageData(w, h);
    const od = out.data;

    for (let p = 0, j = 0; p < w * h; p++, j += 4) {
      let val = (processedL[p] - 0.5) * contrast + 0.5;
      val = this.clamp(val, 0, 1);

      const g = Math.min(255, Math.max(0, val * 255));
      od[j] = od[j + 1] = od[j + 2] = g;
      od[j + 3] = 255;
    }
    return out;
  }

  static generateAO(L, w, h, opts = {}) {
    const { strength = 3.0, mean = 0.5, range = 4, blurSharp = 0, invert = false } = opts;
    
    const processedL = this.applyBlurSharp(L, w, h, blurSharp);
    const blurRadius = Math.max(1, Math.round(range));
    const localMean = this.boxBlur(processedL, w, h, blurRadius);

    const out = new ImageData(w, h);
    const od = out.data;

    for (let p = 0, j = 0; p < w * h; p++, j += 4) {
      const diff = (localMean[p] - processedL[p]) + (mean - 0.5);
      const occlusion = Math.max(0, diff) * strength;
      let val = 1 - occlusion;
      if (invert) val = 1 - val;
      val = this.clamp(val, 0, 1);

      const g = Math.min(255, Math.max(0, val * 255));
      od[j] = od[j + 1] = od[j + 2] = g;
      od[j + 3] = 255;
    }
    return out;
  }

  static generateRoughness(L, w, h, opts = {}) {
    const { strength = 1.0, low = 0.0, max = 1.0, offset = 0.0, invert = false } = opts;
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
      let val = (std[p] / maxStd) * strength + offset;
      if (invert) val = 1 - val;
      val = low + val * (max - low);
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