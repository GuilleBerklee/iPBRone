export class SeamlessEngine {
  /**
   * Genera el mapa continuo mediante desplazamiento de cuadrantes y fusión por máscara difuminada
   */
  static process(sourceCanvas, targetCanvas, bleedRatio = 0.15, blurPx = 12) {
    const w = sourceCanvas.width;
    const h = sourceCanvas.height;

    targetCanvas.width = w;
    targetCanvas.height = h;

    const tCtx = targetCanvas.getContext('2d');
    
    // Canvas temporal con imagen desplazada (Offset W/2, H/2)
    const offsetCanvas = document.createElement('canvas');
    offsetCanvas.width = w;
    offsetCanvas.height = h;
    const offCtx = offsetCanvas.getContext('2d');

    const halfW = Math.floor(w / 2);
    const halfH = Math.floor(h / 2);

    offCtx.drawImage(sourceCanvas, 0, 0, halfW, halfH, halfW, halfH, halfW, halfH);
    offCtx.drawImage(sourceCanvas, halfW, 0, w - halfW, halfH, 0, halfH, w - halfW, halfH);
    offCtx.drawImage(sourceCanvas, 0, halfH, halfW, h - halfH, halfW, 0, halfW, h - halfH);
    offCtx.drawImage(sourceCanvas, halfW, halfH, w - halfW, h - halfH, 0, 0, w - halfW, h - halfH);

    if (bleedRatio <= 0) {
      tCtx.drawImage(offsetCanvas, 0, 0);
      return;
    }

    // Crear máscara de fusión en cruz
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = w;
    maskCanvas.height = h;
    const maskCtx = maskCanvas.getContext('2d');

    const seamW = Math.floor(w * bleedRatio);
    const seamH = Math.floor(h * bleedRatio);

    maskCtx.fillStyle = '#ffffff';
    maskCtx.fillRect(halfW - seamW / 2, 0, seamW, h);
    maskCtx.fillRect(0, halfH - seamH / 2, w, seamH);

    // Aplicar desenfoque gaussiano
    if (blurPx > 0) {
      const blurCanvas = document.createElement('canvas');
      blurCanvas.width = w;
      blurCanvas.height = h;
      const bCtx = blurCanvas.getContext('2d');
      bCtx.filter = `blur(${blurPx}px)`;
      bCtx.drawImage(maskCanvas, 0, 0);

      maskCtx.clearRect(0, 0, w, h);
      maskCtx.drawImage(blurCanvas, 0, 0);
    }

    // Renderizar base desplazada
    tCtx.drawImage(offsetCanvas, 0, 0);

    // Combinar con la original
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = w;
    tempCanvas.height = h;
    const tempCtx = tempCanvas.getContext('2d');

    tempCtx.drawImage(sourceCanvas, 0, 0);
    tempCtx.globalCompositeOperation = 'destination-out';
    tempCtx.drawImage(maskCanvas, 0, 0);

    tCtx.drawImage(tempCanvas, 0, 0);
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