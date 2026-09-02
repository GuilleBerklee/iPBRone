export class SeamlessEngine {
  /**
   * Genera una textura continua suavizando únicamente los bordes exteriores
   * (derecho e inferior) para encajarlos con los bordes opuestos.
   */
  static process(sourceCanvas, targetCanvas, bleedRatio = 0.15) {
    const w = sourceCanvas.width;
    const h = sourceCanvas.height;

    targetCanvas.width = w;
    targetCanvas.height = h;
    const tCtx = targetCanvas.getContext('2d');

    // 1. Renderizar la imagen original como base intacta
    tCtx.drawImage(sourceCanvas, 0, 0);

    const marginX = Math.floor(w * bleedRatio);
    const marginY = Math.floor(h * bleedRatio);

    if (marginX <= 0 || marginY <= 0) return;

    // 2. Transición del borde Izquierdo sobre el borde Derecho
    const stripRight = document.createElement('canvas');
    stripRight.width = marginX;
    stripRight.height = h;
    const srCtx = stripRight.getContext('2d');

    // Copiar e invertir la franja izquierda para que encaje geométricamente
    srCtx.translate(marginX, 0);
    srCtx.scale(-1, 1);
    srCtx.drawImage(sourceCanvas, 0, 0, marginX, h, 0, 0, marginX, h);
    srCtx.setTransform(1, 0, 0, 1, 0, 0);

    // Aplicar máscara de transparencia (0% en el interior, 100% en el borde exterior)
    const gradR = srCtx.createLinearGradient(0, 0, marginX, 0);
    gradR.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gradR.addColorStop(1, 'rgba(0, 0, 0, 1)');
    srCtx.globalCompositeOperation = 'destination-in';
    srCtx.fillStyle = gradR;
    srCtx.fillRect(0, 0, marginX, h);

    tCtx.drawImage(stripRight, w - marginX, 0);

    // 3. Transición del borde Superior sobre el borde Inferior
    const stripBottom = document.createElement('canvas');
    stripBottom.width = w;
    stripBottom.height = marginY;
    const sbCtx = stripBottom.getContext('2d');

    // Copiar e invertir la franja superior tomada del canvas ya procesado
    sbCtx.translate(0, marginY);
    sbCtx.scale(1, -1);
    sbCtx.drawImage(targetCanvas, 0, 0, w, marginY, 0, 0, w, marginY);
    sbCtx.setTransform(1, 0, 0, 1, 0, 0);

    // Aplicar máscara de transparencia vertical
    const gradB = sbCtx.createLinearGradient(0, 0, 0, marginY);
    gradB.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gradB.addColorStop(1, 'rgba(0, 0, 0, 1)');
    sbCtx.globalCompositeOperation = 'destination-in';
    sbCtx.fillStyle = gradB;
    sbCtx.fillRect(0, 0, w, marginY);

    tCtx.drawImage(stripBottom, 0, h - marginY);
  }
}

export class CloneStampTool {
  constructor(canvas, onChangeCallback) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onChange = onChangeCallback;
    
    this.sourcePoint = null;
    this.isSettingSource = false;
    this.isPainting = false;
    
    this.brushSize = 35;
    this.brushHardness = 0.4;

    this.snapshot = null;
    this.strokeStart = null;

    this.initEvents();
  }

  initEvents() {
    const getPos = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
      };
    };

    const start = (e) => {
      const pos = getPos(e);

      if (this.isSettingSource) {
        this.sourcePoint = pos;
        this.isSettingSource = false;
        if (this.onChange) this.onChange({ event: 'source-set', pos });
        return;
      }

      if (!this.sourcePoint) return;

      this.isPainting = true;
      this.strokeStart = pos;

      // Guardar copia antes de comenzar la pincelada
      this.snapshot = document.createElement('canvas');
      this.snapshot.width = this.canvas.width;
      this.snapshot.height = this.canvas.height;
      this.snapshot.getContext('2d').drawImage(this.canvas, 0, 0);

      this.paint(pos.x, pos.y);
    };

    const move = (e) => {
      if (!this.isPainting) return;
      e.preventDefault();
      const pos = getPos(e);
      this.paint(pos.x, pos.y);
    };

    const stop = () => {
      if (this.isPainting) {
        this.isPainting = false;
        this.snapshot = null;
        if (this.onChange) this.onChange({ event: 'stroke-end' });
      }
    };

    this.canvas.addEventListener('mousedown', start);
    this.canvas.addEventListener('mousemove', move);
    window.addEventListener('mouseup', stop);

    this.canvas.addEventListener('touchstart', start, { passive: false });
    this.canvas.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('touchend', stop);
  }

  paint(x, y) {
    if (!this.sourcePoint || !this.snapshot) return;

    const dx = x - this.strokeStart.x;
    const dy = y - this.strokeStart.y;

    const srcX = this.sourcePoint.x + dx;
    const srcY = this.sourcePoint.y + dy;

    const r = this.brushSize;
    const stamp = document.createElement('canvas');
    stamp.width = r * 2;
    stamp.height = r * 2;
    const sCtx = stamp.getContext('2d');

    sCtx.beginPath();
    sCtx.arc(r, r, r, 0, Math.PI * 2);
    sCtx.clip();

    sCtx.drawImage(
      this.snapshot,
      srcX - r, srcY - r, r * 2, r * 2,
      0, 0, r * 2, r * 2
    );

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

    this.ctx.drawImage(stamp, x - r, y - r);
    if (this.onChange) this.onChange({ event: 'paint' });
  }
}