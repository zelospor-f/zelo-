package PKG;

import android.view.Window;
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

abstract class SideDrawer extends Settings {
    // ===== من side-drawer.js: القائمة الجانبية + مركز المساعدة =====
    protected static final String SUPPORT_EMAIL = "support@zelosport.net";
    protected static final String SITE = "https://zelosport.net/";
    protected static final String APP_VERSION = "1.0";
    protected Dialog drDlg, helpDlg;

    protected void openSideDrawer() {
        if (drDlg != null) { try { drDlg.dismiss(); } catch (Exception ignore) {} }
        final Dialog d = new Dialog(this);
        drDlg = d;
        d.requestWindowFeature(Window.FEATURE_NO_TITLE);
        final boolean rtl = isRtlLang();
        int w = Math.min((int) (getResources().getDisplayMetrics().widthPixels * 0.84f), dp(330));
        final LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        GradientDrawable bg = new GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM, new int[] { 0xFF0F1A5C, 0xFF0A1033, 0xFF080D2A });
        box.setBackground(bg);
        box.setPadding(0, statusH() + dp(6), 0, navH() + dp(16));
        d.getWindow().getDecorView().setLayoutDirection(rtl ? View.LAYOUT_DIRECTION_RTL : View.LAYOUT_DIRECTION_LTR);
        ScrollView sc = new ScrollView(this);
        LinearLayout in = new LinearLayout(this);
        in.setOrientation(LinearLayout.VERTICAL);
        in.addView(txt(L("المزيد", "MORE"), 0xFF6F7BB3, 12, true), lpm(22, 10, 22, 4));
        in.addView(drItem("🌐", L("الموقع الرسمي", "Official Website"), false, new Runnable() { @Override public void run() { openExternal(SITE); } }));
        in.addView(drItem("⚙️", L("الإعدادات", "Settings"), false, new Runnable() { @Override public void run() { openSettings(); } }));
        if (isAdmin()) in.addView(drItem("🚩", L("البلاغات (للإدارة)", "Reports (admin)"), false, new Runnable() { @Override public void run() { openReportsPanel(); } }));
        View sp = new View(this);
        in.addView(sp, new LinearLayout.LayoutParams(1, dp(14)));
        TextView inv = txt("🔗  " + L("ادعُ أصدقاءك", "Invite friends"), NAVY, 16, true);
        inv.setGravity(Gravity.CENTER);
        GradientDrawable ig = new GradientDrawable(GradientDrawable.Orientation.LEFT_RIGHT, new int[] { GOLD, 0xFFFDE9A8 });
        ig.setCornerRadius(dp(16));
        inv.setBackground(ig);
        inv.setPadding(dp(16), dp(13), dp(16), dp(13));
        inv.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { d.dismiss(); drInvite(); } });
        in.addView(inv, lpm(14, 4, 14, 8));
        in.addView(drItem("🌍", L("تغيير اللغة", "Change language"), true, new Runnable() { @Override public void run() { openLangPicker(new LangPick() { @Override public void on(String code) { zeloSetLang(code); } }); } }));
        in.addView(drItem("❓", L("مركز المساعدة", "Help center"), true, new Runnable() { @Override public void run() { openHelpCenter(); } }));
        TextView ver = txt("ZELO Sport v" + APP_VERSION, 0xFF5B6697, 12, false);
        ver.setGravity(Gravity.CENTER);
        in.addView(ver, lpm(0, 12, 0, 0));
        sc.addView(in);
        box.addView(sc);
        d.setContentView(box);
        Window wn = d.getWindow();
        wn.setBackgroundDrawable(new ColorDrawable(0x00000000));
        wn.setLayout(w, ViewGroup.LayoutParams.MATCH_PARENT);
        wn.setGravity((rtl ? Gravity.RIGHT : Gravity.LEFT) | Gravity.FILL_VERTICAL);
        wn.setDimAmount(0.62f);
        wn.addFlags(WindowManager.LayoutParams.FLAG_DIM_BEHIND);
        d.setCanceledOnTouchOutside(true);
        d.setOnDismissListener(new DialogInterface.OnDismissListener() { @Override public void onDismiss(DialogInterface di) { drDlg = null; } });
        d.show();
        box.setTranslationX(rtl ? w : -w);
        box.animate().translationX(0).setDuration(260).start();
    }
    protected View drItem(String icon, String label, boolean muted, final Runnable act) {
        LinearLayout r = new LinearLayout(this);
        r.setGravity(Gravity.CENTER_VERTICAL);
        r.setPadding(dp(10), dp(9), dp(10), dp(9));
        TextView ic = txt(icon, GOLD, 18, false);
        ic.setGravity(Gravity.CENTER);
        ic.setBackground(rbg(0x1AF5C35A, 0x00000000, 11));
        r.addView(ic, new LinearLayout.LayoutParams(dp(36), dp(36)));
        TextView l = txt(label, muted ? 0xFFAEB8E6 : 0xFFE8ECFF, 15, !muted);
        l.setPadding(dp(12), 0, dp(12), 0);
        r.addView(l, lpw(1f));
        r.addView(txt(isRtlLang() ? "‹" : "›", 0xFF55608F, 18, true));
        r.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { if (drDlg != null) drDlg.dismiss(); act.run(); } });
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        lp.setMargins(dp(10), dp(2), dp(10), dp(2));
        r.setLayoutParams(lp);
        return r;
    }

    // دعوة الأصدقاء: نافذة المشاركة (share.js لم يُحوَّل بعد) ← نشارك رابط الدعوة نصياً
    protected void drInvite() {
        String link = referralLink();
        if (link.length() == 0) { toast(L("أكمل إنشاء حسابك أولاً", "Finish creating your account first")); return; }
        Intent it = new Intent(Intent.ACTION_SEND);
        it.setType("text/plain");
        it.putExtra(Intent.EXTRA_TEXT, L("انضم إليّ في ZELO Sport ⚽\n", "Join me on ZELO Sport ⚽\n") + link);
        startActivity(Intent.createChooser(it, "ZELO Sport"));
    }

    // ---------- مركز المساعدة ----------
    protected String[][] faqItems() {
        return new String[][] {
            { L("نسيت كلمة السر", "I forgot my password"), L("من شاشة تسجيل الدخول اختر «نسيت كلمة السر» وسيصلك رمز تحقق على بريدك. إن لم يصل خلال دقائق فافحص الرسائل غير المرغوب فيها.", "On the sign-in screen choose “Forgot password” and a verification code will be sent to your email. If it does not arrive within a few minutes, check your spam folder.") },
            { L("كيف أحذف حسابي؟", "How do I delete my account?"), L("من الإعدادات ← حذف الحساب. الحذف لا يلغي اشتراك Google Play، فألغِه من المتجر بنفسك. وأنهِ أي طلب سحب معلّق قبل الحذف.", "Go to Settings → Delete account. Deleting does not cancel your Google Play subscription, so cancel it in the store yourself. Finish any pending withdrawal before deleting.") },
            { L("كيف ألغي اشتراكي؟", "How do I cancel my subscription?"), L("افتح متجر Google Play ← الملف الشخصي ← المدفوعات والاشتراكات ← الاشتراكات ← ZELO Sport ← إلغاء.", "Open Google Play → Profile → Payments & subscriptions → Subscriptions → ZELO Sport → Cancel.") },
            { L("كيف يعمل سحب الكورة؟", "How do Kora withdrawals work?"), L("من «محفظتي». السحب للمشتركين فقط، والحد الأدنى 1000 كورة (200 كورة = 1 USDT)، وتُعلَّق الكورة الجديدة 7 أيام. الحد الأدنى والرسوم ومدة المعالجة تظهر لك قبل تأكيد الطلب، وقد يُطلب منك تحقق إضافي. تأكد من عنوان المحفظة (USDT على شبكة BEP20) لأن العمليات لا تُلغى بعد التنفيذ.", "From “My Wallet”. Withdrawals are for subscribers only, the minimum is 1,000 Kora (200 Kora = 1 USDT), and new Kora is held for 7 days. The minimum, fees and processing time are shown before you confirm, and extra verification may be required. Double-check the wallet address (USDT on BEP20) because transactions cannot be reversed once sent.") },
            { L("كيف أبلّغ عن منشور أو أحظر مستخدماً؟", "How do I report a post or block a user?"), L("من قائمة المنشور (النقاط الثلاث) اختر «بلاغ» أو «حظر».", "From the post menu (three dots) choose “Report” or “Block”.") }
        };
    }
    protected void openHelpCenter() {
        if (helpDlg != null) { try { helpDlg.dismiss(); } catch (Exception ignore) {} }
        final Dialog d = sheetDialog(true);
        helpDlg = d;
        d.getWindow().setBackgroundDrawable(new ColorDrawable(0xFF0A1033));
        lbDirection(d);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(0, statusH() + dp(6), 0, 0);
        LinearLayout bar = new LinearLayout(this);
        bar.setGravity(Gravity.CENTER_VERTICAL);
        bar.setPadding(dp(14), dp(12), dp(14), dp(12));
        bar.addView(backBtn(new Runnable() { @Override public void run() { d.dismiss(); } }));
        TextView ti = txt(L("مركز المساعدة", "Help center"), Color.WHITE, 18, true);
        ti.setPadding(dp(10), 0, 0, 0);
        bar.addView(ti);
        root.addView(bar);
        LinearLayout b = new LinearLayout(this);
        b.setOrientation(LinearLayout.VERTICAL);
        b.setPadding(dp(16), dp(10), dp(16), navH() + dp(28));
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(dp(16), dp(16), dp(16), dp(16));
        GradientDrawable cg = new GradientDrawable(GradientDrawable.Orientation.TL_BR, new int[] { 0x4D2C4BB5, 0x8014206B });
        cg.setCornerRadius(dp(18)); cg.setStroke(dp(1), 0x47F5C35A);
        card.setBackground(cg);
        card.addView(txt(L("تواصل مع الدعم", "Contact support"), GOLD, 17, true));
        card.addView(txt(L("اكتب لنا مشكلتك أو اقتراحك وسنرد عليك على بريدك.", "Tell us about your problem or idea and we will reply by email."), 0xFFC9D1F5, 14, false), lpm(0, 4, 0, 10));
        TextView em = txt(SUPPORT_EMAIL, Color.WHITE, 15, true);
        em.setTextDirection(View.TEXT_DIRECTION_LTR);
        card.addView(em, lpm(0, 0, 0, 12));
        LinearLayout acts = new LinearLayout(this);
        TextView mail = txt("✉️  " + L("راسلنا", "Email us"), NAVY, 15, true), copy = txt(L("نسخ البريد", "Copy email"), Color.WHITE, 15, true);
        for (TextView t : new TextView[] { mail, copy }) { t.setGravity(Gravity.CENTER); t.setPadding(dp(8), dp(12), dp(8), dp(12)); }
        GradientDrawable mg = new GradientDrawable(GradientDrawable.Orientation.LEFT_RIGHT, new int[] { GOLD, 0xFFFDE9A8 });
        mg.setCornerRadius(dp(14));
        mail.setBackground(mg);
        copy.setBackground(rbg(0x14FFFFFF, 0x24FFFFFF, 14));
        mail.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) {
            String who = (uname != null && uname.length() > 0 ? "@" + uname + "  " : "") + (uid != null ? "ID: " + uid : "");
            String body = "\n\n---\n" + L("بيانات حسابي (لتسهيل المساعدة):", "My account info (to help us assist you):") + "\n" + who + "\nApp v" + APP_VERSION;
            Intent it = new Intent(Intent.ACTION_SENDTO, android.net.Uri.parse("mailto:"));
            it.putExtra(Intent.EXTRA_EMAIL, new String[] { SUPPORT_EMAIL });
            it.putExtra(Intent.EXTRA_SUBJECT, L("دعم ZELO Sport", "ZELO Sport support"));
            it.putExtra(Intent.EXTRA_TEXT, body);
            try { startActivity(it); } catch (Exception e) { toast(SUPPORT_EMAIL); }
        } });
        copy.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) {
            ((android.content.ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE)).setPrimaryClip(android.content.ClipData.newPlainText("email", SUPPORT_EMAIL));
            toast(L("تم نسخ البريد", "Email copied"));
        } });
        acts.addView(mail, lpw(1f));
        LinearLayout.LayoutParams cl = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
        cl.setMargins(dp(10), 0, 0, 0);
        acts.addView(copy, cl);
        card.addView(acts);
        b.addView(card, lpm(0, 0, 0, 18));
        b.addView(txt(L("أسئلة شائعة", "FAQ"), 0xFF6F7BB3, 13, true), lpm(4, 6, 4, 8));
        for (final String[] q : faqItems()) {
            final LinearLayout item = new LinearLayout(this);
            item.setOrientation(LinearLayout.VERTICAL);
            item.setBackground(rbg(0x08FFFFFF, 0x17FFFFFF, 14));
            LinearLayout hd = new LinearLayout(this);
            hd.setGravity(Gravity.CENTER_VERTICAL);
            hd.setPadding(dp(14), dp(14), dp(14), dp(14));
            hd.addView(txt(q[0], Color.WHITE, 15, true), lpw(1f));
            final TextView pl = txt("+", GOLD, 22, false);
            hd.addView(pl);
            final TextView ans = txt(q[1], 0xFFC9D1F5, 14, false);
            ans.setPadding(dp(14), 0, dp(14), dp(14));
            ans.setVisibility(View.GONE);
            hd.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { boolean open = ans.getVisibility() == View.VISIBLE; ans.setVisibility(open ? View.GONE : View.VISIBLE); pl.setText(open ? "+" : "−"); } });
            item.addView(hd); item.addView(ans);
            b.addView(item, lpm(0, 0, 0, 8));
        }
        b.addView(txt(L("معلومات قانونية", "Legal"), 0xFF6F7BB3, 13, true), lpm(4, 18, 4, 8));
        String[][] legal = { { "privacy", L("سياسة الخصوصية", "Privacy Policy") }, { "terms", L("شروط الاستخدام", "Terms of Use") }, { "refunds", L("الدفع والاسترداد", "Payments & Refunds") }, { "delete-account", L("حذف الحساب والبيانات", "Delete account & data") } };
        for (final String[] l : legal) {
            LinearLayout r = new LinearLayout(this);
            r.setGravity(Gravity.CENTER_VERTICAL);
            r.setPadding(dp(14), dp(13), dp(14), dp(13));
            r.setBackground(rbg(0x08FFFFFF, 0x17FFFFFF, 14));
            r.addView(txt(l[1], 0xFFE8ECFF, 15, true), lpw(1f));
            r.addView(txt(isRtlLang() ? "‹" : "›", 0xFF55608F, 18, true));
            r.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { openExternal(SITE + l[0] + (isAr() ? ".html" : "-en.html")); } });
            b.addView(r, lpm(0, 0, 0, 8));
        }
        TextView ft = txt("ZELO Sport v" + APP_VERSION, 0xFF5B6697, 12, false);
        ft.setGravity(Gravity.CENTER);
        b.addView(ft, lpm(0, 18, 0, 0));
        ScrollView sc = new ScrollView(this);
        sc.addView(b);
        root.addView(sc, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));
        d.setContentView(root);
        d.setOnDismissListener(new DialogInterface.OnDismissListener() { @Override public void onDismiss(DialogInterface di) { helpDlg = null; } });
        d.show();
    }
}
