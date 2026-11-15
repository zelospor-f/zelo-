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

abstract class Settings extends ShareCard {
    // ===== من settings.js: شاشة الإعدادات =====
    protected Dialog stDlg;
    protected FrameLayout stRoot;
    protected final android.os.Handler stH = new android.os.Handler();
    protected Runnable stDebounce, stCountdown;
    protected TextView stNote, stIco;

    protected String stJs(String k) { try { return pjson.length() > 0 ? new JSONObject(pjson).optString(k, "") : ""; } catch (Exception e) { return ""; } }
    protected String stNick() {
        String n = isAr() ? stJs("nickname_ar") : stJs("nickname_en");
        if (n.length() == 0 || "null".equals(n)) n = stJs("nickname_ar").length() > 0 && !"null".equals(stJs("nickname_ar")) ? stJs("nickname_ar") : stJs("nickname_en");
        if ("null".equals(n)) n = "";
        return n.length() > 0 ? n : (stEmail().split("@")[0]);
    }
    protected String stUser() { String u = stJs("username"); return u.length() > 0 && !"null".equals(u) ? u : (uname == null ? "" : uname); }
    protected String stEmail() { return getSharedPreferences("zn_auth", MODE_PRIVATE).getString("email", ""); }
    protected String maskEmail(String e) {
        String[] p = String.valueOf(e).split("@");
        if (p.length != 2) return e;
        StringBuilder st = new StringBuilder();
        for (int i = 0; i < Math.max(3, p[0].length() - 2); i++) st.append('*');
        return p[0].substring(0, Math.min(2, p[0].length())) + st + "@" + p[1];
    }

