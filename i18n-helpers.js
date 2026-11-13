// ===== نظام الترجمة: ملف لكل لغة في locales/<lang>.json =====
// إضافة لغة جديدة = ملف ترجمة واحد + إضافة رمزها إلى LANGS أدناه (لا تعديل في بقية الأكواد).
// كل ملف لغة (غير ar/en) فيه: مفاتيح الواجهة + قسم "__pairs": { "<English text>": "<translation>" }
// وهو يترجم النصوص المكتوبة داخل الأكواد عبر window.zT(ar, en).
window.i18n = {};

// code, flag, native name, RTL?  — اللغات الجاهزة تُحدَّد في locales/index.json (لا حاجة لتعديل الكود)
const LANGS = [
    { code: 'ar', flag: '🇸🇦', name: 'العربية',          rtl: true },
    { code: 'en', flag: '🇬🇧', name: 'English',          rtl: false },
    { code: 'tr', flag: '🇹🇷', name: 'Türkçe',           rtl: false },
    { code: 'es', flag: '🇪🇸', name: 'Español',          rtl: false },
    { code: 'fr', flag: '🇫🇷', name: 'Français',         rtl: false },
    { code: 'pt', flag: '🇧🇷', name: 'Português',        rtl: false },
    { code: 'ru', flag: '🇷🇺', name: 'Русский',          rtl: false },
    { code: 'hi', flag: '🇮🇳', name: 'हिन्दी',            rtl: false },
    { code: 'id', flag: '🇮🇩', name: 'Bahasa Indonesia', rtl: false },
    { code: 'fa', flag: '🇮🇷', name: 'فارسی',            rtl: true }
];
const SUPPORTED_LANGS = LANGS.map(function (l) { return l.code; });
window.ZELO_LANGS = LANGS;

