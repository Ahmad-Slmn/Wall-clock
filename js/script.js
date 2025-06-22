// ===============================
// كسر حظر تشغيل الصوت عند أول نقرة
// ===============================

let userInteracted = false;
let pendingAlarmRetry = false;

function enableSound() {
    if (!userInteracted) {
        userInteracted = true;

        const silentSound = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAIlYAAESsAAACABAAZGF0YQAAAAA=');
        silentSound.play().catch(err => console.warn('فشل تشغيل الصوت الصامت:', err));
        soundEnabled = true;

        if (pendingAlarmRetry) {
            playAlarmSound();
            pendingAlarmRetry = false;
        }

        // إزالة المستمعين بعد التفعيل
        allEvents.forEach(eventType => {
            window.removeEventListener(eventType, enableSound, true);
        });
    }
}

// أنواع التفاعل الحساسة
const allEvents = [
    'click',
    'touchstart',
    'keydown',
    'mousemove',
    'mousedown',
    'wheel',
    'scroll',
    'pointerdown'
];

// تفعيل الصوت عند أول تفاعل بأي من هذه الأحداث
allEvents.forEach(eventType => {
    window.addEventListener(eventType, enableSound, {
        once: true,
        capture: true
    });
});


// ===============================
// المتغيرات العامة
// ===============================
let animationId = null;
let alarmBannerTimeout = null;
let alarmTime = null;
let countdownInterval = null;
let running = true;
let soundEnabled = false;
let repeatAlarm = false;

const days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

// ✅ تم حذف tickAudio نهائيًا

const alarmSounds = {
    "soft-bell": "sounds/1.mp3",
    "Quiet Mechanical Chime": "sounds/2.mp3",
    "digital": "sounds/3.mp3",
    "medium-bell": "sounds/4.mp3",
    "dinner-bell": "sounds/5.mp3"
};



// ===============================
// عناصر DOM المستخدمة
// ===============================
const alarmTimeInput = document.getElementById('alarmTime');
const alarmToneSelect = document.getElementById('alarmTone');
const repeatAlarmCheckbox = document.getElementById('repeatAlarm');
const setAlarmBtn = document.getElementById('setAlarmBtn');
const btnClearAlarm = document.getElementById('clearAlarmBtn'); // زر حذف المنبه
const confirmDeleteModal = document.getElementById('confirmDeleteModal');
const btnConfirmYes = document.getElementById('confirmDeleteYes');
const btnConfirmNo = document.getElementById('confirmDeleteNo');

// ===============================
// دوال الساعة والتنقل باليدين
// ===============================
function setInitialHands() {
    const now = new Date();
    const s = now.getSeconds() + now.getMilliseconds() / 1000;
    const m = now.getMinutes() + s / 60;
    const h = (now.getHours() % 12) + m / 60;

    document.getElementById('second').style.transform = `rotate(${s * 6}deg)`;
    document.getElementById('minute').style.transform = `rotate(${m * 6}deg)`;
    document.getElementById('hour').style.transform = `rotate(${h * 30}deg)`;
}

let lastShownTime = new Date();

function rotateHandsSmooth() {
    if (!running) return;
    const now = new Date();
    lastShownTime = now;

    const s = now.getSeconds() + now.getMilliseconds() / 1000;
    const m = now.getMinutes() + s / 60;
    const h = (now.getHours() % 12) + m / 60;

    document.getElementById('second').style.transform = `rotate(${s * 6}deg)`;
    document.getElementById('minute').style.transform = `rotate(${m * 6}deg)`;
    document.getElementById('hour').style.transform = `rotate(${h * 30}deg)`;

    updateDigitalClock(now);
    checkAlarm(now);

    animationId = requestAnimationFrame(rotateHandsSmooth);
}


function updateDigitalClock(time) {
    const h = String(time.getHours()).padStart(2, '0');
    const m = String(time.getMinutes()).padStart(2, '0');
    const s = String(time.getSeconds()).padStart(2, '0');
    document.getElementById('digitalClock').textContent = `${h}:${m}:${s}`;
}

