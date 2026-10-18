// ===== نظام الترجمة: الملفات في locales/ar.json و locales/en.json =====
window.i18n = { ar: {}, en: {} };

const SUPPORTED_LANGS = ['ar', 'en'];

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
window.i18nReady = Promise.all(SUPPORTED_LANGS.map(loadLanguageFile)).then(function () {
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
    else if (window.i18n[other] && window.i18n[other][key] !== undefined) text = window.i18n[other][key];
    else text = fallback || key;

    text = String(text);
    Object.keys(params).forEach(function (p) {
        text = text.split('{' + p + '}').join(params[p]);
    });
    return text;
}

window.getT = function (key) { return t(key); };

// tr(key, ar, en, params): ترجمة بنصّين احتياطيين (عربي/إنجليزي).
// تستخدم ملف اللغة الحالية إن وُجد المفتاح، وإلا النص الاحتياطي للغة الحالية
// (ولا تعرض أبداً نص اللغة الأخرى أو اسم المفتاح الخام).
// مثال: tr('refCopyBtn', 'نسخ رابط الدعوة', 'Copy invite link')
//       tr('topFansOf', 'أبطال {club}', 'Top Fans of {club}', { club: name })
function tr(key, ar, en, params) {
    const lang = getCurrentLang();
    const dict = window.i18n[lang];
    let text = (dict && dict[key] !== undefined) ? dict[key] : (lang === 'ar' ? ar : en);
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

function switchLanguage(newLang) {
    newLang = normalizeLang(newLang) || 'ar';
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
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
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

window.t = t;
window.getCurrentLang = getCurrentLang;
window.getClubName = getClubName;
window.getTaskName = getTaskName;
window.switchLanguage = switchLanguage;
window.applyLanguageSettings = applyLanguageSettings;
    
