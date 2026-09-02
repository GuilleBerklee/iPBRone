import { PBRGenerator } from './pbr-generator.js';
import { MaterialViewer3D } from './viewer3d.js';
import { SeamlessEngine, CloneStampTool } from './tiling.js';

class App {
  constructor() {
    this.stream = null;
    this.track = null;
    this.isTorchOn = false;
    this.cachedData = null;
    this.activeLayer = 'albedo';
    this.loadedImage = null;

    // Canvases intermedios
    this.croppedBaseCanvas = document.createElement('canvas');
    this.finalTileCanvas = document.createElement('canvas');

    this.cropState = { x: 0.1, y: 0.1, size: 0.8, isDragging: false, isResizing: false };
    this.viewer3D = new MaterialViewer3D('canvas3d-container');

    this.dom = {
      // Vistas
      captureView: document.getElementById('captureView'),
      cropView: document.getElementById('cropView'),
      tilingView: document.getElementById('tilingView'),
      resultsView: document.getElementById('results'),

      // Botones
      startCameraBtn: document.getElementById('startCameraBtn'),
      shutterBtn: document.getElementById('shutterBtn'),
      torchBtn: document.getElementById('torchBtn'),
      galleryBtn: document.getElementById('galleryBtn'),
      fileInput: document.getElementById('fileInput'),
      confirmCropBtn: document.getElementById('confirmCropBtn'),
      cancelCropBtn: document.getElementById('cancelCropBtn'),
      confirmTilingBtn: document.getElementById('confirmTilingBtn'),
      backToCropBtn: document.getElementById('backToCropBtn'),
      retakeBtn: document.getElementById('retakeBtn'),
      downloadAllBtn: document.getElementById('downloadAllBtn'),
      downloadCurrentBtn: document.getElementById('downloadCurrentBtn'),

      // Canvases y Elementos Tiling
      cropCanvas: document.getElementById('cropCanvas'),
      tilingCanvas: document.getElementById('tilingCanvas'),
      tilingGridPreview: document.getElementById('tilingGridPreview'),
      resSelect: document.getElementById('resSelect'),

      // Sliders Tiling
      enableTiling: document.getElementById('enableTiling'),
      bleedSlider: document.getElementById('bleedSlider'),
      bleedVal: document.getElementById('bleedVal'),
      tilingBlurSlider: document.getElementById('tilingBlurSlider'),
      tilingBlurVal: document.getElementById('tilingBlurVal'),

      // Clone Stamp
      setCloneSourceBtn: document.getElementById('setCloneSourceBtn'),
      stampSizeSlider: document.getElementById('stampSizeSlider'),
      stampSizeVal: document.getElementById('stampSizeVal'),
      stampHardnessSlider: document.getElementById('stampHardnessSlider'),
      stampHardnessVal: document.getElementById('stampHardnessVal'),

      // Elementos PBR & 3D
      video: document.getElementById('video'),
      placeholder: document.getElementById('placeholder'),
      statusEl: document.getElementById('status'),
      currentLayerTitle: document.getElementById('currentLayerTitle'),
      hdriSelect: document.getElementById('hdriSelect'),
      hdriRotation: document.getElementById('hdriRotation'),
      hdriRotVal: document.getElementById('hdriRotVal'),

      hdriEnable: document.getElementById('hdriEnable'),
      hdriIntensity: document.getElementById('hdriIntensity'),
      hdriIntensityVal: document.getElementById('hdriIntensityVal'),
      toggleMainMapHeader: document.getElementById('toggleMainMapHeader'),
      mapToggleHint: document.getElementById('mapToggleHint'),
      singleCanvasContainer: document.getElementById('singleCanvasContainer'),

      tiling3dSlider: document.getElementById('tiling3dSlider'),
      tiling3dVal: document.getElementById('tiling3dVal'),

      canvases: {
        albedo: document.getElementById('albedoCanvas'),
        normal: document.getElementById('normalCanvas'),
        roughness: document.getElementById('roughnessCanvas'),
        height: document.getElementById('heightCanvas'),
        ao: document.getElementById('aoCanvas'),
        metallic: document.getElementById('metallicCanvas')
      },
      inputs: {
        albedoBrightness: document.getElementById('albedoBrightness'),
        albedoContrast: document.getElementById('albedoContrast'),
        albedoSaturation: document.getElementById('albedoSaturation'),
        albedoHue: document.getElementById('albedoHue'),

        normalStrength: document.getElementById('normalStrength'),
        normalLevel: document.getElementById('normalLevel'),
        normalBlurSharp: document.getElementById('normalBlurSharp'),
        normalFilter: document.getElementById('normalFilter'),
        normalInvertR: document.getElementById('normalInvertR'),
        normalInvertG: document.getElementById('normalInvertG'),
        normalInvertHeight: document.getElementById('normalInvertHeight'),
        normalZRange: document.getElementById('normalZRange'),

        heightContrast: document.getElementById('heightContrast'),
        heightBlurSharp: document.getElementById('heightBlurSharp'),
        heightInvert: document.getElementById('heightInvert'),
        dispSlider: document.getElementById('dispSlider'),

        aoStrength: document.getElementById('aoStrength'),
        aoMean: document.getElementById('aoMean'),
        aoRange: document.getElementById('aoRange'),
        aoBlurSharp: document.getElementById('aoBlurSharp'),
        aoInvert: document.getElementById('aoInvert'),

        roughnessStrength: document.getElementById('roughnessStrength'),
        roughnessLow: document.getElementById('roughnessLow'),
        roughnessHigh: document.getElementById('roughnessHigh'),
        roughnessOffset: document.getElementById('roughnessOffset'),
        roughnessInvert: document.getElementById('roughnessInvert'),

        metallicSlider: document.getElementById('metallicSlider')
      },
      labels: {
        albedoBrightnessVal: document.getElementById('albedoBrightnessVal'),
        albedoContrastVal: document.getElementById('albedoContrastVal'),
        albedoSaturationVal: document.getElementById('albedoSaturationVal'),
        albedoHueVal: document.getElementById('albedoHueVal'),

        normalStrengthVal: document.getElementById('normalStrengthVal'),
        normalLevelVal: document.getElementById('normalLevelVal'),
        normalBlurSharpVal: document.getElementById('normalBlurSharpVal'),
        normalZRangeVal: document.getElementById('normalZRangeVal'),

        heightContrastVal: document.getElementById('heightContrastVal'),
        heightBlurSharpVal: document.getElementById('heightBlurSharpVal'),
        dispVal: document.getElementById('dispVal'),

        aoStrengthVal: document.getElementById('aoStrengthVal'),
        aoMeanVal: document.getElementById('aoMeanVal'),
        aoRangeVal: document.getElementById('aoRangeVal'),
        aoBlurSharpVal: document.getElementById('aoBlurSharpVal'),

        roughnessStrengthVal: document.getElementById('roughnessStrengthVal'),
        roughnessLowVal: document.getElementById('roughnessLowVal'),
        roughnessHighVal: document.getElementById('roughnessHighVal'),
        roughnessOffsetVal: document.getElementById('roughnessOffsetVal'),

        metallicVal: document.getElementById('metallicVal')
      }
    };
  }

