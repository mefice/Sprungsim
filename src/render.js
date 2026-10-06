import { LINEUP_CENTER, WORLD, grabOpen, lineupMeter } from './sim.js';

const cam = { x: 640, y: 390, zoom: 1.04, water: 0, label: 'Halle' };
let lastStamp = 0;
const trail = [];
let trailTick = 0;

const CROWD = Array.from({ length: 26 }, (_, i) => ({
  x: 500 + (i % 13) * 52,
  row: i < 13 ? 0 : 1,
  h: 22 + (i * 5) % 12,
  lean: (i % 4) - 1.5,
}));

function verticalGradient(ctx, y0, y1, stops) {
  const grad = ctx.createLinearGradient(0, y0, 0, y1);
  stops.forEach((color, index) => grad.addColorStop(index / (stops.length - 1), color));
  return grad;
}

export function draw(ctx, state, viewW, viewH) {
  const now = performance.now();
  const dt = lastStamp ? Math.min(0.05, (now - lastStamp) / 1000) : 0.016;
  lastStamp = now;
  stepCamera(state, dt);
  stepTrail(state);

  ctx.fillStyle = '#05080d';
  ctx.fillRect(0, 0, viewW, viewH);

  const worldW = WORLD.width / cam.zoom;
  const worldH = WORLD.height / cam.zoom;
  let left = cam.x - worldW / 2;
  let top = cam.y - worldH / 2;
  left = clamp(left, -50, WORLD.width - worldW + 50);
  top = clamp(top, -40, WORLD.height - worldH + 40);
  const scale = Math.min(viewW / worldW, viewH / worldH);
  const ox = (viewW - worldW * scale) / 2;
  const oy = (viewH - worldH * scale) / 2;

  ctx.save();
  ctx.translate(ox, oy);
  ctx.scale(scale, scale);
  ctx.translate(-left, -top);
  drawWorld(ctx, state);
  ctx.restore();

  if (cam.water > 0.08) drawUnderwaterGrade(ctx, viewW, viewH, cam.water);
  drawCameraTag(ctx, ox, oy + worldH * scale);
}

function stepCamera(state, dt) {
  const time = (state?.age ?? lastStamp / 1000);
  let target = {
    x: 620 + Math.sin(time * 0.12) * 24,
    y: 400,
    zoom: 1.06,
    water: 0,
    label: 'Halle',
  };
  if (state && (state.phase === 'approach' || state.phase === 'takeoff')) {
    target = { x: 330, y: 360, zoom: 1.34, water: 0, label: 'Turmseite' };
  } else if (state && (state.phase === 'flight' || state.phase === 'kickout')) {
    target = {
      x: state.x + 30,
      y: state.y * 0.84 + WORLD.waterY * 0.16,
      zoom: 1.78,
      water: 0,
      label: 'Flug',
    };
  } else if (state && state.phase === 'entry') {
    const close = WORLD.waterY - state.y < 190;
    target = close
      ? { x: state.x, y: WORLD.waterY - 10, zoom: 1.82, water: 0.2, label: 'Wasserkante' }
      : { x: state.x, y: state.y + 30, zoom: 1.62, water: 0, label: 'Flug' };
  } else if (state && state.phase === 'result') {
    target = state.splashT < 1.15
      ? { x: state.x, y: WORLD.waterY + 78, zoom: 2.05, water: 1, label: 'Unterwasser' }
      : { x: state.x - 20, y: WORLD.waterY - 90, zoom: 1.48, water: 0, label: 'Replay' };
  }
  const k = 1 - Math.exp(-3.1 * dt);
  cam.x += (target.x - cam.x) * k;
  cam.y += (target.y - cam.y) * k;
  cam.zoom += (target.zoom - cam.zoom) * k;
  cam.water += (target.water - cam.water) * (1 - Math.exp(-5.5 * dt));
  cam.label = target.label;
}

function stepTrail(state) {
  if (!state || state.phase === 'approach' || state.phase === 'takeoff') {
    trail.length = 0;
    return;
  }
  trailTick += 1;
  if (trailTick % 3 !== 0) return;
  if (state.phase === 'result') return;
  trail.push({ x: state.x, y: state.y, rotation: state.rotation, pose: state.pose, opened: state.opened, phase: state.phase });
  if (trail.length > 7) trail.shift();
}