function showLastDigitalTime() {
    updateDigitalClock(lastShownTime);
}

function toggleClock() {
    running = !running;
    localStorage.setItem('clockRunning', running);
    const toggleBtn = document.getElementById('toggleBtn');
    if (toggleBtn) {
        toggleBtn.textContent = running ? '⏸️ إيقاف الساعة' : '▶️ تشغيل الساعة';
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
    const btn = document.getElementById('soundBtn');
    btn.textContent = soundEnabled ? 'إيقاف صوت التك-توك' : 'تشغيل صوت التك-توك';
}

function updateDate() {
    const now = new Date();
    const dayName = days[now.getDay()];
    const dateStr = `${dayName} ${now.getDate()} / ${now.getMonth() + 1} / ${now.getFullYear()}`;
    document.getElementById('dateContainer').textContent = dateStr;
}

// ===============================
// إدارة الثيمات
// ===============================
function setTheme(theme) {
    document.body.className = 'theme-' + theme;
    localStorage.setItem('selectedTheme', theme);
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.classList.remove('active-theme');
    });
    const activeBtn = document.querySelector(`.theme-btn.${theme}`);
    if (activeBtn) activeBtn.classList.add('active-theme');
}

(function initTheme() {
    const savedTheme = localStorage.getItem('selectedTheme') || 'gold';
    document.body.className = 'theme-' + savedTheme;
    document.querySelectorAll('.theme-btn').forEach(btn => btn.classList.remove('active-theme'));
    const activeBtn = document.querySelector(`.theme-btn.${savedTheme}`);
    if (activeBtn) activeBtn.classList.add('active-theme');
})();

// ===============================
// عرض رسالة المنبه مع زر الإيقاف (إذا مطلوب)
// ===============================
function showAlarmBanner(message, showStopBtn = false, persist = false) {

    const banner = document.getElementById('alarmBanner');
    // تشغيل صوت عند ظهور الرسالة
    if (soundEnabled && userInteracted) {
        const bannerSound = new Audio('sounds/notify.mp3');
        bannerSound.play().catch(err => console.warn('فشل تشغيل صوت الرسالة:', err));
    }
    banner.hidden = false;
    banner.innerHTML = '';

    const msg = document.createElement('div');

    // تمييز الساعة بلون أزرق
    const timeMatch = message.match(/الساعة (\d{2}:\d{2})/);
    if (timeMatch) {
        const coloredTime = `<span style="color:#2980b9; font-weight:bold;">${timeMatch[1]}</span>`;
        message = message.replace(timeMatch[1], coloredTime);
    }

    // تمييز اسم النغمة بلون بنفسجي
    const toneMatch = message.match(/نغمة\s+"([^"]+)"/);
    if (toneMatch) {
        const coloredTone = `<span style="color:#8e44ad; font-weight:bold;">${toneMatch[1]}</span>`;
        message = message.replace(toneMatch[1], coloredTone);
    }

    // تمييز عبارة "تكرار يومي" بلون أخضر
    if (message.includes('تكرار يومي')) {
        message = message.replace('تكرار يومي', `<span style="color:green; font-weight:bold;">تكرار يومي</span>`);
    }

    msg.innerHTML = message;
    banner.appendChild(msg);

    if (showStopBtn) {
        const stopBtn = document.createElement('button');
        stopBtn.id = 'stopAlarmBtn';
        stopBtn.textContent = '🛑 إيقاف المنبه';
        stopBtn.style.cssText = `
            margin-top: 12px;
            padding: 10px 18px;
            background-color: #c0392b;
            color: white;
            border: none;
            border-radius: 10px;
            font-size: 16px;
            cursor: pointer;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
            transition: background-color 0.3s;
        `;
        stopBtn.onmouseenter = () => stopBtn.style.backgroundColor = '#e74c3c';
        stopBtn.onmouseleave = () => stopBtn.style.backgroundColor = '#c0392b';

        stopBtn.onclick = () => {
            // إيقاف الصوت فقط
            if (currentAlarmSound) {
                currentAlarmSound.pause();
                currentAlarmSound.currentTime = 0;
                currentAlarmSound = null;
            }

            // إخفاء البانر
            banner.classList.remove('show');
            banner.hidden = true;

            // مسح رسالة المنبه من التخزين المؤقت (وليس الإعدادات)
            localStorage.removeItem('persistentAlarmMessage');
            localStorage.removeItem('persistentAlarmShowStopBtn');

            // عرض رسالة تفيد أن المنبه تم إيقافه (لكن الإعدادات باقية)
            showAlarmBanner('✅ تم إيقاف المنبه.');
        };

        banner.appendChild(stopBtn);
    }

    banner.classList.add('show');

    if (persist) {
        localStorage.setItem('persistentAlarmMessage', message);
        localStorage.setItem('persistentAlarmShowStopBtn', showStopBtn ? 'true' : 'false');
    } else {
        localStorage.removeItem('persistentAlarmMessage');
        localStorage.removeItem('persistentAlarmShowStopBtn');
        if (alarmBannerTimeout) clearTimeout(alarmBannerTimeout);
        alarmBannerTimeout = setTimeout(() => {
            banner.classList.remove('show');
            banner.hidden = true;
        }, 10000);
    }
}




