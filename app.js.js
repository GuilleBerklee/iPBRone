import { PBRGenerator } from './pbr-generator.js';
import { MaterialViewer3D } from './viewer3d.js';

class App {
  constructor() {
    this.stream = null;
    this.track = null;
    this.isTorchOn = false;
    this.cachedData = null;
    
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
      
      sourceCanvas: document.getElementById('sourceCanvas'),
      sourceMeta: document.getElementById('sourceMeta'),
      
      canvases: {
        albedo: document.getElementById('albedoCanvas'),
        normal: document.getElementById('normalCanvas'),
        roughness: document.getElementById('roughnessCanvas'),
        ao: document.getElementById('aoCanvas'),
        metallic: document.getElementById('metallicCanvas')
      },
      
      inputs: {
        normalStrength: document.getElementById('normalStrength'),
        aoStrength: document.getElementById('aoStrength'),
        metallicSlider: document.getElementById('metallicSlider'),
        dispSlider: document.getElementById('dispSlider'),
        roughnessInvert: document.getElementById('roughnessInvert')
      },
      
      labels: {
        normalVal: document.getElementById('normalStrengthVal'),
        aoVal: document.getElementById('aoStrengthVal'),
        metallicVal: document.getElementById('metallicVal'),
        dispVal: document.getElementById('dispVal')
      }
    };
  }

  init() {
    this.bindEvents();
    
    if (!window.isSecureContext && location.hostname !== 'localhost') {
      document.getElementById('secureBanner').style.display = 'block';
    }
  }

  bindEvents() {
    this.dom.startCameraBtn.addEventListener('click', () => this.startCamera());
    this.dom.shutterBtn.addEventListener('click', () => this.capturePhoto());
    this.dom.torchBtn.addEventListener('click', () => this.toggleTorch());
    this.dom.retakeBtn.addEventListener('click', () => this.showCaptureView());
    this.dom.downloadAllBtn.addEventListener('click', () => this.downloadZip());

    // Eventos UI Controles PBR
    Object.values(this.dom.inputs).forEach(input => {
      input.addEventListener('input', () => {
        this.updateLabels();
        this.processPBR();
      });
    });

    // Cambios de geometría 3D
    document.querySelectorAll('.mesh-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.mesh-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.viewer3D.setMeshType(e.target.dataset.mesh);
      });
    });

    // Descargas individuales
    document.querySelectorAll('[data-download]').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.download;
        this.downloadSingleCanvas(this.dom.canvases[key], `${key}.png`);
      });
    });
  }

  async startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      this.dom.statusEl.textContent = 'Cámara no soportada en este navegador.';
      return;
    }

    try {
      this.dom.statusEl.textContent = 'Iniciando cámara…';
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1920 } }
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
    const outSize = Math.min(1024, cropSize);

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

    // Render original
    this.drawToCanvas(this.dom.sourceCanvas, imageData);
    this.dom.sourceMeta.textContent = `${outSize}×${outSize} px`;

    this.stopCamera();
    this.dom.captureView.style.display = 'none';
    this.dom.resultsView.style.display = 'block';

    this.processPBR();
  }

  processPBR() {
    if (!this.cachedData) return;
    const { imageData, w, h, luminance } = this.cachedData;

    const Lsmooth = PBRGenerator.boxBlur(luminance, w, h, 1);
    const lowFreqBig = PBRGenerator.boxBlur(luminance, w, h, Math.max(8, Math.round(Math.min(w, h) * 0.15)));

    const normalStr = parseFloat(this.dom.inputs.normalStrength.value);
    const aoStr = parseFloat(this.dom.inputs.aoStrength.value);
    const metallicVal = parseFloat(this.dom.inputs.metallicSlider.value);
    const dispVal = parseFloat(this.dom.inputs.dispSlider.value);
    const invertRoughness = this.dom.inputs.roughnessInvert.checked;

    // Procesado 2D
    const albedoData = PBRGenerator.generateAlbedo(imageData, lowFreqBig, w, h);
    const normalData = PBRGenerator.generateNormal(Lsmooth, w, h, normalStr);
    const roughnessData = PBRGenerator.generateRoughness(luminance, w, h, invertRoughness);
    const aoData = PBRGenerator.generateAO(luminance, w, h, aoStr);
    const metallicData = PBRGenerator.generateMetallic(w, h, metallicVal);

    this.drawToCanvas(this.dom.canvases.albedo, albedoData);
    this.drawToCanvas(this.dom.canvases.normal, normalData);
    this.drawToCanvas(this.dom.canvases.roughness, roughnessData);
    this.drawToCanvas(this.dom.canvases.ao, aoData);
    this.drawToCanvas(this.dom.canvases.metallic, metallicData);

    // Actualización del Módulo 3D
    this.viewer3D.updateTextures(this.dom.canvases, { disp: dispVal, metallic: metallicVal });
  }

  drawToCanvas(canvas, imageData) {
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    canvas.getContext('2d').putImageData(imageData, 0, 0);
  }

  updateLabels() {
    this.dom.labels.normalVal.textContent = parseFloat(this.dom.inputs.normalStrength.value).toFixed(1);
    this.dom.labels.aoVal.textContent = parseFloat(this.dom.inputs.aoStrength.value).toFixed(1);
    this.dom.labels.metallicVal.textContent = parseFloat(this.dom.inputs.metallicSlider.value).toFixed(2);
    this.dom.labels.dispVal.textContent = parseFloat(this.dom.inputs.dispSlider.value).toFixed(3);
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
    const names = ['albedo', 'normal', 'roughness', 'ao', 'metallic'];

    for (const name of names) {
      const blob = await new Promise(res => this.dom.canvases[name].toBlob(res, 'image/png'));
      zip.file(`${name}.png`, blob);
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

// Arrancar app al cargar DOM
window.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.init();
});