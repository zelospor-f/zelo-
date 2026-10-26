/* ============================================================
 * profile/styles.js  —  كل الـ CSS في مكان واحد
 * P.styles(ar) يرجع وسم <style> جاهزاً للحقن
 * الألوان: كحلي #0a1033 · أزرق ملكي #2c4bb5 · ذهبي #f5c35a
 * ============================================================ */
(function () {
    const P = window.ZeloProfile;

    P.styles = function (ar) {
        const dir = tr('ui_ltr', 'rtl', 'ltr');
        const align = tr('ui_left', 'right', 'left');
        return `
        <style>
            .profile-wrap { width: 100%; box-sizing: border-box; padding: 4px 0 20px 0; direction: ${dir}; color: #fff; text-align: ${align}; }
            .profile-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
            .back-btn { background: rgba(245,195,90,0.08); color: #f5c35a; border: 1px solid rgba(245,195,90,0.35); padding: 8px 14px; border-radius: 20px; font-weight: 800; font-size: 0.8rem; cursor: pointer; }
            .page-title { margin: 0; font-size: 1.05rem; font-weight: 900; background: linear-gradient(135deg, #ffd98a, #f5c35a, #6b8cff); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
            .card { background: linear-gradient(135deg, rgba(17,26,74,0.95), rgba(10,16,51,0.95)); border: 1px solid rgba(245,195,90,0.25); border-radius: 16px; padding: 14px; margin-bottom: 14px; box-shadow: 0 0 14px rgba(44,75,181,0.25); }
            .card-title { color: #fff; font-size: 0.9rem; font-weight: 900; margin: 0 0 12px 0; }
            .hero { padding: 0; overflow: hidden; }
            .wall { position: relative; height: 120px; overflow: hidden; background: #0a1033; }
            .wall-bg { position: absolute; top: 0; bottom: 0; background-size: cover; background-position: center; filter: blur(14px) saturate(1.3) brightness(0.8); transform: scale(1.3); }
            .wall-full { left: 0; right: 0; }
            .wall-left { left: 0; width: 50%; }
            .wall-right { right: 0; width: 50%; }
            .wall-empty { background: linear-gradient(135deg, #14206b, #0a1033 60%, #2c4bb5); filter: none; transform: none; }
            .wall-mark { position: absolute; top: 12px; height: 76px; width: 76px; object-fit: contain; filter: drop-shadow(0 4px 10px rgba(0,0,0,0.55)); z-index: 1; }
            .wall-mark-center { left: 50%; margin-left: -38px; height: 90px; width: 90px; top: 6px; }
            .wall-mark-left { left: 16%; }
            .wall-mark-right { right: 16%; }
            .hero-body { padding: 0 14px 14px 14px; }
            .avatar-stage { position: relative; z-index: 3; margin-top: -44px; margin-bottom: 8px; display: flex; justify-content: flex-start; }
            .avatar-box { position: relative; width: 88px; height: 88px; }
            .avatar-ring { width: 100%; height: 100%; border-radius: 50%; padding: 3px; box-sizing: border-box; background: linear-gradient(135deg, #2c4bb5, #f5c35a, #14206b); box-shadow: 0 0 18px rgba(245,195,90,0.35); }
            .avatar-inner { width: 100%; height: 100%; border-radius: 50%; overflow: hidden; background: #0a1033; border: 2px solid #0a1033; }
            .avatar-inner img { width: 100%; height: 100%; object-fit: cover; }
            .avatar-cam { position: absolute; inset: 3px; border-radius: 50%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; font-size: 1.5rem; cursor: pointer; border: none; color: #fff; }
            .hero-name { font-size: 1.1rem; font-weight: 900; margin: 0; }
            .hero-user { font-size: 0.78rem; color: #ffd98a; font-weight: 700; margin-top: 3px; direction: ltr; text-align: ${align}; }
            .hero-bio { font-size: 0.84rem; color: #e2e8f0; line-height: 1.6; margin-top: 10px; word-break: break-word; }
            .hero-meta { font-size: 0.72rem; color: #9aa6d6; font-weight: 700; margin-top: 8px; }
            .stats { display: flex; gap: 22px; margin-top: 12px; }
            .stat-num { font-size: 0.98rem; font-weight: 900; color: #fff; display: inline; }
            .stat-lbl { font-size: 0.74rem; font-weight: 700; color: #9aa6d6; display: inline; margin: 0 4px; }
            .hero-balance { display: inline-block; margin-top: 12px; font-size: 0.8rem; font-weight: 900; background: linear-gradient(90deg, #6b8cff, #f5c35a, #ffd98a); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
            .x-btns { display: flex; gap: 10px; margin-top: 14px; }
            .x-btn { flex: 1; cursor: pointer; background: transparent; color: #fff; font-weight: 900; font-size: 0.86rem; padding: 10px; border-radius: 22px; border: 1px solid rgba(245,195,90,0.4); }
            .x-btn:active { background: rgba(245,195,90,0.12); }
            .verify-btn { margin-top: 10px; cursor: pointer; border: 1px solid rgba(245,195,90,0.55); background: rgba(245,195,90,0.1); color: #f5c35a; font-weight: 900; font-size: 0.76rem; padding: 7px 14px; border-radius: 20px; }
            .small-btn { margin-top: 8px; border: 1px solid rgba(255,255,255,0.15); cursor: pointer; background: rgba(44,75,181,0.2); color: #cbd5e1; font-size: 0.72rem; font-weight: 800; padding: 5px 12px; border-radius: 10px; }
            .club-row { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 8px; background: rgba(0,0,0,0.35); border: 1px solid rgba(44,75,181,0.4); border-radius: 14px; padding: 10px 12px; margin-bottom: 8px; }
            .club-main { display: flex; align-items: center; gap: 10px; min-width: 0; }
            .club-logo-box { width: 40px; height: 40px; min-width: 40px; border-radius: 10px; background: rgba(0,0,0,0.4); border: 1px solid rgba(245,195,90,0.15); display: flex; align-items: center; justify-content: center; }
            .club-name { color: #fff; font-weight: 800; font-size: 0.84rem; }
            .club-sub { color: #9aa6d6; font-size: 0.66rem; font-weight: 700; margin-top: 2px; }
            .chip { font-size: 0.66rem; font-weight: 900; color: #0a1033; background: linear-gradient(135deg, #f5c35a, #ffd98a); padding: 5px 9px; border-radius: 8px; white-space: nowrap; }
            .empty-box { text-align: center; padding: 14px; color: #94a3b8; font-size: 0.8rem; font-weight: 700; border: 1px dashed rgba(245,195,90,0.35); border-radius: 12px; }
            .input { width: 100%; box-sizing: border-box; background: rgba(0,0,0,0.45); border: 1px solid rgba(44,75,181,0.5); border-radius: 12px; padding: 10px 12px; color: #fff; font-size: 0.86rem; font-weight: 700; outline: none; }
            .acc-row { display: flex; gap: 8px; align-items: center; }
            .acc-btn { border: none; cursor: pointer; white-space: nowrap; font-weight: 900; font-size: 0.78rem; padding: 11px 14px; border-radius: 12px; color: #0a1033; background: linear-gradient(135deg, #f5c35a, #ffd98a); }
            .acc-note { font-size: 0.68rem; font-weight: 700; margin-top: 6px; color: #9aa6d6; }
            .linked-ok { color: #f5c35a; }
            .label { display: block; font-size: 0.7rem; font-weight: 800; color: #9aa6d6; margin-bottom: 6px; }
            .group { margin-bottom: 12px; }
            .logout-btn { width: 100%; margin-top: 4px; cursor: pointer; font-weight: 900; font-size: 0.88rem; padding: 12px; border-radius: 14px; color: #ff6b6b; background: rgba(255,80,80,0.08); border: 1px solid rgba(255,80,80,0.35); }
            /* صفحة التعديل (مثل X) */
            .edit-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
            .edit-title { font-size: 1rem; font-weight: 900; }
            .edit-save { border: none; cursor: pointer; background: linear-gradient(135deg, #f5c35a, #ffd98a); color: #0a1033; font-weight: 900; font-size: 0.82rem; padding: 8px 18px; border-radius: 20px; }
            .x-field { border-bottom: 1px solid rgba(245,195,90,0.18); padding: 12px 2px; }
            .x-field label { display: block; font-size: 0.72rem; font-weight: 800; color: #9aa6d6; margin-bottom: 4px; }
            .x-field input, .x-field textarea { width: 100%; box-sizing: border-box; background: transparent; border: none; outline: none; color: #fff; font-size: 0.96rem; font-weight: 600; padding: 4px 0; font-family: inherit; }
            .x-field textarea { resize: none; height: 78px; }
            .x-field:focus-within { border-bottom-color: #f5c35a; }
            .x-row { display: flex; align-items: center; justify-content: space-between; cursor: pointer; }
            .x-row .val { color: #fff; font-size: 0.92rem; font-weight: 700; display: flex; align-items: center; gap: 6px; }
            .x-row .arrow { color: #9aa6d6; }
            /* نافذة المتابعين / المتابَعين */
            .fl-page { position: fixed; inset: 0; z-index: 2600; background: #0a1033; display: flex; flex-direction: column; color: #fff; animation: fadeUp 0.2s ease-out; }
            .fl-top { display: flex; align-items: center; gap: 16px; padding: 14px 16px 8px; }
            .fl-back { background: none; border: none; color: #fff; font-size: 1.5rem; cursor: pointer; padding: 2px 6px; }
            .fl-head-name { font-size: 1.1rem; font-weight: 900; }
            .fl-head-sub { font-size: 0.74rem; color: #9aa6d6; font-weight: 700; margin-top: 2px; }
            .fl-tabs { display: flex; border-bottom: 1px solid rgba(245,195,90,0.18); }
            .fl-tab { flex: 1; text-align: center; padding: 13px 4px; font-size: 0.9rem; font-weight: 800; color: #9aa6d6; cursor: pointer; position: relative; background: none; border: none; }
            .fl-tab.active { color: #fff; }
            .fl-tab.active::after { content: ''; position: absolute; bottom: -1px; left: 25%; right: 25%; height: 4px; border-radius: 2px; background: #f5c35a; }
            .fl-list { flex: 1; overflow-y: auto; padding-bottom: 30px; }
            .fl-row { display: flex; align-items: flex-start; gap: 12px; padding: 14px 16px; border-bottom: 1px solid rgba(245,195,90,0.1); }
            .fl-av { width: 48px; height: 48px; min-width: 48px; border-radius: 50%; object-fit: cover; background: #0a1033; }
            .fl-main { flex: 1; min-width: 0; }
            .fl-tag { color: #9aa6d6; font-size: 0.72rem; font-weight: 800; margin-bottom: 2px; }
            .fl-name { font-weight: 900; font-size: 0.95rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            .fl-user { color: #9aa6d6; font-size: 0.8rem; font-weight: 700; direction: ltr; unicode-bidi: plaintext; text-align: start; }
            .fl-bio { color: #e2e8f0; font-size: 0.84rem; margin-top: 4px; line-height: 1.5; word-break: break-word; }
            .fl-btn { border: none; cursor: pointer; background: #f5c35a; color: #0a1033; font-weight: 900; font-size: 0.8rem; padding: 8px 16px; border-radius: 999px; white-space: nowrap; }
            .fl-btn.on { background: transparent; color: #fff; border: 1px solid rgba(245,195,90,0.45); }
            /* تبويبات المنشورات (مثل X) */
            .feed-tabs { display: flex; border-bottom: 1px solid rgba(245,195,90,0.18); margin-bottom: 4px; }
            .feed-tab { flex: 1; text-align: center; padding: 12px 4px; font-size: 0.84rem; font-weight: 800; color: #9aa6d6; cursor: pointer; position: relative; background: none; border: none; }
            .feed-tab.active { color: #fff; }
            .feed-tab.active::after { content: ''; position: absolute; bottom: -1px; left: 25%; right: 25%; height: 4px; border-radius: 2px; background: #f5c35a; }
            .feed-item { display: flex; gap: 10px; padding: 12px 2px; border-bottom: 1px solid rgba(245,195,90,0.1); }
            .feed-av { width: 40px; height: 40px; min-width: 40px; border-radius: 50%; object-fit: cover; background: #0a1033; }
            .feed-main { flex: 1; min-width: 0; }
            .feed-ctx { font-size: 0.7rem; font-weight: 800; color: #9aa6d6; margin-bottom: 4px; }
            .feed-head { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-size: 0.84rem; }
            .feed-head b { font-weight: 900; color: #fff; }
            .feed-head span { color: #9aa6d6; font-size: 0.74rem; font-weight: 600; direction: ltr; }
            .feed-text { font-size: 0.88rem; line-height: 1.6; color: #e2e8f0; margin-top: 4px; word-break: break-word; white-space: pre-wrap; }
            .feed-img { width: 100%; max-height: 260px; object-fit: cover; border-radius: 14px; margin-top: 8px; border: 1px solid rgba(245,195,90,0.15); }
            .feed-quote { margin-top: 8px; padding: 8px 10px; border: 1px solid rgba(245,195,90,0.2); border-radius: 12px; font-size: 0.78rem; color: #cbd5e1; }
            .feed-stats { display: flex; gap: 22px; margin-top: 8px; font-size: 0.74rem; font-weight: 700; color: #9aa6d6; }
            .feed-empty { text-align: center; padding: 36px 12px; color: #9aa6d6; font-weight: 700; font-size: 0.86rem; }
            .feed-stats { justify-content: space-between; gap: 6px; }
            .feed-stats .act { cursor: pointer; }
            .feed-head .feed-more { margin-inline-start: auto; cursor: pointer; padding: 0 8px; font-size: 1.3rem; color: #9aa6d6; font-weight: 900; line-height: 1; direction: ltr; }
        </style>`;
    };
})();
