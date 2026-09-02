export class TilingEngine {
  /**
   * Genera una textura tileable usando el método de desplazamiento y fusión cruzada.
   * @param {HTMLCanvasElement} canvas - Canvas con la imagen a procesar.
   * @param {number} bleedRatio - Porcentaje de solapamiento para la fusión (0.05 a 0.35).
   * @param {number} blurPx - Radio de desenfoque/suavizado de la máscara (0 a 30px).
   */
  static makeSeamless(canvas, bleedRatio = 0.15, blurPx = 10) {
    const w = canvas.width;
    const h = canvas.height;
    
    // Canvas temporal con la imagen original
    const origCtx = canvas.getContext('2d');
    const origData = origCtx.getImageData(0, 0, w, h);

    // Canvas desplazado (Offset W/2, H/2)
    const offsetCanvas = document.createElement('canvas');
    offsetCanvas.width = w;
    offsetCanvas.height = h;
    const offCtx = offsetCanvas.getContext('2d');

    // Dibujar los 4 cuadrantes invertidos
    const halfW = Math.floor(w / 2);
    const halfH = Math.floor(h / 2);

    offCtx.drawImage(canvas, 0, 0, halfW, halfH, halfW, halfH, halfW, halfH);
    offCtx.drawImage(canvas, halfW, 0, w - halfW, halfH, 0, halfH, w - halfW, halfH);
    offCtx.drawImage(canvas, 0, halfH, halfW, h - halfH, halfW, 0, halfW, h - halfH);
    offCtx.drawImage(canvas, halfW, halfH, w - halfW, h - halfH, 0, 0, w - halfW, h - halfH);

    if (bleedRatio <= 0) {
      origCtx.drawImage(offsetCanvas, 0, 0);
      return;
    }

    // Crear máscara de fusión en cruz (Centro)
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = w;
    maskCanvas.height = h;
    const maskCtx = maskCanvas.getContext('2d');

    const seamW = Math.floor(w * bleedRatio);
    const seamH = Math.floor(h * bleedRatio);

    // Dibujar banda vertical y horizontal para ocultar las costuras centrales
    maskCtx.fillStyle = '#ffffff';
    maskCtx.fillRect(halfW - seamW / 2, 0, seamW, h);
    maskCtx.fillRect(0, halfH - seamH / 2, w, seamH);

    // Aplicar Blur a la máscara si se solicita
    if (blurPx > 0) {
      const blurredMask = document.createElement('canvas');
      blurredMask.width = w;
      blurredMask.height = h;
      const bCtx = blurredMask.getContext('2d');
      bCtx.filter = `blur(${blurPx}px)`;
      bCtx.drawImage(maskCanvas, 0, 0);
      maskCtx.clearRect(0, 0, w, h);
      maskCtx.drawImage(blurredMask, 0, 0);
    }

    // Fusión: Combinar imagen desplazada con la original usando la máscara
    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = w;
    finalCanvas.height = h;
    const finalCtx = finalCanvas.getContext('2d');

    // Dibujar base (desplazada)
    finalCtx.drawImage(offsetCanvas, 0, 0);

    // Superponer original usando la máscara invertida
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = w;
    tempCanvas.height = h;
    const tempCtx = tempCanvas.getContext('2d');

    tempCtx.drawImage(canvas, 0, 0);
    tempCtx.globalCompositeOperation = 'destination-out';
    tempCtx.drawImage(maskCanvas, 0, 0);

    finalCtx.drawImage(tempCanvas, 0, 0);

    // Copiar resultado de vuelta al canvas principal
    origCtx.drawImage(finalCanvas, 0, 0);
  }
}

export class CloneStampTool {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.sourcePoint = null;
    this.isSettingSource = false;
    this.isCloning = false;
    this.brushSize = 30;
    this.brushHardness = 0.5; // 0 (muy suave) a 1 (borde duro)
    
    // Buffer para guardar estado original antes de un trazo
    this.snapshot = null;
    this.strokeStart = null;
  }

  setSource(x, y) {
    this.sourcePoint = { x, y };
  }

  startStroke(x, y) {
    if (!this.sourcePoint) return;
    this.isCloning = true;
    this.strokeStart = { x, y };
    
    // Guardar copia del canvas al iniciar el trazo
    this.snapshot = document.createElement('canvas');
    this.snapshot.width = this.canvas.width;
    this.snapshot.height = this.canvas.height;
    this.snapshot.getContext('2d').drawImage(this.canvas, 0, 0);
  }

  paint(currentX, currentY) {
    if (!this.isCloning || !this.sourcePoint || !this.snapshot) return;

    // Calcular desplazamiento respecto al punto inicial
    const offsetX = currentX - this.strokeStart.x;
    const offsetY = currentY - this.strokeStart.y;

    const currentSourceX = this.sourcePoint.x + offsetX;
    const currentSourceY = this.sourcePoint.y + offsetY;

    const r = this.brushSize;

    // Crear estampa circular con borde suave
    const stamp = document.createElement('canvas');
    stamp.width = r * 2;
    stamp.height = r * 2;
    const sCtx = stamp.getContext('2d');

    // Recortar círculo
    sCtx.beginPath();
    sCtx.arc(r, r, r, 0, Math.PI * 2);
    sCtx.clip();

    // Copiar zona desde el buffer original en la posición fuente
    sCtx.drawImage(
      this.snapshot,
      currentSourceX - r, currentSourceY - r, r * 2, r * 2,
      0, 0, r * 2, r * 2
    );

    // Aplicar desvanecimiento de bordes si hardness < 1
    if (this.brushHardness < 1) {
      const grad = sCtx.createRadialGradient(r, r, r * this.brushHardness, r, r, r);
      grad.addColorStop(0, 'rgba(0,0,0,1)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      sCtx.globalCompositeOperation = 'destination-in';
      sCtx.fillStyle = grad;
      sCtx.beginPath();
      sCtx.arc(r, r, r, 0, Math.PI * 2);
      sCtx.fill();
    }

    // Estampar en el canvas destino
    this.ctx.drawImage(stamp, currentX - r, currentY - r);
  }

  stopStroke() {
    this.isCloning = false;
    this.snapshot = null;
  }
}