function drawWorld(ctx, state) {
  ctx.fillStyle = verticalGradient(ctx, 0, WORLD.waterY, ['#08111c', '#16324c', '#1d4e6e']);
  ctx.fillRect(-80, -80, WORLD.width + 160, WORLD.waterY + 80);
  drawArchitecture(ctx, state);
  drawCrowd(ctx, state);
  drawReflection(ctx, state);
  drawWater(ctx, state);
  if (state) drawGrabGate(ctx, state);
  if (state) drawLineupGhost(ctx, state);
  drawTower(ctx, state?.bend ?? 0);
  if (state && state.phase !== 'approach' && state.phase !== 'takeoff') drawShadow(ctx, state);
  for (let i = 0; i < trail.length; i += 1) {
    drawAthlete(ctx, trail[i], 0.05 + (i / trail.length) * 0.12);
  }
  if (state) {
    drawSpinMeter(ctx, state);
    drawAthlete(ctx, state, 1);
    if (state.y < WORLD.waterY - 8) drawRefractedAthlete(ctx, state);
  }
  if (state?.splash) drawSplash(ctx, state);
  if (state?.flash && cam.water < 0.65) drawFlash(ctx, state);
  if (state?.result?.rip && state.splashT < 1.25) drawRipMark(ctx, state);
}

