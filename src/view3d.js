import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { draw as drawFlat } from './render.js';
import { LINEUP_CENTER, WORLD, grabOpen, lineupMeter } from './sim.js';

function assetUrl(file) {
  const base = import.meta.env.BASE_URL || './';
  return `${base}${base.endsWith('/') ? '' : '/'}assets/${file}`;
}

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
  renderer.toneMappingExposure = 0.92;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x8ea4b4, 1);

  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0xb9c6d2, 0.004);
  camera = new THREE.OrthographicCamera(-16, 16, 9, -9, 0.1, 90);

  scene.add(new THREE.HemisphereLight(0xe7f2ff, 0x6e7c86, 0.4));
  const sun = new THREE.DirectionalLight(0xfff4e0, 1.15);
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

function paintedTiles() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  for (let y = 0; y < 4; y += 1) {
    for (let x = 0; x < 4; x += 1) {
      ctx.fillStyle = (x + y) % 2 === 0 ? '#1a6d90' : '#2186ad';
      ctx.fillRect(x * 64, y * 64, 64, 64);
      ctx.strokeStyle = '#e7f4f6';
      ctx.lineWidth = 4;
      ctx.strokeRect(x * 64 + 2, y * 64 + 2, 60, 60);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 4);
  return tex;
}

function tileMaterial() {
  const mat = new THREE.MeshStandardMaterial({
    map: paintedTiles(),
    color: 0xffffff,
    roughness: 0.45,
    metalness: 0.04,
  });
  const loader = new THREE.TextureLoader();
  const apply = (tex, slot) => {
    tex.colorSpace = slot === 'map' ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(8, 4);
    mat[slot] = tex;
    mat.needsUpdate = true;
  };
  const quiet = () => {};
  loader.load(assetUrl('tiles_diff.jpg'), (tex) => apply(tex, 'map'), undefined, quiet);
  loader.load(assetUrl('tiles_nor.jpg'), (tex) => apply(tex, 'normalMap'), undefined, quiet);
  loader.load(assetUrl('tiles_rough.jpg'), (tex) => apply(tex, 'roughnessMap'), undefined, quiet);
  return mat;
}

function buildHall() {
  const wall = new THREE.MeshBasicMaterial({ color: 0x5c7386 });
  const deckMat = new THREE.MeshStandardMaterial({ color: 0xc8c2b6, roughness: 0.84 });
  const metal = new THREE.MeshStandardMaterial({ color: 0xd5dbe2, roughness: 0.32, metalness: 0.65 });
  const tiles = tileMaterial();
  const box = (w, h, d, material, x, y, z, shadow = true) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = shadow;
    mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  };

  box(22, 7.2, 0.28, wall, 15.5, 3.6, -7.2, false);
  box(8, 0.28, 3.2, deckMat, 2.2, 0.1, 0, false);

  const poolX = 15.2;
  const poolZ = 0;
  box(20, 0.22, 8, tiles, poolX, -3.05, poolZ);
  box(0.28, 3.0, 8, tiles, poolX - 10, -1.5, poolZ);
  box(0.28, 3.0, 8, tiles, poolX + 10, -1.5, poolZ);
  box(20, 3.0, 0.28, tiles, poolX, -1.5, -4);

  waterMat = new THREE.MeshBasicMaterial({
    color: 0x1a9ec8,
    transparent: true,
    opacity: 0.9,
  });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(21.4, 11.4), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.set(poolX, 0.02, poolZ);
  const volume = new THREE.Mesh(new THREE.BoxGeometry(19.4, 2.9, 7.2), waterMat);
  volume.position.set(poolX, -1.45, poolZ);
  scene.add(volume);
  water.receiveShadow = true;
  scene.add(water);

  for (let i = 0; i < 6; i += 1) {
    const lane = new THREE.Mesh(
      new THREE.BoxGeometry(20.4, 0.02, 0.06),
      new THREE.MeshStandardMaterial({ color: 0xd7e7ef, roughness: 0.4 }),
    );
    lane.position.set(poolX, -3.0, -4.2 + i * 1.7);
    scene.add(lane);
  }

  const towerMat = new THREE.MeshBasicMaterial({ color: 0x2c3b4a });
  box(3.4, 10, 2.4, towerMat, 1.2, 5, 0);
  box(3.6, 0.35, 2.8, towerMat, 1.5, 10.1, 0);
  const boardLen = (408 - 86) * M;
  board = new THREE.Mesh(new THREE.BoxGeometry(boardLen, 0.22, 0.5), metal);
  board.geometry.translate(boardLen / 2, 0, 0);
  board.position.set(86 * M, 10.02, 0);
  board.castShadow = true;
  board.receiveShadow = true;
  scene.add(board);

  box(12, 1.4, 0.8, wall, 16, 0.9, -5.6, false);
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
  athlete.add(buildFigure());
}

