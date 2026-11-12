/**
 * Рандомайзер обеда — Vanilla JS Clean Engine
 * - Clean Manrope font
 * - Zero scrolling: all 6 members visible simultaneously
 * - 17 employees with Kursant pinned to Group 3
 * - Daily cyclic rotation: 11:00 -> 12:00 -> 13:00 -> 11:00
 * - Drag & Drop with swap
 * - Local-First persistence + optional Firebase sync
 */

// --- Default Employee Roster ---
const DEFAULT_EMPLOYEES = [
  // Men (7)
  { id: 'emp_m1', name: 'Байэль', gender: 'male', pinnedGroup: null },
  { id: 'emp_m2', name: 'Айзат', gender: 'male', pinnedGroup: null },
  { id: 'emp_m3', name: 'Тунунук', gender: 'male', pinnedGroup: null },
  { id: 'emp_m4', name: 'Рамазан', gender: 'male', pinnedGroup: null },
  { id: 'emp_m5', name: 'Санжар', gender: 'male', pinnedGroup: null },
  { id: 'emp_m6', name: 'Курсант', gender: 'male', pinnedGroup: 3 }, // Pinned to Group 3
  { id: 'emp_m7', name: 'Хан', gender: 'male', pinnedGroup: null },

  // Women (10)
  { id: 'emp_w1', name: 'Ася', gender: 'female', pinnedGroup: null },
  { id: 'emp_w2', name: 'Айпери', gender: 'female', pinnedGroup: null },
  { id: 'emp_w3', name: 'Наргиз', gender: 'female', pinnedGroup: null },
  { id: 'emp_w4', name: 'Айдана', gender: 'female', pinnedGroup: null },
  { id: 'emp_w5', name: 'Айдай', gender: 'female', pinnedGroup: null },
  { id: 'emp_w6', name: 'Арина', gender: 'female', pinnedGroup: null },
  { id: 'emp_w7', name: 'Эльнура', gender: 'female', pinnedGroup: null },
  { id: 'emp_w8', name: 'Малика', gender: 'female', pinnedGroup: null },
  { id: 'emp_w9', name: 'Эльзира', gender: 'female', pinnedGroup: null },
  { id: 'emp_w10', name: 'Айгуль', gender: 'female', pinnedGroup: null },
];

const GROUP_CONFIG = [
  { id: 1, name: '11:00 – 12:00', maxCapacity: 6 },
  { id: 2, name: '12:00 – 13:00', maxCapacity: 6 },
  { id: 3, name: '13:00 – 14:00', maxCapacity: 6 },
];

// --- State ---
const state = {
  currentDateStr: getIsoDate(new Date()),
  viewingDateStr: getIsoDate(new Date()),
  employees: [],
  schedules: {},
  draggedEmpId: null,
  draggedSourceGroup: null,
  firebaseApp: null,
  firestoreDb: null,
  isFirebaseConnected: false,
  firebaseConfig: null,
  activeTabCode: 'index.html',
  soundEnabled: true,
  audioCtx: null,
};

const STORAGE_KEYS = {
  EMPLOYEES: 'lunch_randomizer_employees_v2',
  SCHEDULES: 'lunch_randomizer_schedules_v2',
  FIREBASE_CONFIG: 'lunch_randomizer_fb_config_v2',
  SOUND_ENABLED: 'lunch_randomizer_sound_v2',
};

// --- Utilities ---
function getIsoDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseIsoDate(isoStr) {
  const [y, m, d] = isoStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatRussianDate(date) {
  const weekdays = [
    'Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'
  ];
  const months = [
    'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
  ];

  const weekday = weekdays[date.getDay()];
  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();

  return `${weekday}, ${day} ${month} ${year} года`;
}

function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// --- Web Audio Tactile Synthesizer ---
function initAudioContext() {
  if (!state.audioCtx && (window.AudioContext || window.webkitAudioContext)) {
    const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
    state.audioCtx = new AudioCtxClass();
  }
  if (state.audioCtx && state.audioCtx.state === 'suspended') {
    state.audioCtx.resume();
  }
}

function playAudioFx(type) {
  if (!state.soundEnabled) return;
  try {
    initAudioContext();
    if (!state.audioCtx) return;

    const ctx = state.audioCtx;
    const now = ctx.currentTime;

    if (type === 'pop') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(680, now + 0.04);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.05);
    } else if (type === 'snap') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.exponentialRampToValueAtTime(100, now + 0.06);
      gain.gain.setValueAtTime(0.16, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.07);
    } else if (type === 'celebrate') {
      [523.25, 659.25, 783.99].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.05);
        gain.gain.setValueAtTime(0.12, now + i * 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.05 + 0.18);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.05);
        osc.stop(now + i * 0.05 + 0.19);
      });
    }
  } catch (e) {
    // Silent
  }
}

function toggleSoundFX() {
  state.soundEnabled = !state.soundEnabled;
  localStorage.setItem(STORAGE_KEYS.SOUND_ENABLED, String(state.soundEnabled));
  const icon = document.getElementById('sound-icon');
  if (icon) icon.textContent = state.soundEnabled ? '🔊' : '🔇';
  if (state.soundEnabled) playAudioFx('pop');
  showToast(state.soundEnabled ? 'Звук включен' : 'Звук выключен', 'info');
}

