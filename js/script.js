// ===============================
// كسر حظر تشغيل الصوت عند أول تفاعل
// ===============================

let userInteracted = false;
let pendingAlarmRetry = false;
const allEvents = ['click', 'touchstart', 'keydown', 'mousemove', 'mousedown', 'wheel', 'scroll', 'pointerdown'];

function enableSound() {
  if (userInteracted) return;
  userInteracted = true;

  new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAIlYAAESsAAACABAAZGF0YQAAAAA=')
    .play().catch(e => console.warn('فشل تشغيل الصوت الصامت:', e));
  soundEnabled = true;

  if (pendingAlarmRetry) {
    playAlarmSound();
    pendingAlarmRetry = false;
  }

  allEvents.forEach(e => window.removeEventListener(e, enableSound, true));
}

allEvents.forEach(e => window.addEventListener(e, enableSound, { once: true, capture: true }));

// ===============================
// المتغيرات العامة والعناصر
// ===============================

let animationId = null, alarmBannerTimeout = null, alarmTime = null, countdownInterval = null;
let running = true, soundEnabled = false, repeatAlarm = false;
let currentAlarmSound = null, lastShownTime = new Date();

const days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const alarmSounds = {
  "soft-bell": "sounds/1.mp3",
  "Quiet Mechanical Chime": "sounds/2.mp3",
  "digital": "sounds/3.mp3",
  "medium-bell": "sounds/4.mp3",
  "dinner-bell": "sounds/5.mp3"
};

const DOM = {
  alarmTimeInput: document.getElementById('alarmTime'),
  alarmToneSelect: document.getElementById('alarmTone'),
  repeatAlarmCheckbox: document.getElementById('repeatAlarm'),
  setAlarmBtn: document.getElementById('setAlarmBtn'),
  btnClearAlarm: document.getElementById('clearAlarmBtn'),
  confirmDeleteModal: document.getElementById('confirmDeleteModal'),
  btnConfirmYes: document.getElementById('confirmDeleteYes'),
  btnConfirmNo: document.getElementById('confirmDeleteNo'),
  alarmBanner: document.getElementById('alarmBanner'),
  digitalClock: document.getElementById('digitalClock'),
  dateContainer: document.getElementById('dateContainer'),
  alarmCountdown: document.getElementById('alarmCountdown'),
  toggleBtn: document.getElementById('toggleBtn'),
  soundBtn: document.getElementById('soundBtn'),
};

// ===============================
// دوال الساعة
// ===============================

function setInitialHands() {
  const now = new Date();
  rotateHands(now);
}

function rotateHands(now) {
  const s = now.getSeconds() + now.getMilliseconds() / 1000;
  const m = now.getMinutes() + s / 60;
  const h = (now.getHours() % 12) + m / 60;

  document.getElementById('second').style.transform = `rotate(${s * 6}deg)`;
  document.getElementById('minute').style.transform = `rotate(${m * 6}deg)`;
  document.getElementById('hour').style.transform = `rotate(${h * 30}deg)`;
}

function rotateHandsSmooth() {
  if (!running) return;
  const now = new Date();
  lastShownTime = now;
  rotateHands(now);
  updateDigitalClock(now);
  checkAlarm(now);
  animationId = requestAnimationFrame(rotateHandsSmooth);
}

function updateDigitalClock(time) {
  const h = String(time.getHours()).padStart(2, '0'),
        m = String(time.getMinutes()).padStart(2, '0'),
        s = String(time.getSeconds()).padStart(2, '0');
  DOM.digitalClock.textContent = `${h}:${m}:${s}`;
}

function showLastDigitalTime() {
  updateDigitalClock(lastShownTime);
}

function toggleClock() {
  running = !running;
  localStorage.setItem('clockRunning', running);
  if (DOM.toggleBtn) {
    DOM.toggleBtn.textContent = running ? '⏸️ إيقاف الساعة' : '▶️ تشغيل الساعة';
  }
  if (running) {
    setInitialHands();
    rotateHandsSmooth();
    if (alarmTime) {
      updateAlarmCountdown();
      startAlarmCountdown();
    }
  } else {
    cancelAnimationFrame(animationId);
    clearInterval(countdownInterval);
    lastShownTime = new Date();
    showLastDigitalTime();
  }
}

function toggleSound() {
  soundEnabled = !soundEnabled;
  if (DOM.soundBtn) {
    DOM.soundBtn.textContent = soundEnabled ? 'إيقاف صوت التك-توك' : 'تشغيل صوت التك-توك';
  }
}

function updateDate() {
  const now = new Date();
  const dayName = days[now.getDay()];
  DOM.dateContainer.textContent = `${dayName} ${now.getDate()} / ${now.getMonth() + 1} / ${now.getFullYear()}`;
}

