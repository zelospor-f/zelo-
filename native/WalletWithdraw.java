package PKG;

import android.text.Editable;
import android.text.InputType;
import android.text.TextWatcher;
import android.app.Activity;
import android.app.AlertDialog;
import android.app.Dialog;
import android.content.Context;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.ColorFilter;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;
import android.graphics.PixelFormat;
import android.graphics.drawable.BitmapDrawable;
import android.graphics.drawable.Drawable;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.graphics.Outline;
import android.graphics.Typeface;
import android.graphics.drawable.ColorDrawable;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.util.LruCache;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.ViewOutlineProvider;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.widget.AbsListView;
import android.widget.BaseAdapter;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.HorizontalScrollView;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ListView;
import android.widget.TextView;
import android.widget.ScrollView;
import android.widget.SeekBar;
import android.widget.Toast;
import android.widget.VideoView;
import android.widget.MediaController;
import java.io.BufferedReader;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TimeZone;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONArray;
import org.json.JSONObject;


// ============================================================
// WalletWithdraw.java — محوَّل من wallet-withdraw.js (صفحة «محفظتي» وسحب USDT BEP20)
// نفس الشروط ونفس دوال القاعدة. زر «اربح» يفتح صفحة الإعلانات (ويب حتى يُحوَّل ads.js).
// ============================================================
abstract class WalletWithdraw extends Ads {
    protected static final String[][] WW_TITLES = {
        { "verified", "تأكيد البريد/الهاتف", "Email/phone verification" }, { "account_age", "عمر الحساب", "Account age" }, { "invites", "الدعوات الناجحة", "Successful invites" },
        { "min_balance", "الحد الأدنى للسحب", "Minimum withdrawal" }, { "hold", "فترة التعليق", "Holding period" }, { "amount", "المبلغ المطلوب", "Requested amount" },
        { "address", "عنوان السحب", "Withdrawal address" }, { "identity", "تأكيد الهوية", "Identity verification" }, { "no_open_request", "الطلبات المعلّقة", "Pending requests" },
        { "no_fraud", "المراجعة الأمنية", "Security review" }, { "subscription", "الاشتراك", "Subscription" }
    };
    protected static final String[][] WW_STATUS = {
        { "pending", "قيد الإرسال", "Sending" }, { "review", "قيد المراجعة", "Under review" }, { "sent", "تم الإرسال", "Sent" },
        { "failed", "فشل", "Failed" }, { "rejected", "مرفوض", "Rejected" }
    };

    // حالة الصفحة
    protected Dialog wwDlg;
    protected LinearLayout wwBox;
    protected ScrollView wwScroll;
    protected boolean wwPro = false, wwBusy = false, wwShowAll = false, wwEditAddr = false, wwShowHist = false;
    protected double wwRate = 200;
    protected long wwAvail = 0, wwHeld = 0, wwAmount = 0;
    protected String wwAddr = null, wwMsg = "";
    protected JSONArray wwHist = new JSONArray();
    protected JSONObject wwElig = null;
    protected View wwSecW, wwSecH;

    protected String wwTitle(String key) {
        for (String[] t : WW_TITLES) if (t[0].equals(key)) return L(t[1], t[2]);
        return key;
    }
    protected String wwUsd(long n) { return String.format(java.util.Locale.US, "%.2f", n / wwRate); }
    protected String wwNum(long n) { return String.format(java.util.Locale.US, "%,d", n); }

    @Override protected void crOpenWallet() { openWithdrawWallet(); }

