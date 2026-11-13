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
  .zw-ov{position:fixed;inset:0;z-index:9999;background:#0a1033;color:#f8fafc;overflow:auto;font-family:system-ui,-apple-system,"Segoe UI",Tahoma,sans-serif}
  .zw-wrap{max-width:520px;margin:0 auto;padding:16px 16px 40px}
  .zw-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
  .zw-top h2{margin:0;font-size:20px;color:#f5c35a}
  .zw-x{background:rgba(44,75,181,.2);border:1px solid rgba(245,195,90,.35);color:#f5c35a;width:40px;height:40px;border-radius:12px;font-size:20px;line-height:1;padding:0;cursor:pointer;display:inline-flex;align-items:center;justify-content:center}
  .zw-card{box-shadow:0 0 12px rgba(245,195,90,0.08);background:rgba(17,26,74,0.85);border:1px solid rgba(245,195,90,0.22);border-radius:14px;padding:14px;margin-bottom:12px}
  .zw-bal{display:flex;gap:12px}
  .zw-bal div{flex:1;text-align:center}
  .zw-bal b{display:block;font-size:24px;color:#f5c35a}
  .zw-bal span{font-size:12px;color:#9aa6d6}
  .zw-h{font-size:14px;color:#9aa6d6;margin:0 0 10px}
  .zw-row{display:flex;gap:10px;padding:8px 0;border-top:1px solid rgba(255,255,255,0.08)}
  .zw-row:first-of-type{border-top:0}
  .zw-ic{width:22px;flex:none}
  .zw-row small{display:block;color:#9aa6d6;margin-top:2px}
  .zw-in{width:100%;box-sizing:border-box;background:#0a1033;border:1px solid rgba(245,195,90,0.35);border-radius:10px;color:#f8fafc;padding:11px;font-size:15px;direction:ltr;text-align:left}
  .zw-btn{width:100%;border:0;border-radius:10px;padding:12px;font-size:15px;font-weight:600;cursor:pointer;background:linear-gradient(135deg,#2c4bb5,#f5c35a);color:#0a1033;margin-top:10px}
  .zw-btn[disabled]{opacity:.4;cursor:not-allowed}
  .zw-btn.sec{background:rgba(44,75,181,0.3);color:#f5c35a;border:1px solid rgba(245,195,90,0.4)}
  .zw-warn{background:rgba(245,195,90,0.12);color:#f5c35a;border-radius:10px;padding:10px;font-size:13px;margin-bottom:10px}
  .zw-msg{margin-top:10px;font-size:14px}
  .zw-h-row{display:flex;justify-content:space-between;padding:7px 0;border-top:1px solid rgba(255,255,255,0.08);font-size:14px}
  .zw-line{display:flex;gap:8px;align-items:center}
  .zw-line .zw-in{flex:1}
  .zw-line button{width:auto;margin:0;padding:11px 14px}
  .zw-bal{align-items:stretch}
  .zw-bal div{background:rgba(44,75,181,0.16);border:1px solid rgba(245,195,90,0.18);border-radius:12px;padding:12px 6px}
  .zw-bal div:first-child{background:linear-gradient(135deg,rgba(245,195,90,0.22),rgba(44,75,181,0.2));border-color:rgba(245,195,90,0.5)}
  .zw-bal b{font-size:22px;direction:ltr}
  .zw-hero{background:linear-gradient(160deg,rgba(44,75,181,.28),rgba(17,26,74,.9));border-color:rgba(245,195,90,.45)}
  .zw-id{display:flex;align-items:center;gap:12px}
  .zw-av{width:52px;height:52px;border-radius:50%;border:2px solid #f5c35a;background:#14206b;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:20px;color:#fff;overflow:hidden;flex:none}
  .zw-av img{width:100%;height:100%;object-fit:cover}
  .zw-who{flex:1;min-width:0}
  .zw-who b{display:block;font-size:15px;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .zw-who small{color:#9aa6d6;font-size:12px;direction:ltr;unicode-bidi:plaintext}
  .zw-rk{text-align:center;flex:none}
  .zw-rk small{display:block;color:#9aa6d6;font-size:11px}
  .zw-rk b{color:#fff;font-size:16px}
  .zw-big{text-align:center;margin:14px 0 4px}
  .zw-big small{color:#9aa6d6;font-size:12px;display:block}
  .zw-bn{color:#f5c35a;line-height:1.2}
  .zw-bn b{font-size:36px;font-variant-numeric:tabular-nums}
  .zw-bn span{font-size:16px;font-weight:700}
  .zw-two{display:flex;gap:8px;margin-top:10px}
  .zw-two div{flex:1;text-align:center;background:rgba(10,16,51,.55);border-radius:10px;padding:8px 4px}
  .zw-two b{display:block;font-size:16px;color:#fff}
  .zw-two span{font-size:11px;color:#9aa6d6}
  .zw-prog{margin-top:12px}
  .zw-prow{display:flex;justify-content:space-between;color:#9aa6d6;font-size:11px;margin-bottom:4px}
  .zw-quick{display:flex;gap:8px;margin-bottom:12px}
  .zw-q{flex:1;border:1px solid rgba(245,195,90,.35);background:rgba(44,75,181,.22);color:#f5c35a;border-radius:12px;padding:11px;font-size:14px;font-weight:800;cursor:pointer;font-family:inherit}
  .zw-sum{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
  .zw-sum .zw-h{margin:0}
  .zw-cnt{direction:ltr;font-size:12px;font-weight:800;padding:3px 10px;border-radius:20px;background:rgba(255,255,255,0.08);color:#cbd5e1}
  .zw-cnt.all{background:rgba(20,241,149,0.15);color:#14F195}
  .zw-bar{height:6px;border-radius:4px;background:rgba(255,255,255,0.1);overflow:hidden;margin-bottom:12px}
  .zw-bar i{display:block;height:100%;border-radius:4px;background:linear-gradient(90deg,#2c4bb5,#14F195)}
  .zw-chk{display:flex;align-items:center;gap:12px;padding:10px 12px;margin-bottom:8px;border-radius:12px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08)}
  .zw-chk.ok{border-color:rgba(20,241,149,0.35);background:rgba(20,241,149,0.06)}
  .zw-chk.no{border-color:rgba(255,77,77,0.35);background:rgba(255,77,77,0.06)}
  .zw-mark{flex:none;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center}
  .zw-mark svg{width:16px;height:16px;fill:none;stroke:#fff;stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round}
  .zw-chk.ok .zw-mark{background:#14c27a}
  .zw-chk.no .zw-mark{background:#e5484d}
  .zw-chk .zw-t{font-weight:800;font-size:14px}
  .zw-chk small{display:block;color:#9aa6d6;margin-top:2px;font-size:12px;line-height:1.5}
  .zw-lbl{display:block;font-size:12px;color:#9aa6d6;margin:0 0 6px;font-weight:700}
  .zw-est{margin-top:10px;padding:10px 12px;border-radius:10px;background:rgba(245,195,90,0.1);color:#f5c35a;font-weight:800;font-size:14px;text-align:center}
  .zw-h-row{align-items:center;padding:10px 0}
  .zw-pill{font-size:12px;font-weight:800;padding:3px 10px;border-radius:20px;background:rgba(255,255,255,0.08)}
  .zw-pill.sent{background:rgba(20,241,149,0.15);color:#14F195}
  .zw-pill.failed,.zw-pill.rejected{background:rgba(255,77,77,0.15);color:#ff6b6b}
  .zw-pill.pending,.zw-pill.review{background:rgba(245,195,90,0.15);color:#f5c35a}
  `;

  const SVG_OK = '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  const SVG_NO = '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  function h(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  async function openWithdrawWallet(sb) {
    if (!document.getElementById('zw-css')) {
      const st = h('style'); st.id = 'zw-css'; st.textContent = CSS; document.head.appendChild(st);
    }
    const ov = h('div', 'zw-ov'); ov.dir = window.zA('rtl', 'ltr');
    const wrap = h('div', 'zw-wrap');
    ov.appendChild(wrap);
    document.body.appendChild(ov);

    const S = { pro: false, cfg: null, avail: 0, held: 0, addr: null, hist: [], elig: null, amount: 0, msg: '', busy: false };
    let timer = null;

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
      top.appendChild(h('h2', '', window.zT('محفظتي', 'My wallet')));
      const x = h('button', 'zw-x', window.zA('›', '‹')); x.onclick = () => ov.remove();
      top.insertBefore(x, top.firstChild); wrap.appendChild(top);
      // مساحة لبانر الإعلان كي لا يغطي الرصيد
      const adGap = h('div', ''); adGap.style.cssText = 'flex-shrink:0;height:max(0px,calc(var(--zelo-ad-h,0px) - 10px));';
      wrap.appendChild(adGap);

      // الرصيد
      const rate = S.cfg ? S.cfg.diamonds_per_usdt : 200;
      const minW = S.cfg ? S.cfg.min_diamonds : 1000;
      const us = window.userState || {};
      const ar0 = window.zA(true, false);
      const nm = (ar0 ? (us.nickname_ar || us.nickname_en) : (us.nickname_en || us.nickname_ar)) || us.username || '';
      const total = S.avail + S.held;

      const hero = h('div', 'zw-card zw-hero');
      const idr = h('div', 'zw-id');
      const av = h('div', 'zw-av');
      if (us.photoUrl && /^(https?:\/\/|data:image\/)/.test(us.photoUrl)) {
        const im = document.createElement('img'); im.src = us.photoUrl; im.alt = ''; av.appendChild(im);
      } else { av.textContent = (nm || '?').trim().charAt(0).toUpperCase(); }
      idr.appendChild(av);
      const who = h('div', 'zw-who'); who.appendChild(h('b', '', nm || '—'));
      if (us.username) who.appendChild(h('small', '', '@' + us.username));
      idr.appendChild(who);
      const rk = (document.getElementById('rank-num') || {}).textContent || '';
      if (/\d/.test(rk)) { const rc2 = h('div', 'zw-rk'); rc2.appendChild(h('small', '', window.zT('الترتيب', 'Rank'))); rc2.appendChild(h('b', '', rk)); idr.appendChild(rc2); }
      hero.appendChild(idr);

      const big = h('div', 'zw-big');
      big.appendChild(h('small', '', window.zT('رصيدك', 'Your balance')));
      const bn = h('div', 'zw-bn'); bn.appendChild(h('b', '', total.toLocaleString('en-US'))); bn.appendChild(h('span', '', window.zT(' كورة', ' Kora'))); big.appendChild(bn);
      big.appendChild(h('small', '', window.zT('يعادل ', 'Equals ') + (total / rate).toFixed(2) + '$'));
      hero.appendChild(big);

      const two = h('div', 'zw-two');
      [[S.avail, window.zT('قابل للسحب الآن', 'Available to withdraw now')], [S.held, window.zT('قيد التعليق', 'On hold')]].forEach(([v, t]) => {
        const d = h('div'); d.appendChild(h('b', '', Number(v).toLocaleString('en-US'))); d.appendChild(h('span', '', t)); two.appendChild(d);
      });
      hero.appendChild(two);

      const pct = Math.min(100, Math.round(total / minW * 100));
      const pr = h('div', 'zw-prog');
      const pt = h('div', 'zw-prow'); pt.appendChild(h('span', '', window.zT('الحد الأدنى للسحب: ', 'Minimum withdrawal: ') + minW.toLocaleString('en-US'))); pt.appendChild(h('span', '', pct + '%')); pr.appendChild(pt);
      const pb = h('div', 'zw-bar'); const pf = h('i'); pf.style.width = pct + '%'; pb.appendChild(pf); pr.appendChild(pb);
      hero.appendChild(pr);
      wrap.appendChild(hero);

      const quick = h('div', 'zw-quick');
      const bq = h('button', 'zw-q', window.zT('اشترِ كورة', 'Buy Kora'));
      bq.onclick = () => { ov.remove(); if (typeof window.openStorePage === 'function') window.openStorePage(); };
      const be = h('button', 'zw-q', window.zT('اربح كورة', 'Earn Kora'));
      be.onclick = () => { ov.remove(); if (typeof window.openAdsPage === 'function') window.openAdsPage(); };
      quick.appendChild(bq); quick.appendChild(be);
      wrap.appendChild(quick);

      // الشروط
      const cl = h('div', 'zw-card');
      const sum = h('div', 'zw-sum');
      sum.appendChild(h('p', 'zw-h', window.zT('شروط السحب', 'Withdrawal conditions')));
      if (S.elig) {
        const total = S.elig.checks.length;
        const done = S.elig.checks.filter(c => c.ok).length;
        sum.appendChild(h('span', 'zw-cnt' + (done === total ? ' all' : ''), done + ' / ' + total));
        cl.appendChild(sum);
        const bar = h('div', 'zw-bar'); const fill = h('i');
        fill.style.width = (total ? Math.round(done / total * 100) : 0) + '%';
        bar.appendChild(fill); cl.appendChild(bar);
        S.elig.checks.forEach(c => {
          const row = h('div', 'zw-chk ' + (c.ok ? 'ok' : 'no'));
          const mk = h('span', 'zw-mark'); mk.innerHTML = c.ok ? SVG_OK : SVG_NO;
          row.appendChild(mk);
          const t = h('div'); t.appendChild(h('div', 'zw-t', (TITLES[c.key] ? window.zT(TITLES[c.key][0], TITLES[c.key][1]) : c.key))); t.appendChild(h('small', '', c.msg));
          row.appendChild(t); cl.appendChild(row);
        });
      } else { cl.appendChild(sum); cl.appendChild(h('small', '', window.zT('تعذّر تحميل الشروط', 'Could not load the conditions'))); }
      wrap.appendChild(cl);

      // العنوان
      const ac = h('div', 'zw-card');
      ac.appendChild(h('p', 'zw-h', window.zT('عنوان محفظتك (شبكة BEP20 فقط)', 'Your wallet address (BEP20 network only)')));
      ac.appendChild(h('div', 'zw-warn', window.zT('أرسل إلى عنوان BNB Smart Chain (BEP20) فقط. أي شبكة أخرى تضيّع المبلغ. تغيير العنوان يؤجّل السحب 48 ساعة.', 'Send to a BNB Smart Chain (BEP20) address only. Any other network loses the funds. Changing the address delays withdrawal by 48 hours.')));
      ac.appendChild(h('label', 'zw-lbl', window.zT('عنوان المحفظة', 'Wallet address')));
      const ai = h('input', 'zw-in'); ai.id = 'zw-addr'; ai.placeholder = '0x...';
      ai.value = S.addr ? S.addr.address : '';
      ac.appendChild(ai);
      const sv = h('button', 'zw-btn sec', window.zT('حفظ العنوان', 'Save address'));
      sv.onclick = async () => {
        const v = ai.value.trim();
        if (!/^0x[a-fA-F0-9]{40}$/.test(v)) { S.msg = window.zT('العنوان غير صالح: يبدأ بـ 0x ويتكوّن من 42 حرفاً', 'Invalid address: it starts with 0x and has 42 characters'); return render(); }
        const r = await sb.rpc('set_withdraw_address', { p_address: v });
        S.msg = r.error || r.data.status !== 'ok' ? window.zT('تعذّر حفظ العنوان', 'Could not save the address') : window.zT('تم حفظ العنوان', 'Address saved');
        await load(); render();
      };
      ac.appendChild(sv); wrap.appendChild(ac);

      // الطلب
      const rc = h('div', 'zw-card');
      rc.appendChild(h('p', 'zw-h', window.zT('طلب سحب', 'Withdrawal request')));
      rc.appendChild(h('label', 'zw-lbl', window.zT('عدد الكورة المراد سحبه', 'Amount of Kora to withdraw')));
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
      line.appendChild(ni); line.appendChild(all); rc.appendChild(line);
      const est = h('div', 'zw-est', window.zT('ستستلم: ', 'You will receive: ') + (S.amount / rate).toFixed(2) + ' USDT'); est.id = 'zw-est'; if (S.amount <= 0) est.style.display = 'none'; rc.appendChild(est);
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
      rc.appendChild(go);
      if (S.msg) rc.appendChild(h('div', 'zw-msg', S.msg));
      wrap.appendChild(rc);

      // السجل
      if (S.hist.length) {
        const hc = h('div', 'zw-card');
        hc.appendChild(h('p', 'zw-h', window.zT('آخر الطلبات', 'Latest requests')));
        S.hist.forEach(w => {
          const row = h('div', 'zw-h-row');
          row.appendChild(h('span', '', Number(w.amount_usdt).toFixed(2) + ' USDT'));
          row.appendChild(h('span', 'zw-pill ' + w.status, (STATUS[w.status] ? window.zT(STATUS[w.status][0], STATUS[w.status][1]) : w.status)));
          hc.appendChild(row);
        });
        wrap.appendChild(hc);
      }
      if (keepFocus) { const f = document.getElementById(keepFocus); if (f) f.focus(); }
    }

    wrap.appendChild(h('p', '', window.zT('جارٍ التحميل...', 'Loading...')));
    await load();
    render();
  }

  window.openWithdrawWallet = openWithdrawWallet;
})();