function restorePersistentAlarmBanner() {
    const message = localStorage.getItem('persistentAlarmMessage');
    const showStopBtn = localStorage.getItem('persistentAlarmShowStopBtn') === 'true';
    if (message) {
        showAlarmBanner(message, showStopBtn, true);
    }
}

function stopAlarmSound() {
    if (currentAlarmSound) {
        currentAlarmSound.pause();
        currentAlarmSound.currentTime = 0;
        currentAlarmSound = null;
    }
    const banner = document.getElementById('alarmBanner');
    banner.classList.remove('show');
    banner.innerHTML = '';
}

function isAlarmPending() {
    if (!alarmTime) return false;
    const now = new Date();
    const [alarmH, alarmM] = alarmTime.split(':').map(Number);
    const alarmDate = new Date(now);
    alarmDate.setHours(alarmH, alarmM, 0, 0);
    if (alarmDate <= now) alarmDate.setDate(alarmDate.getDate() + 1);
    return alarmDate > now;
}

// ===============================
// دوال إدارة المنبه
// ===============================
function resetSetAlarmButton() {
    if (setAlarmBtn) setAlarmBtn.textContent = 'تعيين المنبه🔔';
}

function hasAlarmSettingsChanged() {
    if (!alarmTime) return false;
    if (!alarmTimeInput || !alarmToneSelect || !repeatAlarmCheckbox) return false;
    return (
        alarmTimeInput.value !== alarmTime ||
        alarmToneSelect.value !== (localStorage.getItem('alarmTone') || 'soft-bell') ||
        repeatAlarmCheckbox.checked !== (localStorage.getItem('repeatAlarm') === 'true')
    );
}

function onAlarmSettingChange() {
    if (hasAlarmSettingsChanged()) {
        if (setAlarmBtn) setAlarmBtn.textContent = 'تحديث المنبه';
    } else {
        resetSetAlarmButton();
    }
}