// ===============================
// دوال إدارة الثيمات
// ===============================

function setTheme(theme) {
  document.body.className = 'theme-' + theme;
  localStorage.setItem('selectedTheme', theme);
  document.querySelectorAll('.theme-btn').forEach(btn => btn.classList.remove('active-theme'));
  const activeBtn = document.querySelector(`.theme-btn.${theme}`);
  if (activeBtn) activeBtn.classList.add('active-theme');
}

(function initTheme() {
  const savedTheme = localStorage.getItem('selectedTheme') || 'gold';
  setTheme(savedTheme);
})();

// ===============================
// عرض رسالة المنبه
// ===============================

function showAlarmBanner(message, showStopBtn = false, persist = false) {
  if (!DOM.alarmBanner) return;

  if (soundEnabled && userInteracted) {
    new Audio('sounds/notify.mp3').play().catch(() => {});
  }

  DOM.alarmBanner.hidden = false;
  DOM.alarmBanner.innerHTML = '';

  // تلوين الوقت والنغمة والتكرار
  message = message.replace(/الساعة (\d{2}:\d{2})/, (_, t) => `<span style="color:#2980b9;font-weight:bold;">${t}</span>`)
                   .replace(/نغمة\s+"([^"]+)"/, (_, t) => `<span style="color:#8e44ad;font-weight:bold;">${t}</span>`)
                   .replace('تكرار يومي', `<span style="color:green;font-weight:bold;">تكرار يومي</span>`);

  const msgDiv = document.createElement('div');
  msgDiv.innerHTML = message;
  DOM.alarmBanner.appendChild(msgDiv);

  if (showStopBtn) {
    const stopBtn = document.createElement('button');
    stopBtn.id = 'stopAlarmBtn';
    stopBtn.textContent = '🛑 إيقاف المنبه';
    stopBtn.style.cssText = `
      margin-top: 12px; padding: 10px 18px;
      background-color: #c0392b; color: white; border: none; border-radius: 10px;
      font-size: 16px; cursor: pointer; box-shadow: 0 4px 8px rgba(0,0,0,0.2);
      transition: background-color 0.3s;
    `;
    stopBtn.onmouseenter = () => stopBtn.style.backgroundColor = '#e74c3c';
    stopBtn.onmouseleave = () => stopBtn.style.backgroundColor = '#c0392b';
    stopBtn.onclick = () => {
      if (currentAlarmSound) {
        currentAlarmSound.pause();
        currentAlarmSound.currentTime = 0;
        currentAlarmSound = null;
      }
      DOM.alarmBanner.classList.remove('show');
      DOM.alarmBanner.hidden = true;
      localStorage.removeItem('persistentAlarmMessage');
      localStorage.removeItem('persistentAlarmShowStopBtn');
      showAlarmBanner('✅ تم إيقاف المنبه.');
    };
    DOM.alarmBanner.appendChild(stopBtn);
  }

  DOM.alarmBanner.classList.add('show');

  if (persist) {
    localStorage.setItem('persistentAlarmMessage', message);
    localStorage.setItem('persistentAlarmShowStopBtn', showStopBtn ? 'true' : 'false');
  } else {
    localStorage.removeItem('persistentAlarmMessage');
    localStorage.removeItem('persistentAlarmShowStopBtn');
    if (alarmBannerTimeout) clearTimeout(alarmBannerTimeout);
    alarmBannerTimeout = setTimeout(() => {
      DOM.alarmBanner.classList.remove('show');
      DOM.alarmBanner.hidden = true;
    }, 10000);
  }
}

function restorePersistentAlarmBanner() {
  const message = localStorage.getItem('persistentAlarmMessage');
  const showStopBtn = localStorage.getItem('persistentAlarmShowStopBtn') === 'true';
  if (message) showAlarmBanner(message, showStopBtn, true);
}

function stopAlarmSound() {
  if (currentAlarmSound) {
    currentAlarmSound.pause();
    currentAlarmSound.currentTime = 0;
    currentAlarmSound = null;
  }
  if (DOM.alarmBanner) {
    DOM.alarmBanner.classList.remove('show');
    DOM.alarmBanner.innerHTML = '';
  }
}

function isAlarmPending() {
  if (!alarmTime) return false;
  const now = new Date();
  const [h, m] = alarmTime.split(':').map(Number);
  const alarmDate = new Date(now);
  alarmDate.setHours(h, m, 0, 0);
  if (alarmDate <= now) alarmDate.setDate(alarmDate.getDate() + 1);
  return alarmDate > now;
}

// ===============================
// إدارة المنبه
// ===============================

function resetSetAlarmButton() {
  if (DOM.setAlarmBtn) DOM.setAlarmBtn.textContent = '🔔 تعيين المنبه';
}

