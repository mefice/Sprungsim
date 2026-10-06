import { DivingGame } from './game.js';
import { DIVES, getUnlockedDives } from './dives.js';

const canvas = document.getElementById('gameCanvas');
const uiOverlay = document.getElementById('ui-overlay');
const menuOverlay = document.getElementById('menu-overlay');
const phaseIndicator = document.getElementById('phase-indicator');
const timingBarContainer = document.getElementById('timing-bar-container');
const timingMarker = document.getElementById('timing-marker');
const timingTarget = document.getElementById('timing-target');
const diveInfo = document.getElementById('dive-info');
const scoreDisplay = document.getElementById('score-display');
const judgeFeedback = document.getElementById('judge-feedback');
const instructions = document.getElementById('instructions');
const diveButtons = document.getElementById('dive-buttons');
const startBtn = document.getElementById('start-btn');
const sessionStats = document.getElementById('session-stats');

let selectedDiveId = DIVES[0].id;
let game = null;

function initUI() {
  const unlockedDives = getUnlockedDives();
  diveButtons.innerHTML = '';
  
  unlockedDives.forEach(dive => {
    const btn = document.createElement('button');
    btn.className = `dive-btn ${dive.id === selectedDiveId ? 'selected' : ''}`;
    btn.innerHTML = `
      <div>
        <div><strong>${dive.id}</strong> - ${dive.name}</div>
        <div class="dive-difficulty">${dive.difficulty}</div>
      </div>
      <div class="dive-dd">DD ${dive.dd.toFixed(1)}</div>
    `;
    btn.addEventListener('click', () => {
      selectedDiveId = dive.id;
      document.querySelectorAll('.dive-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
    diveButtons.appendChild(btn);
  });
  
  updateSessionStats({ totalDives: 0, totalScore: 0, bestScore: 0, perfectEntries: 0 });
}

function updateSessionStats(stats) {
  if (stats.totalDives === 0) {
    sessionStats.innerHTML = `
      <h3>Session-Statistik</h3>
      <p style="color: rgba(255,255,255,0.5); font-size: 14px;">Noch keine Sprünge absolviert</p>
    `;
  } else {
    sessionStats.innerHTML = `
      <h3>Session-Statistik</h3>
      <div class="stat-row">
        <span class="label">Sprünge:</span>
        <span class="value">${stats.totalDives}</span>
      </div>
      <div class="stat-row">
        <span class="label">Durchschnitt:</span>
        <span class="value">${(stats.totalScore / stats.totalDives).toFixed(2)}</span>
      </div>
      <div class="stat-row">
        <span class="label">Beste Wertung:</span>
        <span class="value">${stats.bestScore.toFixed(2)}</span>
      </div>
      <div class="stat-row">
        <span class="label">Perfekte Eintritte:</span>
        <span class="value">${stats.perfectEntries}</span>
      </div>
    `;
  }
}

function startGame() {
  menuOverlay.classList.add('hidden');
  uiOverlay.classList.add('active');
  scoreDisplay.classList.remove('visible');
  judgeFeedback.classList.remove('visible');
  
  const dive = DIVES.find(d => d.id === selectedDiveId);
  diveInfo.innerHTML = `
    <div class="dive-name">${dive.id} - ${dive.name}</div>
    <div class="dive-dd">Schwierigkeitsgrad: ${dive.dd.toFixed(1)}</div>
  `;
  
  game.startDive(selectedDiveId);
}

function showResults(result) {
  const execution = result.execution;
  const finalScore = result.finalScore;
  
  let rating, ratingClass;
  if (execution >= 8.5) {
    rating = 'Ausgezeichnet!';
    ratingClass = 'excellent';
  } else if (execution >= 7.0) {
    rating = 'Gut!';
    ratingClass = 'good';
  } else if (execution >= 5.5) {
    rating = 'Ordentlich';
    ratingClass = 'ok';
  } else {
    rating = 'Verbesserungswürdig';
    ratingClass = 'poor';
  }
  
  scoreDisplay.innerHTML = `
    <div class="final-score">${finalScore.toFixed(2)}</div>
    <div class="score-breakdown">
      Ausführung: ${execution.toFixed(1)} × DD ${result.dd.toFixed(1)}
    </div>
    <div class="rating ${ratingClass}">${rating}</div>
    <button class="continue-btn" id="continue-btn">Weiter</button>
  `;
  scoreDisplay.classList.add('visible');
  
  const feedbackItems = [
    { label: 'Anlauf', value: result.scores.approach, threshold: [0.7, 0.9] },
    { label: 'Absprung', value: result.scores.takeoff, threshold: [0.7, 0.9] },
    { label: 'Rotation', value: result.scores.flight, threshold: [0.7, 0.9] },
    { label: 'Öffnen', value: result.scores.kickout, threshold: [0.7, 0.9] },
    { label: 'Eintritt', value: result.scores.entry, threshold: [0.8, 0.95] }
  ];
  
  let feedbackHtml = '<h3>Kampfrichter-Feedback</h3>';
  feedbackItems.forEach(item => {
    let valueClass = 'bad';
    let valueText = 'Mangelhaft';
    if (item.value >= item.threshold[1]) {
      valueClass = 'good';
      valueText = 'Exzellent';
    } else if (item.value >= item.threshold[0]) {
      valueClass = 'ok';
      valueText = 'Gut';
    }
    feedbackHtml += `
      <div class="feedback-item">
        <span class="label">${item.label}</span>
        <span class="value ${valueClass}">${valueText}</span>
      </div>
    `;
  });
  
  if (result.scores.entry >= 0.95) {
    feedbackHtml += `<div style="margin-top: 15px; color: #2ecc71; font-weight: 600;">RIP! Perfekter Eintritt!</div>`;
  }
  
  judgeFeedback.innerHTML = feedbackHtml;
  judgeFeedback.classList.add('visible');
  
  document.getElementById('continue-btn').addEventListener('click', () => {
    scoreDisplay.classList.remove('visible');
    judgeFeedback.classList.remove('visible');
    uiOverlay.classList.remove('active');
    menuOverlay.classList.remove('hidden');
    updateSessionStats(result.sessionStats);
  });
}

function updateUI() {
  if (!game) return;
  
  const phase = game.getCurrentPhase();
  const phaseName = game.getCurrentPhaseName();
  
  phaseIndicator.textContent = phaseName;
  
  const timingInfo = game.getTimingInfo();
  if (timingInfo && timingInfo.showBar) {
    timingBarContainer.classList.add('visible');
    timingMarker.style.left = `${timingInfo.position * 100}%`;
    
    const targetStart = timingInfo.targetRange[0] * 100;
    const targetWidth = (timingInfo.targetRange[1] - timingInfo.targetRange[0]) * 100;
    timingTarget.style.left = `${targetStart}%`;
    timingTarget.style.width = `${targetWidth}%`;
    
    const inPerfect = timingInfo.position >= timingInfo.perfectRange[0] && 
                      timingInfo.position <= timingInfo.perfectRange[1];
    timingTarget.classList.toggle('perfect', inPerfect);
  } else {
    timingBarContainer.classList.remove('visible');
  }
  
  const instr = game.getPhaseInstructions();
  if (instr) {
    instructions.innerHTML = instr;
    instructions.style.display = 'block';
  } else {
    instructions.style.display = 'none';
  }
  
  requestAnimationFrame(updateUI);
}

function init() {
  game = new DivingGame(canvas);
  
  game.callbacks.onPhaseChange = (phase, name) => {
    phaseIndicator.textContent = name;
  };
  
  game.callbacks.onDiveComplete = (result) => {
    showResults(result);
  };
  
  initUI();
  
  startBtn.addEventListener('click', startGame);
  
  updateUI();
}

window.addEventListener('load', init);
