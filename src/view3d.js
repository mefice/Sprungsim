import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { draw as drawFlat } from './render.js';
import { LINEUP_CENTER, WORLD, grabOpen, lineupMeter } from './sim.js';

const M = 10 / (WORLD.waterY - WORLD.platformY);

const cam = { x: 640, y: 390, zoom: 1.04, water: 0, label: 'Halle' };
let lastStamp = 0;

let flat = false;
let flatCtx = null;
let renderer;
let scene;
let camera;
let diver;
let athlete;
let lineup;
let grabRing;
let spinRing;
let board;
let waterMat;
let drops = [];
let tag;
let wash;
let bones = new Map();
let rests = new Map();
const euler = new THREE.Euler();
const extra = new THREE.Quaternion();
const look = new THREE.Vector3();

function to3(x, y, z = 0) {
  return new THREE.Vector3(x * M, (WORLD.waterY - y) * M, z);
}

function gradeHex(grade) {
  if (grade >= 0.85) return 0x2ecc71;
  if (grade >= 0.55) return 0xf1c40f;
  return 0xff8d7a;
}

function useFlat(canvas, state) {
  if (!flatCtx) {
    flatCtx = canvas.getContext('2d');
    if (!flatCtx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    flatCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  drawFlat(flatCtx, state, canvas.clientWidth, canvas.clientHeight);
}

function ensure(canvas) {
  if (flat) return;
  if (renderer) return;
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x8ea4b4, 1);

  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0xb9c6d2, 0.004);
  camera = new THREE.OrthographicCamera(-16, 16, 9, -9, 0.1, 90);

  scene.add(new THREE.HemisphereLight(0xe7f2ff, 0x6e7c86, 0.55));
  const sun = new THREE.DirectionalLight(0xfff4e0, 2.4);
  sun.position.set(8, 22, 14);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 2;
  sun.shadow.camera.far = 50;
  sun.shadow.camera.left = -18;
  sun.shadow.camera.right = 18;
  sun.shadow.camera.top = 16;
  sun.shadow.camera.bottom = -8;
  sun.shadow.bias = -0.0003;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xc5d8ea, 0.6);
  fill.position.set(-6, 8, 10);
  scene.add(fill);

  buildHall();
  buildCues();
  buildAthlete();
  loadAthlete();
  loadEnvironment();

  tag = document.createElement('div');
  tag.id = 'camera-tag';
  wash = document.createElement('div');
  wash.id = 'water-wash';
  document.getElementById('app').append(tag, wash);
}

function tileMaterial() {
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.42,
    metalness: 0.04,
  });
  const loader = new THREE.TextureLoader();
  const apply = (tex, slot) => {
    tex.colorSpace = slot === 'map' ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(10, 6);
    mat[slot] = tex;
    mat.needsUpdate = true;
  };
  loader.load('/assets/tiles_diff.jpg', (tex) => apply(tex, 'map'));
  loader.load('/assets/tiles_nor.jpg', (tex) => apply(tex, 'normalMap'));
  loader.load('/assets/tiles_rough.jpg', (tex) => apply(tex, 'roughnessMap'));
  return mat;
}

