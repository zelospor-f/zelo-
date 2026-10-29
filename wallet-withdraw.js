// wallet-withdraw.js — صفحة "محفظتي": رصيد الألماس + شروط السحب + طلب سحب USDT (BEP20)
// الاستخدام: أضف الملف إلى الصفحة ثم استدعِ openWithdrawWallet(supabaseClient) من زر المحفظة.
(function () {
  const TITLES = {
    verified: 'توثيق الحساب', account_age: 'عمر الحساب', invites: 'الدعوات الناجحة',
    min_balance: 'الحد الأدنى للسحب', hold: 'فترة التعليق', amount: 'المبلغ المطلوب',
    address: 'عنوان السحب', identity: 'تأكيد الهوية', no_open_request: 'الطلبات المعلّقة',
    no_fraud: 'المراجعة الأمنية'
  };
  const STATUS = {
    pending: 'قيد الإرسال', review: 'قيد المراجعة', sent: 'تم الإرسال',
    failed: 'فشل', rejected: 'مرفوض'
  };
  const CSS = `
  .zw-ov{position:fixed;inset:0;z-index:9999;background:#0b0f17;color:#e8ecf3;overflow:auto;direction:rtl;font-family:system-ui,-apple-system,"Segoe UI",Tahoma,sans-serif}
  .zw-wrap{max-width:520px;margin:0 auto;padding:16px 16px 40px}
  .zw-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
  .zw-top h2{margin:0;font-size:20px}
  .zw-x{background:#1a2230;border:0;color:#e8ecf3;width:36px;height:36px;border-radius:10px;font-size:18px;cursor:pointer}
  .zw-card{background:#131a26;border:1px solid #1f2a3b;border-radius:14px;padding:14px;margin-bottom:12px}
  .zw-bal{display:flex;gap:12px}
  .zw-bal div{flex:1;text-align:center}
  .zw-bal b{display:block;font-size:24px}
  .zw-bal span{font-size:12px;color:#8fa0b8}
  .zw-h{font-size:14px;color:#8fa0b8;margin:0 0 10px}
  .zw-row{display:flex;gap:10px;padding:8px 0;border-top:1px solid #1b2535}
  .zw-row:first-of-type{border-top:0}
  .zw-ic{width:22px;flex:none}
  .zw-row small{display:block;color:#8fa0b8;margin-top:2px}
  .zw-in{width:100%;box-sizing:border-box;background:#0b0f17;border:1px solid #2a384f;border-radius:10px;color:#e8ecf3;padding:11px;font-size:15px;direction:ltr;text-align:left}
  .zw-btn{width:100%;border:0;border-radius:10px;padding:12px;font-size:15px;font-weight:600;cursor:pointer;background:#2f7cf6;color:#fff;margin-top:10px}
  .zw-btn[disabled]{opacity:.4;cursor:not-allowed}
  .zw-btn.sec{background:#1f2a3b}
  .zw-warn{background:#3a2a10;color:#ffd48a;border-radius:10px;padding:10px;font-size:13px;margin-bottom:10px}
  .zw-msg{margin-top:10px;font-size:14px}
  .zw-h-row{display:flex;justify-content:space-between;padding:7px 0;border-top:1px solid #1b2535;font-size:14px}
  .zw-line{display:flex;gap:8px;align-items:center}
  .zw-line .zw-in{flex:1}
  .zw-line button{width:auto;margin:0;padding:11px 14px}
  `;

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
    const ov = h('div', 'zw-ov');
    const wrap = h('div', 'zw-wrap');
    ov.appendChild(wrap);
    document.body.appendChild(ov);

    const S = { cfg: null, avail: 0, held: 0, addr: null, hist: [], elig: null, amount: 0, msg: '', busy: false };
    let timer = null;

    async function load() {
      const [c, l, a, w] = await Promise.all([
        sb.from('usdt_withdraw_config').select('*').single(),
        sb.from('diamond_ledger').select('delta,available_at'),
        sb.from('withdraw_addresses').select('address,set_at').maybeSingle(),
        sb.from('usdt_withdrawals').select('id,diamonds,amount_usdt,status,created_at,tx_hash')
          .order('created_at', { ascending: false }).limit(10)
      ]);
      S.cfg = c.data;
      const now = Date.now();
      S.avail = 0; S.held = 0;
      (l.data || []).forEach(r => {
        if (new Date(r.available_at).getTime() <= now) S.avail += r.delta; else S.held += r.delta;
      });
      S.addr = a.data; S.hist = w.data || [];
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
      top.appendChild(h('h2', '', 'محفظتي'));
      const x = h('button', 'zw-x', '✕'); x.onclick = () => ov.remove();
      top.appendChild(x); wrap.appendChild(top);

      // الرصيد
      const bal = h('div', 'zw-card zw-bal');
      const rate = S.cfg ? S.cfg.diamonds_per_usdt : 100;
      [[S.avail, 'قابل للسحب'], [S.held, 'قيد التعليق'],
       [(S.avail / rate).toFixed(2) + '$', 'يعادل']].forEach(([v, t]) => {
        const d = h('div'); d.appendChild(h('b', '', String(v))); d.appendChild(h('span', '', t)); bal.appendChild(d);
      });
      wrap.appendChild(bal);

      // الشروط
      const cl = h('div', 'zw-card');
      cl.appendChild(h('p', 'zw-h', 'شروط السحب'));
      if (S.elig) {
        S.elig.checks.forEach(c => {
          const row = h('div', 'zw-row');
          row.appendChild(h('span', 'zw-ic', c.ok ? '✅' : '❌'));
          const t = h('div'); t.appendChild(h('div', '', TITLES[c.key] || c.key)); t.appendChild(h('small', '', c.msg));
          row.appendChild(t); cl.appendChild(row);
        });
      } else cl.appendChild(h('small', '', 'تعذّر تحميل الشروط'));
      wrap.appendChild(cl);

      // العنوان
      const ac = h('div', 'zw-card');
      ac.appendChild(h('p', 'zw-h', 'عنوان محفظتك (شبكة BEP20 فقط)'));
      ac.appendChild(h('div', 'zw-warn', 'أرسل إلى عنوان BNB Smart Chain (BEP20) فقط. أي شبكة أخرى تضيّع المبلغ. تغيير العنوان يؤجّل السحب 48 ساعة.'));
      const ai = h('input', 'zw-in'); ai.id = 'zw-addr'; ai.placeholder = '0x...';
      ai.value = S.addr ? S.addr.address : '';
      ac.appendChild(ai);
      const sv = h('button', 'zw-btn sec', 'حفظ العنوان');
      sv.onclick = async () => {
        const v = ai.value.trim();
        if (!/^0x[a-fA-F0-9]{40}$/.test(v)) { S.msg = 'العنوان غير صالح: يبدأ بـ 0x ويتكوّن من 42 حرفاً'; return render(); }
        const r = await sb.rpc('set_withdraw_address', { p_address: v });
        S.msg = r.error || r.data.status !== 'ok' ? 'تعذّر حفظ العنوان' : 'تم حفظ العنوان';
        await load(); render();
      };
      ac.appendChild(sv); wrap.appendChild(ac);

      // الطلب
      const rc = h('div', 'zw-card');
      rc.appendChild(h('p', 'zw-h', 'طلب سحب'));
      const line = h('div', 'zw-line');
      const ni = h('input', 'zw-in'); ni.id = 'zw-amt'; ni.type = 'number'; ni.inputMode = 'numeric';
      ni.placeholder = 'عدد الألماس'; ni.value = S.amount > 0 ? S.amount : '';
      ni.oninput = () => {
        S.amount = Math.floor(Number(ni.value)) || 0;
        clearTimeout(timer);
        timer = setTimeout(async () => { await checkElig(); render(); }, 400);
      };
      const all = h('button', 'zw-btn sec', 'الكل');
      all.onclick = async () => { S.amount = S.avail; await checkElig(); render(); };
      line.appendChild(ni); line.appendChild(all); rc.appendChild(line);
      if (S.amount > 0) rc.appendChild(h('small', '', 'ستستلم: ' + (S.amount / rate).toFixed(2) + ' USDT'));
      const go = h('button', 'zw-btn', 'اطلب السحب');
      go.disabled = S.busy || !S.elig || S.elig.decision === 'rejected' || S.amount <= 0;
      go.onclick = async () => {
        if (!confirm('سحب ' + S.amount + ' ألماسة (' + (S.amount / rate).toFixed(2) + ' USDT) إلى:\n' + S.addr.address + '\nشبكة BEP20')) return;
        S.busy = true; render();
        const r = await sb.rpc('request_usdt_withdrawal', { p_diamonds: S.amount });
        S.busy = false;
        if (r.error) S.msg = 'حدث خطأ، حاول مجدداً';
        else if (r.data.status === 'rejected') S.msg = (r.data.reasons || []).join(' • ');
        else if (r.data.status === 'review') S.msg = 'استلمنا طلبك وسيُراجَع يدوياً';
        else if (r.data.status === 'pending') S.msg = 'تمت الموافقة، سيُرسل المبلغ قريباً';
        S.amount = 0; await load(); render();
      };
      rc.appendChild(go);
      if (S.msg) rc.appendChild(h('div', 'zw-msg', S.msg));
      wrap.appendChild(rc);

      // السجل
      if (S.hist.length) {
        const hc = h('div', 'zw-card');
        hc.appendChild(h('p', 'zw-h', 'آخر الطلبات'));
        S.hist.forEach(w => {
          const row = h('div', 'zw-h-row');
          row.appendChild(h('span', '', Number(w.amount_usdt).toFixed(2) + ' USDT'));
          row.appendChild(h('span', '', STATUS[w.status] || w.status));
          hc.appendChild(row);
        });
        wrap.appendChild(hc);
      }
      if (keepFocus) { const f = document.getElementById(keepFocus); if (f) f.focus(); }
    }

    wrap.appendChild(h('p', '', 'جارٍ التحميل...'));
    await load();
    render();
  }

  window.openWithdrawWallet = openWithdrawWallet;
})();
