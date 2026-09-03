export class LightCorrector {
  /**
   * Corrección de iluminación sobre Canvas de origen.
   * * @param {HTMLCanvasElement} srcCanvas
   * @param {HTMLCanvasElement} dstCanvas
   * @param {Object} opts
   */
  static process(srcCanvas, dstCanvas, opts = {}) {
    const {
      flatFieldStrength = 0.0, // 0.0 a 1.0 (Auto-iluminación plana)
      flatFieldRadius = 60,    // Radio de la luz suave
      gradAngle = 0,          // Ángulo en grados (0 - 360)
      gradIntensity = 0.0,    // Intensidad direccional (-1.0 a 1.0)
      vignette = 0.0,         // Anti-viñeteado (-1.0 a 1.0)
      brightness = 0.0,       // Brillo fino (-0.5 a 0.5)
      contrast = 1.0          // Contraste fino (0.5 a 1.5)
    } = opts;

    const w = srcCanvas.width;
    const h = srcCanvas.height;

    dstCanvas.width = w;
    dstCanvas.height = h;

    const ctxSrc = srcCanvas.getContext('2d');
    const ctxDst = dstCanvas.getContext('2d');

    const srcImgData = ctxSrc.getImageData(0, 0, w, h);
    const srcData = srcImgData.data;

    const outImgData = ctxDst.createImageData(w, h);
    const outData = outImgData.data;

    // 1. Flat-field: Calculamos mapa de iluminación desenfocado
    let blurR, blurG, blurB;
    let avgR = 128, avgG = 128, avgB = 128;

    if (flatFieldStrength > 0) {
      blurR = this.boxBlurChannel(srcData, w, h, 0, flatFieldRadius);
      blurG = this.boxBlurChannel(srcData, w, h, 1, flatFieldRadius);
      blurB = this.boxBlurChannel(srcData, w, h, 2, flatFieldRadius);

      let sumR = 0, sumG = 0, sumB = 0;
      const totalPixels = w * h;
      for (let i = 0; i < totalPixels; i++) {
        sumR += blurR[i];
        sumG += blurG[i];
        sumB += blurB[i];
      }
      avgR = sumR / totalPixels;
      avgG = sumG / totalPixels;
      avgB = sumB / totalPixels;
    }

    // Precálculo para gradiente direccional
    const rad = (gradAngle * Math.PI) / 180;
    const cosA = Math.cos(rad);
    const sinA = Math.sin(rad);
    const halfW = w / 2;
    const halfH = h / 2;

    for (let y = 0; y < h; y++) {
      const ny = (y - halfH) / halfH; // Rango -1 a +1
      for (let x = 0; x < w; x++) {
        const nx = (x - halfW) / halfW; // Rango -1 a +1
        const idx = (y * w + x) * 4;
        const pIdx = y * w + x;

        let r = srcData[idx];
        let g = srcData[idx + 1];
        let b = srcData[idx + 2];

        // A. Corrección Flat-field (restar sombras/luces suaves de fondo)
        if (flatFieldStrength > 0) {
          const compR = r - (blurR[pIdx] - avgR);
          const compG = g - (blurG[pIdx] - avgG);
          const compB = b - (blurB[pIdx] - avgB);

          r = r * (1 - flatFieldStrength) + compR * flatFieldStrength;
          g = g * (1 - flatFieldStrength) + compG * flatFieldStrength;
          b = b * (1 - flatFieldStrength) + compB * flatFieldStrength;
        }

        // B. Gradiente Lineal Direccional
        if (gradIntensity !== 0) {
          const proj = nx * cosA + ny * sinA;
          const gradFactor = 1.0 + proj * gradIntensity;
          r *= gradFactor;
          g *= gradFactor;
          b *= gradFactor;
        }

        // C. Anti-viñeteado (Gradiente Radial)
        if (vignette !== 0) {
          const distSq = nx * nx + ny * ny;
          const vigFactor = 1.0 + (distSq - 0.5) * vignette;
          r *= vigFactor;
          g *= vigFactor;
          b *= vigFactor;
        }

        // D. Brillo y Contraste
        if (brightness !== 0 || contrast !== 1.0) {
          r = (r - 128) * contrast + 128 + brightness * 255;
          g = (g - 128) * contrast + 128 + brightness * 255;
          b = (b - 128) * contrast + 128 + brightness * 255;
        }

        outData[idx]     = Math.min(255, Math.max(0, r));
        outData[idx + 1] = Math.min(255, Math.max(0, g));
        outData[idx + 2] = Math.min(255, Math.max(0, b));
        outData[idx + 3] = srcData[idx + 3];
      }
    }

    ctxDst.putImageData(outImgData, 0, 0);
  }

  // Desenfoque rápido en $O(N)$
  static boxBlurChannel(srcData, w, h, channelOffset, radius) {
    const total = w * h;
    const input = new Float32Array(total);
    for (let i = 0; i < total; i++) {
      input[i] = srcData[i * 4 + channelOffset];
    }

    const temp = new Float32Array(total);
    const output = new Float32Array(total);

    // Horizontal
    for (let y = 0; y < h; y++) {
      let sum = 0;
      const yOffset = y * w;
      for (let r = -radius; r <= radius; r++) {
        const x = Math.min(w - 1, Math.max(0, r));
        sum += input[yOffset + x];
      }
      for (let x = 0; x < w; x++) {
        temp[yOffset + x] = sum / (2 * radius + 1);
        const removeX = Math.max(0, x - radius);
        const addX = Math.min(w - 1, x + radius + 1);
        sum += input[yOffset + addX] - input[yOffset + removeX];
      }
    }

    // Vertical
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let r = -radius; r <= radius; r++) {
        const y = Math.min(h - 1, Math.max(0, r));
        sum += temp[y * w + x];
      }
      for (let y = 0; y < h; y++) {
        output[y * w + x] = sum / (2 * radius + 1);
        const removeY = Math.max(0, y - radius);
        const addY = Math.min(h - 1, y + radius + 1);
        sum += temp[addY * w + x] - temp[removeY * w + x];
      }
    }

    return output;
  }
}