function buildHall() {
  const plaster = new THREE.MeshStandardMaterial({ color: 0xe4ddd2, roughness: 0.9, metalness: 0 });
  const deck = new THREE.MeshStandardMaterial({ color: 0xcfc6b8, roughness: 0.82, metalness: 0.02 });
  const metal = new THREE.MeshStandardMaterial({ color: 0xb7c0c8, roughness: 0.35, metalness: 0.72 });
  const tiles = tileMaterial();
  const box = (w, h, d, material, x, y, z, shadow = true) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = shadow;
    mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  };

  box(36, 14, 0.4, plaster, 14, 7, -9.2, false);
  box(36, 0.35, 18, deck, 14, -0.18, 0, false);
  box(0.4, 14, 18, plaster, -2.2, 7, 0, false);
  box(36, 0.3, 18, plaster, 14, 13.6, -2, false);

  const poolX = 15.5;
  const poolZ = 0;
  box(22, 0.25, 12, tiles, poolX, -3.15, poolZ);
  box(0.35, 3.2, 12, tiles, poolX - 11, -1.55, poolZ);
  box(0.35, 3.2, 12, tiles, poolX + 11, -1.55, poolZ);
  box(22, 3.2, 0.35, tiles, poolX, -1.55, -6);

  waterMat = new THREE.MeshPhysicalMaterial({
    color: 0x1c7ea0,
    roughness: 0.06,
    metalness: 0.02,
    transmission: 0.55,
    thickness: 1.4,
    transparent: true,
    opacity: 0.88,
    envMapIntensity: 1.15,
  });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(21.4, 11.4), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.set(poolX, 0.02, poolZ);
  const volume = new THREE.Mesh(new THREE.BoxGeometry(21.2, 3.0, 10.5), waterMat);
  volume.position.set(poolX, -1.5, poolZ);
  scene.add(volume);
  water.receiveShadow = true;
  water.renderOrder = 2;
  waterMat.depthWrite = false;
  scene.add(water);

  for (let i = 0; i < 6; i += 1) {
    const lane = new THREE.Mesh(
      new THREE.BoxGeometry(20.4, 0.02, 0.06),
      new THREE.MeshStandardMaterial({ color: 0xd7e7ef, roughness: 0.4 }),
    );
    lane.position.set(poolX, -3.0, -4.2 + i * 1.7);
    scene.add(lane);
  }

  const towerMat = new THREE.MeshStandardMaterial({ color: 0x9aa3ad, roughness: 0.72, metalness: 0.08 });
  box(3.4, 10, 2.4, towerMat, 1.2, 5, 0);
  box(3.6, 0.35, 2.8, towerMat, 1.5, 10.1, 0);
  const boardLen = (408 - 86) * M;
  board = new THREE.Mesh(new THREE.BoxGeometry(boardLen, 0.22, 0.5), metal);
  board.geometry.translate(boardLen / 2, 0, 0);
  board.position.set(86 * M, 10.02, 0);
  board.castShadow = true;
  board.receiveShadow = true;
  scene.add(board);

  const rail = new THREE.MeshStandardMaterial({ color: 0x8d98a3, roughness: 0.4, metalness: 0.6 });
  box(16, 0.9, 1.1, plaster, 16, 1.3, -7.4, false);
  box(16, 0.7, 1.1, plaster, 16, 2.2, -7.7, false);
  for (let i = 0; i < 8; i += 1) {
    box(0.35, 1.15, 0.35, rail, 9 + i * 2, 1.7, -7.2, false);
  }

  for (let i = 0; i < 4; i += 1) {
    const win = new THREE.Mesh(
      new THREE.PlaneGeometry(2.2, 3.2),
      new THREE.MeshStandardMaterial({
        color: 0xfff1d2,
        emissive: 0xffe2b0,
        emissiveIntensity: 0.85,
        roughness: 0.2,
      }),
    );
    win.position.set(4 + i * 6.5, 11.2, -8.95);
    scene.add(win);
  }
}

function cueMaterial() {
  return new THREE.MeshBasicMaterial({ color: 0xffffff });
}

function buildCues() {
  const lineMat = cueMaterial();
  lineup = new THREE.Group();
  lineup.userData.material = lineMat;
  const dash = 0.7;
  const gap = 0.32;
  for (let i = 0; i < 5; i += 1) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.38, dash, 0.16), lineMat);
    mesh.position.y = -0.15 - dash / 2 - i * (dash + gap);
    lineup.add(mesh);
  }
  lineup.visible = false;
  scene.add(lineup);

  const ringMat = cueMaterial();
  const coreMat = cueMaterial();
  grabRing = new THREE.Group();
  grabRing.userData.ringMat = ringMat;
  grabRing.userData.coreMat = coreMat;
  grabRing.add(new THREE.Mesh(new THREE.TorusGeometry(2.05, 0.18, 14, 72), ringMat));
  const core = new THREE.Mesh(new THREE.TorusGeometry(2.05, 0.12, 12, 64), coreMat);
  core.name = 'grab-core';
  grabRing.add(core);
  grabRing.visible = false;
  scene.add(grabRing);

  const trackMat = new THREE.MeshBasicMaterial({
    color: 0xf1c40f,
    transparent: true,
    opacity: 0.38,
    side: THREE.DoubleSide,
  });
  const arcMat = new THREE.MeshBasicMaterial({
    color: 0xf1c40f,
    transparent: true,
    opacity: 0.96,
    side: THREE.DoubleSide,
  });
  spinRing = new THREE.Group();
  spinRing.userData.arcMat = arcMat;
  spinRing.add(new THREE.Mesh(new THREE.RingGeometry(1.05, 1.48, 64), trackMat));
  const arc = new THREE.Mesh(
    new THREE.RingGeometry(1.05, 1.48, 48, 1, Math.PI / 2, 0.2),
    arcMat,
  );
  arc.name = 'spin-arc';
  spinRing.add(arc);
  spinRing.userData.into = -1;
  spinRing.visible = false;
  scene.add(spinRing);

  const dropMat = new THREE.MeshStandardMaterial({ color: 0xf4fbff, transparent: true, roughness: 0.15 });
  const dropGeo = new THREE.SphereGeometry(0.07, 8, 6);
  for (let i = 0; i < 48; i += 1) {
    const mesh = new THREE.Mesh(dropGeo, dropMat.clone());
    mesh.visible = false;
    scene.add(mesh);
    drops.push(mesh);
  }
}

