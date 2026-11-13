// ZELO - صفحة الدوريات: قائمة الدوريات ← داخل الدوري (قادمة / انتهت مع توقعك)
(function () {
    'use strict';

    const NAMES = {
        PL:  ['الدوري الإنجليزي الممتاز', 'Premier League', '🏴'],
        ELC: ['دوري الدرجة الأولى الإنجليزي', 'Championship', '🏴'],
        PD:  ['الدوري الإسباني', 'La Liga', '🇪🇸'],
        SA:  ['الدوري الإيطالي', 'Serie A', '🇮🇹'],
        BL1: ['الدوري الألماني', 'Bundesliga', '🇩🇪'],
        FL1: ['الدوري الفرنسي', 'Ligue 1', '🇫🇷'],
        DED: ['الدوري الهولندي', 'Eredivisie', '🇳🇱'],
        PPL: ['الدوري البرتغالي', 'Primeira Liga', '🇵🇹'],
        BSA: ['الدوري البرازيلي', 'Brasileirão', '🇧🇷'],
        CL:  ['دوري أبطال أوروبا', 'Champions League', '⭐'],
        EL:  ['الدوري الأوروبي', 'Europa League', '⭐'],
        CLI: ['كوبا ليبرتادوريس', 'Copa Libertadores', '🏆'],
        WC:  ['كأس العالم', 'World Cup', '🌍'],
        EC:  ['بطولة أوروبا', 'Euro', '🌍']
    };
    // ترتيب العرض: أوروبية كبرى أولًا
    const ORDER = ['CL', 'EL', 'PL', 'PD', 'SA', 'BL1', 'FL1', 'PPL', 'DED', 'ELC', 'BSA', 'CLI', 'WC', 'EC'];

    const isAr = () => ((window.userState && window.userState.lang) || 'ar').startsWith('ar');
    const db = () => (typeof supabaseClient !== 'undefined' ? supabaseClient : window.supabaseClient);
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const locale = () => (window.zA('ar-EG', 'en-US'));
    const T = (ar, en) => window.zT(ar, en);

    let box = null;
    const MAP = {};
    let tab = 'up';
    let HUB_CACHE = '';
    const LG_CACHE = {};

    function lgName(code, fallback) {
        const n = NAMES[code];
        return n ? (isAr() ? n[0] : n[1]) : (fallback || code);
    }
    function lgIcon(code) { return (NAMES[code] && NAMES[code][2]) || '⚽'; }

    function logo(code, emblem) {
        const fb = lgIcon(code);
        if (!emblem) return `<span style="font-size:20px">${fb}</span>`;
        return `<img src="${esc(emblem)}" alt="" loading="lazy" style="width:28px;height:28px;object-fit:contain" onerror="this.replaceWith(Object.assign(document.createElement('span'),{textContent:'${fb}',style:'font-size:20px'}))">`;
    }

    function css() {
        if (document.getElementById('lg-css')) return;
        const s = document.createElement('style');
        s.id = 'lg-css';
        s.textContent = `
        .lg-top{display:flex;align-items:center;gap:10px;margin-bottom:14px}
        .lg-back{width:40px;height:40px;border-radius:12px;border:1px solid rgba(245,195,90,.35);background:rgba(44,75,181,.2);color:#f5c35a;font-size:20px;cursor:pointer;flex:none;font-family:inherit}
        .lg-title{flex:1;font-weight:900;font-size:1.15rem;color:#fff;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .lg-sec{margin:14px 2px 6px;font-size:.78rem;font-weight:900;color:#f5c35a}
        .lg-row{display:flex;align-items:center;gap:12px;padding:12px;margin-bottom:8px;border-radius:16px;background:#111a4a;border:1px solid rgba(255,255,255,.07);cursor:pointer;width:100%;box-sizing:border-box;color:#fff;font-family:inherit;text-align:start}
        .lg-row:active{transform:scale(.98)}
        .lg-ic{width:42px;height:42px;border-radius:12px;background:#14206b;border:1px solid rgba(245,195,90,.35);display:flex;align-items:center;justify-content:center;flex:none}
        .lg-nm{flex:1;min-width:0}.lg-nm b{display:block;font-size:.95rem}.lg-nm small{color:#8d99cf;font-size:.72rem}
        .lg-n{min-width:26px;text-align:center;padding:3px 8px;border-radius:999px;background:rgba(245,195,90,.15);color:#f5c35a;font-weight:900;font-size:.75rem}
        .lg-tabs{display:flex;padding:4px;margin-bottom:6px;border-radius:999px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1)}
        .lg-tab{flex:1;text-align:center;padding:9px;border-radius:999px;border:0;background:transparent;color:#9aa6d6;font-weight:800;font-size:.88rem;cursor:pointer;font-family:inherit}
        .lg-tab.on{background:linear-gradient(135deg,#ffe7ad,#f5c35a);color:#0a1033;font-weight:900}
        .lg-day{display:flex;align-items:center;gap:10px;margin:16px 2px 8px;font-weight:900;font-size:.8rem;color:#ffd98a}
        .lg-day i{flex:1;height:1px;background:rgba(245,195,90,.25)}
        .lg-m{padding:12px 14px;margin-bottom:10px;border-radius:20px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09)}
        .lg-m.lv{border-color:rgba(255,95,125,.45)}
        .lg-rt{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px}
        .lg-chip{padding:5px 11px;border-radius:999px;border:1px solid rgba(245,195,90,.4);background:transparent;color:#f5c35a;font-size:.72rem;font-weight:800;cursor:pointer;font-family:inherit}
        .lg-chip.dash{border-style:dashed;border-color:rgba(245,195,90,.55);background:rgba(245,195,90,.08);color:#ffd98a;font-weight:900}
        .lg-mr{display:flex;align-items:center;gap:6px}
        .lg-t{flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;gap:6px}
        .lg-tn{font-weight:800;font-size:.78rem;text-align:center;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#fff}
        .lg-cr{position:relative;width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,.08);border:1.5px solid rgba(255,255,255,.25);overflow:hidden;display:block}
        .lg-cr img{position:absolute;inset:3px;width:calc(100% - 6px);height:calc(100% - 6px)}
        .lg-cr-i{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-weight:900;color:#cfd8ff}
        .lg-mid{min-width:78px;text-align:center}
        .lg-sc{font-weight:900;font-size:1.5rem;color:#fff;letter-spacing:2px;white-space:nowrap;direction:ltr}
        .lg-tm{font-weight:900;font-size:1.35rem;color:#f5c35a;direction:ltr;white-space:nowrap}
        .lg-end{display:inline-block;margin-top:2px;padding:1px 9px;border-radius:999px;background:rgba(255,255,255,.08);font-size:.62rem;font-weight:800;color:#c9d3ff}
        .lg-pb{flex:1;padding:12px;border:0;border-radius:14px;background:linear-gradient(135deg,#ffe7ad,#f5c35a);color:#0a1033;font-weight:900;font-size:.9rem;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;font-family:inherit}
        .lg-pb.done{background:rgba(245,195,90,.2);color:#f5c35a;border:1px solid #f5c35a}
        .lg-pb.closed{background:rgba(255,255,255,.05);color:#9aa6d6;border:1px solid #14206b}
        .lg-prw{text-align:center;margin-top:10px}
        .lg-pc{display:inline-block;padding:4px 12px;border-radius:999px;font-size:.72rem;font-weight:800}
        .lg-pok{background:rgba(20,241,149,.12);border:1px solid rgba(20,241,149,.4);color:#14f195}
        .lg-pno{background:rgba(255,90,110,.12);border:1px solid rgba(255,90,110,.4);color:#ff8f9d}
        .lg-pn{font-size:.72rem;color:#8d99cf}
        .lg-empty{text-align:center;color:#9aa6d6;padding:40px 10px;font-size:.9rem}
        .lg-soon{opacity:.75}
        `;
        document.head.appendChild(s);
    }

    // ================= قائمة الدوريات =================
    async function renderHub(container) {
        box = container || box || document.getElementById('main-content');
        if (!box) return;
        css();
        box.style.direction = window.zA('rtl', 'ltr');
        box.innerHTML = HUB_CACHE || `<div class="lg-empty">⏳ ${T('جارٍ التحميل...', 'Loading...')}</div>`;

        const c = db();
        let rows = [];
        if (c) {
            try {
                const since = new Date(Date.now() - 30 * 86400000).toISOString();
                const { data } = await c.from('matches')
                    .select('competition_code,competition_name,competition_emblem,status')
                    .gte('match_date', since).not('competition_code', 'is', null).limit(2000);
                rows = data || [];
            } catch (e) { console.error('[ZELO] leagues hub:', e); }
        }
        const by = {};
        rows.forEach(r => {
            const o = by[r.competition_code] || (by[r.competition_code] = { code: r.competition_code, name: r.competition_name, emblem: r.competition_emblem, up: 0 });
            if (r.status === 'NOT_STARTED' || r.status === 'LIVE') o.up++;
            if (r.competition_emblem) o.emblem = r.competition_emblem;
        });
        const list = Object.values(by).sort((a, b) => {
            const ia = ORDER.indexOf(a.code), ib = ORDER.indexOf(b.code);
            return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
        });

        const row = o => `
            <button class="lg-row" onclick="window.openLeague('${esc(o.code)}')">
                <span class="lg-ic">${logo(o.code, o.emblem)}</span>
                <span class="lg-nm"><b>${esc(lgName(o.code, o.name))}</b><small>${esc(o.name || '')}</small></span>
                ${o.up ? `<span class="lg-n">${o.up}</span>` : ''}
                <span style="color:#8d99cf">${window.zA('‹', '›')}</span>
            </button>`;

        box.innerHTML = `
            <div class="lg-top"><div class="lg-title">⚽ ${T('المباريات', 'Matches')}</div>${window.mrRankChip ? window.mrRankChip() : ''}</div>
            ${window.fcEntryHtml ? window.fcEntryHtml() : ''}
            <div style="margin:0 2px 4px;font-size:.78rem;color:#8d99cf">${T('اختر دوريًا وتوقّع مبارياته مباشرة', 'Pick a league and predict its matches')}</div>
            <div class="lg-sec">${T('الدوريات والبطولات', 'Leagues & cups')}</div>
            ${list.length ? list.map(row).join('') : `<div class="lg-empty">${T('لا توجد مباريات الآن', 'No matches right now')}</div>`}
            <div class="lg-sec">${T('الدوريات العربية', 'Arab leagues')}</div>
            <div class="lg-row lg-soon" style="cursor:default">
                <span class="lg-ic"><span style="font-size:20px">🌙</span></span>
                <span class="lg-nm"><b>${T('الدوري السعودي والمصري وغيرها', 'Saudi, Egyptian & more')}</b><small>${T('قريبًا', 'Coming soon')}</small></span>
            </div>`;
        HUB_CACHE = box.innerHTML;
        if (window.fcRefreshBadge) window.fcRefreshBadge();
        if (window.mrRefreshRank) window.mrRefreshRank();
    }

    // ================= داخل الدوري (قادمة / منتهية فقط) =================
    window.openLeague = async function (code, which) {
        if (!box) box = document.getElementById('main-content');
        if (!box) return;
        css();
        if (which) tab = which;
        if (tab !== 'up' && tab !== 'fin') tab = 'up';
        const c = db();
        const ckey = code + '|' + tab;
        box.innerHTML = LG_CACHE[ckey] || `<div class="lg-empty">⏳ ${T('جارٍ التحميل...', 'Loading...')}</div>`;
        let ms = [], preds = {}, crests = {};
        if (c) {
            try {
                const { data } = await c.from('matches').select('*')
                    .eq('competition_code', code).neq('status', 'CANCELLED')
                    .order('match_date', { ascending: true }).limit(400);
                ms = data || [];
                const uid = window.userState && window.userState.userId;
                if (uid && ms.length) {
                    const ids = ms.map(m => m.id);
                    const r = await c.from('match_predictions').select('match_id,predicted_home,predicted_away')
                        .eq('user_id', uid).in('match_id', ids);
                    (r.data || []).forEach(p => { preds[p.match_id] = p; });
                }
                // شعارات الفرق من جدول الترتيب (مطابقة بالاسم)
                const st = await c.from('standings').select('team_name,crest').eq('competition_code', code);
                (st.data || []).forEach(t => { if (t.crest) crests[String(t.team_name).trim().toLowerCase()] = t.crest; });
            } catch (e) { console.error('[ZELO] league:', e); }
        }
        ms.forEach(m => { MAP[m.id] = m; });
        const name = ms[0] ? lgName(code, ms[0].competition_name) : lgName(code);
        const emblem = (ms.find(m => m.competition_emblem) || {}).competition_emblem || '';
        const sub = NAMES[code] ? (isAr() ? NAMES[code][1] : '') : '';
        const up = ms.filter(m => m.status === 'NOT_STARTED' || m.status === 'LIVE');
        const fin = ms.filter(m => m.status === 'FINISHED').reverse();
        const day = d => new Date(d).toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long' });
        const hm = d => new Date(d).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit', hour12: false });

        const teamHtml = n => {
            const u = crests[String(n || '').trim().toLowerCase()];
            const ini = esc(String(n || '?').trim().charAt(0).toUpperCase());
            const img = u ? `<img src="${esc(u)}" alt="" loading="lazy" style="width:100%;height:100%;object-fit:contain" onerror="this.remove()">` : '';
            return `<div class="lg-t"><span class="lg-cr"><span class="lg-cr-i">${ini}</span>${img}</span><span class="lg-tn">${esc(n)}</span></div>`;
        };

        const card = m => {
            const live = m.status === 'LIVE';
            const fin_ = m.status === 'FINISHED';
            let mid;
            if (fin_) mid = `<div class="lg-mid"><div class="lg-sc">${m.home_score ?? '-'} - ${m.away_score ?? '-'}</div><div class="lg-end">${T('انتهت', 'Full time')}</div></div>`;
            else if (live) mid = `<div class="lg-mid"><div class="lg-sc" style="color:#ff5f7d">${m.live_home ?? 0} - ${m.live_away ?? 0}</div><div class="lg-end" style="color:#ff5f7d">● ${T('مباشر', 'LIVE')}</div></div>`;
            else mid = `<div class="lg-mid"><div class="lg-tm">${hm(m.match_date)}</div><div class="lg-end">${T('بتوقيتك', 'Your time')}</div></div>`;
            let pr = '';
            if (fin_) {
                const p = preds[m.id];
                if (p) {
                    const exact = p.predicted_home === m.home_score && p.predicted_away === m.away_score;
                    const sgn = (a, b) => Math.sign(a - b);
                    const win = sgn(p.predicted_home, p.predicted_away) === sgn(m.home_score, m.away_score);
                    const cls = (exact || win) ? 'lg-pok' : 'lg-pno';
                    const txt = exact ? T('نتيجة دقيقة 🎯', 'Exact score 🎯') : win ? T('أصبت ✓', 'Correct ✓') : T('لم تصب ✗', 'Missed ✗');
                    pr = `<div class="lg-prw"><span class="lg-pc ${cls}">${T('توقعك', 'Your pick')} ${p.predicted_home} - ${p.predicted_away} · ${txt}</span></div>`;
                } else {
                    pr = `<div class="lg-prw"><span class="lg-pn">${T('لم تتوقع هذه المباراة', 'You did not predict this match')}</span></div>`;
                }
            }
            let act = '', top = '';
            if (!fin_) {
                const started = (Date.now() + 3600000) >= new Date(m.match_date).getTime();
                const p = preds[m.id] || ((window.userState && window.userState.predictedMatches || []).includes(m.id) ? {} : null);
                const BALL = '<img src="zelo-coin.png" alt="" style="width:15px;height:15px;flex:none" onerror="if(!this.dataset.f){this.dataset.f=1;this.src=\'https://raw.githubusercontent.com/zelospor-f/zelo-/main/zelo-coin.png\';}else{this.style.display=\'none\';}">';
                let btn;
                if (p) btn = `<button disabled class="lg-pb done">${T('تم التوقع', 'Predicted')}${p.predicted_home != null ? ` · ${p.predicted_home} - ${p.predicted_away}` : ''}</button>`;
                else if (started) btn = `<button disabled class="lg-pb closed">${T('مغلق', 'Closed')}</button>`;
                else btn = `<button onclick="window.lgPredict(${m.id})" class="lg-pb">${T('توقّع واكسب', 'Predict & win')} ${BALL}</button>`;
                const fc = (!started && window.fcMatchButton) ? window.fcMatchButton(m.id) : '';
                act = `<div id="btn-container-${m.id}" style="margin-top:10px"><div style="display:flex;gap:10px">${btn}${fc}</div></div>`;
                top = `<div class="lg-rt">
                    <button class="lg-chip" onclick="window.openMatchRoom && window.openMatchRoom('${m.id}')">💬 ${T('غرفة المباراة', 'Match room')}</button>
                    <button class="lg-chip dash" onclick="window.createMatchLinkedRoom && window.createMatchLinkedRoom('${m.id}')">＋ ${T('إنشاء غرفة', 'Create room')}</button></div>`;
            }
            return `<div class="lg-m ${live ? 'lv' : ''}">${top}
                <div class="lg-mr">${teamHtml(m.team_a)}${mid}${teamHtml(m.team_b)}</div>${pr}${act}</div>`;
        };
        const grouped = arr => {
            if (!arr.length) return `<div class="lg-empty">${T('لا توجد مباريات', 'No matches')}</div>`;
            let out = '', last = '';
            arr.forEach(m => {
                const d = day(m.match_date);
                if (d !== last) { out += `<div class="lg-day"><span>${esc(d)}</span><i></i></div>`; last = d; }
                out += card(m);
            });
            return out;
        };

        box.innerHTML = `
            <div class="lg-top">${window.zeloBackBtn ? window.zeloBackBtn('window.renderLeaguesHub()', isAr()) : ''}
                <span class="lg-ic" style="width:38px;height:38px">${logo(code, emblem)}</span>
                <div style="flex:1;min-width:0"><div class="lg-title" style="line-height:1.2">${esc(name)}</div>${sub ? `<div style="font-size:.72rem;color:#9aa6d6">${esc(sub)}</div>` : ''}</div></div>
            <div class="lg-tabs">
                <button class="lg-tab ${tab === 'up' ? 'on' : ''}" onclick="window.openLeague('${esc(code)}','up')">${T('القادمة', 'Upcoming')} (${up.length})</button>
                <button class="lg-tab ${tab === 'fin' ? 'on' : ''}" onclick="window.openLeague('${esc(code)}','fin')">${T('المنتهية', 'Finished')} (${fin.length})</button>
            </div>
            ${tab === 'up' ? grouped(up) : grouped(fin)}`;
        LG_CACHE[ckey] = box.innerHTML;
        box.scrollTop = 0;
        window.scrollTo(0, 0);
    };

    window.lgPredict = function (id) {
        const m = MAP[id];
        if (m && window.showPredictionModal) window.showPredictionModal(m.id, String(m.team_a).replace(/'/g, '\u2019'), String(m.team_b).replace(/'/g, '\u2019'));
    };

    window.renderLeaguesHub = function () { return renderHub(box); };
    window.renderLeaguesPage = renderHub;
})();
