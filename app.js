import { PBRGenerator } from './pbr-generator.js';
import { MaterialViewer3D } from './viewer3d.js';

class App {
  constructor() {
    this.stream = null;
    this.track = null;
    this.isTorchOn = false;
    this.cachedData = null;
    this.activeLayer = 'albedo';
    
    this.viewer3D = new MaterialViewer3D('canvas3d-container');

    this.dom = {
      video: document.getElementById('video'),
      placeholder: document.getElementById('placeholder'),
      shutterBtn: document.getElementById('shutterBtn'),
      torchBtn: document.getElementById('torchBtn'),
      startCameraBtn: document.getElementById('startCameraBtn'),
      statusEl: document.getElementById('status'),
      captureView: document.getElementById('captureView'),
      resultsView: document.getElementById('results'),
      retakeBtn: document.getElementById('retakeBtn'),
      downloadAllBtn: document.getElementById('downloadAllBtn'),
      downloadCurrentBtn: document.getElementById('downloadCurrentBtn'),
      resSelect: document.getElementById('resSelect'),
      currentLayerTitle: document.getElementById('currentLayerTitle'),
      hdriSelect: document.getElementById('hdriSelect'),
      hdriRotation: document.getElementById('hdriRotation'),
      hdriRotVal: document.getElementById('hdriRotVal'),
      
      canvases: {
        albedo: document.getElementById('albedoCanvas'),
        normal: document.getElementById('normalCanvas'),
        roughness: document.getElementById('roughnessCanvas'),
        height: document.getElementById('heightCanvas'),
        ao: document.getElementById('aoCanvas'),
        metallic: document.getElementById('metallicCanvas')
      },
      
      inputs: {
        albedoContrast: document.getElementById('albedoContrast'),
        albedoSaturation: document.getElementById('albedoSaturation'),
        albedoTint: document.getElementById('albedoTint'),
        normalStrength: document.getElementById('normalStrength'),
        normalIntensity: document.getElementById('normalIntensity'),
        heightContrast: document.getElementById('heightContrast'),
        heightOffset: document.getElementById('heightOffset'),
        dispSlider: document.getElementById('dispSlider'),
        roughnessContrast: document.getElementById('roughnessContrast'),
        roughnessLow: document.getElementById('roughnessLow'),
        roughnessHigh: document.getElementById('roughnessHigh'),
        roughnessOffset: document.getElementById('roughnessOffset'),
        roughnessInvert: document.getElementById('roughnessInvert'),
        aoAmount: document.getElementById('aoAmount'),
        aoContrast: document.getElementById('aoContrast'),
        metallicSlider: document.getElementById('metallicSlider')
      },
      
      labels: {
        albedoContrastVal: document.getElementById('albedoContrastVal'),
        albedoSaturationVal: document.getElementById('albedoSaturationVal'),
        normalStrengthVal: document.getElementById('normalStrengthVal'),
        normalIntensityVal: document.getElementById('normalIntensityVal'),
        heightContrastVal: document.getElementById('heightContrastVal'),
        heightOffsetVal: document.getElementById('heightOffsetVal'),
        dispVal: document.getElementById('dispVal'),
        roughnessContrastVal: document.getElementById('roughnessContrastVal'),
        roughnessLowVal: document.getElementById('roughnessLowVal'),
        roughnessHighVal: document.getElementById('roughnessHighVal'),
        roughnessOffsetVal: document.getElementById('roughnessOffsetVal'),
        aoAmountVal: document.getElementById('aoAmountVal'),
        aoContrastVal: document.getElementById('aoContrastVal'),
        metallicVal: document.getElementById('metallicVal')
      }
    };
  }

  init() {
    this.bindEvents();
    if (!window.isSecureContext && location.hostname !== 'localhost') {
      const banner = document.getElementById('secureBanner');
      if (banner) banner.style.display = 'block';
    }
  }