// اللغات الجاهزة (المعروضة في قائمة الاختيار): locales/index.json  →  { "ready": ["ar","en","tr", ...] }
window.zeloReadyLangs = ['ar', 'en'];
window.zeloReadyPromise = fetch('locales/index.json?v=' + Date.now(), { cache: 'no-store' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (j) { if (j && Array.isArray(j.ready)) window.zeloReadyLangs = j.ready; })
    .catch(function () {});

// يحوّل أي رمز لغة (fa, en-US, ar-EG ...) إلى لغة مدعومة أو null
function normalizeLang(l) {
    if (!l) return null;
    const short = String(l).toLowerCase().slice(0, 2);
    return SUPPORTED_LANGS.includes(short) ? short : null;
}

async function loadLanguageFile(lang) {
    try {
        const res = await fetch('locales/' + lang + '.json?v=' + Date.now(), { cache: 'no-store' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        window.i18n[lang] = await res.json();
        console.log('[i18n] loaded', lang, Object.keys(window.i18n[lang]).length, 'keys');
    } catch (e) {
        console.error('[i18n] Failed to load language file:', lang, e);
    }
}

// أي ملف آخر يستطيع انتظار الترجمة:  await window.i18nReady
function langsToLoad() {
    const cur = getCurrentLang();
    const list = ['ar', 'en'];
    if (list.indexOf(cur) < 0) list.push(cur);
    return list;
}
window.i18nReady = Promise.all(langsToLoad().map(loadLanguageFile)).then(function () {
    applyLanguageSettings();
    if (typeof renderCurrentPage === 'function') renderCurrentPage();
});

function getCurrentLang() {
    return normalizeLang(localStorage.getItem('app_lang')) ||
           normalizeLang(typeof userState !== 'undefined' && userState?.lang) ||
           normalizeLang(window.Telegram?.WebApp?.initDataUnsafe?.user?.language_code) ||
           'ar';
}

// t(key) | t(key, {params}) | t(key, 'نص بديل') | t(key, 'نص بديل', {params})
function t(key, a, b) {
    let fallback = '';
    let params = {};
    if (typeof a === 'string') { fallback = a; params = b || {}; }
    else if (a && typeof a === 'object') { params = a; }

    const lang = getCurrentLang();
    const other = lang === 'ar' ? 'en' : 'ar';
    let text;

    if (window.i18n[lang] && window.i18n[lang][key] !== undefined) text = window.i18n[lang][key];
    else if (lang !== 'ar' && window.i18n.en && window.i18n.en[key] !== undefined) text = window.i18n.en[key];
    else if (window.i18n[other] && window.i18n[other][key] !== undefined) text = window.i18n[other][key];
    else text = fallback || key;

    text = String(text);
    Object.keys(params).forEach(function (p) {
        text = text.split('{' + p + '}').join(params[p]);
    });
    return text;
}

window.getT = function (key) { return t(key); };

// zT(ar, en): النص المكتوب داخل الأكواد بالعربية والإنجليزية → اللغة الحالية.
// ar → النص العربي، en → الإنجليزي، غيرهما → ترجمة من قسم "__pairs" في ملف اللغة
// (المفتاح هو النص الإنجليزي)، وإن لم توجد فالإنجليزية.
// الأرقام داخل النص تُستبدل بـ {n} عند البحث ثم تعود لمكانها.
function zT(ar, en) {
    const lang = getCurrentLang();
    if (lang === 'ar') return ar;
    if (lang === 'en' || typeof en !== 'string') return en;
    const dict = window.i18n[lang];
    const pairs = dict && dict.__pairs;
    if (!pairs) return en;
    const nums = [];
    const key = en.replace(/\d+(?:[.,]\d+)*/g, function (m) { nums.push(m); return '{n}'; });
    let out = pairs[key];
    if (out === undefined) return en;
    let i = 0;
    return String(out).replace(/\{n\}/g, function () { return nums[i++] !== undefined ? nums[i - 1] : '{n}'; });
}
window.zT = zT;
// zA(a, b): قيمة غير نصية (اتجاه/لغة خادم/رمز): a للعربية فقط، b لغيرها.
window.zA = function (a, b) { return getCurrentLang() === 'ar' ? a : b; };

// tr(key, ar, en, params): ترجمة بنصّين احتياطيين (عربي/إنجليزي).
// تستخدم ملف اللغة الحالية إن وُجد المفتاح، وإلا النص الاحتياطي للغة الحالية
// (ولا تعرض أبداً نص اللغة الأخرى أو اسم المفتاح الخام).
// مثال: tr('refCopyBtn', 'نسخ رابط الدعوة', 'Copy invite link')
//       tr('topFansOf', 'أبطال {club}', 'Top Fans of {club}', { club: name })
function tr(key, ar, en, params) {
    const lang = getCurrentLang();
    const dict = window.i18n[lang];
    let text = (dict && dict[key] !== undefined) ? dict[key] : zT(ar, en); // لغة بلا مفتاح: قسم __pairs ثم الإنجليزية
    text = String(text === undefined || text === null ? key : text);
    Object.keys(params || {}).forEach(function (p) {
        text = text.split('{' + p + '}').join(params[p]);
    });
    return text;
}
window.tr = tr;

function getClubName(club) {
    if (!club) return '';
    if (getCurrentLang() === 'ar') {
        return club.nameAr || club.name_ar || club.nameEn || club.name_en || club.name || '';
    }
    return club.nameEn || club.name_en || club.nameAr || club.name_ar || club.name || '';
}

function getTaskName(task) {
    if (!task) return '';
    if (task.titleKey) return t(task.titleKey);
    if (getCurrentLang() === 'ar') {
        return task.textAr || task.text_ar || task.titleAr || task.title_ar || task.textEn || task.text_en || task.title || '';
    }
    return task.textEn || task.text_en || task.titleEn || task.title_en || task.textAr || task.text_ar || task.titleAr || task.title_ar || task.title || '';
}

async function switchLanguage(newLang) {
    newLang = normalizeLang(newLang) || 'ar';
    if (!window.i18n[newLang]) await loadLanguageFile(newLang);
    if (typeof userState !== 'undefined') userState.lang = newLang;
    localStorage.setItem('app_lang', newLang);

    applyLanguageSettings();

    if (typeof renderCurrentPage === 'function') {
        renderCurrentPage();
    } else {
        if (typeof renderHomePage === 'function') renderHomePage();
        if (typeof renderTasksPage === 'function') renderTasksPage();
        if (typeof renderWalletPage === 'function') renderWalletPage();
    }
    applyLanguageSettings();
}

function applyLanguageSettings() {
    const lang = getCurrentLang();
    const meta = LANGS.find(function (l) { return l.code === lang; });
    document.documentElement.dir = (meta && meta.rtl) ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;

    document.querySelectorAll('[data-i18n]').forEach(function (el) {
        const key = el.getAttribute('data-i18n');
        if (key) el.innerText = t(key);
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
        const key = el.getAttribute('data-i18n-placeholder');
        if (key) el.setAttribute('placeholder', t(key));
    });
}

// ===== قائمة اختيار اللغة المشتركة (القائمة الجانبية + شاشات الدخول) =====
// zeloSetLang(code): يحفظ اللغة (جهاز + قاعدة البيانات) ثم يعيد تحميل التطبيق.
window.zeloSetLang = async function (code) {
    code = normalizeLang(code) || 'ar';
    try { localStorage.setItem('app_lang', code); } catch (e) {}
    if (typeof userState !== 'undefined') userState.lang = code;
    try {
        const c = (typeof supabaseClient !== 'undefined') ? supabaseClient : null;
        const uid = (typeof userState !== 'undefined') ? userState.userId : null;
        if (c && uid) await c.from('users').update({ lang: code }).eq('user_id', String(uid));
    } catch (e) { console.warn('[ZELO] lang save failed', e); }
    location.reload();
};

// zeloOpenLangPicker(onPick?): نافذة من أسفل الشاشة بكل اللغات الجاهزة.
window.zeloOpenLangPicker = async function (onPick) {
    try { await window.zeloReadyPromise; } catch (e) {}
    if (!document.getElementById('zlang-style')) {
        const st = document.createElement('style');
        st.id = 'zlang-style';
        st.textContent = `
        .zlang-overlay { position: fixed; inset: 0; z-index: 9000; background: rgba(3,6,24,0.7); display: flex; align-items: flex-end; justify-content: center; }
        .zlang-sheet { width: 100%; max-width: 480px; max-height: 80vh; overflow-y: auto; background: #0f1a5c; border-radius: 22px 22px 0 0; border-top: 1px solid rgba(245,195,90,0.3); padding: 18px 16px calc(env(safe-area-inset-bottom, 0px) + 20px); }
        .zlang-title { font-size: 1.05rem; font-weight: 900; color: #fff; margin: 2px 4px 12px; }
        .zlang-opt { width: 100%; display: flex; align-items: center; gap: 12px; padding: 13px 14px; margin-bottom: 8px; border-radius: 14px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.05); color: #fff; font-family: inherit; font-size: 1rem; font-weight: 800; cursor: pointer; text-align: start; }
        .zlang-opt.on { border-color: #f5c35a; background: rgba(245,195,90,0.14); }
        .zlang-flag { font-size: 1.4rem; }
        .zlang-name { flex: 1; }
        .zlang-check { color: #f5c35a; font-weight: 900; }`;
        document.head.appendChild(st);
    }
    const old = document.getElementById('zlang-picker');
    if (old) old.remove();
    const cur = getCurrentLang();
    const box = document.createElement('div');
    box.id = 'zlang-picker';
    box.className = 'zlang-overlay';
    box.innerHTML = '<div class="zlang-sheet" dir="ltr"><div class="zlang-title">🌐 Language · اللغة</div>' +
        LANGS.filter(function (l) { return window.zeloReadyLangs.indexOf(l.code) >= 0; }).map(function (l) {
            return '<button class="zlang-opt ' + (l.code === cur ? 'on' : '') + '" data-lang="' + l.code + '">' +
                '<span class="zlang-flag">' + l.flag + '</span><span class="zlang-name">' + l.name + '</span>' +
                '<span class="zlang-check">' + (l.code === cur ? '✓' : '') + '</span></button>';
        }).join('') + '</div>';
    box.addEventListener('click', function (e) {
        const opt = e.target.closest('[data-lang]');
        if (opt) {
            box.remove();
            if (opt.dataset.lang === cur) return;
            if (typeof onPick === 'function') onPick(opt.dataset.lang); else window.zeloSetLang(opt.dataset.lang);
            return;
        }
        if (e.target === box) box.remove();
    });
    document.body.appendChild(box);
};
window.zeloLangMeta = function (code) { return LANGS.find(function (l) { return l.code === code; }) || LANGS[0]; };

window.t = t;
window.getCurrentLang = getCurrentLang;
window.getClubName = getClubName;
window.getTaskName = getTaskName;
window.switchLanguage = switchLanguage;
window.applyLanguageSettings = applyLanguageSettings;
    