    // ---------- هيكل الشاشة ----------
    protected void openSettings() {
        if (stDlg != null) { try { stDlg.dismiss(); } catch (Exception ignore) {} }
        stDlg = sheetDialog(true);
        stDlg.getWindow().setBackgroundDrawable(new ColorDrawable(NAVY));
        stDlg.getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
        lbDirection(stDlg);
        stRoot = new FrameLayout(this);
        stDlg.setContentView(stRoot);
        stDlg.setOnDismissListener(new DialogInterface.OnDismissListener() { @Override public void onDismiss(DialogInterface d) { stClear(); stDlg = null; } });
        stDlg.show();
        stMain();
    }
    protected void stClear() { if (stDebounce != null) stH.removeCallbacks(stDebounce); if (stCountdown != null) stH.removeCallbacks(stCountdown); }
    protected void stShow(View v) { stClear(); stRoot.removeAllViews(); stRoot.addView(v, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)); }

    // صفحة: رأس + محتوى قابل للتمرير + تذييل اختياري
    protected LinearLayout stPage(String title, String sub, final Runnable back, boolean line, LinearLayout body, View foot) {
        LinearLayout p = new LinearLayout(this);
        p.setOrientation(LinearLayout.VERTICAL);
        p.setPadding(0, statusH() + dp(6), 0, 0);
        LinearLayout h = new LinearLayout(this);
        h.setGravity(Gravity.CENTER_VERTICAL);
        h.setPadding(dp(16), dp(14), dp(16), dp(14));
        if (line) h.setBackground(rbg(0xB3111A4A, 0x00000000, 0));
        h.addView(backBtn(new Runnable() { @Override public void run() { back.run(); } }));
        if (title != null) {
            LinearLayout t = new LinearLayout(this);
            t.setOrientation(LinearLayout.VERTICAL);
            t.setPadding(dp(14), 0, 0, 0);
            t.addView(txt(title, GOLD, 17, true));
            if (sub != null && sub.length() > 0) t.addView(txt(sub, MUTED, 13, false));
            h.addView(t);
        }
        p.addView(h);
        ScrollView sc = new ScrollView(this);
        body.setPadding(dp(16), dp(14), dp(16), dp(20));
        sc.addView(body);
        p.addView(sc, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));
        if (foot != null) p.addView(foot);
        return p;
    }
    protected LinearLayout stBody() { LinearLayout b = new LinearLayout(this); b.setOrientation(LinearLayout.VERTICAL); return b; }
    protected Runnable stBackMain = new Runnable() { @Override public void run() { stMain(); } };
    protected LinearLayout stFoot(View... btns) {
        LinearLayout f = new LinearLayout(this);
        f.setGravity(Gravity.END);
        f.setBackground(rbg(0xB3111A4A, 0x00000000, 0));
        f.setPadding(dp(16), dp(12), dp(16), navH() + dp(14));
        for (int i = 0; i < btns.length; i++) {
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(btns.length > 1 ? 0 : ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT, btns.length > 1 ? 1f : 0f);
            if (i > 0) lp.setMargins(dp(10), 0, 0, 0);
            f.addView(btns[i], lp);
        }
        return f;
    }
    protected TextView stPill(String s, boolean enabled) {
        TextView b = txt(s, Color.WHITE, 15, true);
        b.setGravity(Gravity.CENTER);
        b.setPadding(dp(28), dp(14), dp(28), dp(14));
        GradientDrawable g = new GradientDrawable(GradientDrawable.Orientation.LEFT_RIGHT, new int[] { 0xFF14206B, 0xFF2C4BB5, GOLD });
        g.setCornerRadius(dp(16));
        b.setBackground(g);
        stEnable(b, enabled);
        return b;
    }
    protected TextView stOutline(String s) {
        TextView b = txt(s, GOLD, 15, true);
        b.setGravity(Gravity.CENTER);
        b.setPadding(dp(28), dp(14), dp(28), dp(14));
        b.setBackground(rbg(0x00000000, 0x73F5C35A, 16));
        return b;
    }
    protected void stEnable(TextView b, boolean on) { b.setEnabled(on); b.setAlpha(on ? 1f : 0.4f); }
    protected EditText stEdit(String text, String hint, int maxLen, boolean ltr) {
        EditText e = new EditText(this);
        e.setText(text); e.setHint(hint); e.setHintTextColor(0xB39AA6D6);
        e.setTextColor(Color.WHITE); e.setTextSize(16); e.setSingleLine(true);
        e.setFilters(new android.text.InputFilter[] { new android.text.InputFilter.LengthFilter(maxLen) });
        if (ltr) { e.setTextDirection(View.TEXT_DIRECTION_LTR); e.setGravity(Gravity.START); }
        e.setBackground(null);
        return e;
    }
    protected LinearLayout stBox(String label, View input, boolean off, View trailing) {
        FrameLayout fl = new FrameLayout(this);
        LinearLayout bx = new LinearLayout(this);
        bx.setGravity(Gravity.CENTER_VERTICAL);
        bx.setPadding(dp(14), dp(6), dp(14), dp(6));
        bx.setBackground(rbg(0xFF111A4A, 0x40F5C35A, 14));
        bx.setAlpha(off ? 0.6f : 1f);
        bx.addView(input, lpw(1f));
        if (trailing != null) bx.addView(trailing);
        fl.addView(bx, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        if (label != null) {
            TextView l = txt(label, GOLD, 12, true);
            l.setBackgroundColor(NAVY);
            l.setPadding(dp(8), 0, dp(8), 0);
            FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.TOP | Gravity.START);
            lp.setMargins(dp(12), -dp(10), 0, 0);
            fl.addView(l, lp);
        }
        LinearLayout w = new LinearLayout(this);
        w.setOrientation(LinearLayout.VERTICAL);
        w.addView(fl);
        w.setPadding(0, dp(18), 0, dp(6));
        return w;
    }
    protected TextView stNoteNew() { TextView n = txt("", MUTED, 12, true); n.setPadding(dp(2), dp(4), dp(2), 0); stNote = n; return n; }
    protected void stSetNote(String cls, String text) {
        if (stNote == null) return;
        stNote.setText(text);
        stNote.setTextColor("ok".equals(cls) ? 0xFF14F195 : "bad".equals(cls) ? 0xFFFF6B6B : MUTED);
    }
    protected void stSetIco(String cls, String g) { if (stIco == null) return; stIco.setText(g); stIco.setTextColor("ok".equals(cls) ? 0xFF14F195 : "bad".equals(cls) ? 0xFFFF6B6B : MUTED); }
    protected TextView stIcoNew() { TextView t = txt("", MUTED, 19, true); t.setGravity(Gravity.CENTER); t.setMinWidth(dp(24)); stIco = t; return t; }
    protected void stOnText(EditText e, final Runnable r) {
        e.addTextChangedListener(new android.text.TextWatcher() {
            @Override public void beforeTextChanged(CharSequence s, int a, int b, int c) {}
            @Override public void onTextChanged(CharSequence s, int a, int b, int c) { r.run(); }
            @Override public void afterTextChanged(android.text.Editable s) {}
        });
    }
    protected void stDebounce(Runnable r, long ms) { if (stDebounce != null) stH.removeCallbacks(stDebounce); stDebounce = r; stH.postDelayed(r, ms); }
    protected void stBg(final Runnable work) { pool.execute(work); }

    // ---------- الشاشة الرئيسية ----------
    protected View stRow(String icon, String label, String val, View.OnClickListener ck) {
        LinearLayout r = new LinearLayout(this);
        r.setGravity(Gravity.CENTER_VERTICAL);
        r.setPadding(dp(14), dp(13), dp(14), dp(13));
        TextView ic = txt(icon, GOLD, 18, false);
        ic.setGravity(Gravity.CENTER);
        ic.setBackground(rbg(0x1AF5C35A, 0x40F5C35A, 12));
        r.addView(ic, new LinearLayout.LayoutParams(dp(38), dp(38)));
        LinearLayout t = new LinearLayout(this);
        t.setOrientation(LinearLayout.VERTICAL);
        t.setPadding(dp(12), 0, dp(12), 0);
        t.addView(txt(label, Color.WHITE, 14, true));
        TextView s = txt(val, MUTED, 12, false); s.setSingleLine(true); s.setEllipsize(android.text.TextUtils.TruncateAt.END);
        t.addView(s);
        r.addView(t, lpw(1f));
        r.addView(txt(isRtlLang() ? "‹" : "›", 0xFF6F7BB8, 20, true));
        r.setOnClickListener(ck);
        return r;
    }
    protected LinearLayout stCard() { LinearLayout c = new LinearLayout(this); c.setOrientation(LinearLayout.VERTICAL); c.setBackground(rbg(0x0DFFFFFF, 0x17FFFFFF, 20)); return c; }

    protected void stMain() {
        LinearLayout b = stBody();
        LinearLayout prof = new LinearLayout(this);
        prof.setGravity(Gravity.CENTER_VERTICAL);
        prof.setPadding(dp(14), dp(14), dp(14), dp(14));
        GradientDrawable pg = new GradientDrawable(GradientDrawable.Orientation.TL_BR, new int[] { 0x732C4BB5, 0x24F5C35A });
        pg.setCornerRadius(dp(20)); pg.setStroke(dp(1), 0x4DF5C35A);
        prof.setBackground(pg);
        String ph = stJs("photo_url");
        prof.addView(lbAvatar(ph.startsWith("http") ? ph : "", initial(stNick()), 58, GOLD, false, 3), new LinearLayout.LayoutParams(dp(58), dp(58)));
        LinearLayout t = new LinearLayout(this);
        t.setOrientation(LinearLayout.VERTICAL);
        t.setPadding(dp(14), 0, 0, 0);
        t.addView(txt(stNick(), Color.WHITE, 16, true));
        if (stUser().length() > 0) t.addView(txt("@" + stUser(), 0xFFCFD8FF, 13, false));
        prof.addView(t);
        b.addView(prof);
        b.addView(txt(L("الحساب", "Account"), MUTED, 12, true), lpm(4, 18, 4, 8));
        LinearLayout c1 = stCard();
        c1.addView(stRow("👤", L("الاسم المستعار", "Nickname"), stNick(), new View.OnClickListener() { @Override public void onClick(View v) { stNickScreen(); } }));
        c1.addView(stRow("@", L("اسم المستخدم", "Username"), stUser().length() > 0 ? "@" + stUser() : "—", new View.OnClickListener() { @Override public void onClick(View v) { stUserScreen(); } }));
        c1.addView(stRow("✉️", L("البريد الإلكتروني", "Email"), stEmail().length() > 0 ? stEmail() : "—", new View.OnClickListener() { @Override public void onClick(View v) { stStartEmail(); } }));
        c1.addView(stRow("🔒", L("كلمة المرور", "Password"), "••••••••", new View.OnClickListener() { @Override public void onClick(View v) { stPassScreen(false); } }));
        b.addView(c1);
        b.addView(txt(L("الخصوصية", "Privacy"), MUTED, 12, true), lpm(4, 18, 4, 8));
        LinearLayout c2 = stCard();
        c2.addView(stRow("🚫", L("المحظورون", "Blocked users"), L("إدارة من حظرتهم", "Manage people you blocked"), new View.OnClickListener() { @Override public void onClick(View v) { stBlocked(); } }));
        b.addView(c2);
        TextView out = txt("⎋  " + L("تسجيل الخروج", "Log out"), GOLD, 15, true);
        out.setGravity(Gravity.CENTER);
        out.setBackground(rbg(0x14F5C35A, 0x80F5C35A, 16));
        out.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) {
            new AlertDialog.Builder(Settings.this).setMessage(L("هل تريد تسجيل الخروج؟", "Log out?"))
                .setPositiveButton(L("خروج", "Log out"), new DialogInterface.OnClickListener() { @Override public void onClick(DialogInterface d, int w) { doLogout(); } })
                .setNegativeButton(L("إلغاء", "Cancel"), null).show();
        } });
        b.addView(out, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(50)));
        ((LinearLayout.LayoutParams) out.getLayoutParams()).setMargins(0, dp(22), 0, 0);
        LinearLayout del = new LinearLayout(this);
        del.setGravity(Gravity.CENTER_VERTICAL);
        del.setPadding(dp(14), dp(12), dp(14), dp(12));
        del.setBackground(rbg(0x0FFF4D5E, 0x4DFF6B6B, 18));
        TextView dic = txt("🗑️", 0xFFFF7B86, 18, false); dic.setGravity(Gravity.CENTER);
        del.addView(dic, new LinearLayout.LayoutParams(dp(38), dp(38)));
        LinearLayout dt = new LinearLayout(this);
        dt.setOrientation(LinearLayout.VERTICAL);
        dt.setPadding(dp(12), 0, 0, 0);
        dt.addView(txt(L("حذف الحساب", "Delete account"), 0xFFFF9B9B, 14, true));
        dt.addView(txt(L("منطقة الخطر · لا يمكن التراجع", "Danger zone · Cannot be undone"), MUTED, 12, false));
        del.addView(dt);
        del.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { stDeleteScreen(); } });
        LinearLayout.LayoutParams dl = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        dl.setMargins(0, dp(26), 0, dp(20));
        b.addView(del, dl);
        stShow(stPage(L("الإعدادات", "Settings"), null, new Runnable() { @Override public void run() { if (stDlg != null) stDlg.dismiss(); } }, true, b, null));
    }

    // ---------- المحظورون ----------
    protected void stBlocked() {
        final LinearLayout b = stBody();
        b.addView(txt(L("جارٍ التحميل…", "Loading…"), MUTED, 13, true));
        stShow(stPage("🚫 " + L("المحظورون", "Blocked users"), null, stBackMain, true, b, null));
        stBg(new Runnable() { @Override public void run() {
            final List<String[]> list = new ArrayList<String[]>();
            try {
                JSONArray a = new JSONArray(get("user_blocks?select=blocked_id&user_id=eq." + uid + "&order=created_at.desc"));
                List<String> ids = new ArrayList<String>();
                for (int i = 0; i < a.length(); i++) ids.add(a.getJSONObject(i).optString("blocked_id"));
                Map<String, JSONObject> m = new HashMap<String, JSONObject>();
                if (!ids.isEmpty()) {
                    try { JSONArray u = new JSONArray(get("public_profiles?select=user_id,nickname_ar,nickname_en,nickname,username,photo_url&user_id=in.(" + android.text.TextUtils.join(",", ids) + ")")); for (int i = 0; i < u.length(); i++) m.put(u.getJSONObject(i).optString("user_id"), u.getJSONObject(i)); } catch (Exception ignore) {}
                }
                for (String id : ids) {
                    JSONObject u = m.get(id);
                    String nm = "", un = "", ph = "";
                    if (u != null) {
                        String[] ks = { "nickname_ar", "nickname_en", "nickname", "username" };
                        for (String k : ks) if (nm.length() == 0 && !u.isNull(k)) nm = u.optString(k);
                        un = u.isNull("username") ? "" : u.optString("username"); ph = u.isNull("photo_url") ? "" : u.optString("photo_url");
                    }
                    list.add(new String[] { id, nm, un, ph });
                }
            } catch (Exception ignore) {}
            runOnUiThread(new Runnable() { @Override public void run() { stBlockedRender(b, list); } });
        } });
    }
    protected void stBlockedRender(final LinearLayout b, List<String[]> list) {
        b.removeAllViews();
        if (list.isEmpty()) { TextView e = txt(L("لا يوجد مستخدمون محظورون", "No blocked users"), MUTED, 13, true); e.setGravity(Gravity.CENTER); e.setPadding(0, dp(30), 0, dp(30)); b.addView(e); return; }
        for (final String[] u : list) {
            final LinearLayout r = new LinearLayout(this);
            r.setGravity(Gravity.CENTER_VERTICAL);
            r.setPadding(dp(14), dp(12), dp(14), dp(12));
            r.setBackground(rbg(0xFF111A4A, 0x1FF5C35A, 18));
            String label = u[1].length() > 0 ? u[1] : L("حساب غير متاح", "Unavailable account");
            r.addView(lbAvatar(u[3], initial(label), 44, 0x00000000, false, 1), new LinearLayout.LayoutParams(dp(44), dp(44)));
            LinearLayout t = new LinearLayout(this);
            t.setOrientation(LinearLayout.VERTICAL);
            t.setPadding(dp(12), 0, dp(12), 0);
            t.addView(txt(label, Color.WHITE, 14, true));
            if (u[2].length() > 0) t.addView(txt("@" + u[2], MUTED, 12, false));
            r.addView(t, lpw(1f));
            final TextView ub = stPill(L("إلغاء الحظر", "Unblock"), true);
            ub.setPadding(dp(14), dp(8), dp(14), dp(8)); ub.setTextSize(13);
            ub.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) {
                stEnable(ub, false);
                final String id = u[0];
                stBg(new Runnable() { @Override public void run() {
                    boolean ok = true;
                    try { send("DELETE", "user_blocks?user_id=eq." + uid + "&blocked_id=eq." + id, null); } catch (Exception e) { ok = false; }
                    final boolean fo = ok;
                    runOnUiThread(new Runnable() { @Override public void run() {
                        if (!fo) { stEnable(ub, true); return; }
                        b.removeView(r);
                        if (b.getChildCount() == 0) { TextView e = txt(L("لا يوجد مستخدمون محظورون", "No blocked users"), MUTED, 13, true); e.setGravity(Gravity.CENTER); e.setPadding(0, dp(30), 0, dp(30)); b.addView(e); }
                    } });
                } });
            } });
            r.addView(ub);
            b.addView(r, lpm(0, 0, 0, 10));
        }
    }

    // ---------- اسم المستخدم ----------
    protected static final String ST_RESERVED = "admin,administrator,support,official,moderator,zelosport,zelo_sport,zelo";
    protected void stUserScreen() {
        final String cur = stUser();
        LinearLayout b = stBody();
        EditText curE = stEdit(cur.length() > 0 ? "@" + cur : "", "", 21, true);
        curE.setEnabled(false);
        b.addView(stBox(L("الحالي", "Current"), curE, true, null));
        final EditText in = stEdit(cur, "", 20, true);
        in.setInputType(android.text.InputType.TYPE_CLASS_TEXT | android.text.InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS);
        b.addView(stBox(L("جديد", "New"), in, false, stIcoNew()));
        b.addView(stNoteNew());
        stSetNote("", L("حروف إنجليزية وأرقام و _ فقط، من 3 إلى 20 حرفًا. يُستخدم هذا الاسم لتسجيل الدخول أيضًا.", "English letters, numbers and _ only, 3–20 characters. This name is also used to sign in."));
        final TextView done = stPill(L("تمّ", "Done"), false);
        stOnText(in, new Runnable() { @Override public void run() {
            final String n = in.getText().toString().trim();
            stEnable(done, false);
            if (n.length() == 0) { stSetIco("", ""); return; }
            if (!n.matches("^[A-Za-z0-9_]{3,20}$")) { stSetIco("bad", "✖"); stSetNote("bad", L("حروف إنجليزية وأرقام و _ فقط، من 3 إلى 20", "English letters, numbers and _ only, 3–20 chars")); return; }
            if (n.equals(cur)) { stSetIco("ok", "✔"); stSetNote("ok", L("هذا اسمك الحالي", "This is your current username")); return; }
            if (ST_RESERVED.contains(n.toLowerCase()) && !n.equalsIgnoreCase(cur) && !isAdmin()) { stSetIco("bad", "✖"); stSetNote("bad", L("هذا الاسم محجوز", "This name is reserved")); return; }
            stSetIco("", "…"); stSetNote("", L("جارٍ الفحص...", "Checking..."));
            stDebounce(new Runnable() { @Override public void run() {
                stBg(new Runnable() { @Override public void run() {
                    Boolean taken = n.equalsIgnoreCase(cur) ? Boolean.FALSE : stTaken("is_username_available", "p_username", n);
                    final Boolean ft = taken;
                    runOnUiThread(new Runnable() { @Override public void run() {
                        if (!n.equals(in.getText().toString().trim())) return;
                        if (ft == null) { stSetIco("", "⚠"); stSetNote("bad", L("تعذر فحص الاسم، حاول مرة أخرى", "Could not check the name, try again")); }
                        else if (ft) { stSetIco("bad", "✖"); stSetNote("bad", L("الاسم مأخوذ", "Name is taken")); }
                        else { stSetIco("ok", "✔"); stSetNote("ok", L("الاسم متاح", "Name is available")); stEnable(done, true); }
                    } });
                } });
            } }, 400);
        } });
        done.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) {
            final String n = in.getText().toString().trim();
            if (!n.matches("^[A-Za-z0-9_]{3,20}$")) return;
            stEnable(done, false);
            stBg(new Runnable() { @Override public void run() {
                String err = null; boolean dup = false;
                try {
                    if (!n.equalsIgnoreCase(cur)) { Boolean t = stTaken("is_username_available", "p_username", n); if (t == null || t) { err = t == null ? L("تعذر فحص الاسم", "Could not check the name") : L("الاسم مأخوذ", "Name is taken"); } }
                    if (err == null) send("PATCH", "users?user_id=eq." + uid, new JSONObject().put("username", n).toString());
                } catch (Exception e) { err = String.valueOf(e.getMessage()); if (err.contains("23505")) { err = L("الاسم مأخوذ", "Name is taken"); } }
                final String fe = err;
                runOnUiThread(new Runnable() { @Override public void run() {
                    if (fe != null) { stEnable(done, true); stSetNote("bad", fe); return; }
                    uname = n; stPut("username", n);
                    toast(L("تم حفظ اسم المستخدم ✅", "Username saved ✅"));
                    stMain();
                } });
            } });
        } });
        stShow(stPage(L("اسم المستخدم", "Username"), cur.length() > 0 ? "@" + cur : "", stBackMain, true, b, stFoot(done)));
    }
    protected void stPut(String k, Object v) { try { JSONObject o = pjson.length() > 0 ? new JSONObject(pjson) : new JSONObject(); o.put(k, v); pjson = o.toString(); } catch (Exception ignore) {} }
    // true = مأخوذ، false = متاح، null = تعذر الفحص
    protected Boolean stTaken(String fn, String arg, String val) {
        try { String r = rpc(fn, new JSONObject().put(arg, val).toString()).trim(); if ("false".equals(r)) return Boolean.TRUE; if ("true".equals(r)) return Boolean.FALSE; return null; } catch (Exception e) { return null; }
    }

    // ---------- الاسم المستعار ----------
    protected void stNickScreen() {
        final String cur = stNick();
        LinearLayout b = stBody();
        EditText curE = stEdit(cur, "", 30, false);
        curE.setEnabled(false);
        b.addView(stBox(L("الحالي", "Current"), curE, true, null));
        final EditText in = stEdit(cur, "", 30, false);
        b.addView(stBox(L("جديد", "New"), in, false, stIcoNew()));
        b.addView(stNoteNew());
        final TextView done = stPill(L("تمّ", "Done"), false);
        stOnText(in, new Runnable() { @Override public void run() {
            final String n = in.getText().toString().trim();
            stEnable(done, false);
            if (n.length() < 2) { stSetIco("", ""); stSetNote("", ""); return; }
            if (n.equalsIgnoreCase(cur)) { stSetIco("ok", "✔"); stSetNote("ok", L("هذا اسمك الحالي", "This is your current name")); return; }
            stSetIco("", "…"); stSetNote("", L("جارٍ الفحص...", "Checking..."));
            stDebounce(new Runnable() { @Override public void run() {
                stBg(new Runnable() { @Override public void run() {
                    final Boolean t = stTaken("is_nickname_available", "p_nick", n);
                    runOnUiThread(new Runnable() { @Override public void run() {
                        if (!n.equals(in.getText().toString().trim())) return;
                        if (t == null) { stSetIco("", "⚠"); stSetNote("bad", L("تعذر فحص الاسم، حاول مرة أخرى", "Could not check the name, try again")); }
                        else if (t) { stSetIco("bad", "✖"); stSetNote("bad", L("الاسم مأخوذ", "Name is taken")); }
                        else { stSetIco("ok", "✔"); stSetNote("ok", L("الاسم متاح", "Name is available")); stEnable(done, true); }
                    } });
                } });
            } }, 400);
        } });
        done.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) {
            final String n = in.getText().toString().trim();
            if (n.length() < 2) return;
            stEnable(done, false);
            stBg(new Runnable() { @Override public void run() {
                String err = null;
                final boolean ar = n.matches(".*[؀-ۿ].*");
                try {
                    Boolean t = stTaken("is_nickname_available", "p_nick", n);
                    if (t == null || t) err = t == null ? L("تعذر فحص الاسم", "Could not check the name") : L("الاسم مأخوذ", "Name is taken");
                    else upsertUser(new JSONObject().put("user_id", uid).put("nickname_ar", ar ? n : JSONObject.NULL).put("nickname_en", ar ? JSONObject.NULL : n));
                } catch (Exception e) { err = String.valueOf(e.getMessage()); if (err.contains("23505")) err = L("الاسم مأخوذ", "Name is taken"); }
                final String fe = err;
                runOnUiThread(new Runnable() { @Override public void run() {
                    if (fe != null) { stEnable(done, true); stSetNote("bad", fe); return; }
                    stPut("nickname_ar", ar ? n : ""); stPut("nickname_en", ar ? "" : n);
                    toast(L("تم حفظ الاسم المستعار ✅", "Nickname saved ✅"));
                    stMain();
                } });
            } });
        } });
        stShow(stPage(L("الاسم المستعار", "Nickname"), cur, stBackMain, true, b, stFoot(done)));
    }

    // ---------- رمز التحقق (يُستخدم للبريد الحالي ثم الجديد) ----------
    protected interface StOk { void ok(); }
    protected void stCodeScreen(final String email, final String type, final StOk onOk, final Runnable onBack) {
        LinearLayout b = stBody();
        TextView big = txt(L("لقد أرسلنا لك رمزاً", "We sent you a code"), Color.WHITE, 24, true);
        b.addView(big, lpm(0, 20, 0, 10));
        b.addView(txt(L("أدخل رمز التحقق المرسل إلى ", "Enter the verification code sent to ") + maskEmail(email), MUTED, 14, false), lpm(0, 0, 0, 16));
        final EditText code = stEdit("", L("إدخال رمز التحقق", "Enter verification code"), 8, true);
        code.setInputType(android.text.InputType.TYPE_CLASS_NUMBER);
        code.setGravity(Gravity.CENTER);
        b.addView(stBox(null, code, false, null));
        b.addView(stNoteNew());
        final TextView rs = txt("", MUTED, 14, true);
        rs.setPadding(0, dp(14), 0, 0);
        b.addView(rs);
        final TextView ok = stPill(L("تأكيد", "Confirm"), false);
        stOnText(code, new Runnable() { @Override public void run() { stEnable(ok, code.getText().length() >= 6); if (code.getText().length() > 0) stSetNote("", ""); } });
        final int[] left = { 60 };
        stCountdown = new Runnable() { @Override public void run() {
            if (left[0] > 0) { rs.setTextColor(MUTED); rs.setText(L("ألم تستلم الرمز؟ أعد المحاولة بعد " + left[0] + "ث", "Didn't get a code? Retry in " + left[0] + "s")); left[0]--; stH.postDelayed(this, 1000); }
            else { rs.setTextColor(GOLD); rs.setText(L("ألم تستلم الرمز؟", "Didn't receive the code?")); }
        } };
        stH.post(stCountdown);
        rs.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) {
            if (left[0] > 0) return;
            stSetNote("", L("جارٍ الإرسال...", "Sending..."));
            stBg(new Runnable() { @Override public void run() {
                String err = null;
                try {
                    if (type.equals("email")) authCall("POST", "/auth/v1/otp", new JSONObject().put("email", email).put("create_user", false).toString(), null);
                    else authCall("POST", "/auth/v1/resend", new JSONObject().put("type", "email_change").put("email", email).toString(), token);
                } catch (Exception e) { err = String.valueOf(e.getMessage()); }
                final String fe = err;
                runOnUiThread(new Runnable() { @Override public void run() {
                    if (fe != null) { stSetNote("bad", fe); return; }
                    stSetNote("ok", L("تم إرسال رمز جديد ✅", "New code sent ✅"));
                    left[0] = 60; stH.removeCallbacks(stCountdown); stH.post(stCountdown);
                } });
            } });
        } });
        ok.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) {
            final String tk = code.getText().toString().trim();
            if (tk.length() < 6) return;
            stEnable(ok, false);
            stSetNote("", L("جارٍ التحقق...", "Verifying..."));
            stBg(new Runnable() { @Override public void run() {
                boolean good = true;
                try {
                    JSONObject r = authCall("POST", "/auth/v1/verify", new JSONObject().put("email", email).put("token", tk).put("type", type).toString(), null);
                    // الرد يحمل جلسة جديدة: نحفظها حتى لا تنتهي الجلسة الحالية
                    if (r.optString("access_token").length() > 0 && r.optJSONObject("user") != null)
                        saveSession(r.optString("access_token"), r.optString("refresh_token"), r.optJSONObject("user").optString("id", uid), r.optJSONObject("user").optString("email", stEmail()));
                } catch (Exception e) { good = false; }
                final boolean fg = good;
                runOnUiThread(new Runnable() { @Override public void run() {
                    if (!fg) { stEnable(ok, true); stSetNote("bad", L("الرمز خطأ", "Incorrect code")); return; }
                    stClear(); onOk.ok();
                } });
            } });
        } });
        stShow(stPage(null, null, onBack, false, b, stFoot(ok)));
    }

    // ---------- تغيير البريد ----------
    protected void stStartEmail() {
        final String cur = stEmail();
        if (cur.length() == 0) { stEmailChange(); return; }
        toast(L("جارٍ إرسال الرمز...", "Sending code..."));
        stBg(new Runnable() { @Override public void run() {
            String err = null;
            try { authCall("POST", "/auth/v1/otp", new JSONObject().put("email", cur).put("create_user", false).toString(), null); } catch (Exception e) { err = String.valueOf(e.getMessage()); }
            final String fe = err;
            runOnUiThread(new Runnable() { @Override public void run() {
                if (fe != null) { toast(fe); return; }
                stCodeScreen(cur, "email", new StOk() { @Override public void ok() { stEmailChange(); } }, stBackMain);
            } });
        } });
    }
    protected void stEmailChange() {
        final String cur = stEmail();
        LinearLayout b = stBody();
        b.addView(txt(L("تغيير البريد الإلكتروني", "Change email"), Color.WHITE, 24, true), lpm(0, 20, 0, 10));
        if (cur.length() > 0) b.addView(txt(L("بريدك الإلكتروني الحالي هو ", "Your current email is ") + cur + ".", MUTED, 14, false), lpm(0, 0, 0, 16));
        final EditText in = stEdit("", L("عنوان البريد الإلكتروني", "Email address"), 80, true);
        in.setInputType(android.text.InputType.TYPE_CLASS_TEXT | android.text.InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS);
        b.addView(stBox(null, in, false, null));
        b.addView(stNoteNew());
        final TextView next = stPill(L("التالي", "Next"), false);
        TextView cancel = stOutline(L("إلغاء", "Cancel"));
        cancel.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { stMain(); } });
        stOnText(in, new Runnable() { @Override public void run() { stEnable(next, android.util.Patterns.EMAIL_ADDRESS.matcher(in.getText().toString().trim()).matches()); stSetNote("", ""); } });
        next.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) {
            final String e = in.getText().toString().trim().toLowerCase();
            if (e.equalsIgnoreCase(cur)) { stSetNote("bad", L("هذا بريدك الحالي", "This is your current email")); return; }
            stEnable(next, false); stSetNote("", L("جارٍ الإرسال...", "Sending..."));
            stBg(new Runnable() { @Override public void run() {
                String err = null;
                try { authCall("PUT", "/auth/v1/user", new JSONObject().put("email", e).toString(), token); } catch (Exception ex) { err = String.valueOf(ex.getMessage()); }
                final String fe = err;
                runOnUiThread(new Runnable() { @Override public void run() {
                    if (fe != null) { stEnable(next, true); stSetNote("bad", fe); return; }
                    stCodeScreen(e, "email_change", new StOk() { @Override public void ok() { stFinishEmail(e); } }, new Runnable() { @Override public void run() { stEmailChange(); } });
                } });
            } });
        } });
        stShow(stPage(null, null, stBackMain, false, b, stFoot(cancel, next)));
    }
    protected void stFinishEmail(final String e) {
        stBg(new Runnable() { @Override public void run() {
            try { send("PATCH", "users?user_id=eq." + uid, new JSONObject().put("email", e).toString()); } catch (Exception ignore) {}
            getSharedPreferences("zn_auth", MODE_PRIVATE).edit().putString("email", e).apply();
            runOnUiThread(new Runnable() { @Override public void run() { toast(L("تم تغيير البريد ✅", "Email changed ✅")); stMain(); } });
        } });
    }

    // ---------- كلمة المرور ----------
    protected View stPassBox(String hint, EditText[] out, int idx) {
        final EditText e = stEdit("", hint, 64, true);
        e.setInputType(android.text.InputType.TYPE_CLASS_TEXT | android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD);
        out[idx] = e;
        final TextView eye = txt("👁", MUTED, 20, false);
        eye.setPadding(dp(6), 0, dp(6), 0);
        eye.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) {
            boolean hidden = (e.getInputType() & android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD) != 0;
            e.setInputType(android.text.InputType.TYPE_CLASS_TEXT | (hidden ? android.text.InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD : android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD));
            e.setSelection(e.getText().length());
        } });
        return stBox(null, e, false, eye);
    }
    protected void stPassScreen(final boolean reset) {
        final EditText[] f = new EditText[3];
        LinearLayout b = stBody();
        if (!reset) b.addView(stPassBox(L("كلمة المرور الحالية", "Current password"), f, 0));
        b.addView(stPassBox(L("كلمة المرور الجديدة", "New password"), f, 1));
        b.addView(txt(L("8 أحرف على الأقل", "8 characters minimum"), MUTED, 12, true), lpm(2, 2, 2, 0));
        b.addView(stPassBox(L("تأكيد كلمة المرور", "Confirm password"), f, 2));
        b.addView(stNoteNew());
        final TextView btn = stPill(L("تحديث كلمة المرور", "Update password"), false);
        btn.setGravity(Gravity.CENTER);
        b.addView(btn, lpm(0, 22, 0, 0));
        Runnable check = new Runnable() { @Override public void run() {
            boolean ok = (reset || f[0].getText().length() > 0) && f[1].getText().length() >= 8 && f[1].getText().toString().equals(f[2].getText().toString());
            stEnable(btn, ok);
            if (f[2].getText().length() > 0 && !f[1].getText().toString().equals(f[2].getText().toString())) stSetNote("bad", L("كلمتا المرور غير متطابقتين", "Passwords do not match")); else stSetNote("", "");
        } };
        for (EditText e : f) if (e != null) stOnText(e, check);
        if (!reset) {
            TextView fg = txt(L("هل نسيت كلمة المرور؟", "Forgot your password?"), GOLD, 14, true);
            fg.setGravity(Gravity.CENTER); fg.setPadding(0, dp(16), 0, 0);
            fg.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { stRecover(); } });
            b.addView(fg);
        }
        btn.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) {
            stEnable(btn, false); stSetNote("", L("جارٍ التحديث...", "Updating..."));
            final String cur = reset ? "" : f[0].getText().toString(), np = f[1].getText().toString();
            stBg(new Runnable() { @Override public void run() {
                String err = null;
                try {
                    if (!reset) {
                        try { authCall("POST", "/auth/v1/token?grant_type=password", new JSONObject().put("email", stEmail()).put("password", cur).toString(), null); }
                        catch (Exception e) { throw new Exception(L("كلمة المرور الحالية غير صحيحة. إن لم تعيّن كلمة مرور من قبل فاستخدم «هل نسيت كلمة المرور؟»", "Current password is incorrect. If you have never set one, use “Forgot your password?”")); }
                    }
                    authCall("PUT", "/auth/v1/user", new JSONObject().put("password", np).toString(), token);
                } catch (Exception e) { err = String.valueOf(e.getMessage()); }
                final String fe = err;
                runOnUiThread(new Runnable() { @Override public void run() {
                    if (fe != null) { stEnable(btn, true); stSetNote("bad", fe); return; }
                    toast(L("تم تحديث كلمة المرور ✅", "Password updated ✅")); stMain();
                } });
            } });
        } });
        stShow(stPage(L("تغيير كلمة المرور", "Change password"), stUser().length() > 0 ? "@" + stUser() : "", stBackMain, true, b, null));
    }
    protected void stRecover() {
        LinearLayout b = stBody();
        b.addView(txt(L("اختر طريقة لاستعادة حسابك", "Choose a way to recover your account"), Color.WHITE, 24, true), lpm(0, 20, 0, 10));
        b.addView(txt(L("سنرسل لك رمزاً لتسجيل الدخول", "We'll send you a code to sign in"), MUTED, 14, false));
        b.addView(stNoteNew());
        final TextView mail = stOutline("✉️  " + L("رمز البريد الإلكتروني", "Email code"));
        mail.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) {
            final String cur = stEmail();
            if (cur.length() == 0) { stSetNote("bad", L("لا يوجد بريد مرتبط بحسابك", "No email linked to your account")); return; }
            stEnable(mail, false); stSetNote("", L("جارٍ الإرسال...", "Sending..."));
            stBg(new Runnable() { @Override public void run() {
                String err = null;
                try { authCall("POST", "/auth/v1/otp", new JSONObject().put("email", cur).put("create_user", false).toString(), null); } catch (Exception e) { err = String.valueOf(e.getMessage()); }
                final String fe = err;
                runOnUiThread(new Runnable() { @Override public void run() {
                    if (fe != null) { stEnable(mail, true); stSetNote("bad", fe); return; }
                    stCodeScreen(cur, "email", new StOk() { @Override public void ok() { stPassScreen(true); } }, new Runnable() { @Override public void run() { stRecover(); } });
                } });
            } });
        } });
        stShow(stPage(null, null, new Runnable() { @Override public void run() { stPassScreen(false); } }, false, b, stFoot(mail)));
    }

    // ---------- حذف الحساب ----------
    protected void stDeleteScreen() {
        final String word = L("حذف", "DELETE");
        LinearLayout b = stBody();
        b.addView(txt(L("سيُحذف حسابك نهائياً مع توقعاتك ورصيد ZELO، ولا يمكن التراجع عن ذلك.", "Your account, predictions and ZELO balance will be permanently deleted. This cannot be undone."), 0xFFFF9B9B, 13, true));
        b.addView(txt("⚠️ " + L("حذف الحساب لا يلغي اشتراكك في Google Play. ألغِه بنفسك من Play Store ← الاشتراكات حتى لا يستمر الخصم. وتأكد من إنهاء أي سحب USDT معلّق قبل الحذف، فالرصيد والألماس لا يمكن استرجاعهما.", "Deleting your account does not cancel your Google Play subscription. Cancel it yourself in Play Store → Subscriptions to avoid further charges. Also finish any pending USDT withdrawal first: balances and diamonds cannot be recovered."), 0xFFFFD98A, 13, true), lpm(0, 10, 0, 0));
        final EditText in = stEdit("", "", 12, false);
        b.addView(stBox(L("اكتب الكلمة للتأكيد: ", "Type the word to confirm: ") + word, in, false, null));
        final TextView btn = stPill(L("حذف نهائي", "Delete permanently"), false);
        btn.setBackground(rbg(0xFFE5484D, 0, 16));
        stOnText(in, new Runnable() { @Override public void run() { stEnable(btn, in.getText().toString().trim().equals(word)); } });
        btn.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) {
            stEnable(btn, false); btn.setText("…");
            stBg(new Runnable() { @Override public void run() {
                String err = null;
                try { JSONObject r = authCall("POST", "/functions/v1/delete-account", "{}", token); if (!r.optBoolean("success")) throw new Exception(r.optString("error", "failed")); }
                catch (Exception e) { err = String.valueOf(e.getMessage()); }
                final String fe = err;
                runOnUiThread(new Runnable() { @Override public void run() {
                    if (fe != null) {
                        stEnable(btn, true); btn.setText(L("حذف نهائي", "Delete permanently"));
                        toast(fe.contains("pending_withdrawal") ? L("عندك سحب معلّق، انتظر حتى ينتهي ثم احذف حسابك", "You have a pending withdrawal. Wait until it finishes, then delete your account") : L("تعذر حذف الحساب، حاول لاحقاً", "Could not delete the account, try later"));
                        return;
                    }
                    doLogout();
                } });
            } });
        } });
        stShow(stPage("🗑️ " + L("حذف الحساب", "Delete account"), null, stBackMain, true, b, stFoot(btn)));
    }
}