function buildAthlete() {
  diver = new THREE.Group();
  const facing = new THREE.Group();
  facing.rotation.y = Math.PI / 2;
  athlete = new THREE.Group();
  facing.add(athlete);
  diver.add(facing);
  scene.add(diver);

  const skin = new THREE.MeshPhysicalMaterial({
    color: 0xc6866a,
    roughness: 0.62,
    metalness: 0,
    sheen: 0.35,
    sheenColor: new THREE.Color(0xffc8b0),
    sheenRoughness: 0.55,
  });
  const suit = new THREE.MeshStandardMaterial({ color: 0x0c3f78, roughness: 0.45, metalness: 0.08 });
  const part = (geo, material, x, y, z) => {
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    athlete.add(mesh);
    return mesh;
  };
  part(new THREE.CapsuleGeometry(0.16, 0.42, 6, 10), suit, 0, 0.15, 0);
  part(new THREE.CapsuleGeometry(0.11, 0.28, 4, 8), skin, 0, 0.62, 0);
  part(new THREE.SphereGeometry(0.13, 16, 14), skin, 0, 0.92, 0.02);
  part(new THREE.CapsuleGeometry(0.07, 0.34, 4, 8), skin, 0.02, -0.42, 0.02);
  athlete.userData.placeholder = true;
}