function setAlarm() {
    const input = alarmTimeInput.value;
    const toneValue = alarmToneSelect.value;
    const toneLabel = alarmToneSelect.options[alarmToneSelect.selectedIndex].textContent;
    const repeatChecked = repeatAlarmCheckbox.checked;

    if (!input) {
        showAlarmBanner('⚠️ يرجى اختيار وقت المنبه أولاً');
        return;
    }

    if (alarmTime && isAlarmPending()) {
        const isChanged = input !== alarmTime ||
            toneValue !== localStorage.getItem('alarmTone') ||
            repeatChecked !== (localStorage.getItem('repeatAlarm') === 'true');

        if (!isChanged) {
            showAlarmBanner('⚠️ المنبه المعين موجود ولم يحان وقت تشغيله بعد');
            return;
        }
    }

    const message = (alarmTime === null) ?
        `✅ تم تعيين المنبه إلى الساعة ${input} مع نغمة "${toneLabel}"${repeatChecked ? ' وتكرار يومي' : ''}` :
        `✅ تم تحديث المنبه إلى الساعة ${input} مع نغمة "${toneLabel}"${repeatChecked ? ' وتكرار يومي' : ''}`;

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
    alarmTimeInput.value = '';
    document.getElementById('alarmCountdown').textContent = '';
    repeatAlarmCheckbox.checked = false;
    alarmToneSelect.value = 'soft-bell';
    clearInterval(countdownInterval);
    showAlarmBanner('❌ تم حذف المنبه.');
    localStorage.removeItem('persistentAlarmMessage');
    localStorage.removeItem('persistentAlarmShowStopBtn');

    resetSetAlarmButton();
}

function updateAlarmCountdown() {
    if (!alarmTime) return;

    const now = new Date();
    const [alarmH, alarmM] = alarmTime.split(':').map(Number);
    const alarmDate = new Date(now);
    alarmDate.setHours(alarmH, alarmM, 0, 0);
    if (alarmDate <= now) alarmDate.setDate(alarmDate.getDate() + 1);

    const diff = alarmDate - now;
    const minsLeft = Math.floor(diff / (1000 * 60));
    const hrs = String(Math.floor(minsLeft / 60)).padStart(2, '0');
    const mins = String(minsLeft % 60).padStart(2, '0');
    const secs = String(Math.floor((diff % (1000 * 60)) / 1000)).padStart(2, '0');

    const countdownEl = document.getElementById('alarmCountdown');
    countdownEl.textContent = `الوقت المتبقي للمنبه: ${hrs}:${mins}:${secs}`;

    // إزالة جميع الكلاسات أولاً
    countdownEl.classList.remove('soon', 'medium', 'later');

    // تحديد اللون حسب الوقت المتبقي
    if (minsLeft < 5) {
        countdownEl.classList.add('soon'); // أقل من 5 دقائق: أحمر
    } else if (minsLeft < 10) {
        countdownEl.classList.add('medium'); // أقل من 10 دقائق: برتقالي
    } else {
        countdownEl.classList.add('later'); // أكثر من 10 دقائق: أخضر
    }
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
        document.getElementById('alarmCountdown').textContent = '';

        if (!repeatAlarm) {
            alarmTimeInput.value = '';
            alarmToneSelect.value = 'soft-bell';
            repeatAlarmCheckbox.checked = false;

            localStorage.removeItem('alarmTime');
            localStorage.removeItem('alarmTone');
            localStorage.removeItem('repeatAlarm');
            localStorage.removeItem('persistentAlarmMessage');
            localStorage.removeItem('persistentAlarmShowStopBtn');

            alarmTime = null;
            repeatAlarm = false;
        } else {
            updateAlarmCountdown();
            startAlarmCountdown();
        }
    }
}

let currentAlarmSound = null;

function playAlarmSound() {
    if (!userInteracted) {
        console.warn('🔇 لم يتم التفاعل بعد، سيتم تشغيل الصوت بعد أول تفاعل');
        pendingAlarmRetry = true;
        return;
    }

    const tone = localStorage.getItem('alarmTone') || 'soft-bell';
    const soundUrl = alarmSounds[tone] || alarmSounds['soft-bell'];
    currentAlarmSound = new Audio(soundUrl);
    currentAlarmSound.play().catch(err => console.error('خطأ في تشغيل الصوت:', err));
}


// ===============================
// إدارة نافذة تأكيد حذف المنبه (تظهر فقط عند الضغط على زر الحذف)
// ===============================
function showConfirmDeleteModal() {
    const modal = document.querySelector('.confirm-modal');
    const noBtn = document.getElementById('confirmDeleteNo');

    modal.classList.add('showing');

    // السماح للـ transition بالعمل بعد عرض العنصر
    requestAnimationFrame(() => {
        modal.classList.add('active');

        // ✅ التركيز على زر "لا"
        if (noBtn) {
            noBtn.focus();
            noBtn.classList.add('pulsing');

            // إزالة المؤثر بعد فترة قصيرة
            setTimeout(() => noBtn.classList.remove('pulsing'), 2500);
        }
    });
}


