import { DIVES, getDiveById } from './dives.js';

const PHASES = {
  IDLE: 'idle',
  APPROACH: 'approach',
  TAKEOFF: 'takeoff',
  FLIGHT: 'flight',
  KICKOUT: 'kickout',
  ENTRY: 'entry',
  RESULT: 'result'
};

const PHASE_NAMES = {
  [PHASES.IDLE]: '',
  [PHASES.APPROACH]: 'Anlauf',
  [PHASES.TAKEOFF]: 'Absprung',
  [PHASES.FLIGHT]: 'Flug',
  [PHASES.KICKOUT]: 'Öffnen',
  [PHASES.ENTRY]: 'Eintritt',
  [PHASES.RESULT]: 'Ergebnis'
};

export class DivingGame {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.resize();
    
    this.phase = PHASES.IDLE;
    this.currentDive = null;
    this.phaseData = {};
    this.scores = {
      approach: 0,
      takeoff: 0,
      flight: 0,
      kickout: 0,
      entry: 0
    };
    
    this.diverY = 0;
    this.diverX = 0;
    this.diverRotation = 0;
    this.diverVelocityY = 0;
    this.diverTuck = 0;
    
    this.timingPosition = 0;
    this.timingDirection = 1;
    this.timingSpeed = 0.015;
    
    this.keys = {};
    this.keyJustPressed = {};
    
    this.sessionStats = {
      totalDives: 0,
      totalScore: 0,
      bestScore: 0,
      perfectEntries: 0
    };
    
    this.callbacks = {
      onPhaseChange: null,
      onScoreUpdate: null,
      onDiveComplete: null
    };
    
