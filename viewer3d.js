import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';

export class MaterialViewer3D {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.mesh = null;
    this.material = null;
    this.textures = {};
    this.currentHDRI = null;
    this.exrLoader = new EXRLoader();
    this.hdriEnabled = true;
    this.hdriIntensity = 1.0;
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;

    const w = this.container.clientWidth || 300;
    const h = this.container.clientHeight || 300;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0d0e10);

    this.camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
    this.camera.position.set(0, 0, 3.5);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h, false);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.enableZoom = true;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    this.scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 1.0);
    mainLight.position.set(3, 4, 3);
    this.scene.add(mainLight);

    this.material = new THREE.MeshStandardMaterial({
      roughness: 0.5,
      metalness: 0.0,
      side: THREE.DoubleSide
    });

    const geometry = new THREE.SphereGeometry(1, 128, 128);
    geometry.setAttribute('uv2', new THREE.BufferAttribute(geometry.attributes.uv.array, 2));
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.scene.add(this.mesh);

    const resizeObserver = new ResizeObserver(() => this.resize());
    resizeObserver.observe(this.container);

    const animate = () => {
      requestAnimationFrame(animate);
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    };
    animate();

    this.initialized = true;
  }

  loadHDRI(filename) {
    if (!this.initialized) this.init();
    if (!filename) return;

    const path = `assets/environment/${filename}`;
    this.exrLoader.load(path, (texture) => {
      if (this.currentHDRI) this.currentHDRI.dispose();

      this.currentHDRI = texture;
      texture.mapping = THREE.EquirectangularReflectionMapping;
      
      this.scene.environment = texture;
      this.scene.background = texture;
      this.scene.backgroundBlurriness = 0.5;
    }, undefined, (err) => {
      console.warn(`No se pudo cargar el mapa HDRI: ${path}`, err);
    });
  }

  setHDRIRotation(degrees) {
    if (!this.scene) return;
    const radians = THREE.MathUtils.degToRad(degrees);
    this.scene.environmentRotation.y = radians;
    this.scene.backgroundRotation.y = radians;
  }

  setHDRIEnabled(enabled) {
    this.hdriEnabled = enabled;
    this.updateHDRIProps();
  }

  setHDRIIntensity(intensity) {
    this.hdriIntensity = intensity;
    this.updateHDRIProps();
  }

  updateHDRIProps() {
    if (!this.scene) return;
    
    const effectiveIntensity = this.hdriEnabled ? this.hdriIntensity : 0;

    // Compatibilidad con Three.js para intensidad de fondo y luz ambiental
    if ('environmentIntensity' in this.scene) {
      this.scene.environmentIntensity = effectiveIntensity;
      this.scene.backgroundIntensity = effectiveIntensity;
    } else if (this.material) {
      this.material.envMapIntensity = effectiveIntensity;
    }

    // Fuerza renderizado si el loop continuo no está activo
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  setMeshType(type) {
    if (!this.mesh) return;
    this.mesh.geometry.dispose();

    let newGeo;
    if (type === 'sphere') {
      newGeo = new THREE.SphereGeometry(1, 128, 128);
    } else if (type === 'cube') {
      newGeo = new THREE.BoxGeometry(1.5, 1.5, 1.5, 64, 64, 64);
    } else if (type === 'plane') {
      newGeo = new THREE.PlaneGeometry(2, 2, 128, 128);
    }
    
    newGeo.setAttribute('uv2', new THREE.BufferAttribute(newGeo.attributes.uv.array, 2));
    this.mesh.geometry = newGeo;
  }

  updateTextures(canvases, settings) {
    if (!this.initialized) this.init();

    const createTexture = (canvas) => {
      const tex = new THREE.CanvasTexture(canvas);
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.needsUpdate = true;
      return tex;
    };

    if (this.textures.map) this.textures.map.dispose();
    if (this.textures.normalMap) this.textures.normalMap.dispose();
    if (this.textures.roughnessMap) this.textures.roughnessMap.dispose();
    if (this.textures.aoMap) this.textures.aoMap.dispose();
    if (this.textures.displacementMap) this.textures.displacementMap.dispose();

    this.textures.map = createTexture(canvases.albedo);
    this.textures.map.colorSpace = THREE.SRGBColorSpace;
    this.textures.normalMap = createTexture(canvases.normal);
    this.textures.roughnessMap = createTexture(canvases.roughness);
    this.textures.aoMap = createTexture(canvases.ao);
    this.textures.displacementMap = createTexture(canvases.height);

    this.material.map = this.textures.map;
    this.material.normalMap = this.textures.normalMap;
    this.material.roughnessMap = this.textures.roughnessMap;
    this.material.aoMap = this.textures.aoMap;
    this.material.displacementMap = this.textures.displacementMap;

    this.material.displacementScale = settings.disp;
    this.material.metalness = settings.metallic;

    this.material.needsUpdate = true;
    this.resize();
  }

  resize() {
    if (!this.renderer || !this.container) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w === 0 || h === 0) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }
}