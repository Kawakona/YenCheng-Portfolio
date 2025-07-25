import * as THREE from '../node_modules/three';
import { GLTFLoader } from '../node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from '../node_modules/three/examples/jsm/controls/OrbitControls.js';
import { RGBELoader } from '../node_modules/three/examples/jsm/loaders/RGBELoader.js';
import './style/P4style.css';

export function initCasualToolsViewer(container) {
  const scene = new THREE.Scene();

  // 相機
  const camera = new THREE.PerspectiveCamera(
    75,
    container.clientWidth / container.clientHeight,
    0.1,
    1000
  );
  camera.position.z = 2;

  // 渲染器
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.physicallyCorrectLights = true;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputEncoding = THREE.sRGBEncoding;
  container.appendChild(renderer.domElement);
  renderer.domElement.classList.add('threejs-canvas'); // ✅ 加入 class 讓主程式可以辨識滾輪行為

  // 強制設定渲染器大小的函式
  function resizeRenderer() {
    const width = container.clientWidth;
    const height = container.clientHeight;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  // 頁面載入時設定一次大小
  resizeRenderer();

  // 監聽視窗 resize 事件，調整畫面大小
  window.addEventListener('resize', resizeRenderer);

  // HDR 環境貼圖
  const rgbeLoader = new RGBELoader();
  rgbeLoader.setPath(import.meta.env.BASE_URL + 'hdr/');
  rgbeLoader.load('vertopal.com_car-studio-lighting.hdr', function (texture) {
    texture.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = texture;
    renderer.setClearColor(new THREE.Color('rgb(214, 214, 214)')); // ✅ 設定背景
    //const renderer = new THREE.WebGLRenderer({ alpha: true });; // ✅ 設定背景
  });

  // OrbitControls
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  // ✅ 限制 OrbitControls 只在 canvas 滾輪時作用（非強制阻擋頁面）
  renderer.domElement.addEventListener('wheel', (e) => {
    e.stopPropagation(); // 避免影響外部事件（但不攔截整個頁面）
  });

  // 變數初始化
  let mixer,
    actions = {};
  let isOpened = false;
  let isBrushOut = false;
  let isCutting = false;

  const clock = new THREE.Clock();
  const FPS = 24;
  const CLAMP_OPEN_TIME = 40 / FPS;
  const CLAMP_FULL_TIME = 52 / FPS;

  // GLTF 載入
  const loader = new GLTFLoader();
  loader.load(import.meta.env.BASE_URL + 'model/HL31A.glb', (gltf) => {
    const model = gltf.scene;
    model.position.set(0, 0.5, 1.75);
    model.scale.set(2, 2, 2);
    scene.add(model);

    // 設定動畫
    mixer = new THREE.AnimationMixer(model);
    gltf.animations.forEach((clip) => {
      const action = mixer.clipAction(clip);
      action.clampWhenFinished = true;
      action.setLoop(THREE.LoopOnce);
      actions[clip.name] = action;
    });

    // 預覽動畫（初始旋轉）
    controls.enabled = false;

    const previewDuration = 2; // 秒
    const previewFPS = 60;
    const previewSteps = previewDuration * previewFPS;
    let currentStep = 0;

    const originalPosition = camera.position.clone();
    const radius = originalPosition.length();

    function previewSpin() {
      if (currentStep >= previewSteps) {
        controls.enabled = true;
        return;
      }

      const progress = currentStep / previewSteps;
      const angle = progress * (Math.PI / 4);
      const tiltAngle = progress * (Math.PI / 8);

      camera.position.x = Math.sin(angle) * radius;
      camera.position.z = Math.cos(angle) * radius;
      camera.position.y = Math.sin(tiltAngle) * radius;
      camera.lookAt(0, 0, 10);

      currentStep++;
      requestAnimationFrame(previewSpin);
    }

    previewSpin();
  });

  // 打開或關閉鉗子（連動開關）
  function toggleOpen() {
    const switchAction = actions['開關Action'];
    const clampAction = actions['鉗子Action'];
    if (!switchAction || !clampAction) return;

    if (!isOpened) {
      switchAction.reset();
      switchAction.timeScale = 1;
      switchAction.play();

      clampAction.reset();
      clampAction.timeScale = 1;
      clampAction.time = 0;
      clampAction.play();

      setTimeout(() => {
        clampAction.paused = true;
        clampAction.time = CLAMP_OPEN_TIME;
        updateClipButtonVisibility(true);
      }, CLAMP_OPEN_TIME * 1000);

      isOpened = true;
    } else {
      switchAction.reset();
      switchAction.timeScale = -1;
      switchAction.time = switchAction.getClip().duration;
      switchAction.play();

      clampAction.reset();
      clampAction.timeScale = -1;
      clampAction.time = CLAMP_OPEN_TIME;
      clampAction.play();

      updateClipButtonVisibility(false);
      isOpened = false;
    }
  }

  // 剪的動作（鉗子打開後）
  function clipAction() {
    if (!isOpened || isCutting) return;
    const clampAction = actions['鉗子Action'];
    if (!clampAction) return;

    isCutting = true;

    clampAction.reset();
    clampAction.timeScale = 1;
    clampAction.time = CLAMP_OPEN_TIME;
    clampAction.play();

    setTimeout(() => {
      isCutting = false;
    }, (CLAMP_FULL_TIME - CLAMP_OPEN_TIME) * 1000);
  }

  // 刷子推出/收回
  function toggleBrush() {
    const brushAction = actions['刷子Action'];
    if (!brushAction) return;

    brushAction.reset();
    brushAction.timeScale = isBrushOut ? -1 : 1;
    brushAction.time = isBrushOut ? brushAction.getClip().duration : 0;
    brushAction.play();

    isBrushOut = !isBrushOut;
  }

  
  // UI（放在 container 中）
  const ui = document.createElement('div');
  ui.style.position = 'absolute';
  ui.style.top = '-200px';
  ui.style.left = '20px';
  ui.style.transform = 'translateY(50%)';
  ui.style.display = 'flex';
  ui.style.flexDirection = 'column'; //row
  ui.style.gap = '0';
  ui.innerHTML = `
    <button id="openBtn" class="svg-button">
      <img id="icon1" src='icons/開.svg' alt="打開 / 關閉鉗子" />
    </button>

    <button id="clipBtn" class="svg-button clip-hidden">
      <img src='icons/剪.svg' alt="剪" />
    </button>

    <button id="brushBtn" class="svg-button">
      <img id="icon3" src='icons/刷子開.svg' alt="推出 / 收回刷子" />
    </button>
  `;
  container.appendChild(ui);

  // icon切換
  let isOpen1 = true;
  let isOn2 = true;
  ui.querySelector('#openBtn').addEventListener('click', () => {
    isOpen1 = !isOpen1;
    setTimeout(() => {
      ui.querySelector('#icon1').src = isOpen1 ? 'icons/開.svg' : 'icons/關.svg';
    }, 1200);
  });
  ui.querySelector('#brushBtn').addEventListener('click', () => {
    isOn2 = !isOn2;
    setTimeout(() => {
      ui.querySelector('#icon3').src = isOn2 ? 'icons/刷子開.svg' : 'icons/刷子關.svg';
    }, 1200);
  });

  // clipBtn 顯示與否
  const clipBtn = ui.querySelector('#clipBtn');
  function updateClipButtonVisibility(isVisible) {
    if (isVisible) {
      clipBtn.classList.add('clip-visible');
      clipBtn.classList.remove('clip-hidden');
    } else {
      clipBtn.classList.add('clip-hidden');
      clipBtn.classList.remove('clip-visible');
    }
  }

  // 綁定事件
  ui.querySelector('#openBtn').onclick = toggleOpen;
  clipBtn.onclick = clipAction;
  ui.querySelector('#brushBtn').onclick = toggleBrush;

  // 發光按鈕
  const buttons = ui.querySelectorAll('.svg-button');
  buttons.forEach((btn) => {
    btn.addEventListener('mousedown', () => {
      btn.classList.add('active-glow');
    });
    btn.addEventListener('mouseup', () => {
      setTimeout(() => {
        btn.classList.remove('active-glow');
      }, 700);
    });
  });

  // animate
  function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    if (mixer) mixer.update(delta);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();
}
