import { WORLD } from './sim.js';

export function draw(ctx, state, viewW, viewH) {
  ctx.fillStyle = '#071018';
  ctx.fillRect(0, 0, viewW, viewH);

  const scale = Math.min(viewW / WORLD.width, viewH / WORLD.height);
  const ox = (viewW - WORLD.width * scale) / 2;
  const oy = (viewH - WORLD.height * scale) / 2;
  ctx.save();
  ctx.translate(ox, oy);
  ctx.scale(scale, scale);
  drawWorld(ctx, state);
  ctx.restore();
}

function drawWorld(ctx, state) {
  const sky = ctx.createLinearGradient(0, 0, 0, WORLD.waterY);
  sky.addColorStop(0, '#102033');
  sky.addColorStop(0.55, '#1b3f5c');
  sky.addColorStop(1, '#24587a');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WORLD.width, WORLD.waterY);

  ctx.fillStyle = 'rgba(255, 244, 214, 0.05)';
  ctx.beginPath();
  ctx.moveTo(180, 0);
  ctx.lineTo(460, 0);
  ctx.lineTo(390, WORLD.waterY);
  ctx.lineTo(250, WORLD.waterY);
  ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  for (let i = 0; i < 4; i += 1) {
    ctx.fillRect(860 + i * 90, 36, 54, 90);
  }

  drawCrowd(ctx);
  drawWater(ctx, state);
  drawTower(ctx, state?.bend ?? 0);

  if (state && state.phase !== 'approach' && state.phase !== 'takeoff') {
    drawShadow(ctx, state);
  }
  if (state) drawDiver(ctx, state);
  if (state?.splash) drawSplash(ctx, state);
  if (state?.flash) drawFlash(ctx, state);
  if (state?.result?.rip && state.splashT < 1.1) drawRip(ctx, state);
}

function drawCrowd(ctx) {
  for (let i = 0; i < 18; i += 1) {
    const x = 470 + i * 42;
    const y = WORLD.waterY - 58;
    ctx.fillStyle = i % 3 === 0 ? '#c4554a' : i % 3 === 1 ? '#d7d2c6' : '#2f6f8f';
    ctx.fillRect(x, y, 16, 28);
    ctx.fillStyle = '#e7c2a4';
    ctx.beginPath();
    ctx.arc(x + 8, y - 6, 7, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawWater(ctx, state) {
  const water = ctx.createLinearGradient(0, WORLD.waterY, 0, WORLD.height);
  water.addColorStop(0, '#1fa6e0');
  water.addColorStop(0.35, '#0d74b0');
  water.addColorStop(1, '#063553');
  ctx.fillStyle = water;
  ctx.fillRect(0, WORLD.waterY, WORLD.width, WORLD.height - WORLD.waterY);

  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 2;
  const shift = (state?.age ?? 0) * 18;
  for (let i = 0; i < 6; i += 1) {
    const y = WORLD.waterY + 28 + i * 28;
    ctx.beginPath();
    for (let x = 0; x <= WORLD.width; x += 24) {
      const wave = Math.sin((x + shift) / 70 + i) * 3;
      if (x === 0) ctx.moveTo(x, y + wave);
      else ctx.lineTo(x, y + wave);
    }
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(0, WORLD.waterY - 2, WORLD.width, 4);
}

function drawTower(ctx, bend) {
  ctx.fillStyle = '#1c2a3b';
  ctx.fillRect(48, 70, 54, WORLD.platformY - 70);
  ctx.fillStyle = '#31445c';
  ctx.fillRect(40, WORLD.platformY - 8, 70, 16);

  const tipY = WORLD.platformY + bend;
  ctx.strokeStyle = '#e7edf4';
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(78, WORLD.platformY);
  ctx.quadraticCurveTo(230, tipY, 400, tipY);
  ctx.stroke();

  ctx.fillStyle = '#8d98a8';
  ctx.fillRect(168, WORLD.platformY - 2, 22, 16);

  ctx.fillStyle = 'rgba(255,255,255,0.72)';
  ctx.font = '600 18px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('10 m', 112, 96);
}

function drawShadow(ctx, state) {
  const height = Math.max(0, WORLD.waterY - state.y);
  const alpha = Math.max(0.08, 0.35 - height / 1400);
  ctx.fillStyle = `rgba(0, 20, 40, ${alpha})`;
  ctx.beginPath();
  ctx.ellipse(state.x, WORLD.waterY + 4, 18 + height * 0.02, 6, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawDiver(ctx, state) {
  const tuck = state.pose;
  const lining = state.opened || state.phase === 'entry' || state.phase === 'result';
  ctx.save();
  ctx.translate(state.x, state.y);
  ctx.rotate(state.rotation);

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const knee = tuck * 1.2;
  ctx.strokeStyle = '#f0c2a2';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(-4, 2);
  ctx.lineTo(-4 - Math.sin(knee) * 8, 16 + (1 - tuck) * 18);
  ctx.moveTo(4, 2);
  ctx.lineTo(8 + Math.sin(knee) * 20, 8 + (1 - tuck) * 14);
  ctx.lineTo(10 + Math.sin(knee) * 22, 24 + (1 - tuck) * 16 - tuck * 8);
  ctx.stroke();

  ctx.strokeStyle = '#1496d0';
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(0, 6);
  ctx.lineTo(tuck * 4, -22 + tuck * 8);
  ctx.stroke();

  ctx.strokeStyle = '#f0c2a2';
  ctx.lineWidth = 5;
  ctx.beginPath();
  if (lining) {
    ctx.moveTo(0, -16 + tuck * 4);
    ctx.lineTo(-2, -42);
    ctx.moveTo(0, -16 + tuck * 4);
    ctx.lineTo(2, -42);
    if ((state.grabValue ?? 0) >= 0.65) {
      ctx.moveTo(-7, -42);
      ctx.lineTo(7, -42);
    }
  } else if (tuck > 0.25) {
    ctx.moveTo(2, -8);
    ctx.lineTo(18, 6);
    ctx.moveTo(0, -8);
    ctx.lineTo(-14, 8);
  } else {
    ctx.moveTo(0, -12);
    ctx.lineTo(16, 2);
    ctx.moveTo(0, -12);
    ctx.lineTo(-16, 2);
  }
  ctx.stroke();

  const headY = -30 + tuck * 12;
  ctx.fillStyle = '#f1c40f';
  ctx.beginPath();
  ctx.arc(tuck * 3, headY, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f0c2a2';
  ctx.beginPath();
  ctx.arc(tuck * 3 + 1.5, headY + 1, 6.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawSplash(ctx, state) {
  for (const particle of state.splash) {
    if (particle.life <= 0) continue;
    const alpha = Math.max(0, particle.life / particle.max);
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawRip(ctx, state) {
  const radius = 10 + state.splashT * 70;
  ctx.strokeStyle = `rgba(241, 196, 15, ${Math.max(0, 1 - state.splashT)})`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(state.x, WORLD.waterY, radius, radius * 0.28, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#f1c40f';
  ctx.font = '700 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('RIP', state.x, WORLD.waterY - 28);
}

function drawFlash(ctx, state) {
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, state.flash.life * 2.4));
  ctx.fillStyle = state.flash.score >= 0.92 ? '#f1c40f' : '#ffffff';
  ctx.font = '700 26px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(state.flash.text, state.x, state.y - 64);
  ctx.restore();
}