  bindEvents() {
    this.dom.startCameraBtn.addEventListener('click', () => this.startCamera());
    this.dom.shutterBtn.addEventListener('click', () => this.capturePhoto());
    this.dom.torchBtn.addEventListener('click', () => this.toggleTorch());
    this.dom.retakeBtn.addEventListener('click', () => this.showCaptureView());
    this.dom.downloadAllBtn.addEventListener('click', () => this.downloadZip());
    this.dom.downloadCurrentBtn.addEventListener('click', () => {
      this.downloadSingleCanvas(this.dom.canvases[this.activeLayer], `${this.activeLayer}.png`);
    });

    this.dom.hdriSelect.addEventListener('change', (e) => {
      this.viewer3D.loadHDRI(e.target.value);
    });

    this.dom.hdriRotation.addEventListener('input', (e) => {
      const deg = parseFloat(e.target.value);
      this.dom.hdriRotVal.textContent = `${deg}°`;
      this.viewer3D.setHDRIRotation(deg);
    });

    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const layer = e.target.dataset.layer;
        this.setActiveLayer(layer);
      });
    });

    Object.values(this.dom.inputs).forEach(input => {
      input.addEventListener('input', () => {
        this.updateLabels();
        this.processPBR();
      });
    });

    document.querySelectorAll('.mesh-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.mesh-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.viewer3D.setMeshType(e.target.dataset.mesh);
      });
    });
  }

  setActiveLayer(layerKey) {
    this.activeLayer = layerKey;

    document.querySelectorAll('.tab-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.layer === layerKey);
    });

    Object.keys(this.dom.canvases).forEach(k => {
      this.dom.canvases[k].classList.toggle('active', k === layerKey);
    });

    const titles = {
      albedo: 'Mapa Albedo / Color',
      normal: 'Mapa de Normales',
      roughness: 'Mapa de Rugosidad (Roughness)',
      height: 'Mapa de Altura (Height / Displacement)',
      ao: 'Oclusión Ambiental (AO)',
      metallic: 'Mapa Metálico'
    };
    this.dom.currentLayerTitle.textContent = titles[layerKey] || layerKey;

    document.querySelectorAll('.layer-control-group').forEach(group => {
      group.style.display = 'none';
    });
    const activeCtrl = document.getElementById(`ctrl-${layerKey}`);
    if (activeCtrl) activeCtrl.style.display = 'block';
  }

  async startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      this.dom.statusEl.textContent = 'Cámara no soportada en este navegador.';
      return;
    }

    try {
      this.dom.statusEl.textContent = 'Iniciando cámara…';
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 3840 }, height: { ideal: 2160 } }
      });

      this.dom.video.srcObject = this.stream;
      await this.dom.video.play();

      this.track = this.stream.getVideoTracks()[0];
      const capabilities = this.track.getCapabilities ? this.track.getCapabilities() : {};
      this.dom.torchBtn.disabled = !capabilities.torch;

      this.dom.placeholder.style.display = 'none';
      this.dom.shutterBtn.disabled = false;
      this.dom.statusEl.textContent = 'Cámara activa';
    } catch (err) {
      this.dom.statusEl.textContent = 'Error al acceder a la cámara.';
    }
  }

  async toggleTorch() {
    if (!this.track) return;
    try {
      this.isTorchOn = !this.isTorchOn;
      await this.track.applyConstraints({ advanced: [{ torch: this.isTorchOn }] });
      this.dom.torchBtn.classList.toggle('active', this.isTorchOn);
    } catch {
      this.isTorchOn = false;
      this.dom.torchBtn.classList.remove('active');
    }
  }

  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
      this.track = null;
      this.dom.torchBtn.disabled = true;
    }
  }

  capturePhoto() {
    const vw = this.dom.video.videoWidth;
    const vh = this.dom.video.videoHeight;
    if (!vw || !vh) return;

    const cropSize = Math.min(vw, vh);
    const sx = (vw - cropSize) / 2;
    const sy = (vh - cropSize) / 2;

    const resSetting = this.dom.resSelect.value;
    let outSize = cropSize;
    if (resSetting !== 'max') {
      outSize = Math.min(parseInt(resSetting, 10), cropSize);
    }

    const tmp = document.createElement('canvas');
    tmp.width = outSize;
    tmp.height = outSize;
    const ctx = tmp.getContext('2d');
    ctx.drawImage(this.dom.video, sx, sy, cropSize, cropSize, 0, 0, outSize, outSize);

    const imageData = ctx.getImageData(0, 0, outSize, outSize);
    this.cachedData = {
      imageData,
      w: outSize,
      h: outSize,
      luminance: PBRGenerator.computeLuminance(imageData)
    };

    this.stopCamera();

    this.dom.captureView.style.display = 'none';
    this.dom.resultsView.style.display = 'block';

    setTimeout(() => {
      this.viewer3D.init();
      this.viewer3D.loadHDRI(this.dom.hdriSelect.value);
      this.viewer3D.resize();
      this.processPBR();
      this.setActiveLayer('albedo');
    }, 50);
  }

  processPBR() {
    if (!this.cachedData) return;
    const { imageData, w, h, luminance } = this.cachedData;

    const Lsmooth = PBRGenerator.boxBlur(luminance, w, h, 1);
    const lowFreqBig = PBRGenerator.boxBlur(luminance, w, h, Math.max(8, Math.round(Math.min(w, h) * 0.15)));

    const inp = this.dom.inputs;

    const albedoData = PBRGenerator.generateAlbedo(imageData, lowFreqBig, w, h, {
      contrast: parseFloat(inp.albedoContrast.value),
      saturation: parseFloat(inp.albedoSaturation.value),
      tint: inp.albedoTint.value
    });

    const normalData = PBRGenerator.generateNormal(Lsmooth, w, h, {
      strength: parseFloat(inp.normalStrength.value),
      intensity: parseFloat(inp.normalIntensity.value)
    });

    const heightData = PBRGenerator.generateHeight(luminance, w, h, {
      contrast: parseFloat(inp.heightContrast.value),
      offset: parseFloat(inp.heightOffset.value)
    });

    const roughnessData = PBRGenerator.generateRoughness(luminance, w, h, {
      contrast: parseFloat(inp.roughnessContrast.value),
      low: parseFloat(inp.roughnessLow.value),
      high: parseFloat(inp.roughnessHigh.value),
      offset: parseFloat(inp.roughnessOffset.value),
      invert: inp.roughnessInvert.checked
    });

    const aoData = PBRGenerator.generateAO(luminance, w, h, {
      amount: parseFloat(inp.aoAmount.value),
      contrast: parseFloat(inp.aoContrast.value)
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
    const ctx = canvas.getContext('2d');
    ctx.putImageData(imageData, 0, 0);
  }

  updateLabels() {
    const inp = this.dom.inputs;
    const lbl = this.dom.labels;

    lbl.albedoContrastVal.textContent = parseFloat(inp.albedoContrast.value).toFixed(2);
    lbl.albedoSaturationVal.textContent = parseFloat(inp.albedoSaturation.value).toFixed(2);
    lbl.normalStrengthVal.textContent = parseFloat(inp.normalStrength.value).toFixed(1);
    lbl.normalIntensityVal.textContent = parseFloat(inp.normalIntensity.value).toFixed(1);
    lbl.heightContrastVal.textContent = parseFloat(inp.heightContrast.value).toFixed(1);
    lbl.heightOffsetVal.textContent = parseFloat(inp.heightOffset.value).toFixed(2);
    lbl.dispVal.textContent = parseFloat(inp.dispSlider.value).toFixed(3);
    lbl.roughnessContrastVal.textContent = parseFloat(inp.roughnessContrast.value).toFixed(1);
    lbl.roughnessLowVal.textContent = parseFloat(inp.roughnessLow.value).toFixed(2);
    lbl.roughnessHighVal.textContent = parseFloat(inp.roughnessHigh.value).toFixed(2);
    lbl.roughnessOffsetVal.textContent = parseFloat(inp.roughnessOffset.value).toFixed(2);
    lbl.aoAmountVal.textContent = parseFloat(inp.aoAmount.value).toFixed(1);
    lbl.aoContrastVal.textContent = parseFloat(inp.aoContrast.value).toFixed(1);
    lbl.metallicVal.textContent = parseFloat(inp.metallicSlider.value).toFixed(2);
  }

  showCaptureView() {
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
}

window.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.init();
});