function skinMaterial() {
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xc6866a,
    roughness: 0.58,
    metalness: 0,
    sheen: 0.42,
    sheenColor: new THREE.Color(0xf0c2aa),
    sheenRoughness: 0.5,
  });
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vBodyY;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBodyY = position.y;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vBodyY;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        float suit = smoothstep(0.70, 0.78, vBodyY) * (1.0 - smoothstep(1.02, 1.16, vBodyY));
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.035, 0.16, 0.34), suit);
        float hair = smoothstep(1.50, 1.58, vBodyY);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.09, 0.06, 0.045), hair);
      `);
  };
  return mat;
}

function loadAthlete() {
  const loader = new GLTFLoader();
  loader.load('/assets/athlete.glb', (gltf) => {
    const root = gltf.scene;
    const mat = skinMaterial();
    root.traverse((obj) => {
      if (obj.isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
        obj.material = mat;
        obj.frustumCulled = false;
      }
      if (obj.isBone) bones.set(obj.name, obj);
    });
    athlete.clear();
    athlete.add(root);
    athlete.updateWorldMatrix(true, true);
    const pelvis = bones.get('pelvis');
    if (pelvis) {
      const pos = new THREE.Vector3();
      pelvis.getWorldPosition(pos);
      const local = athlete.worldToLocal(pos.clone());
      root.position.sub(local);
    }
    bones.forEach((bone, name) => rests.set(name, bone.quaternion.clone()));
  });
}

function loadEnvironment() {
  new RGBELoader().load('/assets/indoor_pool_1k.hdr', (tex) => {
    tex.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = tex;
  });
}

function bend(name, x, y, z) {
  const bone = bones.get(name);
  const rest = rests.get(name);
  if (!bone || !rest) return;
  euler.set(x, y, z);
  extra.setFromEuler(euler);
  bone.quaternion.copy(rest).multiply(extra);
}

function poseAthlete(state) {
  rests.forEach((rest, name) => {
    const bone = bones.get(name);
    if (bone) bone.quaternion.copy(rest);
  });
  if (!state || rests.size === 0) return;
  const laidOut = Boolean(state.opened || state.phase === 'entry' || state.phase === 'result');
  const tuck = laidOut ? 0 : (state.pose ?? 0);
  const airborne = state.phase === 'flight' || state.phase === 'kickout' || state.phase === 'entry' || state.phase === 'result';
  if (!airborne) {
    bend('upperarm_l', -0.5, 0, -0.6);
    bend('upperarm_r', -0.5, 0, 0.6);
    bend('lowerarm_l', -0.3, 0, 0);
    bend('lowerarm_r', -0.3, 0, 0);
    return;
  }
  if (laidOut) {
    bend('upperarm_l', 2.2, 0, 0.3);
    bend('upperarm_r', 2.2, 0, -0.3);
    bend('lowerarm_l', 0, 0, 0);
    bend('lowerarm_r', 0, 0, 0);
    return;
  }
  bend('thigh_l', -2.15 * tuck, 0, 0);
  bend('thigh_r', -2.15 * tuck, 0, 0);
  bend('calf_l', 1.7 * tuck, 0, 0);
  bend('calf_r', 1.7 * tuck, 0, 0);
  bend('spine_01', 0.55 * tuck, 0, 0);
  bend('spine_02', 0.4 * tuck, 0, 0);
  bend('upperarm_l', 1.4 * tuck, 0, -1.2 * tuck);
  bend('upperarm_r', 1.4 * tuck, 0, 1.2 * tuck);
  bend('lowerarm_l', -1.4 * tuck, 0, 0);
  bend('lowerarm_r', -1.4 * tuck, 0, 0);
}

function frameSideCamera(width, height) {
  const aspect = Math.max(0.6, width / Math.max(1, height));
  const worldW = 31;
  const worldH = 15;
  let viewW = worldW;
  let viewH = viewW / aspect;
  if (viewH < worldH) {
    viewH = worldH;
    viewW = viewH * aspect;
  }
  const cx = 13;
  const cy = 3.2;
  camera.left = cx - viewW / 2;
  camera.right = cx + viewW / 2;
  camera.top = cy + viewH / 2;
  camera.bottom = cy - viewH / 2;
  camera.position.set(cx, cy, 28);
  camera.lookAt(cx, cy, 0);
  camera.updateProjectionMatrix();
}

function stepCamera(state, dt) {
  const time = state?.age ?? lastStamp / 1000;
  let target = {
    x: 620 + Math.sin(time * 0.12) * 24,
    y: 400,
    zoom: 1.06,
    water: 0,
    label: 'Halle',
  };
  if (state && (state.phase === 'approach' || state.phase === 'takeoff')) {
    target = { x: state.x + 36, y: state.y + 8, zoom: 3.5, water: 0, label: 'Turmseite' };
  } else if (state && (state.phase === 'flight' || state.phase === 'kickout')) {
    target = {
      x: state.x + 20,
      y: state.y + 10,
      zoom: 3.05,
      water: 0,
      label: 'Flug',
    };
  } else if (state && state.phase === 'entry') {
    const close = WORLD.waterY - state.y < 190;
    target = close
      ? { x: state.x, y: WORLD.waterY - 20, zoom: 3.1, water: 0.25, label: 'Wasserkante' }
      : { x: state.x, y: state.y, zoom: 2.9, water: 0, label: 'Flug' };
  } else if (state && state.phase === 'result') {
    target = state.splashT < 1.15
      ? { x: state.x, y: WORLD.waterY + 40, zoom: 2.8, water: 1, label: 'Unterwasser' }
      : { x: state.x, y: WORLD.waterY - 70, zoom: 2.3, water: 0, label: 'Replay' };
  }
  const k = 1 - Math.exp(-3.1 * dt);
  cam.x += (target.x - cam.x) * k;
  cam.y += (target.y - cam.y) * k;
  cam.zoom += (target.zoom - cam.zoom) * k;
  cam.water += (target.water - cam.water) * (1 - Math.exp(-5.5 * dt));
  cam.label = target.label;
}

function updateCues(state) {
  if (!state) {
    lineup.visible = false;
    grabRing.visible = false;
    spinRing.visible = false;
    diver.visible = false;
    drops.forEach((drop) => { drop.visible = false; });
    return;
  }
  diver.visible = true;
  const hip = to3(state.x, state.y);
  diver.position.copy(hip);
  diver.rotation.set(0, 0, -state.rotation);
  poseAthlete(state);

  const value = state.lineLock ?? lineupMeter(state);
  lineup.visible = value !== null && value !== undefined;
  if (lineup.visible) {
    const at = to3(state.x, WORLD.waterY, 6.2);
    lineup.position.copy(at);
    lineup.rotation.z = -value * (Math.PI / 2) * 0.85;
    const graded = state.lineGrade !== null && state.lineGrade !== undefined;
    lineup.userData.material.color.setHex(graded
      ? gradeHex(state.lineGrade)
      : Math.abs(value) <= LINEUP_CENTER ? 0xf1c40f : 0xffffff);
  }

  const gradedGrab = state.grabGrade !== null && state.grabGrade !== undefined;
  const liveGrab = !gradedGrab && state.phase === 'entry' && state.y < WORLD.waterY;
  grabRing.visible = gradedGrab || liveGrab;
  if (grabRing.visible) {
    const open = gradedGrab ? Math.max(state.grabLock ?? 0, 0.55) : grabOpen(state);
    grabRing.position.copy(to3(state.x, WORLD.waterY, 6.2));
    grabRing.position.y = 0.15;
    const core = grabRing.getObjectByName('grab-core');
    core.scale.setScalar(0.28 + open * 0.66);
    const color = gradedGrab
      ? gradeHex(state.grabGrade)
      : open >= 0.78 ? 0xf1c40f : 0xffffff;
    grabRing.userData.ringMat.color.setHex(color);
    grabRing.userData.coreMat.color.setHex(color);
  }

  const showSpin = state.phase !== 'approach' && state.phase !== 'takeoff';
  spinRing.visible = showSpin;
  if (showSpin) {
    const halves = Math.max(0, state.rotation) / Math.PI;
    const into = halves - Math.floor(halves);
    const pulse = state.halfPulse || 0;
    spinRing.position.set(hip.x, hip.y, 6.2);
    spinRing.scale.setScalar(1 + pulse * 0.2);
    spinRing.userData.arcMat.color.setHex(pulse > 0.05 ? 0xfff4c4 : 0xf1c40f);
    const shown = Math.round(into * 40) / 40;
    if (shown !== spinRing.userData.into) {
      spinRing.userData.into = shown;
      const arc = spinRing.getObjectByName('spin-arc');
      arc.geometry.dispose();
      arc.geometry = new THREE.RingGeometry(1.05, 1.48, 48, 1, Math.PI / 2, Math.max(0.16, shown) * Math.PI * 2);
    }
  }

  const particles = state.splash || [];
  drops.forEach((drop, index) => {
    const particle = particles[index];
    if (!particle || particle.life <= 0) {
      drop.visible = false;
      return;
    }
    drop.visible = true;
    drop.position.copy(to3(particle.x, particle.y, (index % 5) * 0.05));
    const size = Math.max(0.04, (particle.r || 3) * M * 0.35);
    drop.scale.setScalar(particle.kind === 'ring' ? size * 4 : size);
    drop.material.opacity = Math.max(0, particle.life / (particle.max || 1));
  });
}

export function resizeView(canvas) {
  if (flat) return;
  try {
  ensure(canvas);
  if (flat || !renderer) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, canvas.clientWidth);
  const height = Math.max(1, canvas.clientHeight);
  renderer.setPixelRatio(dpr);
  renderer.setSize(width, height, false);
  frameSideCamera(width, height);
  } catch (err) {
    console.warn(err);
    flat = true;
  }
}

export function draw(canvas, state) {
  if (flat) {
    useFlat(canvas, state);
    return;
  }
  try {
  ensure(canvas);
  if (flat || !renderer) return;
  const now = performance.now();
  const dt = lastStamp ? Math.min(0.05, (now - lastStamp) / 1000) : 0.016;
  lastStamp = now;
  if (renderer.domElement.width !== Math.floor(canvas.clientWidth * Math.min(window.devicePixelRatio || 1, 2))) {
    resizeView(canvas);
  }
  frameSideCamera(canvas.clientWidth, canvas.clientHeight);

  const drop = (state?.bend ?? 0) * M;
  const boardLen = (408 - 86) * M;
  board.rotation.z = -Math.atan2(drop, boardLen);

  scene.fog.density = 0.004;
  scene.fog.color.set(0xb9c6d2);
  updateCues(state);
  if (tag) tag.textContent = 'KAMERA  SEITE';
  if (wash) wash.style.opacity = '0';
  renderer.render(scene, camera);
  } catch (err) {
    console.warn(err);
    flat = true;
    useFlat(canvas, state);
  }
}
