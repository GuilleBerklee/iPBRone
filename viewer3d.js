import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

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
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;

    const w = this.container.clientWidth || 300;
    const h = this.container.clientHeight || 300;

    // Escena
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0d0e10);

    // Cámara
    this.camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
    this.camera.position.set(0, 0, 3.5);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.container.appendChild(this.renderer.domElement);

    // Controles
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.enableZoom = true;

    // Luces
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    this.scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 1.5);
    mainLight.position.set(3, 4, 3);
    this.scene.add(mainLight);

    const fillLight = new THREE.DirectionalLight(0x7c83ff, 0.5);
    fillLight.position.set(-3, -2, -2);
    this.scene.add(fillLight);

    // Material
    this.material = new THREE.MeshStandardMaterial({
      roughness: 0.5,
      metalness: 0.0,
      side: THREE.DoubleSide
    });

    // Malla inicial
    const geometry = new THREE.SphereGeometry(1, 128, 128);
    geometry.attributes.uv2 = geometry.attributes.uv;
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.scene.add(this.mesh);

    // Resize observer
    const resizeObserver = new ResizeObserver(() => this.resize());
    resizeObserver.observe(this.container);

    // Bucle de render
    const animate = () => {
      requestAnimationFrame(animate);
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    };
    animate();

    this.initialized = true;
  }

  setMeshType(type) {
    if (!this.mesh) return;
    this.mesh.geometry.dispose();

    if (type === 'sphere') {
      this.mesh.geometry = new THREE.SphereGeometry(1, 128, 128);
    } else if (type === 'cube') {
      this.mesh.geometry = new THREE.BoxGeometry(1.5, 1.5, 1.5, 64, 64, 64);
    } else if (type === 'plane') {
      this.mesh.geometry = new THREE.PlaneGeometry(2, 2, 128, 128);
    }
    
    // Canal UV2 necesario para el mapa de Oclusión Ambiental
    this.mesh.geometry.attributes.uv2 = this.mesh.geometry.attributes.uv;
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
    const h = this.container.clientHeight || w;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  onResize() {
    this.resize();
  }
}