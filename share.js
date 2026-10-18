/* ============================================================
 * profile/share.js  —  مشاركة الملف الشخصي + شارة التوثيق + تسجيل الخروج
 * ============================================================ */
(function () {
    const P = window.ZeloProfile;
    const S = P.state;
    const { US, LS, esc, isAr, db, displayNameOf, avatarOf, clubLabel, openExternal } = P;

    // ===== نافذة المشاركة (مثل X) =====
    window.shareVia = function (kind) {
        const ar = isAr();
        const link = P.inviteLink();
        const name = displayNameOf(S.draft || P.loadProfile(), ar);
        const text = ar ? `${name} على Zelo Sport ⚽ انضم واربح مكافآت $ZELOFC` : `${name} on Zelo Sport ⚽ Join and earn $ZELOFC rewards`;
        const u = encodeURIComponent(link), t = encodeURIComponent(text);
        document.getElementById('share-overlay')?.remove();
        if (kind === 'telegram') openExternal(`https://t.me/share/url?url=${u}&text=${t}`);
        else if (kind === 'whatsapp') openExternal(`https://wa.me/?text=${t}%20${u}`);
        else if (kind === 'x') openExternal(`https://twitter.com/intent/tweet?text=${t}&url=${u}`);
        else if (kind === 'messenger') openExternal(`fb-messenger://share?link=${u}`);
        else if (kind === 'copy') window.copyInvite();
        else if (navigator.share) navigator.share({ text, url: link }).catch(() => {});
        else window.copyInvite();
    };

    window.copyInvite = async function () {
        const l = P.inviteLink();
        try { await navigator.clipboard.writeText(l); }
        catch (e) { const t = document.createElement('textarea'); t.value = l; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); } catch (e2) {} t.remove(); }
        alert(tr('ui_link_copied', 'تم نسخ الرابط ✅', 'Link copied ✅'));
    };

    window.openShareSheet = function () {
        const ar = isAr();
        const d = S.draft || P.loadProfile();
        const name = displayNameOf(d, ar);
        document.getElementById('share-overlay')?.remove();
        const ov = document.createElement('div');
        ov.id = 'share-overlay';
        ov.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.65);display:flex;align-items:flex-end;justify-content:center;';
        ov.onclick = e => { if (e.target === ov) ov.remove(); };
        const ic = (kind, bg, glyph, label) => `
            <div onclick="window.shareVia('${kind}')" style="flex:0 0 auto;width:76px;text-align:center;cursor:pointer;">
                <div style="width:56px;height:56px;border-radius:50%;margin:0 auto 6px auto;background:${bg};display:flex;align-items:center;justify-content:center;font-size:1.5rem;color:#fff;font-weight:900;">${glyph}</div>
                <div style="font-size:0.68rem;font-weight:700;color:#cbd5e1;">${label}</div>
            </div>`;
        ov.innerHTML = `
            <div style="width:100%;max-width:500px;box-sizing:border-box;direction:${tr('ui_ltr', 'rtl', 'ltr')};background:#0f1126;border:1px solid rgba(90,110,255,0.35);border-radius:22px 22px 0 0;padding:10px 0 22px 0;color:#fff;">
                <div style="width:44px;height:5px;border-radius:3px;background:rgba(255,255,255,0.25);margin:0 auto 14px auto;"></div>
                <div style="display:flex;align-items:center;gap:12px;padding:0 16px 14px 16px;border-bottom:1px solid rgba(255,255,255,0.08);">
                    <img src="${esc(avatarOf(d, name))}" style="width:48px;height:48px;border-radius:50%;object-fit:cover;">
                    <div style="min-width:0;">
                        <div style="font-weight:900;font-size:0.95rem;">${esc(name)}${window.zeloVerifiedBadge(d.badgeClub, 16)}</div>
                        <div style="font-size:0.74rem;color:#7CF7C4;font-weight:700;direction:ltr;text-align:${tr('ui_left', 'right', 'left')};">${d.username ? '@' + esc(d.username) : ''}</div>
                    </div>
                </div>
                <div style="display:flex;gap:6px;overflow-x:auto;padding:16px 12px 4px 12px;">
                    ${ic('telegram', '#2AABEE', '✈️', 'Telegram')}
                    ${ic('whatsapp', '#25D366', '💬', tr('ui_whatsapp', 'واتساب', 'WhatsApp'))}
                    ${ic('x', '#000', '𝕏', 'X')}
                    ${ic('messenger', '#0084ff', '🗨️', tr('ui_messenger', 'الدردشات', 'Messenger'))}
                    ${ic('copy', '#1f2937', '🔗', tr('ui_copy_link', 'نسخ الرابط', 'Copy link'))}
                    ${ic('more', '#111827', '⋯', tr('ui_share_via', 'مشاركة عبر…', 'Share via…'))}
                </div>
            </div>`;
        document.body.appendChild(ov);
    };

    // ===== شارة التوثيق =====
    window.openBadgePicker = function () {
        P.readInputsIntoDraft();
        const ar = isAr();
        const matched = P.getMatchedClubs(S.draft);
        if (!matched.length) {
            alert(tr('ui_select_a_club_first', 'اختر نادياً أولاً من شاشة اختيار الأندية', 'Select a club first'));
            return;
        }
        document.getElementById('badge-overlay')?.remove();
        const ov = document.createElement('div');
        ov.id = 'badge-overlay';
        ov.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.7);display:flex;align-items:flex-end;justify-content:center;';
        ov.onclick = e => { if (e.target === ov) ov.remove(); };
        const opts = matched.map(c => `
            <div onclick="window.applyBadge('${esc(String(c.id))}')" style="display:flex;align-items:center;gap:12px;padding:12px;margin-bottom:8px;border-radius:14px;cursor:pointer;background:rgba(0,0,0,0.4);border:1px solid ${String(c.id) === S.draft.badgeClub ? '#00FF87' : 'rgba(90,110,255,0.3)'};">
                <img src="${esc(c.logo)}" style="width:38px;height:38px;object-fit:contain;" onerror="this.style.display='none'">
                <span style="font-weight:800;font-size:0.9rem;color:#fff;">${esc(clubLabel(c))}</span>
            </div>`).join('');
        ov.innerHTML = `
            <div style="width:100%;max-width:500px;box-sizing:border-box;direction:${tr('ui_ltr', 'rtl', 'ltr')};background:#0f1126;border:1px solid rgba(90,110,255,0.35);border-radius:20px 20px 0 0;padding:18px 16px 24px 16px;color:#fff;">
                <div style="font-weight:900;font-size:1rem;margin-bottom:4px;">✔️ ${tr('ui_verify_with_your_club', 'وثّق حسابك بشارة ناديك', 'Verify with your club badge')}</div>
                <div style="color:#7a7f9a;font-size:0.72rem;font-weight:700;margin-bottom:14px;">${tr('ui_choose_the_badge_shown', 'اختر الشارة التي تظهر بجانب اسمك في المنشورات', 'Choose the badge shown next to your name on posts')}</div>
                ${opts}
                <div onclick="window.applyBadge('')" style="text-align:center;padding:10px;color:#94a3b8;font-weight:800;font-size:0.8rem;cursor:pointer;">🚫 ${tr('ui_no_badge', 'بدون شارة', 'No badge')}</div>
            </div>`;
        document.body.appendChild(ov);
    };

    window.applyBadge = async function (id) {
        document.getElementById('badge-overlay')?.remove();
        P.readInputsIntoDraft();
        S.draft.badgeClub = String(id || '');
        LS.set('zelo_badge_club', S.draft.badgeClub);
        if (typeof userState !== 'undefined') userState.badgeClub = S.draft.badgeClub;
        const c = db();
        if (c && US().userId) {
            try {
                const { error } = await c.from('users').upsert(
                    { user_id: String(US().userId), badge_club: S.draft.badgeClub || null },
                    { onConflict: 'user_id' });
                if (error) alert((tr('ui_saved_locally_database_rejected', 'تم الحفظ محلياً، لكن القاعدة رفضت: ', 'Saved locally, database rejected: ')) + error.message);
            } catch (e) { console.error(e); }
        }
        P.redraw();
    };

    // ===== تسجيل الخروج =====
    window.logoutUser = async function () {
        const ar = isAr();
        if (!confirm(tr('ui_log_out', 'هل تريد تسجيل الخروج؟', 'Log out?'))) return;
        const c = db();
        try { if (c && c.auth) await c.auth.signOut(); } catch (e) {}
        try {
            const lang = localStorage.getItem('app_lang');
            Object.keys(localStorage).filter(k => k.startsWith('zelo_')).forEach(k => localStorage.removeItem(k));
            if (lang) localStorage.setItem('app_lang', lang);
        } catch (e) {}
        location.reload();
    };
})();