// Particle Burst
function burstParticles(x, y) {
  const canvas = document.getElementById('fx-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const colors = ['#ffffff', '#ff337f', '#38bdf8', '#fbbf24', '#22c55e'];
  const particles = [];

  for (let i = 0; i < 35; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 3 + Math.random() * 5;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 1.2,
      size: 4 + Math.random() * 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      alpha: 1,
      decay: 0.02 + Math.random() * 0.02,
    });
  }

  function frame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let active = false;

    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.15;
      p.alpha -= p.decay;

      if (p.alpha > 0) {
        active = true;
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    });

    if (active) requestAnimationFrame(frame);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  requestAnimationFrame(frame);
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  let dotColor = '#ffffff';
  if (type === 'success') dotColor = '#22c55e';
  else if (type === 'warn') dotColor = '#fbbf24';

  toast.innerHTML = `<span style="width:7px; height:7px; border-radius:50%; background:${dotColor};"></span><span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 250);
  }, 2800);
}

// --- Persistence ---
function loadLocalData() {
  try {
    const rawEmp = localStorage.getItem(STORAGE_KEYS.EMPLOYEES);
    state.employees = rawEmp ? JSON.parse(rawEmp) : [...DEFAULT_EMPLOYEES];

    // Ensure Kursant is pinned to Group 3
    const kursant = state.employees.find(e => e.name === 'Курсант');
    if (kursant && kursant.pinnedGroup === undefined) {
      kursant.pinnedGroup = 3;
    }

    const rawSched = localStorage.getItem(STORAGE_KEYS.SCHEDULES);
    state.schedules = rawSched ? JSON.parse(rawSched) : {};

    const rawFb = localStorage.getItem(STORAGE_KEYS.FIREBASE_CONFIG);
    if (rawFb) state.firebaseConfig = JSON.parse(rawFb);

    const soundVal = localStorage.getItem(STORAGE_KEYS.SOUND_ENABLED);
    if (soundVal !== null) state.soundEnabled = soundVal === 'true';
  } catch (e) {
    state.employees = [...DEFAULT_EMPLOYEES];
    state.schedules = {};
  }
}

function saveLocalData() {
  try {
    localStorage.setItem(STORAGE_KEYS.EMPLOYEES, JSON.stringify(state.employees));
    localStorage.setItem(STORAGE_KEYS.SCHEDULES, JSON.stringify(state.schedules));
    if (state.firebaseConfig) {
      localStorage.setItem(STORAGE_KEYS.FIREBASE_CONFIG, JSON.stringify(state.firebaseConfig));
    }
  } catch (e) {
    console.error('Error saving to storage', e);
  }
}

// --- Distribution & Rotation ---
function generateFairInitialDistribution(employeesList) {
  const groups = { 1: [], 2: [], 3: [] };
  const targetSizes = { 1: 6, 2: 6, 3: 5 };

  const unpinned = [];
  employeesList.forEach(emp => {
    if (emp.pinnedGroup && groups[emp.pinnedGroup]) {
      groups[emp.pinnedGroup].push(emp.id);
    } else {
      unpinned.push(emp);
    }
  });

  const men = shuffleArray(unpinned.filter(e => e.gender === 'male'));
  const women = shuffleArray(unpinned.filter(e => e.gender === 'female'));

  function getBestGroup(candidateGroups, genderKey) {
    return candidateGroups
      .filter(gId => groups[gId].length < targetSizes[gId])
      .sort((a, b) => {
        const countA = groups[a].filter(id => employeesList.find(e => e.id === id)?.gender === genderKey).length;
        const countB = groups[b].filter(id => employeesList.find(e => e.id === id)?.gender === genderKey).length;
        if (countA !== countB) return countA - countB;
        return groups[a].length - groups[b].length;
      })[0];
  }

  men.forEach(m => {
    const bestG = getBestGroup([1, 2, 3], 'male') || [1, 2, 3].find(g => groups[g].length < targetSizes[g]) || 1;
    groups[bestG].push(m.id);
  });

  women.forEach(w => {
    const bestG = getBestGroup([1, 2, 3], 'female') || [1, 2, 3].find(g => groups[g].length < targetSizes[g]) || 1;
    groups[bestG].push(w.id);
  });

  return groups;
}

function findPreviousSchedule(targetDateStr) {
  const dates = Object.keys(state.schedules)
    .filter(d => d < targetDateStr)
    .sort();
  if (dates.length === 0) return null;
  const latestDate = dates[dates.length - 1];
  return { date: latestDate, schedule: state.schedules[latestDate] };
}

function rotateFromPreviousSchedule(prevSchedule, currentEmployees) {
  const empMap = new Map(currentEmployees.map(e => [e.id, e]));
  const prevGroups = prevSchedule.groups;

  const nextGroups = { 1: [], 2: [], 3: [] };

  // Kursant stays in Group 3
  currentEmployees.forEach(emp => {
    if (emp.pinnedGroup && nextGroups[emp.pinnedGroup]) {
      nextGroups[emp.pinnedGroup].push(emp.id);
    }
  });

  const candidatesForG2 = [];
  const candidatesForG3 = [];
  const candidatesForG1 = [];

  (prevGroups[1] || []).forEach(empId => {
    const emp = empMap.get(empId);
    if (emp && !emp.pinnedGroup) candidatesForG2.push(empId);
  });

  (prevGroups[2] || []).forEach(empId => {
    const emp = empMap.get(empId);
    if (emp && !emp.pinnedGroup) candidatesForG3.push(empId);
  });

  (prevGroups[3] || []).forEach(empId => {
    const emp = empMap.get(empId);
    if (emp && !emp.pinnedGroup) candidatesForG1.push(empId);
  });

  currentEmployees.forEach(emp => {
    if (!emp.pinnedGroup) {
      const wasInPrev = (prevGroups[1] || []).includes(emp.id) ||
                        (prevGroups[2] || []).includes(emp.id) ||
                        (prevGroups[3] || []).includes(emp.id);
      if (!wasInPrev) {
        candidatesForG1.push(emp.id);
      }
    }
  });

  const totalCount = currentEmployees.length;
  const target3 = Math.floor(totalCount / 3);
  const target2 = Math.floor((totalCount - target3) / 2);
  const target1 = totalCount - target2 - target3;

  candidatesForG2.forEach(id => nextGroups[2].push(id));

  const availableSlotsInG3 = Math.max(0, target3 - nextGroups[3].length);
  const shuffledFromG2 = shuffleArray(candidatesForG3);
  const toG3 = shuffledFromG2.slice(0, availableSlotsInG3);
  const overflowToG1 = shuffledFromG2.slice(availableSlotsInG3);

  toG3.forEach(id => nextGroups[3].push(id));
  candidatesForG1.forEach(id => nextGroups[1].push(id));
  overflowToG1.forEach(id => nextGroups[1].push(id));

  while (nextGroups[2].length > target2 && nextGroups[1].length < target1) {
    const unpinnedIdx = nextGroups[2].findIndex(id => !empMap.get(id)?.pinnedGroup);
    if (unpinnedIdx >= 0) {
      const [moved] = nextGroups[2].splice(unpinnedIdx, 1);
      nextGroups[1].push(moved);
    } else break;
  }

  nextGroups[1] = shuffleArray(nextGroups[1]);
  nextGroups[2] = shuffleArray(nextGroups[2]);
  nextGroups[3] = shuffleArray(nextGroups[3]);

  return nextGroups;
}

function getOrCreateScheduleForDate(dateStr) {
  if (state.schedules[dateStr] && state.schedules[dateStr].groups) {
    return state.schedules[dateStr];
  }

  const prev = findPreviousSchedule(dateStr);
  let newGroups;

  if (prev && prev.schedule && prev.schedule.groups) {
    newGroups = rotateFromPreviousSchedule(prev.schedule, state.employees);
  } else {
    newGroups = generateFairInitialDistribution(state.employees);
  }

  const newSchedule = {
    date: dateStr,
    groups: newGroups,
    isManual: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  state.schedules[dateStr] = newSchedule;
  saveLocalData();
  syncScheduleToFirebase(dateStr, newSchedule);

  return newSchedule;
}

// --- UI Rendering ---

function renderApp() {
  updateHeaderInfo();
  renderAvatarStack();
  renderGroupCards();
  renderSummaryStats();
}

function updateHeaderInfo() {
  const viewingDate = parseIsoDate(state.viewingDateStr);
  const isToday = state.viewingDateStr === state.currentDateStr;

  const dateLabel = document.getElementById('current-date-text');
  if (dateLabel) {
    dateLabel.textContent = formatRussianDate(viewingDate);
  }

  const navDayLabel = document.getElementById('nav-day-label');
  if (navDayLabel) {
    navDayLabel.textContent = isToday ? 'Сегодня' : formatRussianDate(viewingDate).split(',')[0];
  }

  const boardTitle = document.getElementById('board-schedule-title');
  if (boardTitle) {
    boardTitle.textContent = isToday ? 'Расписание на сегодня' : `Расписание: ${state.viewingDateStr}`;
  }

  // Clock
  const now = new Date();
  const timeEl = document.getElementById('live-time-display');
  if (timeEl) {
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    timeEl.textContent = `${hh}:${mm}:${ss}`;
  }
}

function renderAvatarStack() {
  const container = document.getElementById('avatar-stack-wrap');
  if (!container) return;
  container.innerHTML = '';

  const visibleEmp = state.employees.slice(0, 5);
  const remainingCount = state.employees.length - visibleEmp.length;

  visibleEmp.forEach(emp => {
    const item = document.createElement('div');
    item.className = `stack-avatar ${emp.gender === 'male' ? 'm' : 'f'}`;
    item.title = emp.name;
    item.textContent = emp.name.charAt(0);
    container.appendChild(item);
  });

  if (remainingCount > 0) {
    const plusBtn = document.createElement('div');
    plusBtn.className = 'stack-plus';
    plusBtn.textContent = `+${remainingCount}`;
    plusBtn.title = 'Все сотрудники';
    plusBtn.onclick = openEmployeeModal;
    container.appendChild(plusBtn);
  }
}

function renderGroupCards() {
  const schedule = getOrCreateScheduleForDate(state.viewingDateStr);
  const empMap = new Map(state.employees.map(e => [e.id, e]));

  GROUP_CONFIG.forEach(group => {
    const groupMemberIds = schedule.groups[group.id] || [];
    const container = document.getElementById(`group-body-${group.id}`);
    const countPill = document.getElementById(`group-count-${group.id}`);
    const genderRatioEl = document.getElementById(`group-ratio-${group.id}`);

    if (!container) return;
    container.innerHTML = '';

    const count = groupMemberIds.length;
    if (countPill) {
      countPill.textContent = `${count} / ${group.maxCapacity}`;
    }

    let maleCount = 0;
    let femaleCount = 0;

    if (groupMemberIds.length === 0) {
      const emptyDiv = document.createElement('div');
      emptyDiv.className = 'chip-empty';
      emptyDiv.textContent = 'Свободно для переноса';
      container.appendChild(emptyDiv);
    } else {
      groupMemberIds.forEach(empId => {
        const emp = empMap.get(empId);
        if (!emp) return;

        if (emp.gender === 'male') maleCount++;
        else femaleCount++;

        const itemEl = createEmployeeItemElement(emp, group.id);
        container.appendChild(itemEl);
      });
    }

    if (genderRatioEl) {
      genderRatioEl.innerHTML = `<span>Баланс:</span><span>♂ ${maleCount} • ♀ ${femaleCount}</span>`;
    }
  });
}

function createEmployeeItemElement(emp, groupId) {
  const el = document.createElement('div');
  el.className = 'emp-row-chip';
  el.draggable = true;
  el.dataset.empId = emp.id;
  el.dataset.groupId = groupId;

  const isMale = emp.gender === 'male';
  const avatarLetter = isMale ? 'М' : 'Ж';
  const avatarClass = isMale ? 'male' : 'female';
  const isPinned = emp.pinnedGroup !== null && emp.pinnedGroup !== undefined;

  let pinnedBadgeHtml = '';
  if (isPinned) {
    pinnedBadgeHtml = `<span class="pinned-tag-mini">📌 Гр.${emp.pinnedGroup}</span>`;
  }

  el.innerHTML = `
    <div class="emp-left-box">
      <div class="gender-dot ${avatarClass}">${avatarLetter}</div>
      <div class="emp-person-name">
        <span>${escapeHtml(emp.name)}</span>
        ${pinnedBadgeHtml}
      </div>
    </div>
    <div style="opacity:0.35; font-size:0.75rem; cursor:grab;">⋮⋮</div>
  `;

  el.addEventListener('dragstart', handleDragStart);
  el.addEventListener('dragend', handleDragEnd);
  el.addEventListener('dragover', handleDragOverItem);
  el.addEventListener('dragleave', handleDragLeaveItem);
  el.addEventListener('drop', handleDropOnItem);

  return el;
}

function renderSummaryStats() {
  const schedule = state.schedules[state.viewingDateStr];
  const isManual = schedule && schedule.isManual;

  const statusBadge = document.getElementById('schedule-status-badge');
  if (statusBadge) {
    statusBadge.textContent = isManual ? '✏️ Изменено вручную' : '🔄 Авто-ротация';
  }

  const totalEmp = document.getElementById('stat-total-emp');
  if (totalEmp) totalEmp.textContent = state.employees.length;

  const totalEmpSub = document.getElementById('stat-total-emp-sub');
  if (totalEmpSub) totalEmpSub.textContent = state.employees.length;
}

// --- Drag & Drop ---
function handleDragStart(e) {
  const item = e.currentTarget;
  state.draggedEmpId = item.dataset.empId;
  state.draggedSourceGroup = parseInt(item.dataset.groupId, 10);

  item.classList.add('dragging');
  e.dataTransfer.setData('text/plain', item.dataset.empId);
  e.dataTransfer.effectAllowed = 'move';
  playAudioFx('pop');
}

function handleDragEnd(e) {
  e.currentTarget.classList.remove('dragging');
  document.querySelectorAll('.group-column').forEach(card => card.classList.remove('drag-over'));
  document.querySelectorAll('.emp-row-chip').forEach(el => el.classList.remove('drag-over-item'));
  state.draggedEmpId = null;
  state.draggedSourceGroup = null;
}

function handleDragOverCard(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const card = e.currentTarget;
  card.classList.add('drag-over');
}

function handleDragLeaveCard(e) {
  const card = e.currentTarget;
  card.classList.remove('drag-over');
}

function handleDropOnCard(e) {
  e.preventDefault();
  const card = e.currentTarget;
  card.classList.remove('drag-over');

  const targetGroupId = parseInt(card.dataset.groupId, 10);
  const empId = state.draggedEmpId || e.dataTransfer.getData('text/plain');

  if (!empId || !targetGroupId) return;

  moveEmployeeToGroup(empId, targetGroupId);
}

function handleDragOverItem(e) {
  e.preventDefault();
  e.stopPropagation();
  e.dataTransfer.dropEffect = 'move';
  e.currentTarget.classList.add('drag-over-item');
}

function handleDragLeaveItem(e) {
  e.stopPropagation();
  e.currentTarget.classList.remove('drag-over-item');
}

function handleDropOnItem(e) {
  e.preventDefault();
  e.stopPropagation();
  const targetItem = e.currentTarget;
  targetItem.classList.remove('drag-over-item');

  const targetEmpId = targetItem.dataset.empId;
  const targetGroupId = parseInt(targetItem.dataset.groupId, 10);
  const sourceEmpId = state.draggedEmpId || e.dataTransfer.getData('text/plain');

  if (!sourceEmpId || !targetEmpId || sourceEmpId === targetEmpId) return;

  swapEmployees(sourceEmpId, targetEmpId);
}

// --- Movement Operations ---
function moveEmployeeToGroup(empId, targetGroupId) {
  const schedule = state.schedules[state.viewingDateStr];
  if (!schedule) return;

  const emp = state.employees.find(e => e.id === empId);
  if (!emp) return;

  let sourceGroupId = null;
  for (let g = 1; g <= 3; g++) {
    if (schedule.groups[g].includes(empId)) {
      sourceGroupId = g;
      break;
    }
  }

  if (sourceGroupId === targetGroupId) return;

  if (emp.pinnedGroup && emp.pinnedGroup !== targetGroupId) {
    showToast(`Внимание: ${emp.name} закреплен(а) за группой ${emp.pinnedGroup}`, 'warn');
  }

  schedule.groups[sourceGroupId] = schedule.groups[sourceGroupId].filter(id => id !== empId);
  schedule.groups[targetGroupId].push(empId);
  schedule.isManual = true;
  schedule.updatedAt = Date.now();

  saveLocalData();
  playAudioFx('snap');
  renderApp();
  syncScheduleToFirebase(state.viewingDateStr, schedule);
  showToast(`${emp.name} переведен(а) в Группу ${targetGroupId}`, 'info');
}

function swapEmployees(empId1, empId2) {
  const schedule = state.schedules[state.viewingDateStr];
  if (!schedule) return;

  const emp1 = state.employees.find(e => e.id === empId1);
  const emp2 = state.employees.find(e => e.id === empId2);
  if (!emp1 || !emp2) return;

  let g1 = null, g2 = null;
  for (let g = 1; g <= 3; g++) {
    if (schedule.groups[g].includes(empId1)) g1 = g;
    if (schedule.groups[g].includes(empId2)) g2 = g;
  }

  if (!g1 || !g2) return;

  if (g1 === g2) {
    const list = schedule.groups[g1];
    const idx1 = list.indexOf(empId1);
    const idx2 = list.indexOf(empId2);
    if (idx1 >= 0 && idx2 >= 0) {
      [list[idx1], list[idx2]] = [list[idx2], list[idx1]];
    }
  } else {
    schedule.groups[g1] = schedule.groups[g1].map(id => id === empId1 ? empId2 : id);
    schedule.groups[g2] = schedule.groups[g2].map(id => id === empId2 ? empId1 : id);
  }

  schedule.isManual = true;
  schedule.updatedAt = Date.now();

  saveLocalData();
  playAudioFx('snap');
  renderApp();
  syncScheduleToFirebase(state.viewingDateStr, schedule);
  showToast(`Обмен: ${emp1.name} ⇄ ${emp2.name}`, 'success');
}

function resetDaySchedule() {
  const prev = findPreviousSchedule(state.viewingDateStr);
  let freshGroups;

  if (prev && prev.schedule && prev.schedule.groups) {
    freshGroups = rotateFromPreviousSchedule(prev.schedule, state.employees);
  } else {
    freshGroups = generateFairInitialDistribution(state.employees);
  }

  state.schedules[state.viewingDateStr] = {
    date: state.viewingDateStr,
    groups: freshGroups,
    isManual: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  saveLocalData();
  playAudioFx('snap');
  renderApp();
  syncScheduleToFirebase(state.viewingDateStr, state.schedules[state.viewingDateStr]);
  showToast('Сброшено к исходному расписанию дня', 'info');
}

function reshuffleDaySchedule(e) {
  const schedule = state.schedules[state.viewingDateStr];
  if (!schedule) return;

  const newDistribution = generateFairInitialDistribution(state.employees);
  schedule.groups = newDistribution;
  schedule.isManual = true;
  schedule.updatedAt = Date.now();

  saveLocalData();
  playAudioFx('celebrate');

  const btn = e ? e.currentTarget : null;
  if (btn) {
    const rect = btn.getBoundingClientRect();
    burstParticles(rect.left + rect.width / 2, rect.top + rect.height / 2);
  }

  renderApp();
  syncScheduleToFirebase(state.viewingDateStr, schedule);
  showToast('Сотрудники перемешаны!', 'success');
}

function handleManualSave(e) {
  saveLocalData();
  const schedule = state.schedules[state.viewingDateStr];
  if (schedule) {
    syncScheduleToFirebase(state.viewingDateStr, schedule);
  }
  playAudioFx('celebrate');

  const btn = e ? e.currentTarget : null;
  if (btn) {
    const rect = btn.getBoundingClientRect();
    burstParticles(rect.left + rect.width / 2, rect.top + rect.height / 2);
  }

  showToast('Расписание сохранено!', 'success');
}

// --- Date Navigation ---
function navigateDate(daysOffset) {
  const current = parseIsoDate(state.viewingDateStr);
  current.setDate(current.getDate() + daysOffset);
  state.viewingDateStr = getIsoDate(current);

  getOrCreateScheduleForDate(state.viewingDateStr);
  playAudioFx('pop');
  renderApp();
}

function goToToday() {
  state.viewingDateStr = state.currentDateStr;
  getOrCreateScheduleForDate(state.viewingDateStr);
  playAudioFx('pop');
  renderApp();
}

// --- Employee Management ---
function openEmployeeModal() {
  playAudioFx('pop');
  renderEmployeeListInModal();
  document.getElementById('modal-employees').classList.add('active');
}

function closeEmployeeModal() {
  playAudioFx('pop');
  document.getElementById('modal-employees').classList.remove('active');
}

function renderEmployeeListInModal() {
  const container = document.getElementById('emp-modal-list');
  if (!container) return;
  container.innerHTML = '';

  state.employees.forEach((emp) => {
    const row = document.createElement('div');
    row.className = 'emp-manage-item';

    const isMale = emp.gender === 'male';
    const avatarClass = isMale ? 'male' : 'female';
    const isKursant = emp.name === 'Курсант';

    row.innerHTML = `
      <div style="display:flex; align-items:center; gap:8px;">
        <div class="gender-dot ${avatarClass}">${isMale ? 'М' : 'Ж'}</div>
        <span style="font-weight:700; font-size:0.85rem;">
          ${escapeHtml(emp.name)}
          ${isKursant ? ' (Курсант)' : ''}
        </span>
      </div>
      <div style="display:flex; align-items:center; gap:6px;">
        <select class="form-field" style="padding:3px 8px; font-size:0.75rem; width:auto;" onchange="handlePinChange('${emp.id}', this.value)">
          <option value="" ${!emp.pinnedGroup ? 'selected' : ''}>Без фиксации</option>
          <option value="1" ${emp.pinnedGroup === 1 ? 'selected' : ''}>Группа 1</option>
          <option value="2" ${emp.pinnedGroup === 2 ? 'selected' : ''}>Группа 2</option>
          <option value="3" ${emp.pinnedGroup === 3 ? 'selected' : ''}>Группа 3</option>
        </select>
        <button class="modal-close-btn" title="Удалить" onclick="handleDeleteEmployee('${emp.id}')" style="width:26px; height:26px; font-size:0.75rem; color:#ef4444;">
          ✕
        </button>
      </div>
    `;

    container.appendChild(row);
  });
}

window.handlePinChange = function(empId, value) {
  const emp = state.employees.find(e => e.id === empId);
  if (!emp) return;

  emp.pinnedGroup = value ? parseInt(value, 10) : null;
  saveLocalData();
  playAudioFx('snap');
  renderApp();
  renderEmployeeListInModal();
  showToast(`Закрепление ${emp.name} обновлено`, 'info');
};

window.handleDeleteEmployee = function(empId) {
  const emp = state.employees.find(e => e.id === empId);
  if (!emp) return;

  if (confirm(`Удалить сотрудника "${emp.name}"?`)) {
    state.employees = state.employees.filter(e => e.id !== empId);

    const schedule = state.schedules[state.viewingDateStr];
    if (schedule) {
      for (let g = 1; g <= 3; g++) {
        schedule.groups[g] = schedule.groups[g].filter(id => id !== empId);
      }
    }

    saveLocalData();
    playAudioFx('snap');
    renderApp();
    renderEmployeeListInModal();
    showToast(`Сотрудник ${emp.name} удален`, 'info');
  }
};

function handleAddEmployeeForm(e) {
  e.preventDefault();
  const nameInput = document.getElementById('new-emp-name');
  const genderInput = document.querySelector('input[name="new-emp-gender"]:checked');
  const pinInput = document.getElementById('new-emp-pin');

  if (!nameInput || !nameInput.value.trim()) return;

  const name = nameInput.value.trim();
  const gender = genderInput ? genderInput.value : 'male';
  const pinnedGroup = pinInput && pinInput.value ? parseInt(pinInput.value, 10) : null;

  const newEmp = {
    id: 'emp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    name,
    gender,
    pinnedGroup,
  };

  state.employees.push(newEmp);

  const schedule = state.schedules[state.viewingDateStr];
  if (schedule) {
    if (pinnedGroup && schedule.groups[pinnedGroup]) {
      schedule.groups[pinnedGroup].push(newEmp.id);
    } else {
      let minG = 1;
      let minLen = schedule.groups[1].length;
      for (let g = 2; g <= 3; g++) {
        if (schedule.groups[g].length < minLen) {
          minLen = schedule.groups[g].length;
          minG = g;
        }
      }
      schedule.groups[minG].push(newEmp.id);
    }
  }

  saveLocalData();
  playAudioFx('celebrate');
  renderApp();
  renderEmployeeListInModal();

  nameInput.value = '';
  showToast(`Сотрудник ${name} добавлен`, 'success');
}

// --- History Modal ---
function openHistoryModal() {
  playAudioFx('pop');
  renderHistoryView();
  document.getElementById('modal-history').classList.add('active');
}

function closeHistoryModal() {
  playAudioFx('pop');
  document.getElementById('modal-history').classList.remove('active');
}

function renderHistoryView() {
  const container = document.getElementById('history-content-box');
  const dateInput = document.getElementById('history-date-picker');
  if (!container) return;

  if (dateInput && !dateInput.value) {
    dateInput.value = state.viewingDateStr;
  }

  const selectedDate = (dateInput && dateInput.value) || state.viewingDateStr;
  const schedule = state.schedules[selectedDate];
  const empMap = new Map(state.employees.map(e => [e.id, e]));

  if (!schedule || !schedule.groups) {
    container.innerHTML = `
      <div style="text-align:center; padding:24px 12px; color:#a1a1aa;">
        <p>На дату <strong>${selectedDate}</strong> расписания нет.</p>
        <button class="btn-action-accent" style="margin-top:10px;" onclick="generateScheduleForHistoryDate('${selectedDate}')">
          Сформировать
        </button>
      </div>
    `;
    return;
  }

  let html = `
    <div style="margin-bottom:12px; display:flex; justify-content:space-between; align-items:center;">
      <span style="font-size:0.8rem; font-weight:700; color:#a1a1aa;">
        ${schedule.isManual ? '✏️ Ручное изменение' : '🔄 Авто-ротация'}
      </span>
      <button class="btn-action-accent" onclick="loadHistoryDateToMain('${selectedDate}')" style="padding:4px 12px; font-size:0.75rem;">
        Открыть
      </button>
    </div>
    <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:8px;">
  `;

  GROUP_CONFIG.forEach(group => {
    const memberIds = schedule.groups[group.id] || [];
    html += `
      <div style="background:#222226; border-radius:12px; padding:10px;">
        <div style="font-size:0.8rem; font-weight:800; margin-bottom:6px;">${group.name}</div>
        <div style="display:flex; flex-direction:column; gap:3px;">
    `;

    memberIds.forEach(id => {
      const emp = empMap.get(id);
      if (emp) {
        html += `
          <div style="background:#18181b; padding:3px 6px; border-radius:6px; font-size:0.75rem; font-weight:700;">
            ${escapeHtml(emp.name)}
          </div>
        `;
      }
    });

    html += `
        </div>
      </div>
    `;
  });

  html += '</div>';
  container.innerHTML = html;
}

window.generateScheduleForHistoryDate = function(dateStr) {
  getOrCreateScheduleForDate(dateStr);
  playAudioFx('snap');
  renderHistoryView();
  showToast(`Расписание на ${dateStr} создано`, 'success');
};

window.loadHistoryDateToMain = function(dateStr) {
  state.viewingDateStr = dateStr;
  getOrCreateScheduleForDate(dateStr);
  playAudioFx('pop');
  renderApp();
  closeHistoryModal();
  showToast(`Переключено на ${dateStr}`, 'info');
};

// --- Firebase ---
async function initFirebaseIfConfigured() {
  if (!state.firebaseConfig) return;

  try {
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
    const { getFirestore } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');

    state.firebaseApp = initializeApp(state.firebaseConfig);
    state.firestoreDb = getFirestore(state.firebaseApp);
    state.isFirebaseConnected = true;
    syncFromFirebase();
  } catch (err) {
    state.isFirebaseConnected = false;
  }
}

async function syncScheduleToFirebase(dateStr, scheduleData) {
  if (!state.isFirebaseConnected || !state.firestoreDb) return;

  try {
    const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
    await setDoc(doc(state.firestoreDb, 'schedules', dateStr), scheduleData, { merge: true });
    await setDoc(doc(state.firestoreDb, 'roster', 'current'), { employees: state.employees, updatedAt: Date.now() }, { merge: true });
  } catch (e) {
    // Silent
  }
}

async function syncFromFirebase() {
  if (!state.isFirebaseConnected || !state.firestoreDb) return;

  try {
    const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
    const schedSnap = await getDoc(doc(state.firestoreDb, 'schedules', state.viewingDateStr));
    if (schedSnap.exists()) {
      state.schedules[state.viewingDateStr] = schedSnap.data();
      saveLocalData();
      renderApp();
    }
  } catch (e) {
    // Silent
  }
}

function openFirebaseModal() {
  playAudioFx('pop');
  const input = document.getElementById('firebase-config-input');
  if (input && state.firebaseConfig) {
    input.value = JSON.stringify(state.firebaseConfig, null, 2);
  }
  document.getElementById('modal-firebase').classList.add('active');
}

function closeFirebaseModal() {
  playAudioFx('pop');
  document.getElementById('modal-firebase').classList.remove('active');
}

function saveFirebaseConfig() {
  const input = document.getElementById('firebase-config-input');
  if (!input) return;

  const val = input.value.trim();
  if (!val) {
    state.firebaseConfig = null;
    localStorage.removeItem(STORAGE_KEYS.FIREBASE_CONFIG);
    state.isFirebaseConnected = false;
    showToast('Конфигурация Firebase очищена', 'info');
    closeFirebaseModal();
    initFirebaseIfConfigured();
    return;
  }

  try {
    const parsed = JSON.parse(val);
    state.firebaseConfig = parsed;
    saveLocalData();
    closeFirebaseModal();
    playAudioFx('celebrate');
    showToast('Настройки Firebase сохранены', 'info');
    initFirebaseIfConfigured();
  } catch (e) {
    alert('Ошибка JSON: проверьте корректность объекта конфигурации');
  }
}

// --- Code Export Modal ---
function openExportModal() {
  playAudioFx('pop');
  switchCodeTab('index.html');
  document.getElementById('modal-export').classList.add('active');
}

function closeExportModal() {
  playAudioFx('pop');
  document.getElementById('modal-export').classList.remove('active');
}

async function switchCodeTab(fileName) {
  state.activeTabCode = fileName;
  document.querySelectorAll('#modal-export .pill-btn').forEach(btn => {
    btn.classList.toggle('active', btn.textContent.trim() === fileName);
  });

  const preEl = document.getElementById('code-display-pre');
  if (!preEl) return;

  try {
    const resp = await fetch(fileName);
    if (resp.ok) {
      preEl.textContent = await resp.text();
    } else {
      preEl.textContent = `// Содержимое файла ${fileName} доступно в проекте.`;
    }
  } catch (e) {
    preEl.textContent = `// Файл ${fileName} готов в проекте.`;
  }
}

