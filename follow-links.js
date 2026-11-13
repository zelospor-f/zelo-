/* follow-links.js: أزرار متابعة X وتيليجرام أسفل القائمة الجانبية */
(function () {
    const isAr = () => !(window.userState && window.userState.lang === 'en');
    const LINKS = { x: 'https://x.com/Zelo_Sport', tg: 'https://t.me/ZeloSport' };

    function open(url) {
        try {
            const B = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Browser;
            if (B && typeof B.open === 'function') { B.open({ url }); return; }
            window.open(url, '_blank');
        } catch (e) { location.href = url; }
    }

    function addRow() {
        const foot = document.querySelector('#zdrawer .zdrawer-footer');
        if (!foot || foot.querySelector('.zfollow')) return;
        const row = document.createElement('div');
        row.className = 'zfollow';
        row.style.cssText = 'display:flex;gap:8px;justify-content:center;margin:10px 0 2px;';
        const btn = 'flex:1;padding:10px;border-radius:12px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.05);color:#cbd5e1;font-weight:700;font-family:inherit;';
        row.innerHTML =
            '<button data-follow="x" style="' + btn + '">𝕏 ' + (window.zT('تابعنا', 'Follow')) + '</button>' +
            '<button data-follow="tg" style="' + btn + '">✈️ ' + (window.zT('تيليجرام', 'Telegram')) + '</button>';
        const ver = foot.querySelector('.zdrawer-version');
        if (ver) foot.insertBefore(row, ver); else foot.appendChild(row);
    }

    document.addEventListener('click', function (e) {
        const b = e.target.closest && e.target.closest('[data-follow]');
        if (!b) return;
        e.stopPropagation();
        open(LINKS[b.dataset.follow]);
    }, true);

    new MutationObserver(addRow).observe(document.body, { childList: true, subtree: true });
    addRow();
})();