function buildFigure() {
  const skin = new THREE.MeshStandardMaterial({ color: 0xc6866a, roughness: 0.58 });
  const suit = new THREE.MeshStandardMaterial({ color: 0x0d4f86, roughness: 0.42 });
  const hair = new THREE.MeshStandardMaterial({ color: 0x2c241f, roughness: 0.7 });
  const figure = new THREE.Group();
  figure.name = 'fallback-athlete';
  const capsule = (radius, length, material) => new THREE.Mesh(
    new THREE.CapsuleGeometry(radius, Math.max(0.04, length), 5, 8),
    material,
  );
  const torso = capsule(0.16, 0.36, suit);
  torso.position.y = 0.28;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), skin);
  head.position.set(0, 0.74, 0.02);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.136, 12, 8), hair);
  cap.scale.set(1, 0.62, 1.05);
  cap.position.set(0, 0.82, -0.01);
  const hang = (length, radius, material) => {
    const pivot = new THREE.Group();
    const mesh = capsule(radius, length, material);
    mesh.position.y = -length / 2;
    mesh.castShadow = true;
    pivot.add(mesh);
    return pivot;
  };
  const thighL = hang(0.42, 0.075, skin);
  thighL.position.set(0.1, 0.02, 0);
  const calfL = hang(0.4, 0.055, skin);
  calfL.position.y = -0.42;
  thighL.add(calfL);
  const thighR = hang(0.42, 0.075, skin);
  thighR.position.set(-0.1, 0.02, 0);
  const calfR = hang(0.4, 0.055, skin);
  calfR.position.y = -0.42;
  thighR.add(calfR);
  const armL = hang(0.32, 0.05, skin);
  armL.position.set(0.24, 0.5, 0);
  const foreL = hang(0.28, 0.042, skin);
  foreL.position.y = -0.32;
  armL.add(foreL);
  const armR = hang(0.32, 0.05, skin);
  armR.position.set(-0.24, 0.5, 0);
  const foreR = hang(0.28, 0.042, skin);
  foreR.position.y = -0.32;
  armR.add(foreR);
  figure.add(torso, head, cap, thighL, thighR, armL, armR);
  figure.userData.limbs = { thighL, thighR, calfL, calfR, armL, armR, foreL, foreR };
  return figure;
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
  loader.load(assetUrl('athlete.glb'), (gltf) => {
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
  }, undefined, () => {});
}

function loadEnvironment() {
  new RGBELoader().load(assetUrl('indoor_pool_1k.hdr'), (tex) => {
    tex.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = tex;
  }, undefined, () => {});
}

function bend(name, x, y, z) {
  const bone = bones.get(name);
  const rest = rests.get(name);
  if (!bone || !rest) return;
  euler.set(x, y, z);
  extra.setFromEuler(euler);
  bone.quaternion.copy(rest).multiply(extra);
}

function poseFigure(state) {
  const figure = athlete.getObjectByName('fallback-athlete');
  const limbs = figure?.userData.limbs;
  if (!limbs) return;
  Object.values(limbs).forEach((limb) => limb.rotation.set(0, 0, 0));
  if (!state) return;
  const laidOut = Boolean(state.opened || state.phase === 'entry' || state.phase === 'result');
  const tuck = laidOut ? 0 : (state.pose ?? 0);
  const airborne = state.phase === 'flight' || state.phase === 'kickout' || state.phase === 'entry' || state.phase === 'result';
  if (!airborne) {
    limbs.armL.rotation.z = 0.4;
    limbs.armR.rotation.z = -0.4;
    return;
  }
  if (laidOut) {
    limbs.armL.rotation.x = -2.5;
    limbs.armR.rotation.x = -2.5;
    return;
  }
  limbs.thighL.rotation.x = -1.45 * tuck;
  limbs.thighR.rotation.x = -1.45 * tuck;
  limbs.calfL.rotation.x = 1.6 * tuck;
  limbs.calfR.rotation.x = 1.6 * tuck;
  limbs.armL.rotation.x = -1.15 * tuck;
  limbs.armR.rotation.x = -1.15 * tuck;
  limbs.foreL.rotation.x = -1.05 * tuck;
  limbs.foreR.rotation.x = -1.05 * tuck;
}

function poseAthlete(state) {
  if (rests.size === 0) {
    poseFigure(state);
    return;
  }
  rests.forEach((rest, name) => {
    const bone = bones.get(name);
    if (bone) bone.quaternion.copy(rest);
  });
  if (!state) return;
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
  const worldW = 26;
  const worldH = 16;
  let viewW = worldW;
  let viewH = viewW / aspect;
  if (viewH < worldH) {
    viewH = worldH;
    viewW = viewH * aspect;
  }
  const cx = 11;
  const cy = 4;
  camera.left = -viewW / 2;
  camera.right = viewW / 2;
  camera.top = viewH / 2;
  camera.bottom = -viewH / 2;
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
    diver.visible = true;
    diver.position.copy(to3(210, WORLD.platformY - 42));
    diver.rotation.set(0, 0, 0);
    poseAthlete({ phase: 'approach', pose: 0, opened: false, rotation: 0 });
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