function copyCurrentCode() {
  const preEl = document.getElementById('code-display-pre');
  if (!preEl) return;

  navigator.clipboard.writeText(preEl.textContent).then(() => {
    playAudioFx('celebrate');
    showToast(`Код ${state.activeTabCode} скопирован в буфер!`, 'success');
  }).catch(() => {
    showToast('Не удалось скопировать', 'error');
  });
}

function downloadCurrentFile() {
  const preEl = document.getElementById('code-display-pre');
  if (!preEl) return;

  const blob = new Blob([preEl.textContent], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = state.activeTabCode;
  a.click();
  URL.revokeObjectURL(url);
  playAudioFx('celebrate');
  showToast(`Файл ${state.activeTabCode} скачан`, 'success');
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// --- Initialization ---
function initApp() {
  loadLocalData();
  const icon = document.getElementById('sound-icon');
  if (icon) icon.textContent = state.soundEnabled ? '🔊' : '🔇';

  getOrCreateScheduleForDate(state.currentDateStr);
  renderApp();

  GROUP_CONFIG.forEach(group => {
    const card = document.getElementById(`group-card-${group.id}`);
    if (card) {
      card.addEventListener('dragover', handleDragOverCard);
      card.addEventListener('dragleave', handleDragLeaveCard);
      card.addEventListener('drop', handleDropOnCard);
    }
  });

  setInterval(updateHeaderInfo, 1000);

  setInterval(() => {
    const nowStr = getIsoDate(new Date());
    if (nowStr !== state.currentDateStr) {
      state.currentDateStr = nowStr;
      if (state.viewingDateStr === getIsoDate(new Date(Date.now() - 86400000))) {
        state.viewingDateStr = nowStr;
      }
      getOrCreateScheduleForDate(nowStr);
      renderApp();
      showToast('Наступил новый день! Расписание обновлено.', 'info');
    }
  }, 30000);

  const addEmpForm = document.getElementById('add-employee-form');
  if (addEmpForm) {
    addEmpForm.addEventListener('submit', handleAddEmployeeForm);
  }

  const histDateInput = document.getElementById('history-date-picker');
  if (histDateInput) {
    histDateInput.addEventListener('change', () => {
      renderHistoryView();
    });
  }

  initFirebaseIfConfigured();

  // Expose global handlers
  window.openEmployeeModal = openEmployeeModal;
  window.closeEmployeeModal = closeEmployeeModal;
  window.openHistoryModal = openHistoryModal;
  window.closeHistoryModal = closeHistoryModal;
  window.openFirebaseModal = openFirebaseModal;
  window.closeFirebaseModal = closeFirebaseModal;
  window.saveFirebaseConfig = saveFirebaseConfig;
  window.openExportModal = openExportModal;
  window.closeExportModal = closeExportModal;
  window.switchCodeTab = switchCodeTab;
  window.copyCurrentCode = copyCurrentCode;
  window.downloadCurrentFile = downloadCurrentFile;
  window.resetDaySchedule = resetDaySchedule;
  window.reshuffleDaySchedule = reshuffleDaySchedule;
  window.handleManualSave = handleManualSave;
  window.navigateDate = navigateDate;
  window.goToToday = goToToday;
  window.toggleSoundFX = toggleSoundFX;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
