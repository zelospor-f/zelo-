/* ============================================================
 * تعديل premium.js للدفع بعملة SOL
 * 1) احذف الدالة القديمة  async function subscribe(planId, btn) { ... }  بالكامل
 *    والصق بدلها كل ما في هذا الملف (من "الدفع بعملة SOL" حتى النهاية).
 * 2) غيّر ملاحظة الدفع داخل openSubscriptions (zp-note) كما في آخر الملف.
 * ============================================================ */

/* ---------- الدفع بعملة SOL ---------- */
let payTimer = null;

function stopPolling() {
    if (payTimer) { clearInterval(payTimer); payTimer = null; }
}

// يسأل السيرفر هل وصلت الدفعة. يرجع true عند التفعيل
async function checkOrder(orderId) {
    const c = db();
    if (!c) return false;
    try {
        const { data } = await c.functions.invoke('sol-verify', { body: { order_id: orderId } });
        return !!(data && data.ok);
    } catch (e) {
        return false;   // 400 أو لم تصل بعد: نعيد المحاولة
    }
}

async function onPaid() {
    stopPolling();
    await isPremium(true);
    closeSubscriptions();
    mountPromo();
    toast(isAr() ? '✅ تم تفعيل اشتراكك' : '✅ Subscription activated');
}

function showPayBox(order) {
    const ar = isAr();
    const wrap = document.getElementById('zp-overlay');
    if (!wrap) return;
    const old = document.getElementById('zp-paybox');
    if (old) old.remove();

    const box = document.createElement('div');
    box.id = 'zp-paybox';
    box.style.cssText = 'position:absolute;inset:0;z-index:2;background:' + C.bg +
        ';padding:14px;display:flex;flex-direction:column;gap:10px;overflow:auto';
    box.innerHTML = `
        <button class="zp-close" id="zp-pay-back" aria-label="back">✕</button>
        <h2 style="color:#fff;margin:4px 0 0">${ar ? 'الدفع بعملة SOL' : 'Pay with SOL'}</h2>
        <div style="color:${C.gold};font-size:1.6rem;font-weight:900">${order.amount_sol} SOL</div>
        <div style="color:${C.muted};font-size:.75rem">
            ${ar ? 'السعر مثبّت لهذا الطلب لمدة ساعة.' : 'Price is locked for this order for one hour.'}
        </div>
        <button class="zp-btn main" id="zp-open-wallet">${ar ? 'افتح محفظتي للدفع' : 'Open my wallet to pay'}</button>
        <div style="color:${C.muted};font-size:.75rem">${ar ? 'أو حوّل المبلغ يدوياً إلى هذا العنوان:' : 'Or send manually to this address:'}</div>
        <div id="zp-addr" style="color:#fff;font-size:.72rem;word-break:break-all;padding:10px;border-radius:10px;
             background:${C.card};border:1px solid ${C.line}">${order.treasury}</div>
        <button class="zp-btn ghost" id="zp-copy-addr">${ar ? 'نسخ العنوان' : 'Copy address'}</button>
        <div id="zp-pay-status" style="color:${C.muted};font-size:.8rem;margin-top:4px">
            ${ar ? '⏳ بانتظار وصول الدفعة…' : '⏳ Waiting for payment…'}
        </div>
        <button class="zp-btn ghost" id="zp-check-now">${ar ? 'دفعتُ، تحقق الآن' : "I've paid, check now"}</button>
        <div class="zp-note">${ar
            ? 'بعد تأكيد الشبكة (عادة أقل من دقيقة) يُفعَّل الاشتراك تلقائياً. أرسل المبلغ المطلوب كاملاً.'
            : 'Once the network confirms (usually under a minute) your subscription activates automatically. Send the full amount.'}</div>`;
    wrap.appendChild(box);

    const status = box.querySelector('#zp-pay-status');
    box.querySelector('#zp-pay-back').onclick = () => { stopPolling(); box.remove(); };
    box.querySelector('#zp-open-wallet').onclick = () => { window.location.href = order.pay_url; };
    box.querySelector('#zp-copy-addr').onclick = async () => {
        try { await navigator.clipboard.writeText(order.treasury); toast(ar ? 'تم النسخ' : 'Copied'); }
        catch (e) { toast(order.treasury); }
    };
    box.querySelector('#zp-check-now').onclick = async () => {
        status.textContent = ar ? '🔎 جارٍ التحقق…' : '🔎 Checking…';
        if (await checkOrder(order.order_id)) return onPaid();
        status.textContent = ar ? '⏳ لم تصل الدفعة بعد' : '⏳ Payment not seen yet';
    };

    // تحقق تلقائي كل 4 ثوانٍ لمدة 10 دقائق
    stopPolling();
    const until = Date.now() + 10 * 60 * 1000;
    payTimer = setInterval(async () => {
        if (!document.getElementById('zp-paybox') || Date.now() > until) return stopPolling();
        if (await checkOrder(order.order_id)) onPaid();
    }, 4000);
}

// يُستدعى عند الضغط على "اشترك"
async function subscribe(planId, btn) {
    const ar = isAr();
    const c = db();
    if (!c) return toast(ar ? 'تعذّر الاتصال بالخادم' : 'Server unavailable');
    try {
        if (btn) btn.disabled = true;
        const { data, error } = await c.functions.invoke('sol-create', { body: { package_id: planId } });
        if (error || !data || !data.order_id) throw (error || new Error('create failed'));
        showPayBox(data);
    } catch (e) {
        console.warn('[premium] create order failed', e);
        toast(ar ? 'تعذّر إنشاء الطلب، حاول مرة أخرى' : 'Could not create the order, try again');
    } finally {
        if (btn) btn.disabled = false;
    }
}

/* ---------- تعديل الملاحظة داخل openSubscriptions ---------- */
// استبدل هذا السطر:
//   ${ar ? 'يتم الدفع عبر Google Play ويمكنك إلغاء الاشتراك في أي وقت من المتجر.'
//          : 'Billed via Google Play. Cancel anytime from the store.'}
// بهذا:
//   ${ar ? 'الدفع بعملة SOL. يُفعَّل الاشتراك لمدة الخطة المختارة، ويمكنك التجديد قبل انتهائه.'
//          : 'Paid in SOL. Your subscription runs for the chosen period and you can renew before it ends.'}
