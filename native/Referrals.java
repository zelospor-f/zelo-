package PKG;

import android.view.MotionEvent;
import android.view.Window;
import android.graphics.Shader;
import android.graphics.LinearGradient;
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

abstract class Referrals extends Notifications {
    // ===== من referrals.js: الإحالات + مجمع النقاط =====
    protected static final String REF_PACKAGE = "com.zelosport.app";
    protected static final boolean REF_PUBLISHED = false;     // عند النشر على Google Play غيّرها إلى true
    protected static final String REF_GITHUB = "https://github.com/zelospor-f/zelo-/releases/latest";

    protected String cleanCode(String c) {
        String s = String.valueOf(c == null ? "" : c).replaceFirst("(?i)^ref_", "").replaceAll("[^a-zA-Z0-9_]", "");
        return s.length() > 20 ? s.substring(0, 20) : s;
    }
    protected SharedPreferences refPrefs() { return getSharedPreferences("zn_ref", MODE_PRIVATE); }
    protected boolean saveRefCode(String c) {
        c = cleanCode(c);
        if (c.length() == 0) return false;
        SharedPreferences p = refPrefs();
        if (p.getString("code", "").length() == 0) p.edit().putString("code", c).apply();
        return true;
    }
    // يلتقط ?ref= من رابط فتح التطبيق
    protected void captureReferral(Intent it) {
        try {
            if (it == null || it.getData() == null) return;
            saveRefCode(it.getData().getQueryParameter("ref"));
        } catch (Exception ignore) {}
    }

    // رابط الدعوة (كود الإحالة = اسم المستخدم)
    protected String referralLink() {
        String u = cleanCode(uname);
        if (u.length() == 0) return "";
        try {
            if (REF_PUBLISHED) return "https://play.google.com/store/apps/details?id=" + REF_PACKAGE + "&referrer=" + java.net.URLEncoder.encode("ref_" + u, "UTF-8");
            return REF_GITHUB + "?ref=" + java.net.URLEncoder.encode(u, "UTF-8");
        } catch (Exception e) { return ""; }
    }
    protected String postLink(String id) {
        String pid = String.valueOf(id == null ? "" : id).replaceAll("[^a-zA-Z0-9_-]", "");
        String u = cleanCode(uname);
        try {
            if (REF_PUBLISHED) return "https://play.google.com/store/apps/details?id=" + REF_PACKAGE + "&referrer=" + java.net.URLEncoder.encode((u.length() > 0 ? "ref_" + u : "") + (pid.length() > 0 ? (u.length() > 0 ? "&" : "") + "post_" + pid : ""), "UTF-8");
            String q = "";
            if (u.length() > 0) q += "ref=" + java.net.URLEncoder.encode(u, "UTF-8");
            if (pid.length() > 0) q += (q.length() > 0 ? "&" : "") + "post=" + java.net.URLEncoder.encode(pid, "UTF-8");
            return REF_GITHUB + (q.length() > 0 ? "?" + q : "");
        } catch (Exception e) { return ""; }
    }
    protected void copyReferralLink() {
        String link = referralLink();
        if (link.length() == 0) { toast(L("أكمل إنشاء حسابك أولاً", "Finish creating your account first")); return; }
        android.content.ClipboardManager cm = (android.content.ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
        cm.setPrimaryClip(android.content.ClipData.newPlainText("zelo", link));
        toast(L("تم نسخ الرابط بنجاح! 📋", "Link copied successfully! 📋"));
    }

    // نافذة "هل دعاك صديق؟" — تُستدعى مرة واحدة في شاشة إنشاء الحساب
    protected void askInviter() {
        SharedPreferences p = refPrefs();
        if (p.getString("code", "").length() > 0 || p.getBoolean("asked", false)) return;
        p.edit().putBoolean("asked", true).apply();
        final Dialog d = new Dialog(this);
        d.requestWindowFeature(Window.FEATURE_NO_TITLE);
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setPadding(dp(20), dp(20), dp(20), dp(20));
        box.setBackground(rbg(NAVY, 0x4DF5C35A, 18));
        box.addView(txt("🤝 " + L("هل دعاك صديق؟", "Did a friend invite you?"), Color.WHITE, 16, true));
        TextView sub = txt(L("اكتب اسم مستخدم صديقك ليحصل على مكافأته", "Enter your friend's username so they get their reward"), MUTED, 13, false);
        box.addView(sub, lpm(0, 6, 0, 12));
        final EditText in = new EditText(this);
        in.setSingleLine(true); in.setTextColor(Color.WHITE); in.setTextSize(15);
        in.setFilters(new android.text.InputFilter[] { new android.text.InputFilter.LengthFilter(20) });
        in.setBackground(rbg(0x66000000, 0x992C4BB5, 10));
        in.setPadding(dp(12), dp(11), dp(12), dp(11));
        box.addView(in, lpm(0, 0, 0, 12));
        LinearLayout btns = new LinearLayout(this);
        TextView ok = txt(L("تأكيد", "Confirm"), NAVY, 15, true), skip = txt(L("تخطي", "Skip"), 0xFFCBD5E1, 15, true);
        for (TextView b : new TextView[] { ok, skip }) { b.setGravity(Gravity.CENTER); b.setPadding(0, dp(11), 0, dp(11)); }
        ok.setBackground(rbg(GOLD, 0, 10)); skip.setBackground(rbg(0x00000000, 0x33FFFFFF, 10));
        ok.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { saveRefCode(in.getText().toString().trim().replaceFirst("^@", "")); d.dismiss(); } });
        skip.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { d.dismiss(); } });
        btns.addView(ok, lpw(1f));
        LinearLayout.LayoutParams sl = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
        sl.setMargins(dp(8), 0, 0, 0);
        btns.addView(skip, sl);
        box.addView(btns);
        d.setContentView(box);
        d.getWindow().setBackgroundDrawable(new ColorDrawable(0x00000000));
        d.show();
    }

    // تسجيل الإحالة عند إنشاء حساب المدعو
    protected void registerReferral() {
        final String code = refPrefs().getString("code", "");
        if (code.length() == 0 || token == null) return;
        pool.execute(new Runnable() { @Override public void run() {
            try { rpc("register_referral", new JSONObject().put("p_code", code).toString()); refPrefs().edit().remove("code").apply(); } catch (Exception ignore) {}
        } });
    }
    // صرف المكافأة بعد أول كسب للمدعو
    protected void claimReferralReward() {
        if (token == null) return;
        pool.execute(new Runnable() { @Override public void run() { try { rpc("process_referral_reward", "{}"); } catch (Exception ignore) {} } });
    }
    // مزامنة الرصيد من القاعدة وتحديث الشريط العلوي
    protected void syncPointsPool() { updateTopBar(); }

    // ملخص أرباح الإحالات: {total, done, pending, earned}
    protected JSONObject referralSummary() {
        try {
            JSONArray a = new JSONArray(get("referrals?select=status,reward_fixed&referrer_id=eq." + uid));
            int done = 0; double earned = 0;
            for (int i = 0; i < a.length(); i++) { JSONObject r = a.getJSONObject(i); if ("rewarded".equals(r.optString("status"))) { done++; earned += r.optDouble("reward_fixed", 0); } }
            return new JSONObject().put("total", a.length()).put("done", done).put("pending", a.length() - done).put("earned", earned);
        } catch (Exception e) { return null; }
    }
}
