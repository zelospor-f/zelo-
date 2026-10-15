// ===== نظام الترجمة: الملفات في locales/ar.json و locales/en.json =====
window.i18n = { ar: {}, en: {} };

const SUPPORTED_LANGS = ['ar', 'en'];

async function loadLanguageFile(lang) {
    try {
        const res = await fetch('locales/' + lang + '.json?v=' + Date.now(), { cache: 'no-store' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        window.i18n[lang] = await res.json();
    } catch (e) {
        console.error('Failed to load language file:', lang, e);
    }
}

// أي ملف آخر يستطيع انتظار الترجمة:  await window.i18nReady
window.i18nReady = Promise.all(SUPPORTED_LANGS.map(loadLanguageFile)).then(function () {
    applyLanguageSettings();
    if (typeof renderCurrentPage === 'function') renderCurrentPage();
});

function getCurrentLang() {
    return localStorage.getItem('app_lang') ||
           (typeof userState !== 'undefined' && userState?.lang) ||
           window.Telegram?.WebApp?.initDataUnsafe?.user?.language_code ||
           'ar';
}

function t(key, params = {}) {
    const lang = getCurrentLang();
    let text = key;

    if (i18n[lang] && i18n[lang][key] !== undefined) {
        text = i18n[lang][key];
    } else {
        const fallbackLang = lang === 'ar' ? 'en' : 'ar';
        if (i18n[fallbackLang] && i18n[fallbackLang][key] !== undefined) {
            text = i18n[fallbackLang][key];
        }
    }

    if (typeof params === 'object' && params !== null) {
        Object.keys(params).forEach(paramKey => {
            text = text.replace(new RegExp(`{${paramKey}}`, 'g'), params[paramKey]);
        });
    }

    return text;
}

window.getT = function (key) {
    return t(key);
};

function getClubName(club) {
    if (!club) return '';
    const lang = getCurrentLang();
    if (lang === 'ar') {
        return club.nameAr || club.name_ar || club.nameEn || club.name_en || club.name || '';
    }
    return club.nameEn || club.name_en || club.nameAr || club.name_ar || club.name || '';
}

function getTaskName(task) {
    if (!task) return '';
    if (task.titleKey) {
        return t(task.titleKey);
    }
    const lang = getCurrentLang();
    if (lang === 'ar') {
        return task.textAr || task.text_ar || task.titleAr || task.title_ar || task.textEn || task.text_en || task.title || '';
    }
    return task.textEn || task.text_en || task.titleEn || task.title_en || task.textAr || task.text_ar || task.titleAr || task.title_ar || task.title || '';
}

function switchLanguage(newLang) {
    if (typeof userState !== 'undefined') {
        userState.lang = newLang;
    }
    localStorage.setItem('app_lang', newLang);

    applyLanguageSettings();

    if (typeof renderCurrentPage === 'function') {
        renderCurrentPage();
    } else {
        if (typeof renderHomePage === 'function') renderHomePage();
        if (typeof renderTasksPage === 'function') renderTasksPage();
        if (typeof renderWalletPage === 'function') renderWalletPage();
    }
}

function applyLanguageSettings() {
    const lang = getCurrentLang();
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;

    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (key) el.innerText = t(key);
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (key) el.setAttribute('placeholder', t(key));
    });
        }
            