    protected void openWithdrawWallet() {
        if (uid == null) return;
        if (wwDlg != null) return;
        final Dialog d = sheetDialog(true);
        wwDlg = d;
        d.getWindow().setBackgroundDrawable(new ColorDrawable(NAVY));
        d.getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_PAN);
        lbDirection(d);
        wwBox = new LinearLayout(this);
        wwBox.setOrientation(LinearLayout.VERTICAL);
        wwBox.setPadding(dp(16), statusH() + dp(6), dp(16), navH() + dp(40));
        wwScroll = new ScrollView(this);
        wwScroll.addView(wwBox);
        d.setContentView(wwScroll);
        d.setOnDismissListener(new DialogInterface.OnDismissListener() { @Override public void onDismiss(DialogInterface di) { if (wwDlg == d) { wwDlg = null; wwBox = null; wwScroll = null; } } });
        d.show();
        wwAmount = 0; wwMsg = ""; wwEditAddr = false; wwShowAll = false; wwShowHist = false;
        wwBox.addView(txt("", MUTED, 14, true));
        wwLoad(true);
    }

    protected void wwLoad(final boolean thenRender) {
        pool.execute(new Runnable() { @Override public void run() {
            try {
                try { JSONArray c = new JSONArray(get("usdt_withdraw_config?select=*&limit=1")); if (c.length() > 0) wwRate = c.getJSONObject(0).optDouble("diamonds_per_usdt", 200); } catch (Exception ignore) {}
                try { JSONObject b = rmRow(rpc("my_coin_balance", "{}")); if (b != null) { wwAvail = (long) b.optDouble("available", 0); wwHeld = (long) b.optDouble("held", 0); } } catch (Exception ignore) {}
                try { JSONArray a = new JSONArray(get("withdraw_addresses?select=address,set_at&limit=1")); wwAddr = a.length() > 0 ? a.getJSONObject(0).optString("address") : null; } catch (Exception ignore) {}
                try { wwHist = new JSONArray(get("usdt_withdrawals?select=id,diamonds,amount_usdt,status,created_at,tx_hash&order=created_at.desc&limit=10")); } catch (Exception ignore) { wwHist = new JSONArray(); }
                wwElig = wwFetchElig();
            } catch (Exception ignore) {}
            wwFetchPro(thenRender);
        } });
    }

    protected JSONObject wwFetchElig() {
        try {
            JSONObject b = new JSONObject();
            if (wwAmount > 0) b.put("p_diamonds", wwAmount); else b.put("p_diamonds", JSONObject.NULL);
            return rmRow(rpc("my_withdraw_eligibility", b.toString()));
        } catch (Exception e) { return null; }
    }

    protected void wwFetchPro(final boolean thenRender) {
        fetchTier(new TierCb() { @Override public void on(int tier) {
            wwPro = tier >= 1;
            if (thenRender) wwRender();
        } });
    }

    protected void wwRefresh() {   // إعادة جلب الشروط ثم الرسم
        pool.execute(new Runnable() { @Override public void run() {
            wwElig = wwFetchElig();
            runOnUiThread(new Runnable() { @Override public void run() { wwRender(); } });
        } });
    }

    protected TextView wwH(String s) { return txt(s, 0xFFF4F6FF, 15, true); }
    protected LinearLayout wwCard() {
        LinearLayout c = new LinearLayout(this);
        c.setOrientation(LinearLayout.VERTICAL);
        c.setPadding(dp(16), dp(16), dp(16), dp(16));
        c.setBackground(rbg(0x0DFFFFFF, 0x17FFFFFF, 22));
        return c;
    }
    protected TextView wwBtn(String s, boolean sec) {
        TextView b = txt(s, sec ? GOLD : NAVY, 15, true);
        b.setGravity(Gravity.CENTER);
        b.setPadding(dp(12), dp(13), dp(12), dp(13));
        if (sec) b.setBackground(rbg(0x4D2C4BB5, 0x66F5C35A, 15));
        else b.setBackground(new GradientDrawable(GradientDrawable.Orientation.TL_BR, new int[] { 0xFFFFE7AD, 0xFFF5C35A }) {{ setCornerRadius(dp(15)); }});
        return b;
    }
    protected EditText wwIn(String hint) {
        EditText e = new EditText(this);
        e.setHint(hint);
        e.setHintTextColor(0xFF7A7F9A);
        e.setTextColor(Color.WHITE);
        e.setTextSize(15);
        e.setSingleLine(true);
        e.setLayoutDirection(View.LAYOUT_DIRECTION_LTR);
        e.setGravity(Gravity.START | Gravity.CENTER_VERTICAL);
        e.setBackground(rbg(0xB30A1033, 0x1FFFFFFF, 14));
        e.setPadding(dp(12), dp(12), dp(12), dp(12));
        return e;
    }

    protected void wwRender() {
        if (wwDlg == null || wwBox == null) return;
        wwBox.removeAllViews();
        // الرأس
        LinearLayout top = new LinearLayout(this);
        top.setGravity(Gravity.CENTER_VERTICAL);
        top.addView(backBtn(new Runnable() { @Override public void run() { if (wwDlg != null) wwDlg.dismiss(); } }));
        TextView h2 = txt(L("محفظتي", "My wallet"), 0xFFF4F6FF, 19, true);
        h2.setPadding(dp(12), 0, 0, 0);
        top.addView(h2);
        wwBox.addView(top, lpm(0, 0, 0, 14));
        long total = wwAvail + wwHeld;
        // البطاقة الذهبية
        FrameLayout gold = new FrameLayout(this);
        GradientDrawable gg = new GradientDrawable(GradientDrawable.Orientation.TL_BR, new int[] { 0xFFFFEEBD, 0xFFF5C35A, 0xFFB9842A });
        gg.setCornerRadius(dp(26));
        gold.setBackground(gg);
        TextView brand = txt("ZELO WALLET", 0xBF0A1033, 12, true);
        gold.addView(brand, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.TOP | Gravity.START) {{ setMargins(dp(20), dp(18), dp(20), 0); }});
        View chip = new View(this);
        chip.setBackground(rbg(0x99FFFFFF, 0x400A1033, 7));
        gold.addView(chip, new FrameLayout.LayoutParams(dp(40), dp(30), Gravity.TOP | Gravity.END) {{ setMargins(dp(20), dp(18), dp(20), 0); }});
        LinearLayout gb = new LinearLayout(this);
        gb.setOrientation(LinearLayout.VERTICAL);
        gb.addView(txt(L("رصيدك", "Your balance"), 0xB30A1033, 12, true));
        LinearLayout gn = new LinearLayout(this);
        gn.setLayoutDirection(View.LAYOUT_DIRECTION_LTR);
        gn.setGravity(Gravity.BOTTOM);
        gn.addView(txt(wwNum(total), NAVY, 40, true));
        TextView kr = txt(" " + L("كورة", "Kora"), NAVY, 15, true);
        kr.setPadding(dp(6), 0, 0, dp(8));
        gn.addView(kr);
        gb.addView(gn);
        gb.addView(txt("≈ $" + wwUsd(total), 0xB30A1033, 13, false));
        gold.addView(gb, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.TOP | Gravity.START) {{ setMargins(dp(20), dp(52), dp(20), 0); }});
        LinearLayout gf = new LinearLayout(this);
        long[] fv = { wwAvail, wwHeld };
        String[] fl = { L("قابل للسحب", "Available"), L("قيد التعليق", "On hold") };
        for (int i = 0; i < 2; i++) {
            LinearLayout cell = new LinearLayout(this);
            cell.setGravity(Gravity.CENTER_VERTICAL);
            cell.setPadding(dp(10), dp(7), dp(10), dp(7));
            cell.setBackground(rbg(0xD10A1033, 0, 12));
            cell.addView(txt(fl[i], 0xFFB9C4F0, 11, false), lpw(1f));
            cell.addView(txt(wwNum(fv[i]), i == 0 ? 0xFF14F195 : Color.WHITE, 14, true));
            LinearLayout.LayoutParams cp = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
            cp.setMargins(i == 0 ? 0 : dp(5), 0, i == 0 ? dp(5) : 0, 0);
            gf.addView(cell, cp);
        }
        gold.addView(gf, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.BOTTOM) {{ setMargins(dp(20), 0, dp(20), dp(16)); }});
        wwBox.addView(gold, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(204)));
        ((LinearLayout.LayoutParams) gold.getLayoutParams()).setMargins(0, 0, 0, dp(18));
        // الأزرار السريعة
        LinearLayout acts = new LinearLayout(this);
        acts.setPadding(dp(8), 0, dp(8), 0);
        String[] al = { L("اشترِ", "Buy"), L("اربح", "Earn"), L("اسحب", "Withdraw"), L("السجل", "History") };
        String[] ai = { "＋", "⚡", "⬇", "🕒" };
        for (int i = 0; i < 4; i++) {
            final int k = i;
            LinearLayout col = new LinearLayout(this);
            col.setOrientation(LinearLayout.VERTICAL);
            col.setGravity(Gravity.CENTER_HORIZONTAL);
            TextView ic = txt(ai[i], i == 0 ? NAVY : 0xFFFFE7AD, 22, true);
            ic.setGravity(Gravity.CENTER);
            ic.setBackground(i == 0 ? new GradientDrawable(GradientDrawable.Orientation.TL_BR, new int[] { 0xFFFFE7AD, 0xFFF5C35A }) {{ setCornerRadius(dp(20)); }} : rbg(0x472C4BB5, 0x66F5C35A, 20));
            col.addView(ic, new LinearLayout.LayoutParams(dp(56), dp(56)));
            TextView lb = txt(al[i], 0xFFF4F6FF, 12, true);
            lb.setPadding(0, dp(6), 0, 0);
            col.addView(lb);
            col.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) {
                if (k == 0) { if (wwDlg != null) wwDlg.dismiss(); openStorePage(); }
                else if (k == 1) { if (wwDlg != null) wwDlg.dismiss(); openAdsPage(); }
                else if (k == 2) { if (wwScroll != null && wwSecW != null) wwScroll.smoothScrollTo(0, wwSecW.getTop()); }
                else { if (wwScroll != null && wwSecH != null) wwScroll.smoothScrollTo(0, wwSecH.getTop()); }
            } });
            acts.addView(col, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        }
        wwBox.addView(acts, lpm(0, 0, 0, 18));
        // شروط السحب
        wwBox.addView(wwEligCard(), lpm(0, 0, 0, 14));
        // السحب
        wwSecW = wwWithdrawCard();
        wwBox.addView(wwSecW, lpm(0, 0, 0, 14));
        // السجل
        wwSecH = wwHistCard();
        wwBox.addView(wwSecH, lpm(0, 0, 0, 0));
    }

    protected View wwEligCard() {
        LinearLayout cl = wwCard();
        if (wwElig != null && wwElig.optJSONArray("checks") != null) {
            JSONArray ch = wwElig.optJSONArray("checks");
            int tot = ch.length(), done = 0;
            List<JSONObject> miss = new ArrayList<JSONObject>(), ok = new ArrayList<JSONObject>();
            for (int i = 0; i < tot; i++) { JSONObject c = ch.optJSONObject(i); if (c == null) continue; if (c.optBoolean("ok")) { done++; ok.add(c); } else miss.add(c); }
            boolean allOk = done == tot;
            LinearLayout head = new LinearLayout(this);
            head.setGravity(Gravity.CENTER_VERTICAL);
            TextView ht = wwH(allOk ? L("جاهز للسحب", "Ready to withdraw") : done >= tot - 2 ? L("أنت قريب من السحب", "You are close to withdrawing") : L("شروط السحب", "Withdrawal conditions"));
            head.addView(ht, lpw(1f));
            head.addView(txt(done + " / " + tot, allOk ? 0xFF14F195 : GOLD, 14, true));
            cl.addView(head);
            LinearLayout dots = new LinearLayout(this);
            dots.setLayoutDirection(View.LAYOUT_DIRECTION_LTR);
            for (int i = 0; i < tot; i++) {
                View dv = new View(this);
                dv.setBackground(rbg(i < done ? (allOk ? 0xFF14F195 : GOLD) : 0x1FFFFFFF, 0, 4));
                LinearLayout.LayoutParams dl = new LinearLayout.LayoutParams(0, dp(8), 1f);
                dl.setMargins(dp(2), 0, dp(2), 0);
                dots.addView(dv, dl);
            }
            cl.addView(dots, lpm(0, 12, 0, 0));
            if (!miss.isEmpty()) {
                int n = miss.size();
                String lt = isAr() ? (n == 1 ? L("متبقٍّ لك شرط واحد فقط:", "Only one requirement left:") : n == 2 ? L("متبقٍّ لك شرطان فقط:", "Only two requirements left:") : L("متبقٍّ لك ", "You have ") + n + L(" شروط:", " requirements left:")) : n + (n == 1 ? " condition left:" : " conditions left:");
                cl.addView(txt(lt, MUTED, 12, false), lpm(0, 14, 0, 0));
                for (JSONObject c : miss) {
                    LinearLayout p = new LinearLayout(this);
                    p.setPadding(dp(12), dp(9), dp(12), dp(9));
                    p.setBackground(rbg(0x1AFF4D5E, 0x59FF6B6B, 14));
                    p.addView(txt("✕  ", 0xFFFF9AA5, 12, true));
                    LinearLayout tx = new LinearLayout(this);
                    tx.setOrientation(LinearLayout.VERTICAL);
                    tx.addView(txt(wwTitle(c.optString("key")), 0xFFFFC4CA, 13, true));
                    tx.addView(txt(c.optString("msg"), 0xFFC9A3A8, 11, false));
                    p.addView(tx, lpw(1f));
                    cl.addView(p, lpm(0, 8, 0, 0));
                }
            }
            if (!ok.isEmpty()) {
                TextView mb = txt((wwShowAll ? L("إخفاء الشروط المكتملة", "Hide completed") : L("عرض الشروط المكتملة (", "Show completed (") + ok.size() + ")") + (wwShowAll ? " ⌃" : " ⌄"), GOLD, 13, true);
                mb.setGravity(Gravity.CENTER);
                mb.setPadding(0, dp(8), 0, dp(4));
                mb.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { wwShowAll = !wwShowAll; wwRender(); } });
                cl.addView(mb, lpm(0, 8, 0, 0));
                if (wwShowAll) for (JSONObject c : ok) {
                    LinearLayout row = new LinearLayout(this);
                    row.setGravity(Gravity.CENTER_VERTICAL);
                    row.setPadding(dp(12), dp(10), dp(12), dp(10));
                    row.setBackground(rbg(0x0F14F195, 0x5914F195, 12));
                    TextView mk = txt("✓", Color.WHITE, 14, true);
                    mk.setGravity(Gravity.CENTER);
                    mk.setBackground(oval(0xFF14C27A, 0));
                    row.addView(mk, new LinearLayout.LayoutParams(dp(26), dp(26)));
                    LinearLayout t = new LinearLayout(this);
                    t.setOrientation(LinearLayout.VERTICAL);
                    t.setPadding(dp(12), 0, 0, 0);
                    t.addView(txt(wwTitle(c.optString("key")), Color.WHITE, 13, true));
                    t.addView(txt(c.optString("msg"), MUTED, 11, false));
                    row.addView(t, lpw(1f));
                    cl.addView(row, lpm(0, 8, 0, 0));
                }
            }
        } else {
            cl.addView(wwH(L("شروط السحب", "Withdrawal conditions")));
            cl.addView(txt(L("تعذّر تحميل الشروط", "Could not load the conditions"), MUTED, 13, false), lpm(0, 8, 0, 0));
        }
        return cl;
    }

    protected View wwWithdrawCard() {
        LinearLayout wc = wwCard();
        LinearLayout sh = new LinearLayout(this);
        sh.setGravity(Gravity.CENTER_VERTICAL);
        sh.addView(wwH(L("السحب", "Withdraw")), lpw(1f));
        TextView bep = txt("BEP20", 0xFFFFE7AD, 11, true);
        bep.setPadding(dp(10), dp(3), dp(10), dp(3));
        bep.setBackground(rbg(0x1FF5C35A, 0x4DF5C35A, 12));
        sh.addView(bep);
        wc.addView(sh);
        boolean editing = wwAddr == null || wwAddr.length() == 0 || wwEditAddr;
        if (!editing) {
            LinearLayout row = new LinearLayout(this);
            row.setGravity(Gravity.CENTER_VERTICAL);
            row.setPadding(dp(12), dp(10), dp(12), dp(10));
            row.setBackground(rbg(0xB30A1033, 0x1AFFFFFF, 14));
            TextView ai = txt("👛", GOLD, 16, false);
            ai.setGravity(Gravity.CENTER);
            ai.setBackground(rbg(0x1AF5C35A, 0x47F5C35A, 11));
            row.addView(ai, new LinearLayout.LayoutParams(dp(34), dp(34)));
            LinearLayout at = new LinearLayout(this);
            at.setOrientation(LinearLayout.VERTICAL);
            at.setPadding(dp(10), 0, dp(10), 0);
            at.addView(txt(L("عنوان المحفظة", "Wallet address"), MUTED, 11, false));
            TextView code = txt(wwAddr.substring(0, Math.min(6, wwAddr.length())) + "…" + wwAddr.substring(Math.max(0, wwAddr.length() - 4)), Color.WHITE, 13, false);
            code.setTypeface(Typeface.MONOSPACE);
            code.setLayoutDirection(View.LAYOUT_DIRECTION_LTR);
            at.addView(code);
            row.addView(at, lpw(1f));
            TextView ed = txt("✎", MUTED, 18, true);
            ed.setPadding(dp(6), dp(6), dp(6), dp(6));
            ed.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { wwEditAddr = true; wwRender(); } });
            row.addView(ed);
            wc.addView(row, lpm(0, 12, 0, 0));
            wc.addView(txt(L("أرسل إلى شبكة BNB Smart Chain (BEP20) فقط. تغيير العنوان يؤجّل السحب 48 ساعة.", "BNB Smart Chain (BEP20) only. Changing the address delays withdrawal by 48 hours."), MUTED, 11, false), lpm(0, 8, 0, 0));
        } else {
            TextView w = txt(L("أرسل إلى عنوان BNB Smart Chain (BEP20) فقط. أي شبكة أخرى تضيّع المبلغ. تغيير العنوان يؤجّل السحب 48 ساعة.", "Send to a BNB Smart Chain (BEP20) address only. Any other network loses the funds. Changing the address delays withdrawal by 48 hours."), GOLD, 13, false);
            w.setPadding(dp(10), dp(10), dp(10), dp(10));
            w.setBackground(rbg(0x1FF5C35A, 0, 10));
            wc.addView(w, lpm(0, 12, 0, 10));
            wc.addView(txt(L("عنوان المحفظة", "Wallet address"), MUTED, 12, true), lpm(0, 0, 0, 6));
            final EditText ai = wwIn("0x...");
            ai.setText(wwAddr == null ? "" : wwAddr);
            wc.addView(ai);
            TextView sv = wwBtn(L("حفظ العنوان", "Save address"), true);
            sv.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) {
                final String val = ai.getText().toString().trim();
                if (!val.matches("^0x[a-fA-F0-9]{40}$")) { wwMsg = L("العنوان غير صالح: يبدأ بـ 0x ويتكوّن من 42 حرفاً", "Invalid address: it starts with 0x and has 42 characters"); wwRender(); return; }
                pool.execute(new Runnable() { @Override public void run() {
                    boolean bad = true;
                    try { JSONObject r = rmRow(rpc("set_withdraw_address", new JSONObject().put("p_address", val).toString())); bad = r == null || !"ok".equals(r.optString("status")); } catch (Exception ignore) {}
                    final boolean fb = bad;
                    wwMsg = fb ? L("تعذّر حفظ العنوان", "Could not save the address") : L("تم حفظ العنوان", "Address saved");
                    if (!fb) wwEditAddr = false;
                    try { JSONArray a = new JSONArray(get("withdraw_addresses?select=address,set_at&limit=1")); wwAddr = a.length() > 0 ? a.getJSONObject(0).optString("address") : null; } catch (Exception ignore) {}
                    runOnUiThread(new Runnable() { @Override public void run() { wwRender(); } });
                } });
            } });
            wc.addView(sv, lpm(0, 10, 0, 0));
        }
        // المبلغ
        LinearLayout line = new LinearLayout(this);
        line.setGravity(Gravity.CENTER_VERTICAL);
        final EditText ni = wwIn(L("عدد الكورة", "Kora amount"));
        ni.setInputType(InputType.TYPE_CLASS_NUMBER);
        if (wwAmount > 0) ni.setText(String.valueOf(wwAmount));
        line.addView(ni, lpw(1f));
        TextView all = wwBtn(L("الكل", "All"), true);
        all.setPadding(dp(16), dp(12), dp(16), dp(12));
        all.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { wwAmount = wwAvail; wwRefresh(); } });
        LinearLayout.LayoutParams alp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        alp.setMargins(dp(8), 0, 0, 0);
        line.addView(all, alp);
        wc.addView(line, lpm(0, 12, 0, 0));
        final TextView est = txt(L("ستستلم: ", "You will receive: ") + wwUsd(wwAmount) + " USDT", GOLD, 14, true);
        est.setGravity(Gravity.CENTER);
        est.setPadding(dp(12), dp(10), dp(12), dp(10));
        est.setBackground(rbg(0x1AF5C35A, 0, 12));
        est.setVisibility(wwAmount > 0 ? View.VISIBLE : View.GONE);
        wc.addView(est, lpm(0, 10, 0, 0));
        final TextView go = wwBtn(L("اطلب السحب", "Request withdrawal"), false);
        go.setAlpha(wwBusy || wwAmount <= 0 ? 0.4f : 1f);
        ni.addTextChangedListener(new TextWatcher() {
            @Override public void beforeTextChanged(CharSequence s, int a, int b, int c) {}
            @Override public void onTextChanged(CharSequence s, int a, int b, int c) {}
            @Override public void afterTextChanged(Editable s) {
                long v = 0;
                try { v = Long.parseLong(s.toString().trim()); } catch (Exception ignore) {}
                wwAmount = v;
                est.setText(L("ستستلم: ", "You will receive: ") + wwUsd(wwAmount) + " USDT");
                est.setVisibility(wwAmount > 0 ? View.VISIBLE : View.GONE);
                go.setAlpha(wwBusy || wwAmount <= 0 ? 0.4f : 1f);
            }
        });
        go.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { wwRequest(); } });
        wc.addView(go, lpm(0, 10, 0, 0));
        if (wwMsg.length() > 0) wc.addView(txt(wwMsg, Color.WHITE, 14, false), lpm(0, 10, 0, 0));
        return wc;
    }

    protected void wwRequest() {
        if (wwBusy || wwAmount <= 0) return;
        if (!wwPro) {
            wwMsg = L("وثّق حسابك بالاشتراك لتتمكن من السحب", "Verify your account by subscribing to be able to withdraw");
            wwRender();
            if (wwDlg != null) wwDlg.dismiss();
            openSubscriptions();
            return;
        }
        if (wwAddr == null || wwAddr.length() == 0) { wwMsg = L("احفظ عنوان المحفظة أولاً", "Save your wallet address first"); wwRender(); return; }
        final long amt = wwAmount;
        pool.execute(new Runnable() { @Override public void run() {
            wwElig = wwFetchElig();
            runOnUiThread(new Runnable() { @Override public void run() {
                if (wwElig == null || "rejected".equals(wwElig.optString("decision"))) {
                    String m = L("الشروط غير مكتملة", "Conditions not met");
                    if (wwElig != null && wwElig.optJSONArray("reasons") != null) {
                        StringBuilder sb = new StringBuilder();
                        JSONArray rs = wwElig.optJSONArray("reasons");
                        for (int i = 0; i < rs.length(); i++) sb.append(i > 0 ? " • " : "").append(rs.optString(i));
                        m = sb.toString();
                    }
                    wwMsg = m; wwRender(); return;
                }
                String q = isAr() ? L("سحب ", "Withdraw ") + amt + L(" كورة (", " balls (") + wwUsd(amt) + L(" USDT) إلى:\n", " USDT) to:\n") + wwAddr + L("\nشبكة BEP20", "\nBEP20 network")
                                  : "Withdraw " + amt + " Kora (" + wwUsd(amt) + " USDT) to:\n" + wwAddr + "\nBEP20 network";
                rmConfirm(q, L("تأكيد", "Confirm"), new Runnable() { @Override public void run() { wwSubmit(amt); } });
            } });
        } });
    }

    protected void wwSubmit(final long amt) {
        wwBusy = true;
        wwRender();
        pool.execute(new Runnable() { @Override public void run() {
            String msg;
            try {
                JSONObject r = rmRow(rpc("request_usdt_withdrawal", new JSONObject().put("p_diamonds", amt).toString()));
                String st = r == null ? "" : r.optString("status");
                if ("rejected".equals(st)) {
                    StringBuilder sb = new StringBuilder();
                    JSONArray rs = r.optJSONArray("reasons");
                    if (rs != null) for (int i = 0; i < rs.length(); i++) sb.append(i > 0 ? " • " : "").append(rs.optString(i));
                    msg = sb.toString();
                } else if ("review".equals(st)) msg = L("استلمنا طلبك وسيُراجَع يدوياً", "We received your request and it will be reviewed manually");
                else if ("pending".equals(st)) msg = L("تمت الموافقة، سيُرسل المبلغ قريباً", "Approved, the amount will be sent soon");
                else msg = "";
            } catch (Exception e) { msg = L("حدث خطأ، حاول مجدداً", "An error occurred, try again"); }
            wwBusy = false;
            wwMsg = msg;
            wwAmount = 0;
            wwLoad(false);
            runOnUiThread(new Runnable() { @Override public void run() { wwRender(); } });
        } });
    }

    protected View wwHistCard() {
        LinearLayout hc = wwCard();
        hc.addView(wwH(L("آخر الطلبات", "Latest requests")));
        int n = wwHist.length();
        if (n == 0) { hc.addView(txt(L("لا توجد طلبات بعد", "No requests yet"), MUTED, 13, false), lpm(0, 8, 0, 0)); return hc; }
        int lim = wwShowHist ? n : Math.min(3, n);
        for (int i = 0; i < lim; i++) {
            JSONObject w = wwHist.optJSONObject(i);
            if (w == null) continue;
            LinearLayout row = new LinearLayout(this);
            row.setGravity(Gravity.CENTER_VERTICAL);
            row.setPadding(0, dp(10), 0, dp(10));
            TextView a = txt("USDT " + String.format(java.util.Locale.US, "%.2f", w.optDouble("amount_usdt", 0)), Color.WHITE, 14, true);
            a.setLayoutDirection(View.LAYOUT_DIRECTION_LTR);
            row.addView(a, lpw(1f));
            String st = w.optString("status");
            String label = st;
            for (String[] s : WW_STATUS) if (s[0].equals(st)) label = L(s[1], s[2]);
            int fg = "sent".equals(st) ? 0xFF14F195 : ("failed".equals(st) || "rejected".equals(st)) ? 0xFFFF6B6B : ("pending".equals(st) || "review".equals(st)) ? GOLD : Color.WHITE;
            int bgc = "sent".equals(st) ? 0x2614F195 : ("failed".equals(st) || "rejected".equals(st)) ? 0x26FF4D4D : ("pending".equals(st) || "review".equals(st)) ? 0x26F5C35A : 0x14FFFFFF;
            TextView pill = txt(label, fg, 12, true);
            pill.setPadding(dp(10), dp(3), dp(10), dp(3));
            pill.setBackground(rbg(bgc, 0, 20));
            row.addView(pill);
            hc.addView(row);
            if (i < lim - 1) { View ln = new View(this); ln.setBackgroundColor(0x14FFFFFF); hc.addView(ln, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 1)); }
        }
        if (n > 3) {
            TextView mb = txt(wwShowHist ? L("إخفاء", "Show less") + " ⌃" : L("عرض الكل", "Show all") + " ⌄", GOLD, 13, true);
            mb.setGravity(Gravity.CENTER);
            mb.setPadding(0, dp(8), 0, dp(4));
            mb.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { wwShowHist = !wwShowHist; wwRender(); } });
            hc.addView(mb, lpm(0, 8, 0, 0));
        }
        return hc;
    }
}