    this.setupInput();
    this.lastTime = performance.now();
    this.animate();
  }
  
  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    
    this.platformHeight = this.canvas.height * 0.15;
    this.waterLevel = this.canvas.height * 0.75;
    this.platformX = this.canvas.width * 0.3;
  }
  
  setupInput() {
    window.addEventListener('keydown', (e) => {
      if (!this.keys[e.code]) {
        this.keyJustPressed[e.code] = true;
      }
      this.keys[e.code] = true;
    });
    
    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });
    
    window.addEventListener('resize', () => this.resize());
  }
  
  startDive(diveId) {
    this.currentDive = getDiveById(diveId);
    if (!this.currentDive) return;
    
    this.scores = { approach: 0, takeoff: 0, flight: 0, kickout: 0, entry: 0 };
    this.diverX = this.platformX;
    this.diverY = this.platformHeight;
    this.diverRotation = 0;
    this.diverVelocityY = 0;
    this.diverTuck = 0;
    
    this.setPhase(PHASES.APPROACH);
  }
  
  setPhase(phase) {
    this.phase = phase;
    this.phaseData = {};
    this.phaseData.startTime = performance.now();
    
    switch (phase) {
      case PHASES.APPROACH:
        this.phaseData.step = 0;
        this.phaseData.maxSteps = this.currentDive.phases.approach.steps;
        this.phaseData.stepTiming = [];
        this.timingPosition = 0;
        this.timingDirection = 1;
        this.timingSpeed = 0.012;
        break;
        
      case PHASES.TAKEOFF:
        this.timingPosition = 0;
        this.timingDirection = 1;
        this.timingSpeed = 0.018;
        this.phaseData.powerHeld = false;
        this.phaseData.powerValue = 0;
        this.phaseData.released = false;
        break;
        
      case PHASES.FLIGHT:
        this.diverVelocityY = -15;
        this.phaseData.tuckHeld = false;
        this.phaseData.tuckQuality = 0;
        this.phaseData.tuckSamples = 0;
        this.phaseData.twistTaps = 0;
        this.phaseData.requiredTwistTaps = this.currentDive.phases.flight.twistTaps || 0;
        this.phaseData.targetRotation = this.currentDive.rotations * Math.PI * 2;
        break;
        
      case PHASES.KICKOUT:
        this.timingPosition = 0;
        this.timingDirection = 1;
        this.timingSpeed = 0.025;
        this.phaseData.opened = false;
        break;
        
      case PHASES.ENTRY:
        this.timingPosition = 0;
        this.timingDirection = 1;
        this.timingSpeed = 0.03;
        this.phaseData.grabbed = false;
        break;
        
      case PHASES.RESULT:
        this.calculateFinalScore();
        break;
    }
    
    if (this.callbacks.onPhaseChange) {
      this.callbacks.onPhaseChange(phase, PHASE_NAMES[phase]);
    }
  }
  
  update(dt) {
    for (const key in this.keyJustPressed) {
      this.keyJustPressed[key] = false;
    }
    
    switch (this.phase) {
      case PHASES.APPROACH:
        this.updateApproach(dt);
        break;
      case PHASES.TAKEOFF:
        this.updateTakeoff(dt);
        break;
      case PHASES.FLIGHT:
        this.updateFlight(dt);
        break;
      case PHASES.KICKOUT:
        this.updateKickout(dt);
        break;
      case PHASES.ENTRY:
        this.updateEntry(dt);
        break;
    }
  }
  
  updateApproach(dt) {
    this.timingPosition += this.timingSpeed * this.timingDirection * dt;
    if (this.timingPosition >= 1) {
      this.timingPosition = 1;
      this.timingDirection = -1;
    } else if (this.timingPosition <= 0) {
      this.timingPosition = 0;
      this.timingDirection = 1;
    }
    
    if (this.keyJustPressed['Space']) {
      const accuracy = this.getTimingAccuracy(this.timingPosition, 0.45, 0.55, 0.35, 0.65);
      this.phaseData.stepTiming.push(accuracy);
      this.phaseData.step++;
      this.diverX += 30;
      
      if (this.phaseData.step >= this.phaseData.maxSteps) {
        const avgAccuracy = this.phaseData.stepTiming.reduce((a, b) => a + b, 0) / this.phaseData.stepTiming.length;
        this.scores.approach = avgAccuracy;
        this.setPhase(PHASES.TAKEOFF);
      }
    }
  }
  
  updateTakeoff(dt) {
    this.timingPosition += this.timingSpeed * this.timingDirection * dt;
    if (this.timingPosition >= 1) {
      this.timingPosition = 1;
      this.timingDirection = -1;
    } else if (this.timingPosition <= 0) {
      this.timingPosition = 0;
      this.timingDirection = 1;
    }
    
    if (this.keys['Space'] && !this.phaseData.released) {
      this.phaseData.powerHeld = true;
      this.phaseData.powerValue = Math.min(this.phaseData.powerValue + dt * 0.002, 1);
    }
    
    if (!this.keys['Space'] && this.phaseData.powerHeld && !this.phaseData.released) {
      this.phaseData.released = true;
      
      const target = this.currentDive.phases.takeoff.powerTarget;
      const powerPercent = this.phaseData.powerValue * 100;
      const inRange = powerPercent >= target[0] && powerPercent <= target[1];
      const timingAcc = this.getTimingAccuracy(this.timingPosition, 0.4, 0.6, 0.3, 0.7);
      
      let powerScore = inRange ? 1 : Math.max(0, 1 - Math.abs(powerPercent - (target[0] + target[1]) / 2) / 50);
      this.scores.takeoff = (timingAcc + powerScore) / 2;
      
      this.setPhase(PHASES.FLIGHT);
    }
  }
  
  updateFlight(dt) {
    this.diverVelocityY += 0.03 * dt;
    this.diverY += this.diverVelocityY * dt * 0.1;
    
    if (this.keys['Space']) {
      this.diverTuck = Math.min(this.diverTuck + dt * 0.005, 1);
      this.phaseData.tuckHeld = true;
    } else {
      this.diverTuck = Math.max(this.diverTuck - dt * 0.008, 0);
    }
    
    const rotationSpeed = 0.003 + this.diverTuck * 0.007;
    this.diverRotation += rotationSpeed * dt;
    
    if (this.phaseData.tuckHeld) {
      const targetTuck = this.currentDive.phases.flight.tuckDepth;
      const tuckDiff = Math.abs(this.diverTuck - targetTuck);
      const tuckScore = Math.max(0, 1 - tuckDiff * 2);
      this.phaseData.tuckQuality += tuckScore;
      this.phaseData.tuckSamples++;
    }
    
    if (this.keyJustPressed['KeyT'] && this.phaseData.requiredTwistTaps > 0) {
      this.phaseData.twistTaps++;
    }
    
    const rotationProgress = this.diverRotation / this.phaseData.targetRotation;
    if (rotationProgress >= 0.7 && this.diverY > this.waterLevel - 200) {
      let flightScore = this.phaseData.tuckSamples > 0 
        ? this.phaseData.tuckQuality / this.phaseData.tuckSamples 
        : 0.5;
      
      if (this.phaseData.requiredTwistTaps > 0) {
        const twistAccuracy = Math.min(this.phaseData.twistTaps / this.phaseData.requiredTwistTaps, 1);
        flightScore = (flightScore + twistAccuracy) / 2;
      }
      
      this.scores.flight = flightScore;
      this.setPhase(PHASES.KICKOUT);
    }
    
    if (this.diverY > this.waterLevel) {
      this.scores.flight = 0.3;
      this.scores.kickout = 0;
      this.scores.entry = 0;
      this.setPhase(PHASES.RESULT);
    }
  }
  
  updateKickout(dt) {
    this.diverVelocityY += 0.03 * dt;
    this.diverY += this.diverVelocityY * dt * 0.1;
    
    this.diverTuck = Math.max(this.diverTuck - dt * 0.01, 0);
    this.diverRotation += 0.002 * dt;
    
    this.timingPosition += this.timingSpeed * this.timingDirection * dt;
    if (this.timingPosition >= 1) {
      this.timingPosition = 1;
      this.timingDirection = -1;
    } else if (this.timingPosition <= 0) {
      this.timingPosition = 0;
      this.timingDirection = 1;
    }
    
    if (this.keyJustPressed['Space'] && !this.phaseData.opened) {
      this.phaseData.opened = true;
      this.scores.kickout = this.getTimingAccuracy(this.timingPosition, 0.4, 0.6, 0.25, 0.75);
      this.diverTuck = 0;
      this.setPhase(PHASES.ENTRY);
    }
    
    if (this.diverY > this.waterLevel - 50) {
      this.scores.kickout = 0.3;
      this.setPhase(PHASES.ENTRY);
    }
  }
  
  updateEntry(dt) {
    this.diverVelocityY += 0.03 * dt;
    this.diverY += this.diverVelocityY * dt * 0.1;
    
    this.timingPosition += this.timingSpeed * this.timingDirection * dt;
    if (this.timingPosition >= 1) {
      this.timingPosition = 1;
      this.timingDirection = -1;
    } else if (this.timingPosition <= 0) {
      this.timingPosition = 0;
      this.timingDirection = 1;
    }
    
    if (this.keyJustPressed['Space'] && !this.phaseData.grabbed) {
      this.phaseData.grabbed = true;
      this.scores.entry = this.getTimingAccuracy(this.timingPosition, 0.45, 0.55, 0.3, 0.7);
    }
    
    if (this.diverY > this.waterLevel) {
      if (!this.phaseData.grabbed) {
        this.scores.entry = 0.2;
      }
      this.setPhase(PHASES.RESULT);
    }
  }
  
  getTimingAccuracy(pos, perfectMin, perfectMax, goodMin, goodMax) {
    if (pos >= perfectMin && pos <= perfectMax) {
      return 1.0;
    } else if (pos >= goodMin && pos <= goodMax) {
      const distFromPerfect = pos < perfectMin 
        ? (perfectMin - pos) / (perfectMin - goodMin)
        : (pos - perfectMax) / (goodMax - perfectMax);
      return 0.7 + 0.3 * (1 - distFromPerfect);
    }
    return Math.max(0.2, 0.7 * (1 - Math.min(Math.abs(pos - 0.5) / 0.5, 1)));
  }
  
  calculateFinalScore() {
    const weights = {
      approach: 0.1,
      takeoff: 0.25,
      flight: 0.3,
      kickout: 0.15,
      entry: 0.2
    };
    
    let executionBase = 0;
    for (const [phase, weight] of Object.entries(weights)) {
      executionBase += this.scores[phase] * weight;
    }
    
    const execution = 5 + executionBase * 5;
    const dd = this.currentDive.dd;
    const finalScore = execution * dd;
    
    this.sessionStats.totalDives++;
    this.sessionStats.totalScore += finalScore;
    if (finalScore > this.sessionStats.bestScore) {
      this.sessionStats.bestScore = finalScore;
    }
    if (this.scores.entry >= 0.9) {
      this.sessionStats.perfectEntries++;
    }
    
    const result = {
      dive: this.currentDive,
      scores: { ...this.scores },
      execution: execution,
      dd: dd,
      finalScore: finalScore,
      sessionStats: { ...this.sessionStats }
    };
    
    if (this.callbacks.onDiveComplete) {
      this.callbacks.onDiveComplete(result);
    }
  }
  
  render() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    
    const skyGrad = ctx.createLinearGradient(0, 0, 0, this.waterLevel);
    skyGrad.addColorStop(0, '#0a1628');
    skyGrad.addColorStop(0.5, '#1a3a5c');
    skyGrad.addColorStop(1, '#2d5a7b');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, this.waterLevel);
    
    const waterGrad = ctx.createLinearGradient(0, this.waterLevel, 0, h);
    waterGrad.addColorStop(0, '#1fa6e0');
    waterGrad.addColorStop(0.3, '#0d7ab5');
    waterGrad.addColorStop(1, '#064a73');
    ctx.fillStyle = waterGrad;
    ctx.fillRect(0, this.waterLevel, w, h - this.waterLevel);
    
    ctx.fillStyle = '#1a3a5c';
    ctx.fillRect(0, this.waterLevel - 3, w, 6);
    
    this.drawPlatform(ctx);
    
    if (this.phase !== PHASES.IDLE && this.phase !== PHASES.RESULT) {
      this.drawDiver(ctx);
    }
    
    if (this.phase === PHASES.RESULT) {
      this.drawSplash(ctx);
    }
  }
  
  drawPlatform(ctx) {
    ctx.fillStyle = '#4a5568';
    ctx.fillRect(this.platformX - 100, this.platformHeight - 10, 150, 20);
    
    ctx.fillStyle = '#2d3748';
    ctx.fillRect(this.platformX - 100, this.platformHeight + 10, 20, this.waterLevel - this.platformHeight - 10);
    
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(this.platformX - 100, this.platformHeight - 15, 150, 5);
    
    ctx.fillStyle = '#718096';
    ctx.font = '14px sans-serif';
    ctx.fillText('10m', this.platformX - 130, this.platformHeight);
  }
  
  drawDiver(ctx) {
    ctx.save();
    ctx.translate(this.diverX, this.diverY);
    ctx.rotate(this.diverRotation);
    
    const bodyLength = 50;
    const tuckFactor = 1 - this.diverTuck * 0.5;
    
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(0, -bodyLength * tuckFactor * 0.4, 12, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.strokeStyle = '#1fa6e0';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    
    ctx.beginPath();
    ctx.moveTo(0, -bodyLength * tuckFactor * 0.3);
    ctx.lineTo(0, bodyLength * tuckFactor * 0.3);
    ctx.stroke();
    
    const armAngle = this.diverTuck * Math.PI * 0.6;
    ctx.beginPath();
    ctx.moveTo(0, -bodyLength * tuckFactor * 0.2);
    ctx.lineTo(-20 * Math.cos(armAngle), -bodyLength * tuckFactor * 0.2 + 20 * Math.sin(armAngle));
    ctx.moveTo(0, -bodyLength * tuckFactor * 0.2);
    ctx.lineTo(20 * Math.cos(armAngle), -bodyLength * tuckFactor * 0.2 + 20 * Math.sin(armAngle));
    ctx.stroke();
    
    const legAngle = this.diverTuck * Math.PI * 0.5;
    ctx.beginPath();
    ctx.moveTo(0, bodyLength * tuckFactor * 0.3);
    ctx.lineTo(-15 * Math.sin(legAngle), bodyLength * tuckFactor * 0.3 + 25 * Math.cos(legAngle));
    ctx.moveTo(0, bodyLength * tuckFactor * 0.3);
    ctx.lineTo(15 * Math.sin(legAngle), bodyLength * tuckFactor * 0.3 + 25 * Math.cos(legAngle));
    ctx.stroke();
    
    ctx.restore();
  }
  
  drawSplash(ctx) {
    const splashQuality = this.scores.entry;
    const splashSize = 30 + (1 - splashQuality) * 100;
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const dist = splashSize * (0.5 + Math.random() * 0.5);
      ctx.beginPath();
      ctx.arc(
        this.diverX + Math.cos(angle) * dist,
        this.waterLevel + Math.sin(angle) * dist * 0.3,
        5 + Math.random() * 10,
        0, Math.PI * 2
      );
      ctx.fill();
    }
  }
  
  animate() {
    const now = performance.now();
    const dt = now - this.lastTime;
    this.lastTime = now;
    
    this.update(dt);
    this.render();
    
    requestAnimationFrame(() => this.animate());
  }
  
  getTimingInfo() {
    if (this.phase === PHASES.IDLE || this.phase === PHASES.RESULT) {
      return null;
    }
    
    let targetRange = null;
    let perfectRange = null;
    
    switch (this.phase) {
      case PHASES.APPROACH:
        perfectRange = [0.45, 0.55];
        targetRange = [0.35, 0.65];
        break;
      case PHASES.TAKEOFF:
        perfectRange = [0.4, 0.6];
        targetRange = [0.3, 0.7];
        break;
      case PHASES.KICKOUT:
        perfectRange = [0.4, 0.6];
        targetRange = [0.25, 0.75];
        break;
      case PHASES.ENTRY:
        perfectRange = [0.45, 0.55];
        targetRange = [0.3, 0.7];
        break;
      case PHASES.FLIGHT:
        return { showBar: false };
    }
    
    return {
      showBar: true,
      position: this.timingPosition,
      targetRange,
      perfectRange
    };
  }
  
  getPhaseInstructions() {
    switch (this.phase) {
      case PHASES.APPROACH:
        return `Anlauf: <kbd>Leertaste</kbd> im grünen Bereich drücken (${this.phaseData.step + 1}/${this.phaseData.maxSteps})`;
      case PHASES.TAKEOFF:
        return `Absprung: <kbd>Leertaste</kbd> halten für Kraft, loslassen im richtigen Moment`;
      case PHASES.FLIGHT:
        let instr = `Flug: <kbd>Leertaste</kbd> halten für Hocke/Rotation`;
        if (this.phaseData.requiredTwistTaps > 0) {
          instr += ` | <kbd>T</kbd> für Schrauben (${this.phaseData.twistTaps}/${this.phaseData.requiredTwistTaps})`;
        }
        return instr;
      case PHASES.KICKOUT:
        return `Öffnen: <kbd>Leertaste</kbd> im grünen Bereich zum Strecken`;
      case PHASES.ENTRY:
        return `Eintritt: <kbd>Leertaste</kbd> für Hand-Grab (Rip!)`;
      default:
        return '';
    }
  }
  
  getCurrentPhase() {
    return this.phase;
  }
  
  getCurrentPhaseName() {
    return PHASE_NAMES[this.phase];
  }
}