  init() {
    this.bindEvents();
    this.initCropperEvents();
    this.loadHDRList();

    // Inicializar clonador
    this.cloneTool = new CloneStampTool(this.dom.tilingCanvas, (data) => {
      if (data.event === 'source-set') {
        this.dom.setCloneSourceBtn.textContent = '📍 Origen fijado';
        this.dom.setCloneSourceBtn.style.color = '#5cdb95';
      } else {
        this.updateTilingProcess();
      }
    });
  }

  bindEvents() {
    // Etapa 1
    this.dom.startCameraBtn.addEventListener('click', () => this.startCamera());
    this.dom.shutterBtn.addEventListener('click', () => this.capturePhoto());
    this.dom.torchBtn.addEventListener('click', () => this.toggleTorch());
    this.dom.galleryBtn.addEventListener('click', () => this.dom.fileInput.click());
    this.dom.fileInput.addEventListener('change', (e) => this.handleGallerySelect(e));

    // Etapa 2 -> Etapa 3
    this.dom.confirmCropBtn.addEventListener('click', () => this.confirmCrop());
    this.dom.cancelCropBtn.addEventListener('click', () => this.showCaptureView());

    // Etapa 3 -> Etapa 4
    this.dom.confirmTilingBtn.addEventListener('click', () => this.confirmTiling());
    this.dom.backToCropBtn.addEventListener('click', () => this.openCropView(this.loadedImage));

    // Tiling Controls
    this.dom.enableTiling.addEventListener('change', () => this.updateTilingProcess());
    this.dom.bleedSlider.addEventListener('input', (e) => {
      this.dom.bleedVal.textContent = `${Math.round(e.target.value * 100)}%`;
      this.updateTilingProcess();
    });
    this.dom.tilingBlurSlider.addEventListener('input', (e) => {
      this.dom.tilingBlurVal.textContent = `${e.target.value}px`;
      this.updateTilingProcess();
    });

    // Stamp controls
    this.dom.setCloneSourceBtn.addEventListener('click', () => {
      this.cloneTool.isSettingSource = true;
      this.dom.setCloneSourceBtn.textContent = '🎯 Toca el lienzo para fijar origen';
      this.dom.setCloneSourceBtn.style.color = '#e8a33d';
    });
    this.dom.stampSizeSlider.addEventListener('input', (e) => {
      this.dom.stampSizeVal.textContent = `${e.target.value}px`;
      this.cloneTool.brushSize = parseInt(e.target.value, 10);
    });
    this.dom.stampHardnessSlider.addEventListener('input', (e) => {
      this.dom.stampHardnessVal.textContent = e.target.value;
      this.cloneTool.brushHardness = parseFloat(e.target.value);
    });

    // Etapa 4 & Resultados
    this.dom.retakeBtn.addEventListener('click', () => this.showCaptureView());
    this.dom.downloadAllBtn.addEventListener('click', () => this.downloadZip());
    this.dom.downloadCurrentBtn.addEventListener('click', () => {
      this.downloadSingleCanvas(this.dom.canvases[this.activeLayer], `${this.activeLayer}.png`);
    });

    this.dom.hdriSelect.addEventListener('change', (e) => this.viewer3D.loadHDRI(e.target.value));
    this.dom.hdriRotation.addEventListener('input', (e) => {
      const deg = parseFloat(e.target.value);
      this.dom.hdriRotVal.textContent = `${deg}°`;
      this.viewer3D.setHDRIRotation(deg);
    });

    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => this.setActiveLayer(e.target.dataset.layer));
    });

    Object.values(this.dom.inputs).forEach(input => {
      input.addEventListener('input', () => { this.updateLabels(); this.processPBR(); });
      input.addEventListener('change', () => { this.updateLabels(); this.processPBR(); });
    });

    document.querySelectorAll('.mesh-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.mesh-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.viewer3D.setMeshType(e.target.dataset.mesh);
      });
    });

    this.dom.hdriEnable.addEventListener('change', (e) => {
      this.viewer3D.setHDRIEnabled(e.target.checked);
    });

    // 2. Control de Intensidad HDRI
    this.dom.hdriIntensity.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      this.dom.hdriIntensityVal.textContent = `${val.toFixed(1)}x`;
      this.viewer3D.setHDRIIntensity(val);
    });

    // 3. Ocultar / Mostrar vista previa 2D haciendo clic en el título
    this.dom.toggleMainMapHeader.addEventListener('click', () => {
      const isCollapsed = this.dom.singleCanvasContainer.classList.toggle('collapsed');
      
      if (isCollapsed) {
        this.dom.mapToggleHint.textContent = '(clic para mostrar)';
        this.dom.mapToggleHint.style.opacity = '0.9';
        this.dom.mapToggleHint.style.color = 'var(--accent, #e8a33d)';
      } else {
        this.dom.mapToggleHint.textContent = '(clic para ocultar)';
        this.dom.mapToggleHint.style.opacity = '0.6';
        this.dom.mapToggleHint.style.color = '';
      }
    });

    this.dom.tiling3dSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      this.dom.tiling3dVal.textContent = `${val}x`;
      this.viewer3D.setTilingAmount(val);
    });
  }

  // --- PASO 1: Captura ---
  async startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) return;
    try {
      this.dom.statusEl.textContent = 'Iniciando cámara…';
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 3840 }, height: { ideal: 2160 } }
      });
      this.dom.video.srcObject = this.stream;
      await this.dom.video.play();
      this.track = this.stream.getVideoTracks()[0];
      const caps = this.track.getCapabilities ? this.track.getCapabilities() : {};
      this.dom.torchBtn.disabled = !caps.torch;
      this.dom.placeholder.style.display = 'none';
      this.dom.shutterBtn.disabled = false;
      this.dom.statusEl.textContent = 'Cámara activa';
    } catch {
      this.dom.statusEl.textContent = 'Error al acceder a la cámara.';
    }
  }

  async toggleTorch() {
    if (!this.track) return;
    try {
      this.isTorchOn = !this.isTorchOn;
      await this.track.applyConstraints({ advanced: [{ torch: this.isTorchOn }] });
      this.dom.torchBtn.classList.toggle('active', this.isTorchOn);
    } catch { this.isTorchOn = false; }
  }

  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
      this.track = null;
      this.dom.torchBtn.disabled = true;
    }
  }

  async capturePhoto() {
    if (this.track && 'ImageCapture' in window) {
      try {
        const imageCapture = new ImageCapture(this.track);
        const blob = await imageCapture.takePhoto();
        const img = await createImageBitmap(blob);
        this.stopCamera();
        this.openCropView(img);
        return;
      } catch (e) { console.warn('Fallback a captura de vídeo canvas:', e); }
    }

    const vw = this.dom.video.videoWidth;
    const vh = this.dom.video.videoHeight;
    if (!vw || !vh) return;

    const tmp = document.createElement('canvas');
    tmp.width = vw; tmp.height = vh;
    tmp.getContext('2d').drawImage(this.dom.video, 0, 0, vw, vh);

    const img = new Image();
    img.src = tmp.toDataURL('image/png');
    img.onload = () => { this.stopCamera(); this.openCropView(img); };
  }

  handleGallerySelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const img = new Image();
      img.onload = () => { this.stopCamera(); this.openCropView(img); };
      img.src = evt.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  // --- PASO 2: Crop / Encuadre ---
  openCropView(image) {
    this.loadedImage = image;
    this.dom.captureView.style.display = 'none';
    this.dom.tilingView.style.display = 'none';
    this.dom.resultsView.style.display = 'none';
    this.dom.cropView.style.display = 'block';

    this.cropState = { x: 0.1, y: 0.1, size: 0.8 };
    this.renderCropCanvas();
  }

  renderCropCanvas() {
    if (!this.loadedImage) return;
    const canvas = this.dom.cropCanvas;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();

    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;

    const cw = canvas.width;
    const ch = canvas.height;
    ctx.clearRect(0, 0, cw, ch);

    const imgW = this.loadedImage.width;
    const imgH = this.loadedImage.height;
    const scale = Math.min(cw / imgW, ch / imgH);
    const drawW = imgW * scale;
    const drawH = imgH * scale;
    const offsetX = (cw - drawW) / 2;
    const offsetY = (ch - drawH) / 2;

    this.cropLayout = { scale, drawW, drawH, offsetX, offsetY };

    ctx.drawImage(this.loadedImage, offsetX, offsetY, drawW, drawH);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, cw, ch);

    const cropPixelX = offsetX + this.cropState.x * drawW;
    const cropPixelY = offsetY + this.cropState.y * drawH;
    const cropPixelSize = this.cropState.size * Math.min(drawW, drawH);

    ctx.save();
    ctx.beginPath();
    ctx.rect(cropPixelX, cropPixelY, cropPixelSize, cropPixelSize);
    ctx.clip();
    ctx.drawImage(this.loadedImage, offsetX, offsetY, drawW, drawH);
    ctx.restore();

    ctx.strokeStyle = '#e8a33d';
    ctx.lineWidth = 3 * window.devicePixelRatio;
    ctx.strokeRect(cropPixelX, cropPixelY, cropPixelSize, cropPixelSize);

    const handleSize = 16 * window.devicePixelRatio;
    ctx.fillStyle = '#e8a33d';
    ctx.fillRect(cropPixelX + cropPixelSize - handleSize / 2, cropPixelY + cropPixelSize - handleSize / 2, handleSize, handleSize);
  }

  initCropperEvents() {
    const canvas = this.dom.cropCanvas;
    const getPos = (e) => {
      const rect = canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return { x: (clientX - rect.left) * window.devicePixelRatio, y: (clientY - rect.top) * window.devicePixelRatio };
    };

    const startDrag = (e) => {
      if (!this.cropLayout) return;
      const pos = getPos(e);
      const { offsetX, offsetY, drawW, drawH } = this.cropLayout;
      const minDim = Math.min(drawW, drawH);

      const cropPixelX = offsetX + this.cropState.x * drawW;
      const cropPixelY = offsetY + this.cropState.y * drawH;
      const cropPixelSize = this.cropState.size * minDim;
      const handleSize = 24 * window.devicePixelRatio;

      if (Math.abs(pos.x - (cropPixelX + cropPixelSize)) < handleSize && Math.abs(pos.y - (cropPixelY + cropPixelSize)) < handleSize) {
        this.cropState.isResizing = true;
      } else if (pos.x >= cropPixelX && pos.x <= cropPixelX + cropPixelSize && pos.y >= cropPixelY && pos.y <= cropPixelY + cropPixelSize) {
        this.cropState.isDragging = true;
      }

      if (this.cropState.isDragging || this.cropState.isResizing) {
        this.cropState.startX = pos.x;
        this.cropState.startY = pos.y;
        this.cropState.initialCropX = this.cropState.x;
        this.cropState.initialCropY = this.cropState.y;
        this.cropState.initialCropSize = this.cropState.size;
      }
    };

    const moveDrag = (e) => {
      if (!this.cropState.isDragging && !this.cropState.isResizing) return;
      e.preventDefault();
      const pos = getPos(e);
      const { drawW, drawH } = this.cropLayout;
      const minDim = Math.min(drawW, drawH);

      const dx = (pos.x - this.cropState.startX) / drawW;
      const dy = (pos.y - this.cropState.startY) / drawH;

      if (this.cropState.isDragging) {
        const maxCropX = 1 - (this.cropState.size * minDim) / drawW;
        const maxCropY = 1 - (this.cropState.size * minDim) / drawH;
        this.cropState.x = Math.max(0, Math.min(maxCropX, this.cropState.initialCropX + dx));
        this.cropState.y = Math.max(0, Math.min(maxCropY, this.cropState.initialCropY + dy));
      } else if (this.cropState.isResizing) {
        const dSize = (pos.x - this.cropState.startX) / minDim;
        const maxSize = Math.min((drawW - this.cropState.x * drawW) / minDim, (drawH - this.cropState.y * drawH) / minDim);
        this.cropState.size = Math.max(0.1, Math.min(maxSize, this.cropState.initialCropSize + dSize));
      }
      this.renderCropCanvas();
    };

    const endDrag = () => { this.cropState.isDragging = false; this.cropState.isResizing = false; };

    canvas.addEventListener('mousedown', startDrag);
    canvas.addEventListener('mousemove', moveDrag);
    window.addEventListener('mouseup', endDrag);
    canvas.addEventListener('touchstart', startDrag, { passive: false });
    canvas.addEventListener('touchmove', moveDrag, { passive: false });
    window.addEventListener('touchend', endDrag);
  }

  confirmCrop() {
    if (!this.loadedImage) return;

    const imgW = this.loadedImage.width;
    const imgH = this.loadedImage.height;
    const minDim = Math.min(imgW, imgH);

    const sourceX = this.cropState.x * imgW;
    const sourceY = this.cropState.y * imgH;
    const sourceSize = this.cropState.size * minDim;

    const resSetting = this.dom.resSelect.value;
    let outSize = Math.round(sourceSize);
    if (resSetting !== 'max') {
      outSize = Math.min(parseInt(resSetting, 10), outSize);
    }

    this.croppedBaseCanvas.width = outSize;
    this.croppedBaseCanvas.height = outSize;
    const ctx = this.croppedBaseCanvas.getContext('2d');
    ctx.drawImage(this.loadedImage, sourceX, sourceY, sourceSize, sourceSize, 0, 0, outSize, outSize);

    this.openTilingView();
  }

  // --- PASO 3: Tiling & Tampón ---
  openTilingView() {
    this.dom.cropView.style.display = 'none';
    this.dom.tilingView.style.display = 'block';

    // Inicializar lienzo de trabajo con la imagen recortada
    const tCanvas = this.dom.tilingCanvas;
    tCanvas.width = this.croppedBaseCanvas.width;
    tCanvas.height = this.croppedBaseCanvas.height;
    tCanvas.getContext('2d').drawImage(this.croppedBaseCanvas, 0, 0);

    this.cloneTool.sourcePoint = null;
    this.dom.setCloneSourceBtn.textContent = '📍 Fijar Origen';
    this.dom.setCloneSourceBtn.style.color = '';

    this.updateTilingProcess();
  }

  updateTilingProcess() {
    const isEnabled = this.dom.enableTiling.checked;
    const bleed = parseFloat(this.dom.bleedSlider.value);
    const blur = parseInt(this.dom.tilingBlurSlider.value, 10);

    if (isEnabled) {
      SeamlessEngine.process(this.dom.tilingCanvas, this.finalTileCanvas, bleed, blur);
    } else {
      this.finalTileCanvas.width = this.dom.tilingCanvas.width;
      this.finalTileCanvas.height = this.dom.tilingCanvas.height;
      this.finalTileCanvas.getContext('2d').drawImage(this.dom.tilingCanvas, 0, 0);
    }

    // Actualizar fondo en mosaico (3x3 grid preview)
    const dataUrl = this.finalTileCanvas.toDataURL('image/png');
    this.dom.tilingGridPreview.style.backgroundImage = `url("${dataUrl}")`;
  }

  confirmTiling() {
    const w = this.finalTileCanvas.width;
    const h = this.finalTileCanvas.height;
    const ctx = this.finalTileCanvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, w, h);

    this.cachedData = {
      imageData,
      w,
      h,
      luminance: PBRGenerator.computeLuminance(imageData)
    };

    this.dom.tilingView.style.display = 'none';
    this.dom.resultsView.style.display = 'block';

    setTimeout(() => {
      this.viewer3D.init();
      this.viewer3D.loadHDRI(this.dom.hdriSelect.value);
      this.viewer3D.resize();
      this.processPBR();
      this.setActiveLayer('albedo');
    }, 50);
  }

  // --- PASO 4: Generación PBR & 3D ---
  processPBR() {
    if (!this.cachedData) return;
    const { imageData, w, h, luminance } = this.cachedData;
    const inp = this.dom.inputs;

    const lowFreqBig = PBRGenerator.boxBlur(luminance, w, h, Math.max(8, Math.round(Math.min(w, h) * 0.15)));

    const albedoData = PBRGenerator.generateAlbedo(imageData, lowFreqBig, w, h, {
      brightness: parseFloat(inp.albedoBrightness.value),
      contrast: parseFloat(inp.albedoContrast.value),
      saturation: parseFloat(inp.albedoSaturation.value),
      hue: parseFloat(inp.albedoHue.value)
    });

    const normalData = PBRGenerator.generateNormal(luminance, w, h, {
      strength: parseFloat(inp.normalStrength.value),
      level: parseFloat(inp.normalLevel.value),
      blurSharp: parseFloat(inp.normalBlurSharp.value),
      filter: inp.normalFilter.value,
      invertR: inp.normalInvertR.checked,
      invertG: inp.normalInvertG.checked,
      invertHeight: inp.normalInvertHeight.checked,
      zRange: parseFloat(inp.normalZRange.value)
    });

    const heightData = PBRGenerator.generateHeight(luminance, w, h, {
      contrast: parseFloat(inp.heightContrast.value),
      blurSharp: parseFloat(inp.heightBlurSharp.value),
      invert: inp.heightInvert.checked
    });

    const roughnessData = PBRGenerator.generateRoughness(luminance, w, h, {
      strength: parseFloat(inp.roughnessStrength.value),
      low: parseFloat(inp.roughnessLow.value),
      max: parseFloat(inp.roughnessHigh.value),
      offset: parseFloat(inp.roughnessOffset.value),
      invert: inp.roughnessInvert.checked
    });

    const aoData = PBRGenerator.generateAO(luminance, w, h, {
      strength: parseFloat(inp.aoStrength.value),
      mean: parseFloat(inp.aoMean.value),
      range: parseFloat(inp.aoRange.value),
      blurSharp: parseFloat(inp.aoBlurSharp.value),
      invert: inp.aoInvert.checked
    });

    const metallicVal = parseFloat(inp.metallicSlider.value);
    const metallicData = PBRGenerator.generateMetallic(w, h, metallicVal);

    this.drawToCanvas(this.dom.canvases.albedo, albedoData);
    this.drawToCanvas(this.dom.canvases.normal, normalData);
    this.drawToCanvas(this.dom.canvases.roughness, roughnessData);
    this.drawToCanvas(this.dom.canvases.height, heightData);
    this.drawToCanvas(this.dom.canvases.ao, aoData);
    this.drawToCanvas(this.dom.canvases.metallic, metallicData);

    const dispVal = parseFloat(inp.dispSlider.value);
    this.viewer3D.updateTextures(this.dom.canvases, { disp: dispVal, metallic: metallicVal });
  }

  drawToCanvas(canvas, imageData) {
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    canvas.getContext('2d').putImageData(imageData, 0, 0);
  }

  setActiveLayer(layerKey) {
    this.activeLayer = layerKey;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.layer === layerKey));
    Object.keys(this.dom.canvases).forEach(k => this.dom.canvases[k].classList.toggle('active', k === layerKey));

    const titles = {
      albedo: 'Mapa Albedo / Color',
      normal: 'Mapa de Normales',
      roughness: 'Mapa de Rugosidad',
      height: 'Mapa de Altura',
      ao: 'Oclusión Ambiental',
      metallic: 'Mapa Metálico'
    };
    this.dom.currentLayerTitle.textContent = titles[layerKey] || layerKey;

    document.querySelectorAll('.layer-control-group').forEach(g => g.style.display = 'none');
    const activeCtrl = document.getElementById(`ctrl-${layerKey}`);
    if (activeCtrl) activeCtrl.style.display = 'block';
  }

  updateLabels() {
    const inp = this.dom.inputs;
    const lbl = this.dom.labels;

    lbl.albedoBrightnessVal.textContent = parseFloat(inp.albedoBrightness.value).toFixed(2);
    lbl.albedoContrastVal.textContent = parseFloat(inp.albedoContrast.value).toFixed(2);
    lbl.albedoSaturationVal.textContent = parseFloat(inp.albedoSaturation.value).toFixed(2);
    lbl.albedoHueVal.textContent = `${inp.albedoHue.value}°`;

    lbl.normalStrengthVal.textContent = parseFloat(inp.normalStrength.value).toFixed(1);
    lbl.normalLevelVal.textContent = parseFloat(inp.normalLevel.value).toFixed(1);
    lbl.normalBlurSharpVal.textContent = inp.normalBlurSharp.value;
    lbl.normalZRangeVal.textContent = parseFloat(inp.normalZRange.value).toFixed(2);

    lbl.heightContrastVal.textContent = parseFloat(inp.heightContrast.value).toFixed(1);
    lbl.heightBlurSharpVal.textContent = inp.heightBlurSharp.value;
    lbl.dispVal.textContent = parseFloat(inp.dispSlider.value).toFixed(3);

    lbl.aoStrengthVal.textContent = parseFloat(inp.aoStrength.value).toFixed(1);
    lbl.aoMeanVal.textContent = parseFloat(inp.aoMean.value).toFixed(2);
    lbl.aoRangeVal.textContent = inp.aoRange.value;
    lbl.aoBlurSharpVal.textContent = inp.aoBlurSharp.value;

    lbl.roughnessStrengthVal.textContent = parseFloat(inp.roughnessStrength.value).toFixed(1);
    lbl.roughnessLowVal.textContent = parseFloat(inp.roughnessLow.value).toFixed(2);
    lbl.roughnessHighVal.textContent = parseFloat(inp.roughnessHigh.value).toFixed(2);
    lbl.roughnessOffsetVal.textContent = parseFloat(inp.roughnessOffset.value).toFixed(2);

    lbl.metallicVal.textContent = parseFloat(inp.metallicSlider.value).toFixed(2);
  }

  showCaptureView() {
    this.dom.cropView.style.display = 'none';
    this.dom.tilingView.style.display = 'none';
    this.dom.resultsView.style.display = 'none';
    this.dom.captureView.style.display = 'block';
    this.dom.placeholder.style.display = 'flex';
    this.dom.shutterBtn.disabled = true;
    this.dom.statusEl.textContent = 'Cámara desactivada';
    this.startCamera();
  }

  downloadSingleCanvas(canvas, filename) {
    canvas.toBlob(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
  }

  async downloadZip() {
    if (!window.JSZip) return;
    const zip = new window.JSZip();
    const names = ['albedo', 'normal', 'roughness', 'height', 'ao', 'metallic'];

    for (const name of names) {
      const blob = await new Promise(res => this.dom.canvases[name].toBlob(res, 'image/png'));
      if (blob) zip.file(`${name}.png`, blob);
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'material-pbr.zip';
    a.click();
    URL.revokeObjectURL(url);
  }

  async loadHDRList() {
    try {
      const response = await fetch('assets/environment/lista.json');
      const hdris = await response.json();
      this.dom.hdriSelect.innerHTML = '';
      hdris.forEach((hdri) => {
        const opt = document.createElement('option');
        opt.value = hdri.file;
        opt.textContent = hdri.name;
        this.dom.hdriSelect.appendChild(opt);
      });
      if (this.viewer3D.initialized && hdris.length > 0) {
        this.viewer3D.loadHDRI(hdris[0].file);
      }
    } catch {
      this.dom.hdriSelect.innerHTML = '<option value="">Sin entornos disponibles</option>';
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.init();
});