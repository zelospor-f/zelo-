package PKG;

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

abstract class Login extends Leagues {
    // ===== من login.js: اختيار الأندية (محلي + عالمي، حتى 2) بعد تسجيل الدخول =====
    protected static final int LG_BG = 0xFF08090C, LG_GREEN = 0xFF00FF87, LG_BLUE = 0xFF2AABEE;
    protected final List<String> loginSel = new ArrayList<String>();
    protected Dialog loginDlg;
    protected FrameLayout loginHolder;
    protected Runnable loginDone;
    protected int loginScrollKeep = 0;

    // يحفظ/يدمج صفًا في جدول users (upsert على user_id)
    protected void upsertUser(JSONObject row) throws Exception {
        sendUrl("POST", url + "/rest/v1/users?on_conflict=user_id", new JSONArray().put(row).toString(), "resolution=merge-duplicates,return=minimal");
    }

    protected GradientDrawable loginCard(boolean selected) {
        GradientDrawable g = new GradientDrawable();
        g.setCornerRadius(dp(14));
        if (selected) { g.setColor(0x2600FF87); g.setStroke(dp(2), LG_GREEN); }
        else { g.setColor(0xA614141C); g.setStroke(dp(1), 0x0DFFFFFF); }
        return g;
    }

    protected String loginCountryName(String key, String flag) {
        String n = getCountryName(flag, isAr());
        if (n == null || n.length() == 0) n = key;
        return n.substring(0, 1).toUpperCase() + n.substring(1);
    }

    // نقطة الدخول: تظهر شاشة الاختيار فوق كل شيء ثم تستدعي done عند النجاح
    protected void showLoginScreen(Runnable done) {
        loginDone = done;
        loginSel.clear();
        if (loginDlg != null) { try { loginDlg.dismiss(); } catch (Exception ignore) {} }
        loginDlg = sheetDialog(true);
        loginDlg.getWindow().setBackgroundDrawable(new ColorDrawable(LG_BG));
        lbDirection(loginDlg);
        loginDlg.setCancelable(false);
        loginHolder = new FrameLayout(this);
        loginDlg.setContentView(loginHolder);
        loginDlg.show();
        loginCountries();
    }

