/* ============================================================
 * guess-player.js — لعبة «خمّن اللاعب» (لغز جديد كل يوم)
 * السيرفر هو المرجع: الجواب الصحيح لا يصل للهاتف إلا بعد انتهاء اللغز.
 * دوال Supabase: guess_today, guess_hint, guess_answer, guess_leaderboard
 * الفتح: window.openGuessPlayer()
 * ============================================================ */
(function () {
    'use strict';

    const db = () => (typeof supabaseClient !== 'undefined' && supabaseClient) ? supabaseClient : (window.supabaseClient || null);
    const isAr = () => ((window.userState && window.userState.lang) || 'ar').startsWith('ar');
    const lang = () => isAr() ? 'ar' : 'en';
    const L = (a, e) => isAr() ? a : e;
    const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g,
        c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const G = '#f5c35a', MUTED = '#9aa6d6';
    let st = null, busy = false;

    function toast(m) {
        try { if (typeof window.showToast === 'function') return window.showToast(m); } catch (e) {}
        let el = document.getElementById('zgp-toast');
        if (!el) {
            el = document.createElement('div');
            el.id = 'zgp-toast';
            el.style.cssText = 'position:fixed;bottom:100px;left:50%;transform:translateX(-50%);z-index:100005;background:rgba(17,26,74,.95);color:#fff;padding:10px 18px;border-radius:12px;font-size:.85rem;border:1px solid rgba(245,195,90,.3);transition:opacity .25s;pointer-events:none';
            document.body.appendChild(el);
        }
        el.textContent = m; el.style.opacity = '1';
        clearTimeout(el._t); el._t = setTimeout(() => { el.style.opacity = '0'; }, 2200);
    }

    function injectStyle() {
        if (document.getElementById('zgp-style')) return;
        const s = document.createElement('style');
        s.id = 'zgp-style';
        s.textContent = `
        #zgp{position:fixed;inset:0;z-index:100000;background:var(--bg-dark,#0a1033);color:#fff;overflow-y:auto;
            padding:12px 16px 40px;box-sizing:border-box;font-family:inherit}
        #zgp h2{margin:6px 0 2px;font-size:1.35rem;font-weight:900;color:${G}}
        #zgp .sub{color:${MUTED};font-size:.8rem;margin-bottom:12px}
        #zgp .card{background:#111a4a;border:1px solid rgba(245,195,90,.45);border-radius:18px;padding:14px;margin-bottom:12px}
        #zgp .pts{display:flex;justify-content:space-between;align-items:center;font-size:.85rem;color:${MUTED}}
        #zgp .pts b{color:${G};font-size:1.2rem}
        #zgp .avatar{width:92px;height:92px;border-radius:50%;margin:12px auto;display:flex;align-items:center;justify-content:center;
            background:radial-gradient(#2c4bb5,#14206b);border:2px solid ${G};font-size:2.6rem;font-weight:900;color:${G}}
        #zgp .hint{display:flex;gap:10px;align-items:center;padding:10px;border-radius:12px;background:rgba(255,255,255,.06);margin-top:8px;font-size:.9rem;line-height:1.5}
        #zgp .hint i{font-style:normal;width:24px;height:24px;border-radius:50%;background:${G};color:#0a1033;font-weight:900;
            display:flex;align-items:center;justify-content:center;font-size:.75rem;flex:none}
        #zgp input{width:100%;box-sizing:border-box;margin-top:12px;padding:12px;border-radius:12px;border:1.5px solid rgba(245,195,90,.45);
            background:rgba(255,255,255,.05);color:#fff;font-size:1rem;font-family:inherit;outline:none}
        #zgp .row{display:flex;gap:8px;margin-top:10px}
        #zgp .btn{flex:1;padding:12px;border-radius:14px;text-align:center;font-weight:900;font-size:.95rem;cursor:pointer;border:none;color:#fff;
            font-family:inherit;background:linear-gradient(135deg,#2c4bb5,#14206b,#f5c35a)}
        #zgp .btn.ghost{background:transparent;border:1.5px solid rgba(245,195,90,.45);color:${G}}
        #zgp .btn[disabled]{opacity:.5}
        #zgp .msg{margin-top:10px;font-size:.85rem;text-align:center;min-height:1.2em}
        #zgp .ok{color:#2de2c4}#zgp .bad{color:#ff6b86}
        #zgp .top{display:flex;justify-content:space-between;font-size:.9rem;padding:8px 0;border-top:1px solid rgba(255,255,255,.07)}
        #zgp .top b{color:${G}}`;
        document.head.appendChild(s);
    }

    async function call(fn, args) {
        const c = db();
        if (!c) throw new Error('no_client');
        const { data, error } = await c.rpc(fn, args || {});
        if (error) throw error;
        if (data && data.error) throw new Error(data.error);
        return data;
    }

    function render() {
        const ov = document.getElementById('zgp');
        if (!ov || !st) return;
        const body = ov.querySelector('#zgp-body');
        const over = st.status !== 'playing';
        const hints = (st.hints || []).map((h, i) => `<div class="hint"><i>${i + 1}</i><span>${esc(h)}</span></div>`).join('');
        const canHint = !over && st.hints_used < 4;
        const left = st.max_wrong - st.wrong;
        let resultBox = '';
        if (st.status === 'solved') {
            resultBox = `<div class="msg ok" style="font-size:1rem;font-weight:900">✅ ${L('أحسنت! اللاعب هو', 'Correct! The player is')} ${esc(st.answer)}<br>${L('نقاط اللغز', 'Score')}: ${st.score}/10 · +1 ${L('كورة', 'Kora')}</div>`;
        } else if (st.status === 'failed') {
            resultBox = `<div class="msg bad" style="font-size:1rem;font-weight:900">❌ ${L('انتهت محاولاتك. اللاعب هو', 'Out of tries. The player is')} ${esc(st.answer)}</div>`;
        }
        body.innerHTML = `
            <div class="card">
                <div class="pts"><span>${over ? L('نتيجتك اليوم', 'Your score today') : L('نقاط هذا اللغز', 'Points for this puzzle')}</span>
                    <b dir="ltr">${over ? st.score : st.potential} / 10</b></div>
                <div class="avatar">${over && st.status === 'solved' ? '⚽' : '؟'}</div>
                ${hints}
                ${over ? resultBox : `
                    <input id="zgp-in" type="text" maxlength="60" autocomplete="off" placeholder="${esc(L('اكتب اسم اللاعب…', 'Type the player name…'))}">
                    <div class="row">
                        <button class="btn" id="zgp-go">${L('تأكيد', 'Submit')}</button>
                        <button class="btn ghost" id="zgp-hint" ${canHint ? '' : 'disabled'}>${canHint ? L('تلميح (-2)', 'Hint (-2)') : L('لا مزيد', 'No more')}</button>
                    </div>
                    <div class="msg" id="zgp-msg">${L('المحاولات المتبقية', 'Tries left')}: ${left}</div>`}
            </div>
            ${over ? `<button class="btn ghost" id="zgp-share" style="width:100%">📤 ${L('شارك نتيجتك', 'Share your result')}</button>
                      <div class="sub" style="text-align:center;margin-top:10px">${L('لغز جديد غداً 🌙', 'A new puzzle tomorrow 🌙')}</div>` : ''}
            <div class="card"><div style="font-weight:900;margin-bottom:6px">🏆 ${L('أسرع المخمّنين اليوم', "Today's top guessers")}</div><div id="zgp-lb" class="sub">…</div></div>`;

        const inp = body.querySelector('#zgp-in');
        const go = body.querySelector('#zgp-go');
        if (go) go.onclick = submit;
        if (inp) inp.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
        const hb = body.querySelector('#zgp-hint');
        if (hb) hb.onclick = hint;
        const sh = body.querySelector('#zgp-share');
        if (sh) sh.onclick = share;
        loadBoard();
    }

    async function loadBoard() {
        const el = document.getElementById('zgp-lb');
        if (!el) return;
        try {
            const rows = await call('guess_leaderboard');
            if (!Array.isArray(rows) || !rows.length) { el.textContent = L('كن أول من يحل لغز اليوم!', 'Be the first to solve today!'); return; }
            el.className = '';
            el.innerHTML = rows.map((r, i) => `<div class="top"><span>${i + 1}. ${esc(r.name)}</span><b>${Number(r.score) || 0}</b></div>`).join('');
        } catch (e) { el.textContent = '—'; }
    }

    async function hint() {
        if (busy) return; busy = true;
        try { st = await call('guess_hint', { p_lang: lang() }); render(); }
        catch (e) { toast(L('تعذّر جلب التلميح', 'Could not get hint')); }
        busy = false;
    }

    async function submit() {
        const inp = document.getElementById('zgp-in');
        const v = inp ? inp.value.trim() : '';
        if (v.length < 2) return toast(L('اكتب اسم اللاعب', 'Type a name'));
        if (busy) return; busy = true;
        try {
            const r = await call('guess_answer', { p_text: v, p_lang: lang() });
            st = r;
            render();
            if (r.result === 'correct') toast('✅ +1 ' + L('كورة', 'Kora'));
            else if (r.result === 'wrong' && r.status === 'playing') {
                const m = document.getElementById('zgp-msg');
                if (m) { m.className = 'msg bad'; m.textContent = L('إجابة خاطئة، حاول مرة أخرى. المتبقي: ', 'Wrong. Tries left: ') + (r.max_wrong - r.wrong); }
            }
        } catch (e) {
            toast(e && e.message === 'bad_input' ? L('الاسم غير صالح', 'Invalid name') : L('تعذّر الإرسال', 'Could not send'));
        }
        busy = false;
    }

    async function share() {
        const squares = st.status === 'solved' ? '🟩'.repeat(Math.max(1, 5 - st.hints_used)) + '⬜'.repeat(st.hints_used) : '🟥';
        const text = `🕵️ ${L('خمّن اللاعب في ZELO Sport', 'Guess the Player on ZELO Sport')}\n${squares} ${st.score}/10\n${L('هل تستطيع التفوق عليّ؟', 'Can you beat me?')}\nhttps://t.me/ZeloSport`;
        try {
            if (navigator.share) { await navigator.share({ text }); return; }
        } catch (e) { if (e && e.name === 'AbortError') return; }
        try { await navigator.clipboard.writeText(text); toast(L('تم نسخ النتيجة', 'Result copied')); }
        catch (e) { toast(L('تعذّرت المشاركة', 'Could not share')); }
    }

    async function open() {
        injectStyle();
        close();
        const ar = isAr();
        const ov = document.createElement('div');
        ov.id = 'zgp';
        ov.dir = ar ? 'rtl' : 'ltr';
        ov.innerHTML = `
            ${typeof window.zeloBackBtn === 'function' ? window.zeloBackBtn('window.closeGuessPlayer()', ar)
                : '<button onclick="window.closeGuessPlayer()" style="width:40px;height:40px;border-radius:12px;border:1px solid rgba(245,195,90,.35);background:rgba(44,75,181,.2);color:#f5c35a;font-size:20px;cursor:pointer">' + (ar ? '›' : '‹') + '</button>'}
            <div style="height:max(0px, calc(var(--zelo-ad-h, 0px) - 10px));"></div>
            <h2>🕵️ ${L('خمّن اللاعب', 'Guess the Player')}</h2>
            <div class="sub">${L('لغز جديد كل يوم · كلما قلّت التلميحات زادت نقاطك', 'New puzzle every day · fewer hints, more points')}</div>
            <div id="zgp-body"><div class="sub" style="text-align:center;padding:30px">⏳</div></div>`;
        document.body.appendChild(ov);
        try {
            st = await call('guess_today', { p_lang: lang() });
            render();
        } catch (e) {
            const b = document.getElementById('zgp-body');
            if (b) b.innerHTML = `<div class="sub" style="text-align:center;padding:30px">${L('سجّل الدخول أولاً أو حاول لاحقاً', 'Sign in first or try later')}</div>`;
        }
    }

    function close() { const o = document.getElementById('zgp'); if (o) o.remove(); }

    window.openGuessPlayer = open;
    window.closeGuessPlayer = close;
})();
