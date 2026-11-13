// wallet-withdraw.js — صفحة "محفظتي": رصيد الكورة + شروط السحب + طلب سحب USDT (BEP20)
// الاستخدام: أضف الملف إلى الصفحة ثم استدعِ openWithdrawWallet(supabaseClient) من زر المحفظة.
(function () {
  const TITLES = {
    verified: ['تأكيد البريد/الهاتف','Email/phone verification'], account_age: ['عمر الحساب','Account age'], invites: ['الدعوات الناجحة','Successful invites'],
    min_balance: ['الحد الأدنى للسحب','Minimum withdrawal'], hold: ['فترة التعليق','Holding period'], amount: ['المبلغ المطلوب','Requested amount'],
    address: ['عنوان السحب','Withdrawal address'], identity: ['تأكيد الهوية','Identity verification'], no_open_request: ['الطلبات المعلّقة','Pending requests'],
    no_fraud: ['المراجعة الأمنية','Security review'], subscription: ['الاشتراك','Subscription']
  };
  const STATUS = {
    pending: ['قيد الإرسال','Sending'], review: ['قيد المراجعة','Under review'], sent: ['تم الإرسال','Sent'],
    failed: ['فشل','Failed'], rejected: ['مرفوض','Rejected']
  };
  const CSS = `
  .zw-ov{position:fixed;inset:0;z-index:9999;background:radial-gradient(560px 460px at 90% -8%,#2a42b0 0%,#0a1033 68%);color:#f8fafc;overflow:auto;font-family:system-ui,-apple-system,"Segoe UI",Tahoma,sans-serif}
  .zw-wrap{max-width:520px;margin:0 auto;padding:16px 16px 40px}
  .zw-top{display:flex;align-items:center;gap:12px;margin-bottom:14px}
  .zw-top h2{margin:0;font-size:19px;color:#f4f6ff;font-weight:900}
  .zw-x{background:rgba(44,75,181,.22);border:1px solid rgba(245,195,90,.35);color:#e8ecff;width:42px;height:42px;border-radius:14px;font-size:20px;line-height:1;padding:0;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;flex:none}
  .zw-card{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09);border-radius:22px;padding:16px;margin-bottom:14px}
  .zw-h{font-size:15px;font-weight:900;color:#f4f6ff;margin:0}
  .zw-gold{position:relative;height:204px;border-radius:26px;overflow:hidden;margin-bottom:18px;background:linear-gradient(135deg,#ffeebd 0%,#f5c35a 48%,#b9842a 100%);box-shadow:0 18px 40px rgba(245,195,90,.28),inset 0 2px 0 rgba(255,255,255,.5);color:#0a1033}
  .zw-r1,.zw-r2{position:absolute;border-radius:50%;border:2px solid rgba(10,16,51,.13)}
  .zw-r1{inset-inline-end:-46px;bottom:-60px;width:210px;height:210px}
  .zw-r2{inset-inline-end:-14px;bottom:-30px;width:150px;height:150px}
  .zw-ball{position:absolute;inset-inline-end:30px;bottom:18px;opacity:.22}
  .zw-ball svg{width:92px;height:92px;fill:none;stroke:#0a1033;stroke-width:1.4;stroke-linecap:round;stroke-linejoin:round}
  .zw-gtop{position:absolute;top:18px;inset-inline:20px;display:flex;justify-content:space-between;align-items:center}
  .zw-brand{font-weight:900;font-size:12.5px;letter-spacing:.5px;opacity:.75;direction:ltr}
  .zw-chip{width:40px;height:30px;border-radius:7px;background:linear-gradient(135deg,rgba(255,255,255,.65),rgba(10,16,51,.18));border:1px solid rgba(10,16,51,.25)}
  .zw-gbal{position:absolute;inset-inline-start:20px;top:58px}
  .zw-gbal small{display:block;font-size:12px;font-weight:700;opacity:.7}
  .zw-gnum{display:flex;align-items:baseline;gap:7px}
  .zw-gnum b{font-size:42px;line-height:1.05;font-variant-numeric:tabular-nums;direction:ltr}
  .zw-gnum span{font-weight:900;font-size:15px}
  .zw-gusd{font-size:13px;font-weight:500;opacity:.7;unicode-bidi:plaintext}
  .zw-gfoot{position:absolute;inset-inline:20px;bottom:16px;display:flex;gap:10px}
  .zw-gfoot div{flex:1;border-radius:12px;background:rgba(10,16,51,.82);color:#f4f6ff;padding:7px 10px;display:flex;justify-content:space-between;align-items:center;gap:6px}
  .zw-gfoot span{font-size:11px;color:#b9c4f0}
  .zw-gfoot b{font-size:14px;direction:ltr;color:#fff}
  .zw-gfoot .g b{color:#14f195}
  .zw-acts{display:flex;gap:6px;margin:0 8px 18px}
  .zw-act{flex:1;text-align:center;background:none;border:0;color:#f4f6ff;font-family:inherit;cursor:pointer;padding:0}
  .zw-act i{display:flex;width:56px;height:56px;margin:0 auto;border-radius:20px;background:rgba(44,75,181,.28);border:1px solid rgba(245,195,90,.4);color:#ffe7ad;align-items:center;justify-content:center}
  .zw-act.gold i{background:linear-gradient(135deg,#ffe7ad,#f5c35a);color:#0a1033}
  .zw-act svg{width:26px;height:26px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
  .zw-act span{display:block;margin-top:6px;font-size:12px;font-weight:700}
  .zw-rh{display:flex;justify-content:space-between;align-items:baseline}
  .zw-rh span{direction:ltr;font-weight:700;color:#f5c35a;font-size:14px}
  .zw-rh.all span{color:#14f195}
  .zw-dots{display:flex;gap:4px;direction:ltr;margin-top:12px}
  .zw-dots i{flex:1;height:8px;border-radius:99px;background:rgba(255,255,255,.12)}
  .zw-dots i.on{background:linear-gradient(90deg,#f5c35a,#ffe7ad)}
  .zw-dots.all i.on{background:linear-gradient(90deg,#14c27a,#14f195)}
  .zw-left{margin-top:14px;font-size:12px;color:#9aa6d6}
  .zw-pills{margin-top:8px;display:flex;flex-direction:column;gap:8px}
  .zw-pl{display:flex;align-items:flex-start;gap:8px;padding:9px 12px;border-radius:14px;background:rgba(255,77,94,.1);border:1px solid rgba(255,107,107,.35)}
  .zw-pl svg{width:12px;height:12px;flex:none;margin-top:4px;fill:none;stroke:#ff9aa5;stroke-width:3;stroke-linecap:round}
  .zw-pl b{display:block;font-size:12.5px;color:#ffc4ca}
  .zw-pl small{display:block;font-size:11px;color:#c9a3a8;margin-top:1px;line-height:1.5}
  .zw-more{margin-top:12px;text-align:center;color:#f5c35a;font-weight:900;font-size:12.5px;background:none;border:0;width:100%;cursor:pointer;font-family:inherit;padding:4px}
  .zw-chk{display:flex;align-items:center;gap:12px;padding:10px 12px;margin-top:8px;border-radius:12px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08)}
  .zw-chk.ok{border-color:rgba(20,241,149,.35);background:rgba(20,241,149,.06)}
  .zw-chk.no{border-color:rgba(255,77,77,.35);background:rgba(255,77,77,.06)}
  .zw-mark{flex:none;width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center}
  .zw-mark svg{width:15px;height:15px;fill:none;stroke:#fff;stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round}
  .zw-chk.ok .zw-mark{background:#14c27a}
  .zw-chk.no .zw-mark{background:#e5484d}
  .zw-chk .zw-t{font-weight:800;font-size:13px}
  .zw-chk small{display:block;color:#9aa6d6;margin-top:2px;font-size:11.5px;line-height:1.5}
  .zw-sh{display:flex;justify-content:space-between;align-items:center}
  .zw-bep{padding:3px 10px;border-radius:99px;background:rgba(245,195,90,.12);border:1px solid rgba(245,195,90,.3);color:#ffe7ad;font-size:11px;font-weight:700;direction:ltr}
  .zw-adr{display:flex;align-items:center;gap:10px;padding:10px 12px;margin-top:12px;border-radius:14px;background:rgba(10,16,51,.7);border:1px solid rgba(255,255,255,.1)}
  .zw-ai{width:34px;height:34px;border-radius:11px;background:rgba(245,195,90,.1);border:1px solid rgba(245,195,90,.28);color:#f5c35a;display:flex;align-items:center;justify-content:center;flex:none}
  .zw-ai svg,.zw-ed svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
  .zw-at{flex:1;min-width:0}
  .zw-at small{display:block;font-size:11px;color:#9aa6d6}
  .zw-at code{display:block;font-size:13px;direction:ltr;unicode-bidi:plaintext;font-family:ui-monospace,Menlo,monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .zw-ed{background:none;border:0;color:#9aa6d6;cursor:pointer;padding:6px;display:flex}
  .zw-tiny{margin-top:8px;font-size:11px;color:#9aa6d6;line-height:1.6}
  .zw-warn{background:rgba(245,195,90,.12);color:#f5c35a;border-radius:10px;padding:10px;font-size:12.5px;margin:12px 0 10px;line-height:1.6}
  .zw-lbl{display:block;font-size:12px;color:#9aa6d6;margin:0 0 6px;font-weight:700}
  .zw-in{width:100%;box-sizing:border-box;background:rgba(10,16,51,.7);border:1px solid rgba(255,255,255,.12);border-radius:14px;color:#f8fafc;padding:12px;font-size:15px;direction:ltr;text-align:left}
  .zw-btn{width:100%;border:0;border-radius:15px;padding:13px;font-size:14.5px;font-weight:900;cursor:pointer;background:linear-gradient(135deg,#ffe7ad,#f5c35a);color:#0a1033;margin-top:10px;font-family:inherit}
  .zw-btn[disabled]{opacity:.4;cursor:not-allowed}
  .zw-btn.sec{background:rgba(44,75,181,.3);color:#f5c35a;border:1px solid rgba(245,195,90,.4)}
  .zw-line{display:flex;gap:8px;align-items:center;margin-top:12px}
  .zw-line .zw-in{flex:1}
  .zw-line button{width:auto;margin:0;padding:12px 16px}
  .zw-est{margin-top:10px;padding:10px 12px;border-radius:12px;background:rgba(245,195,90,.1);color:#f5c35a;font-weight:800;font-size:14px;text-align:center}
  .zw-msg{margin-top:10px;font-size:14px}
  .zw-h-row{display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-top:1px solid rgba(255,255,255,.08);font-size:14px}
  .zw-h-row:first-of-type{border-top:0}
  .zw-h-row b{direction:ltr;font-weight:700}
  .zw-pill{font-size:12px;font-weight:800;padding:3px 10px;border-radius:20px;background:rgba(255,255,255,.08)}
  .zw-pill.sent{background:rgba(20,241,149,.15);color:#14F195}
  .zw-pill.failed,.zw-pill.rejected{background:rgba(255,77,77,.15);color:#ff6b6b}
  .zw-pill.pending,.zw-pill.review{background:rgba(245,195,90,.15);color:#f5c35a}
  .zw-empty{margin-top:8px;font-size:13px;color:#9aa6d6}
  `;

  const SVG_OK = '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  const SVG_NO = '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  const SVG_BALL = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 8.2l3.2 2.3-1.2 3.7h-4l-1.2-3.7z"/><path d="M12 8.2V3.2M15.2 10.5l4.6-1.5M14 14.2l2.8 3.9M10 14.2l-2.8 3.9M8.8 10.5L4.2 9"/></svg>';
  const IC = {
    buy: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    earn: '<svg viewBox="0 0 24 24"><path d="M13 3L5 14h6l-1 7 8-11h-6z"/></svg>',
    out: '<svg viewBox="0 0 24 24"><path d="M12 4v12M7 11l5 5 5-5"/><path d="M5 20h14"/></svg>',
    hist: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 8v5l3 2"/></svg>',
    wal: '<svg viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="12" rx="3"/><path d="M16 13h2M3 10h18"/></svg>',
    pen: '<svg viewBox="0 0 24 24"><path d="M4 20l4-1 11-11-3-3L5 16z"/></svg>'
  };

  function h(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function leftTxt(n) {
    if (window.zA(true, false)) return n === 1 ? 'متبقٍّ لك شرط واحد فقط:' : n === 2 ? 'متبقٍّ لك شرطان فقط:' : 'متبقٍّ لك ' + n + ' شروط:';
    return n + (n === 1 ? ' condition left:' : ' conditions left:');
  }
  function goTo(id) { const e = document.getElementById(id); if (e && e.scrollIntoView) e.scrollIntoView({ behavior: 'smooth', block: 'start' }); }

  async function openWithdrawWallet(sb) {
    if (!document.getElementById('zw-css')) {
      const st = h('style'); st.id = 'zw-css'; st.textContent = CSS; document.head.appendChild(st);
    }
    const ov = h('div', 'zw-ov'); ov.dir = window.zA('rtl', 'ltr');
    const wrap = h('div', 'zw-wrap');
    ov.appendChild(wrap);
    document.body.appendChild(ov);

    const S = { pro: false, cfg: null, avail: 0, held: 0, addr: null, hist: [], elig: null, amount: 0, msg: '', busy: false, showAll: false, editAddr: false, showHist: false };

    async function load() {
      const [c, l, a, w] = await Promise.all([
        sb.from('usdt_withdraw_config').select('*').single(),
        sb.rpc('my_coin_balance'),
        sb.from('withdraw_addresses').select('address,set_at').maybeSingle(),
        sb.from('usdt_withdrawals').select('id,diamonds,amount_usdt,status,created_at,tx_hash')
          .order('created_at', { ascending: false }).limit(10)
      ]);
      S.cfg = c.data;
      const bl = (l && l.data) || {};
      S.avail = Number(bl.available) || 0; S.held = Number(bl.held) || 0;
      S.addr = a.data; S.hist = w.data || [];
      try { S.pro = window.ZeloPremium ? await window.ZeloPremium.isPremium(true) : false; } catch (e) { S.pro = false; }
      await checkElig();
    }

    async function checkElig() {
      const r = await sb.rpc('my_withdraw_eligibility', { p_diamonds: S.amount > 0 ? S.amount : null });
      S.elig = r.error ? null : r.data;
    }

    function render() {
      const keepFocus = document.activeElement && document.activeElement.id;
      wrap.textContent = '';
      const top = h('div', 'zw-top');
      const x = h('button', 'zw-x', window.zA('›', '‹')); x.onclick = () => ov.remove();
      top.appendChild(x);
      top.appendChild(h('h2', '', window.zT('محفظتي', 'My wallet')));
      wrap.appendChild(top);
      // مساحة لبانر الإعلان كي لا يغطي الرصيد
      const adGap = h('div', ''); adGap.style.cssText = 'flex-shrink:0;height:max(0px,calc(var(--zelo-ad-h,0px) - 10px));';
      wrap.appendChild(adGap);

      const rate = S.cfg ? S.cfg.diamonds_per_usdt : 200;
      const total = S.avail + S.held;

      // ===== البطاقة الذهبية =====
      const gold = h('div', 'zw-gold');
      gold.appendChild(h('div', 'zw-r1')); gold.appendChild(h('div', 'zw-r2'));
      const ball = h('div', 'zw-ball'); ball.innerHTML = SVG_BALL; gold.appendChild(ball);
      const gt = h('div', 'zw-gtop'); gt.appendChild(h('div', 'zw-brand', 'ZELO WALLET')); gt.appendChild(h('div', 'zw-chip')); gold.appendChild(gt);
      const gb = h('div', 'zw-gbal');
      gb.appendChild(h('small', '', window.zT('رصيدك', 'Your balance')));
      const gn = h('div', 'zw-gnum'); gn.appendChild(h('b', '', total.toLocaleString('en-US'))); gn.appendChild(h('span', '', window.zT('كورة', 'Kora'))); gb.appendChild(gn);
      gb.appendChild(h('div', 'zw-gusd', '≈ $' + (total / rate).toFixed(2)));
      gold.appendChild(gb);
      const gf = h('div', 'zw-gfoot');
      [[S.avail, window.zT('قابل للسحب', 'Available'), 'g'], [S.held, window.zT('قيد التعليق', 'On hold'), '']].forEach(([v, t, c]) => {
        const d = h('div', c); d.appendChild(h('span', '', t)); d.appendChild(h('b', '', Number(v).toLocaleString('en-US'))); gf.appendChild(d);
      });
      gold.appendChild(gf);
      wrap.appendChild(gold);

      // ===== أزرار سريعة =====
      const acts = h('div', 'zw-acts');
      const mk = (cls, svg, label, fn) => { const b = h('button', 'zw-act ' + cls); const i = h('i'); i.innerHTML = svg; b.appendChild(i); b.appendChild(h('span', '', label)); b.onclick = fn; acts.appendChild(b); };
      mk('gold', IC.buy, window.zT('اشترِ', 'Buy'), () => { ov.remove(); if (typeof window.openStorePage === 'function') window.openStorePage(); });
      mk('', IC.earn, window.zT('اربح', 'Earn'), () => { ov.remove(); if (typeof window.openAdsPage === 'function') window.openAdsPage(); });
      mk('', IC.out, window.zT('اسحب', 'Withdraw'), () => goTo('zw-sec-w'));
      mk('', IC.hist, window.zT('السجل', 'History'), () => goTo('zw-sec-h'));
      wrap.appendChild(acts);

      // ===== الاستعداد للسحب =====
      const cl = h('div', 'zw-card');
      if (S.elig && S.elig.checks) {
        const tot = S.elig.checks.length;
        const done = S.elig.checks.filter(c => c.ok).length;
        const miss = S.elig.checks.filter(c => !c.ok);
        const allOk = done === tot;
        const head = h('div', 'zw-rh' + (allOk ? ' all' : ''));
        head.appendChild(h('b', 'zw-h', allOk ? window.zT('جاهز للسحب', 'Ready to withdraw') : done >= tot - 2 ? window.zT('أنت قريب من السحب', 'You are close to withdrawing') : window.zT('شروط السحب', 'Withdrawal conditions')));
        head.appendChild(h('span', '', done + ' / ' + tot));
        cl.appendChild(head);
        const dots = h('div', 'zw-dots' + (allOk ? ' all' : ''));
        for (let i = 0; i < tot; i++) dots.appendChild(h('i', i < done ? 'on' : ''));
        cl.appendChild(dots);
        if (miss.length) {
          cl.appendChild(h('div', 'zw-left', leftTxt(miss.length)));
          const pills = h('div', 'zw-pills');
          miss.forEach(c => {
            const p = h('div', 'zw-pl'); const xs = h('span'); xs.innerHTML = SVG_NO.replace('<svg ', '<svg width="12" height="12" '); p.appendChild(xs.firstChild);
            const tx = h('div'); tx.appendChild(h('b', '', TITLES[c.key] ? window.zT(TITLES[c.key][0], TITLES[c.key][1]) : c.key)); tx.appendChild(h('small', '', c.msg)); p.appendChild(tx);
            pills.appendChild(p);
          });
          cl.appendChild(pills);
        }
        const done2 = S.elig.checks.filter(c => c.ok);
        if (done2.length) {
          const mb = h('button', 'zw-more', (S.showAll ? window.zT('إخفاء الشروط المكتملة', 'Hide completed') : window.zT('عرض الشروط المكتملة (', 'Show completed (') + done2.length + ')') + (S.showAll ? ' ⌃' : ' ⌄'));
          mb.onclick = () => { S.showAll = !S.showAll; render(); };
          cl.appendChild(mb);
          if (S.showAll) done2.forEach(c => {
            const row = h('div', 'zw-chk ok');
            const m = h('span', 'zw-mark'); m.innerHTML = SVG_OK; row.appendChild(m);
            const t = h('div'); t.appendChild(h('div', 'zw-t', TITLES[c.key] ? window.zT(TITLES[c.key][0], TITLES[c.key][1]) : c.key)); t.appendChild(h('small', '', c.msg));
            row.appendChild(t); cl.appendChild(row);
          });
        }
      } else {
        cl.appendChild(h('b', 'zw-h', window.zT('شروط السحب', 'Withdrawal conditions')));
        cl.appendChild(h('div', 'zw-empty', window.zT('تعذّر تحميل الشروط', 'Could not load the conditions')));
      }
      wrap.appendChild(cl);

      // ===== السحب: العنوان + الطلب =====
      const wc = h('div', 'zw-card'); wc.id = 'zw-sec-w';
      const sh = h('div', 'zw-sh'); sh.appendChild(h('b', 'zw-h', window.zT('السحب', 'Withdraw'))); sh.appendChild(h('span', 'zw-bep', 'BEP20')); wc.appendChild(sh);
      const editing = !S.addr || S.editAddr;
      if (!editing) {
        const a = S.addr.address;
        const row = h('div', 'zw-adr');
        const ai = h('div', 'zw-ai'); ai.innerHTML = IC.wal; row.appendChild(ai);
        const at = h('div', 'zw-at'); at.appendChild(h('small', '', window.zT('عنوان المحفظة', 'Wallet address'))); at.appendChild(h('code', '', a.slice(0, 6) + '…' + a.slice(-4))); row.appendChild(at);
        const ed = h('button', 'zw-ed'); ed.innerHTML = IC.pen; ed.setAttribute('aria-label', 'edit'); ed.onclick = () => { S.editAddr = true; render(); };
        row.appendChild(ed); wc.appendChild(row);
        wc.appendChild(h('div', 'zw-tiny', window.zT('أرسل إلى شبكة BNB Smart Chain (BEP20) فقط. تغيير العنوان يؤجّل السحب 48 ساعة.', 'BNB Smart Chain (BEP20) only. Changing the address delays withdrawal by 48 hours.')));
      } else {
        wc.appendChild(h('div', 'zw-warn', window.zT('أرسل إلى عنوان BNB Smart Chain (BEP20) فقط. أي شبكة أخرى تضيّع المبلغ. تغيير العنوان يؤجّل السحب 48 ساعة.', 'Send to a BNB Smart Chain (BEP20) address only. Any other network loses the funds. Changing the address delays withdrawal by 48 hours.')));
        wc.appendChild(h('label', 'zw-lbl', window.zT('عنوان المحفظة', 'Wallet address')));
        const ai = h('input', 'zw-in'); ai.id = 'zw-addr'; ai.placeholder = '0x...';
        ai.value = S.addr ? S.addr.address : '';
        wc.appendChild(ai);
        const sv = h('button', 'zw-btn sec', window.zT('حفظ العنوان', 'Save address'));
        sv.onclick = async () => {
          const v = ai.value.trim();
          if (!/^0x[a-fA-F0-9]{40}$/.test(v)) { S.msg = window.zT('العنوان غير صالح: يبدأ بـ 0x ويتكوّن من 42 حرفاً', 'Invalid address: it starts with 0x and has 42 characters'); return render(); }
          const r = await sb.rpc('set_withdraw_address', { p_address: v });
          const bad = r.error || r.data.status !== 'ok';
          S.msg = bad ? window.zT('تعذّر حفظ العنوان', 'Could not save the address') : window.zT('تم حفظ العنوان', 'Address saved');
          if (!bad) S.editAddr = false;
          await load(); render();
        };
        wc.appendChild(sv);
      }
      const line = h('div', 'zw-line');
      const ni = h('input', 'zw-in'); ni.id = 'zw-amt'; ni.type = 'number'; ni.inputMode = 'numeric';
      ni.placeholder = window.zT('عدد الكورة', 'Kora amount'); ni.value = S.amount > 0 ? S.amount : '';
      ni.oninput = () => {
        S.amount = Math.floor(Number(ni.value)) || 0;
        const e = document.getElementById('zw-est');
        if (e) { e.textContent = window.zT('ستستلم: ', 'You will receive: ') + (S.amount / rate).toFixed(2) + ' USDT'; e.style.display = S.amount > 0 ? '' : 'none'; }
        const g = document.getElementById('zw-go');
        if (g) g.disabled = S.busy || S.amount <= 0;
      };
      const all = h('button', 'zw-btn sec', window.zT('الكل', 'All'));
      all.onclick = async () => { S.amount = S.avail; await checkElig(); render(); };
      line.appendChild(ni); line.appendChild(all); wc.appendChild(line);
      const est = h('div', 'zw-est', window.zT('ستستلم: ', 'You will receive: ') + (S.amount / rate).toFixed(2) + ' USDT'); est.id = 'zw-est'; if (S.amount <= 0) est.style.display = 'none'; wc.appendChild(est);
      const go = h('button', 'zw-btn', window.zT('اطلب السحب', 'Request withdrawal'));
      go.id = 'zw-go'; go.disabled = S.busy || S.amount <= 0;
      go.onclick = async () => {
        if (!S.pro) {
          S.msg = window.zT('وثّق حسابك بالاشتراك لتتمكن من السحب', 'Verify your account by subscribing to be able to withdraw');
          render();
          ov.remove();
          if (window.openSubscriptions) window.openSubscriptions();
          return;
        }
        if (!S.addr) { S.msg = window.zT('احفظ عنوان المحفظة أولاً', 'Save your wallet address first'); render(); return; }
        await checkElig();
        if (!S.elig || S.elig.decision === 'rejected') { S.msg = S.elig && S.elig.reasons ? S.elig.reasons.join(' • ') : window.zT('الشروط غير مكتملة', 'Conditions not met'); render(); return; }
        if (!confirm(window.zT('سحب ' + S.amount + ' كورة (' + (S.amount / rate).toFixed(2) + ' USDT) إلى:\n' + S.addr.address + '\nشبكة BEP20', 'Withdraw ' + S.amount + ' Kora (' + (S.amount / rate).toFixed(2) + ' USDT) to:\n' + S.addr.address + '\nBEP20 network'))) return;
        S.busy = true; render();
        const r = await sb.rpc('request_usdt_withdrawal', { p_diamonds: S.amount });
        S.busy = false;
        if (r.error) S.msg = window.zT('حدث خطأ، حاول مجدداً', 'An error occurred, try again');
        else if (r.data.status === 'rejected') S.msg = (r.data.reasons || []).join(' • ');
        else if (r.data.status === 'review') S.msg = window.zT('استلمنا طلبك وسيُراجَع يدوياً', 'We received your request and it will be reviewed manually');
        else if (r.data.status === 'pending') S.msg = window.zT('تمت الموافقة، سيُرسل المبلغ قريباً', 'Approved, the amount will be sent soon');
        S.amount = 0; await load(); render();
      };
      wc.appendChild(go);
      if (S.msg) wc.appendChild(h('div', 'zw-msg', S.msg));
      wrap.appendChild(wc);

      // ===== السجل =====
      const hc = h('div', 'zw-card'); hc.id = 'zw-sec-h';
      hc.appendChild(h('b', 'zw-h', window.zT('آخر الطلبات', 'Latest requests')));
      if (!S.hist.length) hc.appendChild(h('div', 'zw-empty', window.zT('لا توجد طلبات بعد', 'No requests yet')));
      else {
        const list = S.showHist ? S.hist : S.hist.slice(0, 3);
        list.forEach(w => {
          const row = h('div', 'zw-h-row');
          row.appendChild(h('b', '', 'USDT ' + Number(w.amount_usdt).toFixed(2)));
          row.appendChild(h('span', 'zw-pill ' + w.status, (STATUS[w.status] ? window.zT(STATUS[w.status][0], STATUS[w.status][1]) : w.status)));
          hc.appendChild(row);
        });
        if (S.hist.length > 3) {
          const mb = h('button', 'zw-more', S.showHist ? window.zT('إخفاء', 'Show less') + ' ⌃' : window.zT('عرض الكل', 'Show all') + ' ⌄');
          mb.onclick = () => { S.showHist = !S.showHist; render(); };
          hc.appendChild(mb);
        }
      }
      wrap.appendChild(hc);
      if (keepFocus) { const f = document.getElementById(keepFocus); if (f) f.focus(); }
    }

    wrap.appendChild(h('p', '', window.zT('جارٍ التحميل...', 'Loading...')));
    await load();
    render();
  }

  window.openWithdrawWallet = openWithdrawWallet;
})();