function hasAlarmSettingsChanged() {
  if (!alarmTime || !DOM.alarmTimeInput || !DOM.alarmToneSelect || !DOM.repeatAlarmCheckbox) return false;
  return DOM.alarmTimeInput.value !== alarmTime ||
         DOM.alarmToneSelect.value !== (localStorage.getItem('alarmTone') || 'soft-bell') ||
         DOM.repeatAlarmCheckbox.checked !== (localStorage.getItem('repeatAlarm') === 'true');
}

function onAlarmSettingChange() {
  if (hasAlarmSettingsChanged()) {
    if (DOM.setAlarmBtn) DOM.setAlarmBtn.textContent = 'تحديث المنبه';
  } else resetSetAlarmButton();
}

function setAlarm() {
  const input = DOM.alarmTimeInput.value;
  const toneValue = DOM.alarmToneSelect.value;
  const toneLabel = DOM.alarmToneSelect.options[DOM.alarmToneSelect.selectedIndex].textContent;
  const repeatChecked = DOM.repeatAlarmCheckbox.checked;

  if (!input) {
    showAlarmBanner('⚠️ يرجى اختيار وقت المنبه أولاً');
    return;
  }

  if (alarmTime && isAlarmPending()) {
    const changed = input !== alarmTime || toneValue !== localStorage.getItem('alarmTone') || repeatChecked !== (localStorage.getItem('repeatAlarm') === 'true');
    if (!changed) {
      showAlarmBanner('⚠️ المنبه المعين موجود ولم يحان وقت تشغيله بعد');
      return;
    }
  }

  const message = (alarmTime === null) ? 
    `✅ تم تعيين المنبه إلى الساعة ${input} مع نغمة "${toneLabel}"${repeatChecked ? ' وتكرار يومي' : ''}`
    : `✅ تم تحديث المنبه إلى الساعة ${input} مع نغمة "${toneLabel}"${repeatChecked ? ' وتكرار يومي' : ''}`;

  alarmTime = input;
  repeatAlarm = repeatChecked;

  localStorage.setItem('alarmTime', input);
  localStorage.setItem('alarmTone', toneValue);
  localStorage.setItem('repeatAlarm', repeatAlarm);
  localStorage.removeItem('lastAlarmFired');

  showAlarmBanner(message);
  updateAlarmCountdown();
  startAlarmCountdown();
  resetSetAlarmButton();
}

function clearAlarm() {
  alarmTime = null;
  repeatAlarm = false;

  localStorage.removeItem('alarmTime');
  localStorage.removeItem('alarmTone');
  localStorage.removeItem('repeatAlarm');
  localStorage.removeItem('lastAlarmFired');
  localStorage.removeItem('persistentAlarmMessage');
  localStorage.removeItem('persistentAlarmShowStopBtn');

  if (DOM.alarmTimeInput) DOM.alarmTimeInput.value = '';
  if (DOM.repeatAlarmCheckbox) DOM.repeatAlarmCheckbox.checked = false;
  if (DOM.alarmToneSelect) DOM.alarmToneSelect.value = 'soft-bell';
  if (DOM.alarmCountdown) DOM.alarmCountdown.textContent = '';

  clearInterval(countdownInterval);
  showAlarmBanner('❌ تم حذف المنبه.');
  resetSetAlarmButton();
}

function updateAlarmCountdown() {
  if (!alarmTime || !DOM.alarmCountdown) return;

  const now = new Date();
  const [h, m] = alarmTime.split(':').map(Number);
  const alarmDate = new Date(now);
  alarmDate.setHours(h, m, 0, 0);
  if (alarmDate <= now) alarmDate.setDate(alarmDate.getDate() + 1);

  const diff = alarmDate - now;
  const minsLeft = Math.floor(diff / 60000);
  const hrs = String(Math.floor(minsLeft / 60)).padStart(2, '0');
  const mins = String(minsLeft % 60).padStart(2, '0');
  const secs = String(Math.floor((diff % 60000) / 1000)).padStart(2, '0');

  DOM.alarmCountdown.textContent = `الوقت المتبقي للمنبه: ${hrs}:${mins}:${secs}`;
  DOM.alarmCountdown.classList.remove('soon', 'medium', 'later');

  if (minsLeft < 5) DOM.alarmCountdown.classList.add('soon');
  else if (minsLeft < 10) DOM.alarmCountdown.classList.add('medium');
  else DOM.alarmCountdown.classList.add('later');
}

function startAlarmCountdown() {
  clearInterval(countdownInterval);
  countdownInterval = setInterval(updateAlarmCountdown, 1000);
}