function hideConfirmDeleteModal() {
    const modal = document.querySelector('.confirm-modal');
    modal.classList.remove('active');

    // بعد انتهاء الانيميشن، نخفي العنصر فعليًا
    modal.addEventListener('transitionend', function handler() {
        modal.classList.remove('showing');
        modal.removeEventListener('transitionend', handler);
    });
}

// زر حذف المنبه: إظهار نافذة التأكيد فقط
btnClearAlarm?.addEventListener('click', (e) => {
    e.preventDefault();

    // ✅ تحقق إن كان لا يوجد منبه مفعّل
    if (!alarmTime && !localStorage.getItem('alarmTime')) {
        showAlarmBanner('⚠️ لا يوجد منبه لحذفه.');
        return;
    }

    // ✅ إذا وُجد منبه، أظهر نافذة التأكيد
    showConfirmDeleteModal();
});


// زر "نعم": حذف المنبه وإخفاء النافذة
btnConfirmYes?.addEventListener('click', () => {
    clearAlarm();
    hideConfirmDeleteModal();
});

// زر "لا": إغلاق النافذة فقط
btnConfirmNo?.addEventListener('click', () => {
    hideConfirmDeleteModal();
});

// إغلاق النافذة عند الضغط خارج محتواها
confirmDeleteModal?.addEventListener('click', (e) => {
    if (e.target === confirmDeleteModal) {
        hideConfirmDeleteModal();
    }
});

// ===============================
// تهيئة الصفحة عند التحميل
// ===============================
window.addEventListener('DOMContentLoaded', () => {
    const toggleBtn = document.getElementById('toggleBtn');
    const savedAlarmTime = localStorage.getItem('alarmTime');

    if (savedAlarmTime) {
        alarmTime = savedAlarmTime;
        alarmTimeInput.value = alarmTime;
        const savedTone = localStorage.getItem('alarmTone') || 'soft-bell';
        alarmToneSelect.value = savedTone;
        const savedRepeat = localStorage.getItem('repeatAlarm') === 'true';
        repeatAlarmCheckbox.checked = savedRepeat;
        repeatAlarm = savedRepeat;
        updateAlarmCountdown();
        startAlarmCountdown();
    }

    restorePersistentAlarmBanner();

    const storedRunning = localStorage.getItem('clockRunning');
    if (storedRunning !== null) {
        running = storedRunning === 'true';
    }

    if (toggleBtn) {
        toggleBtn.textContent = running ? '⏸️ إيقاف الساعة' : '▶️ تشغيل الساعة';
        toggleBtn.addEventListener('click', toggleClock);
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

    document.getElementById('soundBtn')?.addEventListener('click', toggleSound);

    // ربط تغيّر الحقول مع تحديث زر التعيين
    alarmTimeInput?.addEventListener('input', onAlarmSettingChange);
    alarmToneSelect?.addEventListener('change', onAlarmSettingChange);
    repeatAlarmCheckbox?.addEventListener('change', onAlarmSettingChange);

    setAlarmBtn?.addEventListener('click', setAlarm);

    // زر الحذف مرتبط بإظهار نافذة التأكيد فقط (ليس الحذف مباشرة)
    btnClearAlarm?.addEventListener('click', (e) => {
        e.preventDefault();

        // ✅ تحقق إن كان لا يوجد منبه مفعّل
        if (!alarmTime && !localStorage.getItem('alarmTime')) {
            showAlarmBanner('⚠️ لا يوجد منبه لحذفه.');
            return;
        }

        // ✅ إذا وُجد منبه، أظهر نافذة التأكيد
        showConfirmDeleteModal();
    });

});