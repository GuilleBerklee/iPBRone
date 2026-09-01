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
        normalStrength: document.getElementById('normalStrength'),
        aoStrength: document.getElementById('aoStrength'),
        metallicSlider: document.getElementById('metallicSlider'),
        dispSlider: document.getElementById('dispSlider'),
        heightStrength: document.getElementById('heightStrength'),
        heightInvert: document.getElementById('heightInvert'),
        roughnessInvert: document.getElementById('roughnessInvert')
      },
      
      labels: {
        normalVal: document.getElementById('normalStrengthVal'),
        aoVal: document.getElementById('aoStrengthVal'),
        metallicVal: document.getElementById('metallicVal'),
        dispVal: document.getElementById('dispVal'),
        heightVal: document.getElementById('heightStrengthVal')
      }
    };
  }

  init() {
    this.bindEvents();
    if (!window.isSecureContext && location.hostname !== 'localhost') {
      const banner = document.getElementById('secureBanner');
      if (banner) banner.style.display = 'block';
    }
    this.dom.hdriSelect.addEventListener('change', (e) => {
      this.viewer3D.loadHDRI(e.target.value);
    });

    this.dom.hdriRotation.addEventListener('input', (e) => {
      const deg = parseFloat(e.target.value);
      this.dom.hdriRotVal.textContent = `${deg}°`;
      this.viewer3D.setHDRIRotation(deg);
    });
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

    // Cambio de pestañas de capas
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const layer = e.target.dataset.layer;
        this.setActiveLayer(layer);
      });
    });

    // Actualización de sliders y recalculo
    Object.values(this.dom.inputs).forEach(input => {
      input.addEventListener('input', () => {
        this.updateLabels();
        this.processPBR();
      });
    });

    // Malla 3D
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

    // Actualizar botones de pestaña
    document.querySelectorAll('.tab-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.layer === layerKey);
    });

    // Mostrar el canvas correspondientes
    Object.keys(this.dom.canvases).forEach(k => {
      this.dom.canvases[k].classList.toggle('active', k === layerKey);
    });

    // Cambiar el título
    const titles = {
      albedo: 'Mapa Albedo / Color',
      normal: 'Mapa de Normales',
      roughness: 'Mapa de Rugosidad (Roughness)',
      height: 'Mapa de Altura (Height / Displacement)',
      ao: 'Oclusión Ambiental (AO)',
      metallic: 'Mapa Metálico'
    };
    this.dom.currentLayerTitle.textContent = titles[layerKey] || layerKey;

    // Mostrar panel de control específico
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

    // Gestión de resolución seleccionada
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

    // Cambiar vista en el DOM inmediatamente
    this.dom.captureView.style.display = 'none';
    this.dom.resultsView.style.display = 'block';

    // Se da un pequeño margen de tiempo para repintar la vista antes del cálculo intensivo
    setTimeout(() => {
      this.viewer3D.init();
      this.viewer3D.loadHDRI(this.dom.hdriSelect.value); // Carga el HDRI activo
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

    const normalStr = parseFloat(this.dom.inputs.normalStrength.value);
    const aoStr = parseFloat(this.dom.inputs.aoStrength.value);
    const metallicVal = parseFloat(this.dom.inputs.metallicSlider.value);
    const dispVal = parseFloat(this.dom.inputs.dispSlider.value);
    const heightStr = parseFloat(this.dom.inputs.heightStrength.value);
    const heightInvert = this.dom.inputs.heightInvert.checked;
    const invertRoughness = this.dom.inputs.roughnessInvert.checked;

    // Algoritmos PBR
    const albedoData = PBRGenerator.generateAlbedo(imageData, lowFreqBig, w, h);
    const normalData = PBRGenerator.generateNormal(Lsmooth, w, h, normalStr);
    const roughnessData = PBRGenerator.generateRoughness(luminance, w, h, invertRoughness);
    const heightData = PBRGenerator.generateHeight(luminance, w, h, heightStr, heightInvert);
    const aoData = PBRGenerator.generateAO(luminance, w, h, aoStr);
    const metallicData = PBRGenerator.generateMetallic(w, h, metallicVal);

    // Pintar los canvas 2D
    this.drawToCanvas(this.dom.canvases.albedo, albedoData);
    this.drawToCanvas(this.dom.canvases.normal, normalData);
    this.drawToCanvas(this.dom.canvases.roughness, roughnessData);
    this.drawToCanvas(this.dom.canvases.height, heightData);
    this.drawToCanvas(this.dom.canvases.ao, aoData);
    this.drawToCanvas(this.dom.canvases.metallic, metallicData);

    // Actualizar visor 3D
    this.viewer3D.updateTextures(this.dom.canvases, { disp: dispVal, metallic: metallicVal });
  }

  drawToCanvas(canvas, imageData) {
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const ctx = canvas.getContext('2d');
    ctx.putImageData(imageData, 0, 0);
  }

  updateLabels() {
    this.dom.labels.normalVal.textContent = parseFloat(this.dom.inputs.normalStrength.value).toFixed(1);
    this.dom.labels.aoVal.textContent = parseFloat(this.dom.inputs.aoStrength.value).toFixed(1);
    this.dom.labels.metallicVal.textContent = parseFloat(this.dom.inputs.metallicSlider.value).toFixed(2);
    this.dom.labels.dispVal.textContent = parseFloat(this.dom.inputs.dispSlider.value).toFixed(3);
    this.dom.labels.heightVal.textContent = parseFloat(this.dom.inputs.heightStrength.value).toFixed(1);
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