function checkAlarm(now) {
  if (!alarmTime) return;

  const currentTime = now.toTimeString().slice(0, 5);
  const currentMinuteStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${currentTime}`;
  const lastFiredMinute = localStorage.getItem('lastAlarmFiredMinute');

  if (currentTime === alarmTime && lastFiredMinute !== currentMinuteStr) {
    localStorage.setItem('lastAlarmFiredMinute', currentMinuteStr);

    showAlarmBanner('🔔 حان وقت المنبه!', true, true);
    playAlarmSound();
    clearInterval(countdownInterval);

    if (!repeatAlarm) {
      clearAlarm();
    } else {
      updateAlarmCountdown();
      startAlarmCountdown();
    }
  }
}

function playAlarmSound() {
  if (!userInteracted) {
    console.warn('🔇 لم يتم التفاعل بعد، سيتم تشغيل الصوت بعد أول تفاعل');
    pendingAlarmRetry = true;
    return;
  }
  const tone = localStorage.getItem('alarmTone') || 'soft-bell';
  currentAlarmSound = new Audio(alarmSounds[tone] || alarmSounds['soft-bell']);
  currentAlarmSound.play().catch(e => console.error('خطأ في تشغيل الصوت:', e));
}

// ===============================
// إدارة نافذة تأكيد حذف المنبه
// ===============================

function showConfirmDeleteModal() {
  if (!DOM.confirmDeleteModal) return;
  const noBtn = DOM.btnConfirmNo;

  DOM.confirmDeleteModal.classList.add('showing');
  requestAnimationFrame(() => {
    DOM.confirmDeleteModal.classList.add('active');
    if (noBtn) {
      noBtn.focus();
      noBtn.classList.add('pulsing');
      setTimeout(() => noBtn.classList.remove('pulsing'), 2500);
    }
  });
}

function hideConfirmDeleteModal() {
  if (!DOM.confirmDeleteModal) return;
  DOM.confirmDeleteModal.classList.remove('active');
  DOM.confirmDeleteModal.addEventListener('transitionend', function handler() {
    DOM.confirmDeleteModal.classList.remove('showing');
    DOM.confirmDeleteModal.removeEventListener('transitionend', handler);
  });
}

// ===============================
// الأحداث - ربط الأزرار
// ===============================

DOM.btnClearAlarm?.addEventListener('click', e => {
  e.preventDefault();
  if (!alarmTime && !localStorage.getItem('alarmTime')) {
    showAlarmBanner('⚠️ لا يوجد منبه لحذفه.');
    return;
  }
  showConfirmDeleteModal();
});

DOM.btnConfirmYes?.addEventListener('click', () => {
  clearAlarm();
  hideConfirmDeleteModal();
});

DOM.btnConfirmNo?.addEventListener('click', hideConfirmDeleteModal);

DOM.confirmDeleteModal?.addEventListener('click', e => {
  if (e.target === DOM.confirmDeleteModal) hideConfirmDeleteModal();
});

// ===============================
// تهيئة الصفحة عند التحميل
// ===============================

window.addEventListener('DOMContentLoaded', () => {
  const savedAlarmTime = localStorage.getItem('alarmTime');
  if (savedAlarmTime) {
    alarmTime = savedAlarmTime;
    if (DOM.alarmTimeInput) DOM.alarmTimeInput.value = alarmTime;

    DOM.alarmToneSelect.value = localStorage.getItem('alarmTone') || 'soft-bell';
    const savedRepeat = localStorage.getItem('repeatAlarm') === 'true';
    DOM.repeatAlarmCheckbox.checked = savedRepeat;
    repeatAlarm = savedRepeat;

    updateAlarmCountdown();
    startAlarmCountdown();
  }

  restorePersistentAlarmBanner();

  const storedRunning = localStorage.getItem('clockRunning');
  running = storedRunning !== null ? storedRunning === 'true' : true;

  if (DOM.toggleBtn) {
    DOM.toggleBtn.textContent = running ? '⏸️ إيقاف الساعة' : '▶️ تشغيل الساعة';
    DOM.toggleBtn.addEventListener('click', toggleClock);
  }

  setInitialHands();

  if (running) {
    rotateHandsSmooth();
    if (alarmTime) {
      updateAlarmCountdown();
      startAlarmCountdown();
    }
  } else {
    lastShownTime = new Date();
    showLastDigitalTime();
  }

  updateDate();
  setInterval(updateDate, 60000);

  DOM.soundBtn?.addEventListener('click', toggleSound);
  DOM.alarmTimeInput?.addEventListener('input', onAlarmSettingChange);
  DOM.alarmToneSelect?.addEventListener('change', onAlarmSettingChange);
  DOM.repeatAlarmCheckbox?.addEventListener('change', onAlarmSettingChange);
  DOM.setAlarmBtn?.addEventListener('click', setAlarm);
});