function drawArchitecture(ctx, state) {
  const time = state?.age ?? 0;
  ctx.fillStyle = '#101820';
  ctx.fillRect(0, 28, WORLD.width, 70);
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 2;
  for (let x = 60; x < WORLD.width; x += 160) {
    ctx.beginPath();
    ctx.moveTo(x, 36);
    ctx.lineTo(x + 80, 92);
    ctx.lineTo(x + 160, 36);
    ctx.stroke();
  }
  for (let i = 0; i < 3; i += 1) {
    const x = 220 + i * 340 + Math.sin(time * 0.25 + i) * 10;
    const glow = ctx.createLinearGradient(x, 0, x, WORLD.waterY - 40);
    glow.addColorStop(0, 'rgba(255, 232, 190, 0.14)');
    glow.addColorStop(1, 'rgba(255, 232, 190, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 28, 0);
    ctx.lineTo(x + 10, WORLD.waterY - 50);
    ctx.lineTo(x + 4, WORLD.waterY - 50);
    ctx.fill();
  }
  ctx.fillStyle = '#16202b';
  ctx.fillRect(0, WORLD.waterY - 28, WORLD.width, 28);
  ctx.fillStyle = '#243140';
  ctx.fillRect(0, WORLD.waterY - 18, WORLD.width, 8);
}

function drawCrowd(ctx, state) {
  const time = state?.age ?? 0;
  const hush = state && (state.phase === 'flight' || state.phase === 'kickout' || state.phase === 'entry');
  const cheer = state?.result && state.splashT > 0.25;
  ctx.fillStyle = '#121a24';
  ctx.fillRect(470, WORLD.waterY - 118, 760, 96);
  ctx.fillStyle = '#1c2836';
  ctx.fillRect(470, WORLD.waterY - 122, 760, 8);
  ctx.save();
  for (const person of CROWD) {
    const y = WORLD.waterY - 78 - person.row * 18;
    const sway = Math.sin(time * (hush ? 0.6 : 1.8) + person.x * 0.02) * (hush ? 0.6 : 2.4);
    ctx.fillStyle = person.row === 0 ? 'rgba(8, 14, 20, 0.82)' : 'rgba(18, 28, 38, 0.72)';
    ctx.fillRect(person.x + sway, y - person.h, 14, person.h);
    ctx.beginPath();
    ctx.arc(person.x + 7 + sway, y - person.h - 5, 6, 0, Math.PI * 2);
    ctx.fill();
    if (cheer && person.lean > 0) {
      ctx.strokeStyle = 'rgba(8, 14, 20, 0.8)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(person.x + 7 + sway, y - person.h + 4);
      ctx.lineTo(person.x + sway + (state.result.rip ? -2 : 6), y - person.h - 16);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawReflection(ctx, state) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, WORLD.waterY, WORLD.width, 130);
  ctx.clip();
  ctx.translate(0, WORLD.waterY);
  ctx.scale(1, -0.5);
  ctx.translate(0, -WORLD.waterY);
  ctx.globalAlpha = 0.22;
  drawTower(ctx, state?.bend ?? 0);
  if (state && state.y < WORLD.waterY) drawAthlete(ctx, state, 0.9);
  ctx.restore();
}

function drawWater(ctx, state) {
  const time = state?.age ?? 0;
  ctx.fillStyle = verticalGradient(ctx, WORLD.waterY, WORLD.height, ['#1aa0d8', '#0c679f', '#04283d']);
  ctx.fillRect(0, WORLD.waterY, WORLD.width, WORLD.height - WORLD.waterY);

  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = '#b7f0ff';
  for (let i = 0; i < 5; i += 1) {
    const x = 180 + i * 200 + Math.sin(time * 0.9 + i) * 18;
    ctx.beginPath();
    ctx.ellipse(x, WORLD.waterY + 22, 34, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  ctx.strokeStyle = 'rgba(190, 230, 255, 0.28)';
  ctx.lineWidth = 1.5;
  for (let row = 0; row < 3; row += 1) {
    const y = WORLD.waterY + 8 + row * 7;
    ctx.beginPath();
    for (let x = 0; x <= WORLD.width; x += 28) {
      const wave = Math.sin(x * 0.02 + time * 1.6 + row) * (3.2 - row);
      if (x === 0) ctx.moveTo(x, y + wave);
      else ctx.lineTo(x, y + wave);
    }
    ctx.stroke();
  }
  const sheen = 0.35 + Math.sin(time * 1.4) * 0.08;
  ctx.fillStyle = `rgba(255,255,255,${sheen})`;
  ctx.fillRect(0, WORLD.waterY - 2, WORLD.width, 3);
  ctx.fillStyle = 'rgba(190, 240, 255, 0.35)';
  for (let i = 0; i < 4; i += 1) {
    const x = ((time * 40 + i * 320) % (WORLD.width + 80)) - 40;
    ctx.fillRect(x, WORLD.waterY - 1, 70, 2);
  }

  for (let lane = 1; lane <= 4; lane += 1) {
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.setLineDash([10, 16]);
    ctx.beginPath();
    ctx.moveTo(80, WORLD.waterY + lane * 42);
    ctx.lineTo(WORLD.width - 40, WORLD.waterY + lane * 42);
    ctx.stroke();
  }
  ctx.setLineDash([]);
}

function drawTower(ctx, bend) {
  ctx.fillStyle = '#1a2633';
  ctx.fillRect(36, 78, 62, WORLD.platformY - 70);
  ctx.fillStyle = '#2c3c4e';
  ctx.fillRect(28, WORLD.platformY - 16, 86, 18);
  ctx.fillStyle = '#8ea0b3';
  ctx.fillRect(150, WORLD.platformY - 4, 26, 18);
  ctx.beginPath();
  ctx.arc(163, WORLD.platformY + 6, 8, 0, Math.PI * 2);
  ctx.fill();

  const tip = WORLD.platformY + bend;
  ctx.strokeStyle = '#c5d0dc';
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(86, WORLD.platformY);
  ctx.quadraticCurveTo(230, tip + bend * 0.15, 408, tip);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(90, WORLD.platformY - 4);
  ctx.quadraticCurveTo(230, tip - 4, 404, tip - 4);
  ctx.stroke();

  if (bend > 8) {
    ctx.strokeStyle = `rgba(241, 196, 15, ${Math.min(0.45, bend / 80)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(250, tip + 14);
    ctx.lineTo(250, tip + 14 + bend * 0.35);
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(255,255,255,0.78)';
  ctx.font = '600 16px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('10 m', 108, 104);
}

function drawSpinMeter(ctx, state) {
  if (state.phase === 'approach' || state.phase === 'takeoff') return;
  const halves = Math.max(0, state.rotation) / Math.PI;
  const into = halves - Math.floor(halves);
  const pulse = state.halfPulse || 0;
  ctx.save();
  ctx.translate(state.x, state.y);
  ctx.strokeStyle = `rgba(241, 196, 15, ${0.28 + pulse * 1.4})`;
  ctx.lineWidth = 3 + pulse * 5;
  ctx.beginPath();
  ctx.arc(0, 0, 40 + pulse * 16, -Math.PI / 2, -Math.PI / 2 + Math.max(0.08, into) * Math.PI * 2);
  ctx.stroke();
  if (pulse > 0.04 && state.halfCount > 0) {
    ctx.globalAlpha = Math.min(1, pulse * 2.4);
    ctx.fillStyle = '#f4fbff';
    ctx.font = '700 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(state.halfCount), 0, -52 - pulse * 12);
  }
  ctx.restore();
}

function drawGrabGate(ctx, state) {
  if (state.phase !== 'entry' || state.y >= WORLD.waterY) return;
  const open = grabOpen(state);
  const x = state.x;
  const y = WORLD.waterY;
  const rx = 16 + open * 46;
  const ry = 5 + open * 13;
  const gold = open >= 0.78;
  ctx.save();
  ctx.strokeStyle = gold
    ? `rgba(241, 196, 15, ${0.55 + open * 0.45})`
    : `rgba(255, 255, 255, ${0.28 + open * 0.35})`;
  ctx.lineWidth = 2 + open * 2.5;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(3, rx * open), Math.max(2, ry * open * 0.72), 0, 0, Math.PI * 2);
  ctx.stroke();
  if (open > 0.2) {
    ctx.globalAlpha = 0.35 * open;
    ctx.beginPath();
    ctx.moveTo(x, state.y + 20);
    ctx.lineTo(x, y - 2);
    ctx.stroke();
  }
  ctx.restore();
}

function lineupColor(state, value) {
  if (state.lineGrade === null || state.lineGrade === undefined) {
    return Math.abs(value) <= LINEUP_CENTER ? 'rgba(241, 196, 15, 0.95)' : 'rgba(255,255,255,0.62)';
  }
  if (state.lineGrade >= 0.85) return 'rgba(46, 204, 113, 0.95)';
  if (state.lineGrade >= 0.55) return 'rgba(241, 196, 15, 0.95)';
  return 'rgba(255, 141, 122, 0.95)';
}

function drawLineupGhost(ctx, state) {
  const value = state.lineLock ?? lineupMeter(state);
  if (value === null || value === undefined) return;
  const tilt = value * (Math.PI / 2) * 0.85;
  ctx.save();
  ctx.translate(state.x, WORLD.waterY + 6);
  ctx.rotate(tilt);
  ctx.strokeStyle = lineupColor(state, value);
  ctx.lineWidth = Math.abs(value) <= LINEUP_CENTER || (state.lineGrade ?? 0) >= 0.85 ? 4 : 2.5;
  ctx.setLineDash([7, 6]);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 86);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function drawShadow(ctx, state) {
  const height = Math.max(0, WORLD.waterY - state.y);
  ctx.fillStyle = `rgba(0, 16, 28, ${clamp(0.34 - height / 1600, 0.08, 0.34)})`;
  ctx.beginPath();
  ctx.ellipse(state.x, WORLD.waterY + 3, 16 + height * 0.015, 5, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawAthlete(ctx, state, alpha) {
  const t = state.pose ?? 0;
  const lining = state.opened || state.phase === 'entry' || state.phase === 'result';
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(state.x, state.y);
  ctx.rotate(state.rotation || 0);
  ctx.scale(1.45, 1.45);
  ctx.translate(0, -6);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const suit = '#1496d0';
  const skin = '#f0c4a6';
  const knee = t * 1.35;
  const hipY = 4;
  const chestX = t * 6;
  const chestY = -18 + t * 12;
  const headY = chestY - 14 + t * 6;

  const limb = (x1, y1, x2, y2, width, color) => {
    ctx.strokeStyle = 'rgba(4, 16, 28, 0.55)';
    ctx.lineWidth = width + 3;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  };

  const thighX = Math.sin(knee) * (8 + (1 - t) * 4);
  const thighY = hipY + Math.cos(knee) * (8 + (1 - t) * 6);
  const footY = thighY + (18 - t * 12);
  limb(0, hipY, thighX, thighY, 7, skin);
  limb(thighX, thighY, thighX * 0.35, footY, 6, skin);
  limb(-3, hipY, -4, hipY + (16 - t * 8), 6, skin);

  limb(0, hipY, chestX, chestY, lining ? 9 : 11 - t * 2, suit);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-1, hipY - 2);
  ctx.lineTo(chestX - 1, chestY + 4);
  ctx.stroke();

  if (lining) {
    limb(chestX, chestY, chestX, headY - 18, 5, skin);
    if ((state.grabValue ?? 0) >= 0.65) {
      limb(chestX - 7, headY - 16, chestX + 7, headY - 16, 4, skin);
    }
  } else if (t > 0.45) {
    limb(chestX, chestY + 2, thighX + 4, thighY - 2, 5, skin);
    limb(chestX, chestY + 2, -8, thighY, 5, skin);
  } else {
    limb(chestX, chestY + 4, 16, chestY + 10, 5, skin);
    limb(chestX, chestY + 4, -14, chestY + 12, 5, skin);
  }

  ctx.fillStyle = '#0b2433';
  ctx.beginPath();
  ctx.arc(chestX + t, headY, 9.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f1c40f';
  ctx.beginPath();
  ctx.arc(chestX + t, headY, 7.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(chestX + t + 2.2, headY + 1.2, 5.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawRefractedAthlete(ctx, state) {
  if (state.phase === 'result' || state.y < WORLD.waterY - 150) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, WORLD.waterY, WORLD.width, WORLD.height - WORLD.waterY);
  ctx.clip();
  ctx.translate(Math.sin((state.age || 0) * 3) * 5, 18);
  ctx.globalAlpha = 0.28;
  drawAthlete(ctx, state, 1);
  ctx.restore();
}

function drawSplash(ctx, state) {
  for (const particle of state.splash) {
    if (particle.life <= 0) continue;
    const alpha = clamp(particle.life / particle.max, 0, 1);
    if (particle.kind === 'ring') {
      ctx.strokeStyle = particle.rip
        ? `rgba(241, 196, 15, ${alpha})`
        : `rgba(255,255,255,${alpha * 0.85})`;
      ctx.lineWidth = particle.rip ? 2.5 : 2;
      ctx.beginPath();
      ctx.ellipse(particle.x, particle.y, particle.r, particle.r * 0.28, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (particle.kind === 'sheet') {
      ctx.fillStyle = `rgba(210, 236, 255, ${alpha * 0.45})`;
      ctx.beginPath();
      ctx.ellipse(particle.x, particle.y, particle.r * 1.6, particle.r * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (particle.kind === 'bubble') {
      ctx.strokeStyle = `rgba(220, 245, 255, ${alpha * 0.8})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.r, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawRipMark(ctx, state) {
  ctx.save();
  ctx.globalAlpha = clamp(1 - state.splashT, 0, 1);
  ctx.fillStyle = '#f1c40f';
  ctx.font = '700 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('RIP', state.x, WORLD.waterY - 36);
  ctx.restore();
}

function drawFlash(ctx, state) {
  ctx.save();
  ctx.globalAlpha = clamp(state.flash.life * 2.2, 0, 1);
  ctx.fillStyle = state.flash.score >= 0.92 ? '#f1c40f' : '#ffffff';
  ctx.font = '700 26px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(state.flash.text, state.x, state.y - 68);
  ctx.restore();
}

function drawCameraTag(ctx, x, y) {
  ctx.save();
  ctx.font = '600 12px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.72)';
  ctx.textAlign = 'left';
  ctx.fillText(`KAMERA  ${cam.label.toUpperCase()}`, x + 16, y - 18);
  ctx.restore();
}

function drawUnderwaterGrade(ctx, viewW, viewH, amount) {
  ctx.save();
  ctx.globalAlpha = 0.45 * amount;
  ctx.fillStyle = '#06344d';
  ctx.fillRect(0, 0, viewW, viewH);
  ctx.globalAlpha = 0.25 * amount;
  const shaft = ctx.createLinearGradient(viewW * 0.3, 0, viewW * 0.5, viewH);
  shaft.addColorStop(0, 'rgba(180, 230, 255, 0.0)');
  shaft.addColorStop(0.5, 'rgba(180, 230, 255, 0.35)');
  shaft.addColorStop(1, 'rgba(180, 230, 255, 0)');
  ctx.fillStyle = shaft;
  ctx.fillRect(0, 0, viewW, viewH);
  ctx.restore();
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