    protected View loginConfirmBar() {
        if (loginSel.isEmpty()) return null;
        final TextView b = txt("✅ " + tr("confirmAndContinue", "تأكيد ومتابعة", "Confirm & Continue") + " (" + loginSel.size() + "/2)", Color.BLACK, 16, true);
        b.setGravity(Gravity.CENTER);
        GradientDrawable g = new GradientDrawable(GradientDrawable.Orientation.LEFT_RIGHT, new int[] { LG_BLUE, LG_GREEN });
        g.setCornerRadius(dp(35));
        b.setBackground(g);
        b.setPadding(dp(20), dp(14), dp(20), dp(14));
        b.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { loginConfirm(b); } });
        return b;
    }

    protected void loginFrame(View top, View list, boolean keepScroll) {
        final ScrollView old = loginHolder.getChildCount() > 0 && loginHolder.getChildAt(0) instanceof LinearLayout ? findScroll(loginHolder.getChildAt(0)) : null;
        int sy = (keepScroll && old != null) ? old.getScrollY() : 0;
        loginHolder.removeAllViews();
        LinearLayout col = new LinearLayout(this);
        col.setOrientation(LinearLayout.VERTICAL);
        col.setPadding(dp(12), statusH() + dp(6), dp(12), navH() + dp(12));
        if (top != null) col.addView(top);
        final ScrollView sc = new ScrollView(this);
        sc.addView(list);
        col.addView(sc, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));
        View bar = loginConfirmBar();
        if (bar != null) col.addView(bar, lpm(0, 10, 0, 6));
        loginHolder.addView(col, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        final int fy = sy;
        sc.post(new Runnable() { @Override public void run() { sc.scrollTo(0, fy); } });
    }
    protected ScrollView findScroll(View v) {
        if (v instanceof ScrollView) return (ScrollView) v;
        if (v instanceof ViewGroup) { ViewGroup g = (ViewGroup) v; for (int i = 0; i < g.getChildCount(); i++) { ScrollView s = findScroll(g.getChildAt(i)); if (s != null) return s; } }
        return null;
    }

    protected void loginCountries() {
        // لغة + عنوان
        LinearLayout top = new LinearLayout(this);
        top.setOrientation(LinearLayout.VERTICAL);
        String[] cur = langMeta(getCurrentLang());
        TextView lang = txt(cur[1] + " " + cur[2] + " ▾", Color.BLACK, 14, true);
        lang.setPadding(dp(20), dp(8), dp(20), dp(8));
        GradientDrawable lg = new GradientDrawable(GradientDrawable.Orientation.LEFT_RIGHT, new int[] { LG_BLUE, LG_GREEN });
        lg.setCornerRadius(dp(25));
        lang.setBackground(lg);
        lang.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) {
                openLangPicker(new LangPick() { @Override public void on(String code) { loginSetLanguage(code); } });
            }
        });
        LinearLayout lw = new LinearLayout(this);
        lw.setGravity(Gravity.CENTER);
        lw.addView(lang);
        top.addView(lw, lpm(0, 0, 0, 12));
        TextView h = txt(tr("chooseYourClubs", "اختر ناديك", "Choose Your Clubs"), LG_GREEN, 21, true);
        h.setGravity(Gravity.CENTER);
        top.addView(h);
        TextView p = txt(tr("clubSelectionLimit", "نادٍ محلي + نادٍ عالمي (حتى 2)", "1 Local + 1 Global Club (Max 2)"), 0xFF94A3B8, 13, true);
        p.setGravity(Gravity.CENTER);
        p.setPadding(0, dp(4), 0, dp(10));
        top.addView(p);

        Map<String, List<String[]>> by = new java.util.LinkedHashMap<String, List<String[]>>();
        for (String[] c : ClubsData.ALL) {
            List<String[]> l = by.get(c[0]);
            if (l == null) { l = new ArrayList<String[]>(); by.put(c[0], l); }
            l.add(c);
        }
        LinearLayout list = new LinearLayout(this);
        list.setOrientation(LinearLayout.VERTICAL);
        for (final Map.Entry<String, List<String[]>> e : by.entrySet()) {
            List<String[]> cl = e.getValue();
            String flag = cl.get(0)[4];
            int selHere = 0;
            for (String[] c : cl) if (loginSel.contains(c[1])) selHere++;
            LinearLayout row = new LinearLayout(this);
            row.setGravity(Gravity.CENTER_VERTICAL);
            row.setPadding(dp(14), dp(12), dp(14), dp(12));
            row.setBackground(loginCard(false));
            row.addView(txt(flag.startsWith("http") ? "🏳️" : flag, Color.WHITE, 24, false));
            TextView nm = txt(loginCountryName(e.getKey(), flag), Color.WHITE, 15, true);
            nm.setPadding(dp(12), 0, dp(12), 0);
            row.addView(nm);
            if (selHere > 0) {
                TextView sb = txt("✓ " + selHere, LG_GREEN, 12, true);
                sb.setPadding(dp(8), dp(3), dp(8), dp(3));
                GradientDrawable sg = new GradientDrawable();
                sg.setColor(0x3300FF87); sg.setCornerRadius(dp(10)); sg.setStroke(dp(1), 0x6600FF87);
                sb.setBackground(sg);
                row.addView(sb);
            }
            View sp = new View(this);
            row.addView(sp, lpw(1f));
            TextView ct = txt(cl.size() + " ⚽", LG_GREEN, 13, true);
            ct.setPadding(dp(8), dp(4), dp(8), dp(4));
            GradientDrawable cg = new GradientDrawable();
            cg.setColor(0x0DFFFFFF); cg.setCornerRadius(dp(12)); cg.setStroke(dp(1), 0x1AFFFFFF);
            ct.setBackground(cg);
            row.addView(ct);
            TextView ar = txt(isAr() ? "👈" : "👉", 0xFF666666, 14, false);
            ar.setPadding(dp(8), 0, 0, 0);
            row.addView(ar);
            row.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { loginClubs(e.getKey(), false); } });
            list.addView(row, lpm(0, 0, 0, 8));
        }
        loginFrame(top, list, true);
    }

    protected void loginClubs(final String country, boolean keep) {
        List<String[]> clubs = new ArrayList<String[]>();
        for (String[] c : ClubsData.ALL) if (c[0].equals(country)) clubs.add(c);
        if (clubs.isEmpty()) return;
        String flag = clubs.get(0)[4];
        LinearLayout top = new LinearLayout(this);
        top.setOrientation(LinearLayout.VERTICAL);
        LinearLayout bk = new LinearLayout(this);
        bk.addView(backBtn(new Runnable() { @Override public void run() { loginCountries(); } }));
        top.addView(bk, lpm(0, 0, 0, 10));
        LinearLayout hc = new LinearLayout(this);
        hc.setOrientation(LinearLayout.VERTICAL);
        hc.setGravity(Gravity.CENTER_HORIZONTAL);
        hc.setPadding(dp(10), dp(10), dp(10), dp(10));
        hc.setBackground(rbg(0xA614141C, 0x0DFFFFFF, 14));
        TextView fl = txt(flag.startsWith("http") ? "🏳️" : flag, Color.WHITE, 34, false);
        fl.setGravity(Gravity.CENTER);
        hc.addView(fl);
        TextView cn = txt(loginCountryName(country, flag), Color.WHITE, 17, true);
        cn.setGravity(Gravity.CENTER);
        hc.addView(cn);
        TextView hint = txt(tr("tapClubHint", "اضغط على نادٍ لاختياره", "Tap a club to select it"), LG_GREEN, 12, true);
        hint.setGravity(Gravity.CENTER);
        hc.addView(hint);
        top.addView(hc, lpm(0, 0, 0, 10));
        LinearLayout list = new LinearLayout(this);
        list.setOrientation(LinearLayout.VERTICAL);
        for (final String[] c : clubs) {
            boolean on = loginSel.contains(c[1]);
            LinearLayout row = new LinearLayout(this);
            row.setGravity(Gravity.CENTER_VERTICAL);
            row.setPadding(dp(14), dp(10), dp(14), dp(10));
            row.setBackground(loginCard(on));
            FrameLayout lb = new FrameLayout(this);
            lb.setBackground(rbg(0x4D000000, 0x0DFFFFFF, 8));
            ImageView li = new ImageView(this);
            li.setScaleType(ImageView.ScaleType.FIT_CENTER);
            lb.addView(li, new FrameLayout.LayoutParams(dp(32), dp(32), Gravity.CENTER));
            loadImage(c[5], li);
            row.addView(lb, new LinearLayout.LayoutParams(dp(44), dp(44)));
            TextView nm = txt(getClubName(c), Color.WHITE, 14, true);
            nm.setPadding(dp(12), 0, dp(12), 0);
            row.addView(nm, lpw(1f));
            TextView st = txt(on ? "✅" : "⭕", Color.WHITE, 18, false);
            if (!on) st.setAlpha(0.25f);
            row.addView(st);
            row.setOnClickListener(new View.OnClickListener() {
                @Override public void onClick(View v) {
                    if (loginSel.contains(c[1])) loginSel.remove(c[1]);
                    else {
                        if (loginSel.size() >= 2) { toast(tr("maxClubsAlert", "يمكنك اختيار نادييْن كحد أقصى (محلي وعالمي) ⚠️", "You can select a maximum of 2 clubs (Local & Global) ⚠️")); return; }
                        loginSel.add(c[1]);
                    }
                    loginClubs(country, true);
                }
            });
            list.addView(row, lpm(0, 0, 0, 8));
        }
        loginFrame(top, list, keep);
    }

    protected void loginSetLanguage(final String code) {
        getSharedPreferences("zelo_lang", MODE_PRIVATE).edit().putString("app_lang", code).apply();
        pool.execute(new Runnable() {
            @Override public void run() {
                try { if (uid != null) upsertUser(new JSONObject().put("user_id", uid).put("lang", code)); } catch (Exception ignore) {}
                loadLanguageFile(code);
                runOnUiThread(new Runnable() { @Override public void run() { loginCountries(); } });
            }
        });
    }

    protected void loginConfirm(final TextView btn) {
        if (loginSel.isEmpty()) { toast(tr("selectAtLeastOne", "اختر نادياً واحداً على الأقل للمتابعة", "Please select at least one club to continue.")); return; }
        btn.setText("…");
        btn.setEnabled(false);
        final List<String> sel = new ArrayList<String>(loginSel);
        pool.execute(new Runnable() {
            @Override public void run() {
                String err = null;
                try {
                    JSONObject row = new JSONObject().put("user_id", uid).put("selected_clubs", new JSONArray(sel)).put("lang", getCurrentLang());
                    upsertUser(row);
                    rpc("join_clubs", new JSONObject().put("p_clubs", new JSONArray(sel)).toString());
                } catch (Exception e) { err = String.valueOf(e.getMessage()); }
                final String fe = err;
                runOnUiThread(new Runnable() {
                    @Override public void run() {
                        if (fe != null) {
                            btn.setEnabled(true);
                            btn.setText(tr("retry", "إعادة المحاولة 🔄", "Retry 🔄"));
                            toast("DB Error: " + fe);
                            return;
                        }
                        if (loginDlg != null) loginDlg.dismiss();
                        loginDlg = null;
                        loadBalance();
                        if (loginDone != null) loginDone.run();
                    }
                });
            }
        });
    }
}
