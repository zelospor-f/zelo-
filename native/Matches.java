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

abstract class Matches extends Leaderboard {
    // ===== من matches.js: التحديات الأسبوعية + نافذة التوقع + تحدّي الأصدقاء + مباريات الليلة/المباشرة =====
    protected final Set<String> predSet = new HashSet<String>();
    protected final Map<String, JSONObject> predMap = new HashMap<String, JSONObject>();
    protected JSONArray fcList = new JSONArray();
    protected String fcFilter = "all", fcFocus = null;
    protected Dialog fcDialog, chDialog, tmDialog, pgDialog;
    protected LinearLayout fcBody;
    protected TextView fcBadgeTv;
    protected Runnable afterPredict = null;
    protected String tmMode = "tonight";
    protected final android.os.Handler timerH = new android.os.Handler();

    // ---------- أدوات واجهة مشتركة (تستعملها الملفات اللاحقة) ----------
    protected GradientDrawable rbg(int fill, int stroke, int rDp) {
        GradientDrawable g = new GradientDrawable();
        g.setColor(fill);
        g.setCornerRadius(dp(rDp));
        if (stroke != 0) g.setStroke(dp(1), stroke);
        return g;
    }
    protected LinearLayout.LayoutParams lpm(int l, int t, int r, int b) {
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        p.setMargins(dp(l), dp(t), dp(r), dp(b));
        return p;
    }
    protected LinearLayout.LayoutParams lpw(float w) { return new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, w); }
    protected TextView txt(String s, int color, int size, boolean bold) {
        TextView t = tv(color, size, bold);
        t.setText(s);
        return t;
    }
    protected LinearLayout uRoot() {
        LinearLayout r = new LinearLayout(this);
        r.setOrientation(LinearLayout.VERTICAL);
        r.setPadding(dp(14), statusH() + dp(6), dp(14), navH() + dp(24));
        return r;
    }
    protected View uHeader(String title, int color, Runnable back) {
        LinearLayout h = new LinearLayout(this);
        h.setGravity(Gravity.CENTER_VERTICAL);
        if (back != null) h.addView(backBtn(back));
        TextView t = txt(title, color, 19, true);
        t.setPadding(dp(12), 0, dp(12), 0);
        h.addView(t, lpw(1f));
        h.setLayoutParams(lpm(0, 0, 0, 14));
        return h;
    }
    protected Dialog uFull(LinearLayout root) {
        Dialog d = sheetDialog(true);
        lbDirection(d);
        ScrollView sc = new ScrollView(this);
        sc.addView(root);
        d.setContentView(sc);
        d.show();
        return d;
    }
    protected View uEmpty(String s) { return lbEmpty(s); }
    protected View uLoading() { return lbEmpty("⏳"); }

    protected long isoMs(String iso) {
        try {
            if (iso == null || iso.length() < 19) return 0;
            String s = iso.replace(' ', 'T');
            String base = s.substring(0, 19);
            long off = 0;
            String rest = s.substring(19);
            int ti = Math.max(rest.lastIndexOf('+'), rest.lastIndexOf('-'));
            if (ti >= 0 && rest.length() >= ti + 3) {
                int sign = rest.charAt(ti) == '+' ? 1 : -1;
                String z = rest.substring(ti + 1).replace(":", "");
                int hh = Integer.parseInt(z.substring(0, 2));
                int mm = z.length() >= 4 ? Integer.parseInt(z.substring(2, 4)) : 0;
                off = sign * (hh * 60L + mm) * 60000L;
            }
            SimpleDateFormat f = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", java.util.Locale.US);
            f.setTimeZone(TimeZone.getTimeZone("UTC"));
            return f.parse(base).getTime() - off;
        } catch (Exception e) { return 0; }
    }
    protected java.util.Locale dateLoc() { return isAr() ? new java.util.Locale("ar", "EG") : java.util.Locale.US; }
    protected String fmtTime(long ms) { return new SimpleDateFormat("HH:mm", dateLoc()).format(new Date(ms)); }
    protected String fmtDay(long ms) { return new SimpleDateFormat("EEEE d MMMM", dateLoc()).format(new Date(ms)); }
    protected String fmtDate(long ms) { return new SimpleDateFormat("d/M/yyyy", dateLoc()).format(new Date(ms)); }

    // ---------- مضيف الصفحات (المباريات/الرسائل) مع الشريط السفلي ----------
    protected void pgClose() {
        if (pgDialog != null) { try { pgDialog.dismiss(); } catch (Exception ignore) {} }
        pgDialog = null;
    }
    protected void pgOpen(View content, int active) {
        pgClose();
        final Dialog d = sheetDialog(true);
        lbDirection(d);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.addView(content, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));
        View line = new View(this);
        line.setBackgroundColor(0x2EF5C35A);
        root.addView(line, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(1)));
        LinearLayout nav = new LinearLayout(this);
        nav.setBackgroundColor(NAVY);
        nav.setPadding(0, 0, 0, navH() - dp(8));
        String[] lb = { "الرئيسية", "المباريات", "فيديو", "الرسائل", "الملف الشخصي" };
        for (int i = 0; i < 5; i++) {
            final int k = i;
            View it = navItem(6 + i, lb[i], null, (6 + i) == active);
            it.setOnClickListener(new View.OnClickListener() {
                @Override public void onClick(View v) {
                    if (k == 0) pgClose();
                    else if (k == 1) { if (active() != 7) showPage("matches"); }
                    else if (k == 2) openVideosTab();
                    else if (k == 3) { if (active() != 9) showPage("messages"); }
                    else showPage("profile");
                }
            });
            nav.addView(it, new LinearLayout.LayoutParams(0, dp(64), 1f));
        }
        root.addView(nav);
        pgActive = active;
        d.setContentView(root);
        pgDialog = d;
        d.setOnDismissListener(new DialogInterface.OnDismissListener() {
            @Override public void onDismiss(DialogInterface di) { if (pgDialog == d) { pgDialog = null; onPageClosed(); } }
        });
        d.show();
    }
    protected int pgActive = 0;
    protected int active() { return pgActive; }
    protected void onPageClosed() {}

    protected void openMatchRoom(String id) { goWeb("room:" + id); }
    protected void createMatchRoom(String id) { goWeb("createroom:" + id); }

    // ---------- التوقعات ----------
    protected void loadPredictions() throws Exception {
        if (uid == null) return;
        JSONArray a = new JSONArray(get("match_predictions?select=*&user_id=eq." + uid));
        predSet.clear(); predMap.clear();
        for (int i = 0; i < a.length(); i++) {
            JSONObject p = a.getJSONObject(i);
            String k = String.valueOf(p.optLong("match_id"));
            predSet.add(k);
            predMap.put(k, p);
        }
    }

    // نافذة إدخال التوقع (showPredictionModal)
    protected void showPredictionModal(final long matchId, final String team1, final String team2) {
        final Dialog d = sheetDialog(false);
        lbDirection(d);
        ScrollView sc = new ScrollView(this);
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setPadding(dp(20), dp(22), dp(20), navH() + dp(16));
        GradientDrawable pbg = rbg(CARD, 0x1AFFFFFF, 0);
        pbg.setCornerRadii(new float[] { dp(22), dp(22), dp(22), dp(22), 0, 0, 0, 0 });
        box.setBackground(pbg);
        TextView ti = txt(tr("enterPredictionTitle", "أدخل توقعك للنتيجة", "Enter your score prediction"), GOLD, 18, true);
        ti.setGravity(Gravity.CENTER);
        box.addView(ti, lpm(0, 0, 0, 16));
        LinearLayout grp = new LinearLayout(this);
        grp.setOrientation(LinearLayout.VERTICAL);
        grp.setPadding(dp(16), dp(16), dp(16), dp(16));
        grp.setBackground(rbg(0x33000000, 0x0DFFFFFF, 16));
        final EditText[] in = new EditText[2];
        String[] names = { team1, team2 };
        for (int i = 0; i < 2; i++) {
            TextView l = txt("⚽ " + tr("goalsLabel", "أهداف", "Goals") + " " + names[i], Color.WHITE, 14, true);
            l.setPadding(0, i == 0 ? 0 : dp(14), 0, dp(8));
            grp.addView(l);
            in[i] = new EditText(this);
            in[i].setInputType(android.text.InputType.TYPE_CLASS_NUMBER);
            in[i].setFilters(new android.text.InputFilter[] { new android.text.InputFilter.LengthFilter(2) });
            in[i].setHint("0");
            in[i].setHintTextColor(MUTED);
            in[i].setTextColor(Color.WHITE);
            in[i].setTextSize(21);
            in[i].setTypeface(Typeface.DEFAULT_BOLD);
            in[i].setGravity(Gravity.CENTER);
            in[i].setBackground(rbg(NAVY, 0x1AFFFFFF, 12));
            in[i].setPadding(dp(10), dp(12), dp(10), dp(12));
            grp.addView(in[i], lpm(0, 0, 0, 0));
        }
        box.addView(grp, lpm(0, 0, 0, 18));
        final TextView sub = gpBtn(tr("submitPredictionBtn", "تأكيد التوقع", "Confirm prediction"), false, true);
        sub.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) {
                String s1 = in[0].getText().toString().trim(), s2 = in[1].getText().toString().trim();
                if (s1.length() == 0 || s2.length() == 0) { toast(tr("enterGoalsError", "أدخل عدد الأهداف للفريقين", "Enter goals for both teams")); return; }
                submitPrediction(d, sub, matchId, team1, team2, Integer.parseInt(s1), Integer.parseInt(s2));
            }
        });
        box.addView(sub, lpm(0, 0, 0, 10));
        TextView cn = gpBtn(tr("cancelBtn", "إلغاء", "Cancel"), true, true);
        cn.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { d.dismiss(); } });
        box.addView(cn, lpm(0, 0, 0, 0));
        sc.addView(box);
        d.setContentView(sc);
        d.show();
    }

    protected void submitPrediction(final Dialog d, final TextView btn, final long matchId, final String t1, final String t2, final int s1, final int s2) {
        btn.setEnabled(false);
        btn.setText("⏳...");
        pool.execute(new Runnable() {
            @Override public void run() {
                String err = null;
                try {
                    String winner = s1 > s2 ? t1 : (s2 > s1 ? t2 : "draw");
                    String ps = t1 + " " + s1 + " - " + s2 + " " + t2 + " | " + tr("winnerLabel", "الفائز:", "Winner:") + " " + (winner.equals("draw") ? tr("drawMatch", "تعادل", "Draw") : winner);
                    JSONObject b = new JSONObject().put("user_id", uid).put("match_id", matchId).put("predicted_score", ps)
                        .put("predicted_home", s1).put("predicted_away", s2).put("points_awarded", 0);
                    send("POST", "match_predictions", new JSONArray().put(b).toString());
                } catch (Exception e) { err = String.valueOf(e.getMessage()); }
                final String fe = err;
                runOnUiThread(new Runnable() {
                    @Override public void run() {
                        if (fe != null) {
                            btn.setEnabled(true);
                            btn.setText(tr("submitPredictionBtn", "تأكيد التوقع", "Confirm prediction"));
                            if (fe.indexOf("account_banned") >= 0) return;
                            toast((fe.indexOf("Tampering rejected") >= 0 || fe.indexOf("التلاعب") >= 0) ? tr("matchStartedError", "بدأت المباراة، لا يمكن التوقع", "The match has started") : tr("connectionError", "تعذّر الاتصال", "Connection error"));
                            return;
                        }
                        try {
                            String k = String.valueOf(matchId);
                            predSet.add(k);
                            predMap.put(k, new JSONObject().put("match_id", matchId).put("predicted_home", s1).put("predicted_away", s2));
                        } catch (Exception ignore) {}
                        d.dismiss();
                        toast(tr("predictionSuccess", "تم تسجيل توقعك ✅", "Prediction saved ✅"));
                        Runnable r = afterPredict;
                        afterPredict = null;
                        if (r != null) r.run();
                        refreshMatchViews();
                    }
                });
            }
        });
    }

    // يعيد رسم الشاشات المفتوحة بعد التوقع (تُملأ في Leagues)
    protected void refreshMatchViews() {
        if (chDialog != null) openChallengesScreen();
    }

    // ---------- التحديات الأسبوعية (openChallengesScreen) ----------
    protected void openChallengesScreen() {
        if (chDialog != null) { try { chDialog.dismiss(); } catch (Exception ignore) {} }
        final LinearLayout root = uRoot();
        root.addView(uHeader("🏆 " + tr("weeklyChallenges", "التحديات الأسبوعية", "Weekly challenges"), GOLD, new Runnable() { @Override public void run() { if (chDialog != null) chDialog.dismiss(); chDialog = null; } }));
        root.addView(uLoading());
        chDialog = uFull(root);
        pool.execute(new Runnable() {
            @Override public void run() {
                JSONArray ms = null;
                try { loadPredictions(); ms = new JSONArray(get("matches?select=*&status=neq.FINISHED&order=match_date.asc")); } catch (Exception ignore) {}
                final JSONArray fm = ms;
                runOnUiThread(new Runnable() {
                    @Override public void run() {
                        if (chDialog == null) return;
                        root.removeAllViews();
                        root.addView(uHeader("🏆 " + tr("weeklyChallenges", "التحديات الأسبوعية", "Weekly challenges"), GOLD, new Runnable() { @Override public void run() { if (chDialog != null) chDialog.dismiss(); chDialog = null; } }));
                        root.addView(fcEntryView());
                        fcRefreshBadge();
                        int shown = 0;
                        if (fm != null) {
                            List<JSONObject> up = new ArrayList<JSONObject>();
                            for (int i = 0; i < fm.length(); i++) {
                                JSONObject m = fm.optJSONObject(i);
                                if (m == null || !"NOT_STARTED".equals(m.optString("status", "").trim().toUpperCase())) continue;
                                if ((System.currentTimeMillis() - isoMs(m.optString("match_date"))) / 3600000.0 > 4) continue;
                                up.add(m);
                            }
                            for (JSONObject m : up) { root.addView(challengeCard(m)); shown++; }
                        }
                        if (shown == 0) root.addView(uEmpty(tr("noMatchesAvailable", "لا توجد مباريات متاحة الآن", "No matches available now")));
                    }
                });
            }
        });
    }

    protected View challengeCard(final JSONObject m) {
        final long id = m.optLong("id");
        final String a = m.optString("team_a", ""), b = m.optString("team_b", "");
        long when = isoMs(m.optString("match_date"));
        boolean started = System.currentTimeMillis() + 3600000 >= when;
        boolean has = predSet.contains(String.valueOf(id));
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setBackground(rbg(CARD, 0x0DFFFFFF, 12));
        LinearLayout top = new LinearLayout(this);
        top.setPadding(dp(15), dp(8), dp(15), dp(8));
        top.setBackgroundColor(0x0DFFFFFF);
        top.addView(txt(tr("matchStatus", "حالة المباراة:", "Status:") + " " + tr("statusNotStarted", "لم تبدأ", "Not started"), GOLD, 12, true), lpw(1f));
        top.addView(txt("📅 " + fmtDate(when) + " | 🕒 " + fmtTime(when), MUTED, 12, false));
        card.addView(top);
        LinearLayout teams = new LinearLayout(this);
        teams.setGravity(Gravity.CENTER_VERTICAL);
        teams.setPadding(dp(15), dp(15), dp(15), dp(10));
        TextView ta = txt(a, Color.WHITE, 16, true); ta.setGravity(Gravity.CENTER);
        TextView tb = txt(b, Color.WHITE, 16, true); tb.setGravity(Gravity.CENTER);
        TextView vs = txt("VS", GOLD, 18, true); vs.setPadding(dp(15), 0, dp(15), 0);
        teams.addView(ta, lpw(1f)); teams.addView(vs); teams.addView(tb, lpw(1f));
        card.addView(teams);
        LinearLayout acts = new LinearLayout(this);
        acts.setPadding(dp(15), 0, dp(15), dp(10));
        acts.addView(predictButton(id, a, b, has, started), lpw(1f));
        if (!started) { View fc = fcMatchButton(id); LinearLayout.LayoutParams fl = lpw(1f); fl.setMargins(dp(10), 0, 0, 0); acts.addView(fc, fl); }
        card.addView(acts);
        LinearLayout rooms = new LinearLayout(this);
        rooms.setOrientation(LinearLayout.VERTICAL);
        rooms.setPadding(dp(15), 0, dp(15), dp(15));
        TextView r1 = txt("💬 " + L("غرفة المباراة", "Match room"), GOLD, 14, true);
        r1.setGravity(Gravity.CENTER); r1.setBackground(rbg(0x0DFFFFFF, 0x59F5C35A, 12)); r1.setPadding(0, dp(11), 0, dp(11));
        r1.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { openMatchRoom(String.valueOf(id)); } });
        TextView r2 = txt("➕ " + L("إنشاء غرفة", "Create room"), 0xFFCBD5E1, 13, true);
        r2.setGravity(Gravity.CENTER); r2.setBackground(rbg(0, 0x40FFFFFF, 12)); r2.setPadding(0, dp(10), 0, dp(10));
        r2.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { createMatchRoom(String.valueOf(id)); } });
        rooms.addView(r1, lpm(0, 0, 0, 0)); rooms.addView(r2, lpm(0, 8, 0, 0));
        card.addView(rooms);
        card.setLayoutParams(lpm(0, 0, 0, 15));
        return card;
    }

    // زر التوقع: توقّع واكسب / تم التوقع / مغلق
    protected TextView predictButton(final long id, final String a, final String b, boolean has, boolean started) {
        TextView btn;
        if (has) {
            btn = txt(tr("btnPredicted", "تم التوقع", "Predicted"), GOLD, 15, true);
            btn.setBackground(rbg(0x33F5C35A, GOLD, 12));
        } else if (started) {
            btn = txt(tr("btnClosed", "مغلق", "Closed"), MUTED, 14, false);
            btn.setBackground(rbg(0x0DFFFFFF, 0xFF14206B, 12));
        } else {
            btn = txt(L("توقّع واكسب", "Predict & win"), Color.WHITE, 15, true);
            btn.setBackground(gpBtnBg(false));
            btn.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { showPredictionModal(id, a, b); } });
        }
        btn.setGravity(Gravity.CENTER);
        btn.setPadding(dp(8), dp(12), dp(8), dp(12));
        return btn;
    }

    // ---------- تحدّي الأصدقاء ----------
    protected void fcLoad() {
        try { fcList = new JSONArray(rpc("get_my_challenges", "{}")); } catch (Exception ignore) {}
    }
    protected int fcPending() {
        int n = 0;
        for (int i = 0; i < fcList.length(); i++) { JSONObject c = fcList.optJSONObject(i); if (c != null && "invited".equals(c.optString("my_status")) && "open".equals(c.optString("state"))) n++; }
        return n;
    }
    protected View fcEntryView() {
        LinearLayout b = new LinearLayout(this);
        b.setGravity(Gravity.CENTER_VERTICAL);
        b.setPadding(dp(14), dp(12), dp(14), dp(12));
        b.setBackground(rbg(0x1AF5C35A, 0x66F5C35A, 16));
        b.addView(txt("👥  " + L("تحدّياتي مع الأصدقاء", "My challenges with friends"), GOLD, 15, true), lpw(1f));
        fcBadgeTv = txt("", NAVY, 13, true);
        fcBadgeTv.setGravity(Gravity.CENTER);
        fcBadgeTv.setMinWidth(dp(22));
        fcBadgeTv.setPadding(dp(6), 0, dp(6), 0);
        fcBadgeTv.setBackground(rbg(GOLD, 0, 11));
        fcBadgeTv.setVisibility(View.GONE);
        b.addView(fcBadgeTv, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, dp(22)));
        b.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { openFriendChallenges(null); } });
        b.setLayoutParams(lpm(0, 0, 0, 14));
        return b;
    }
    protected void fcRefreshBadge() {
        pool.execute(new Runnable() {
            @Override public void run() {
                fcLoad();
                runOnUiThread(new Runnable() {
                    @Override public void run() {
                        if (fcBadgeTv == null) return;
                        int n = fcPending();
                        fcBadgeTv.setVisibility(n > 0 ? View.VISIBLE : View.GONE);
                        fcBadgeTv.setText(n > 0 ? String.valueOf(n) : "");
                    }
                });
            }
        });
    }
    protected View fcMatchButton(final long matchId) {
        TextView b = txt("👥 " + L("تحدَّ أصدقاءك", "Challenge friends"), GOLD, 14, true);
        b.setGravity(Gravity.CENTER);
        b.setPadding(dp(8), dp(12), dp(8), dp(12));
        GradientDrawable g = rbg(0, GOLD, 12);
        g.setStroke(dp(2), GOLD);
        b.setBackground(g);
        b.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { fcPicker(matchId); } });
        return b;
    }
    protected String fcNameOf(JSONObject u) {
        String a = u.optString("nickname_ar", ""), e = u.optString("nickname_en", "");
        String n = isAr() ? (a.length() > 0 ? a : e) : (e.length() > 0 ? e : a);
        return n.length() > 0 ? n : u.optString("username", "");
    }

    protected void fcPicker(final long matchId) {
        final Dialog d = sheetDialog(false);
        lbDirection(d);
        final LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setPadding(dp(16), dp(18), dp(16), navH() + dp(16));
        GradientDrawable pbg = rbg(NAVY, 0x4DF5C35A, 0);
        pbg.setCornerRadii(new float[] { dp(20), dp(20), dp(20), dp(20), 0, 0, 0, 0 });
        box.setBackground(pbg);
        box.addView(uLoading());
        ScrollView sc = new ScrollView(this);
        sc.addView(box);
        d.setContentView(sc);
        d.show();
        pool.execute(new Runnable() {
            @Override public void run() {
                final List<JSONObject> users = new ArrayList<JSONObject>();
                try {
                    JSONArray f = new JSONArray(get("user_follows?select=following_id&follower_id=eq." + uid + "&limit=200"));
                    StringBuilder ids = new StringBuilder();
                    for (int i = 0; i < f.length(); i++) { if (ids.length() > 0) ids.append(","); ids.append(f.getJSONObject(i).optString("following_id")); }
                    if (ids.length() > 0) {
                        JSONArray r = new JSONArray(get("public_profiles?select=user_id,nickname_ar,nickname_en,username,photo_url&user_id=in.(" + ids + ")"));
                        for (int i = 0; i < r.length(); i++) users.add(r.getJSONObject(i));
                    }
                } catch (Exception ignore) {}
                runOnUiThread(new Runnable() {
                    @Override public void run() {
                        box.removeAllViews();
                        if (users.isEmpty()) {
                            TextView e = txt(L("لا تتابع أحداً بعد. تابع أصدقاءك أولاً لتتمكن من تحدّيهم.", "You do not follow anyone yet. Follow your friends first to challenge them."), Color.WHITE, 15, true);
                            e.setGravity(Gravity.CENTER); e.setPadding(dp(10), dp(24), dp(10), dp(24));
                            box.addView(e);
                            TextView c = gpBtn(L("إغلاق", "Close"), true, true);
                            c.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { d.dismiss(); } });
                            box.addView(c);
                            return;
                        }
                        final Set<String> chosen = new HashSet<String>();
                        box.addView(txt(L("اختر أصدقاءك", "Pick your friends"), Color.WHITE, 17, true));
                        final TextView cnt = txt("", MUTED, 12, true);
                        cnt.setPadding(0, dp(4), 0, dp(12));
                        box.addView(cnt);
                        final TextView send = gpBtn(L("أرسل التحدي", "Send challenge"), false, false);
                        final Runnable sync = new Runnable() {
                            @Override public void run() {
                                cnt.setText(L("اخترت " + chosen.size() + " من 9", chosen.size() + " of 9 selected"));
                                send.setEnabled(chosen.size() > 0);
                                send.setAlpha(chosen.size() > 0 ? 1f : 0.5f);
                            }
                        };
                        for (final JSONObject u : users) {
                            final String id = u.optString("user_id");
                            LinearLayout row = new LinearLayout(this_());
                            row.setGravity(Gravity.CENTER_VERTICAL);
                            row.setPadding(dp(10), dp(10), dp(10), dp(10));
                            row.setBackground(rbg(0x0DFFFFFF, 0x14FFFFFF, 14));
                            row.addView(lbAvatar(u.isNull("photo_url") ? "" : u.optString("photo_url"), initial(fcNameOf(u)), 40, 0xFF2C4BB5, false, 1));
                            LinearLayout nm = new LinearLayout(this_());
                            nm.setOrientation(LinearLayout.VERTICAL);
                            nm.setPadding(dp(12), 0, dp(12), 0);
                            nm.addView(txt(fcNameOf(u), Color.WHITE, 14, true));
                            nm.addView(txt("@" + u.optString("username", ""), 0xFFFFD98A, 12, false));
                            row.addView(nm, lpw(1f));
                            final TextView chk = txt("", NAVY, 14, true);
                            chk.setGravity(Gravity.CENTER);
                            chk.setBackground(oval(0x00000000, 0x4DFFFFFF));
                            row.addView(chk, new LinearLayout.LayoutParams(dp(24), dp(24)));
                            final LinearLayout frow = row;
                            row.setOnClickListener(new View.OnClickListener() {
                                @Override public void onClick(View v) {
                                    if (chosen.contains(id)) { chosen.remove(id); chk.setText(""); chk.setBackground(oval(0x00000000, 0x4DFFFFFF)); frow.setBackground(rbg(0x0DFFFFFF, 0x14FFFFFF, 14)); }
                                    else {
                                        if (chosen.size() >= 9) { toast(L("الحد الأقصى 9 أصدقاء", "Maximum 9 friends")); return; }
                                        chosen.add(id); chk.setText("✓"); chk.setBackground(oval(GOLD, GOLD)); frow.setBackground(rbg(0x0DFFFFFF, GOLD, 14));
                                    }
                                    sync.run();
                                }
                            });
                            box.addView(row, lpm(0, 0, 0, 8));
                        }
                        send.setOnClickListener(new View.OnClickListener() {
                            @Override public void onClick(View v) { fcSend(d, send, matchId, chosen); }
                        });
                        box.addView(send, lpm(0, 8, 0, 0));
                        sync.run();
                    }
                });
            }
        });
    }

    protected void fcSend(final Dialog d, final TextView send, final long matchId, final Set<String> chosen) {
        send.setEnabled(false);
        send.setText("⏳");
        pool.execute(new Runnable() {
            @Override public void run() {
                JSONObject res = null;
                try { res = new JSONObject(rpc("create_challenge", new JSONObject().put("p_match_id", matchId).put("p_invitees", new JSONArray(new ArrayList<String>(chosen))).toString())); } catch (Exception ignore) {}
                final JSONObject fr = res;
                runOnUiThread(new Runnable() {
                    @Override public void run() {
                        send.setEnabled(true);
                        send.setText(L("أرسل التحدي", "Send challenge"));
                        if (fr == null) { toast(L("تعذّر الإرسال، حاول لاحقاً", "Could not send, try later")); return; }
                        String st = fr.optString("status", "");
                        if (st.equals("ok")) { d.dismiss(); toast(L("تم إرسال التحدي", "Challenge sent")); openFriendChallenges(fr.optString("id", null)); return; }
                        String msg;
                        if (st.equals("match_started")) msg = L("بدأت المباراة، لا يمكن إنشاء تحدٍّ", "The match has started");
                        else if (st.equals("predict_first")) msg = L("توقّع المباراة أولاً", "Predict the match first");
                        else if (st.equals("daily_limit")) msg = L("وصلت إلى حد 5 تحدّيات اليوم", "You reached 5 challenges today");
                        else if (st.equals("too_many")) msg = L("الحد الأقصى 9 أصدقاء", "Maximum 9 friends");
                        else if (st.equals("no_invitees")) msg = L("لا يمكن دعوة هؤلاء الأصدقاء", "These friends cannot be invited");
                        else msg = L("تعذّر الإرسال", "Could not send");
                        toast(msg);
                    }
                });
            }
        });
    }

    // صفحة تحدّياتي
    protected void openFriendChallenges(String focus) {
        fcFocus = focus;
        if (fcDialog != null) { try { fcDialog.dismiss(); } catch (Exception ignore) {} }
        fcBody = uRoot();
        fcBody.addView(uLoading());
        fcDialog = uFull(fcBody);
        fcDialog.setOnDismissListener(new DialogInterface.OnDismissListener() {
            @Override public void onDismiss(DialogInterface di) { fcDialog = null; timerH.removeCallbacks(fcTick); fcRefreshBadge(); }
        });
        fcReload();
        timerH.removeCallbacks(fcTick);
        timerH.postDelayed(fcTick, 30000);
    }
    protected final Runnable fcTick = new Runnable() {
        @Override public void run() {
            if (fcDialog == null) return;
            fcReload();
            timerH.postDelayed(this, 30000);
        }
    };
    protected void fcReload() {
        pool.execute(new Runnable() {
            @Override public void run() {
                fcLoad();
                runOnUiThread(new Runnable() { @Override public void run() { fcRender(); } });
            }
        });
    }

    protected TextView fcChip(final String key, String label) {
        boolean on = fcFilter.equals(key);
        TextView c = txt(label, on ? 0xFFFFD98A : 0xFFA9B4E6, 14, on);
        c.setPadding(dp(16), dp(8), dp(16), dp(8));
        c.setBackground(rbg(on ? 0x29F5C35A : 0, on ? 0x73F5C35A : 0x24FFFFFF, 20));
        c.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { fcFilter = key; fcRender(); } });
        return c;
    }

    protected void fcRender() {
        if (fcBody == null || fcDialog == null) return;
        fcBody.removeAllViews();
        fcBody.addView(uHeader(L("تحدّياتي مع الأصدقاء", "My challenges with friends"), Color.WHITE, new Runnable() { @Override public void run() { if (fcDialog != null) fcDialog.dismiss(); } }));
        LinearLayout chips = new LinearLayout(this);
        chips.addView(fcChip("all", L("الكل", "All")));
        TextView c2 = fcChip("live", L("الجارية", "Active")), c3 = fcChip("done", L("المنتهية", "Finished"));
        chips.addView(c2, lpm(8, 0, 0, 0)); chips.addView(c3, lpm(8, 0, 0, 0));
        ((LinearLayout.LayoutParams) c2.getLayoutParams()).width = ViewGroup.LayoutParams.WRAP_CONTENT;
        ((LinearLayout.LayoutParams) c3.getLayoutParams()).width = ViewGroup.LayoutParams.WRAP_CONTENT;
        fcBody.addView(chips, lpm(0, 0, 0, 14));
        int shown = 0;
        for (int i = 0; i < fcList.length(); i++) {
            JSONObject c = fcList.optJSONObject(i);
            if (c == null) continue;
            String st = c.optString("state", "");
            if (!(fcFilter.equals("all") || (fcFilter.equals("live") ? !st.equals("settled") : st.equals("settled")))) continue;
            fcBody.addView(fcCard(c));
            shown++;
        }
        if (shown == 0) fcBody.addView(uEmpty(L("لا توجد تحدّيات هنا بعد. اضغط \"تحدَّ أصدقاءك\" على أي مباراة لتبدأ.", "No challenges yet. Tap \"Challenge friends\" on any match to start.")));
        TextView foot = txt(L("تتحدث الصفحة وحدها أثناء فتحها، والتحدّيات المنتهية تبقى هنا.", "This page updates by itself while open; finished challenges stay here."), 0xFF8D99CF, 12, false);
        foot.setGravity(Gravity.CENTER); foot.setPadding(dp(10), dp(6), dp(10), dp(6));
        fcBody.addView(foot);
    }

    protected String memberName(JSONObject m) {
        String a = m.optString("name_ar", ""), e = m.optString("name_en", "");
        String n = isAr() ? (a.length() > 0 ? a : e) : (e.length() > 0 ? e : a);
        return n.length() > 0 ? n : m.optString("username", "");
    }

    protected View fcCard(final JSONObject c) {
        String state = c.optString("state", "");
        String stT; int stC = 0xFFFFD98A;
        if (state.equals("settled")) { stT = L("انتهى", "Finished"); stC = 0xFFC9D3FF; }
        else if (state.equals("waiting")) stT = L("بانتظار التأكيد", "Confirming");
        else if (state.equals("live")) stT = L("جارية", "Live");
        else stT = "invited".equals(c.optString("my_status")) ? L("دعوة", "Invite") : L("لم تبدأ", "Not started");
        JSONArray members = c.optJSONArray("members");
        if (members == null) members = new JSONArray();
        String score = "";
        if (state.equals("settled")) score = c.optInt("home_score") + " - " + c.optInt("away_score");
        else if (state.equals("live") && !c.isNull("live_home") && !c.isNull("live_away")) score = c.optInt("live_home") + " - " + c.optInt("live_away");
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(dp(14), dp(14), dp(14), dp(14));
        boolean focus = fcFocus != null && fcFocus.equals(String.valueOf(c.optLong("id")));
        card.setBackground(rbg(CARD, focus ? GOLD : (state.equals("waiting") ? 0x80F5C35A : 0x1AFFFFFF), 20));
        LinearLayout hd = new LinearLayout(this);
        hd.setGravity(Gravity.CENTER_VERTICAL);
        hd.addView(txt(c.optString("team_a", "") + " × " + c.optString("team_b", ""), Color.WHITE, 15, true), lpw(1f));
        TextView stv = txt(stT + (score.length() > 0 ? " · " + score : ""), stC, 12, true);
        stv.setPadding(dp(10), dp(4), dp(10), dp(4));
        stv.setBackground(rbg(0x14FFFFFF, 0, 20));
        hd.addView(stv);
        card.addView(hd);
        String me = uid == null ? "" : uid;
        List<String> winners = new ArrayList<String>();
        JSONObject mine = null;
        for (int i = 0; i < members.length(); i++) {
            JSONObject m = members.optJSONObject(i);
            if (m == null) continue;
            if (m.optBoolean("winner")) winners.add(me.equals(m.optString("user_id")) ? L("أنت", "You") : memberName(m));
            if (me.equals(m.optString("user_id"))) mine = m;
        }
        if (state.equals("waiting")) {
            TextView b = txt(L("انتهت المباراة. نؤكد النتيجة الآن وسيظهر الفائز هنا تلقائياً وسيصلك إشعار.", "The match is over. We are confirming the result; the winner will appear here and you will get a notification."), 0xFFC9D3FF, 13, false);
            b.setPadding(0, dp(11), 0, 0);
            card.addView(b);
        } else if (state.equals("settled")) {
            String t = "🏆 " + (winners.isEmpty() ? L("لم يُصب أحد النتيجة", "Nobody got it right") : L("الفائزون: ", "Winners: ") + android.text.TextUtils.join(L("، ", ", "), winners));
            TextView b = txt(t, 0xFFFFD98A, 14, true);
            b.setPadding(dp(12), dp(10), dp(12), dp(10));
            b.setBackground(rbg(0x1FF5C35A, 0x66F5C35A, 14));
            card.addView(b, lpm(0, 11, 0, 0));
        }
        LinearLayout rows = new LinearLayout(this);
        rows.setOrientation(LinearLayout.VERTICAL);
        for (int i = 0; i < members.length(); i++) {
            JSONObject m = members.optJSONObject(i);
            if (m == null) continue;
            boolean isMe = me.equals(m.optString("user_id"));
            LinearLayout r = new LinearLayout(this);
            r.setGravity(Gravity.CENTER_VERTICAL);
            r.addView(txt(isMe ? L("أنت", "You") : memberName(m), m.optBoolean("winner") ? 0xFFFFD98A : Color.WHITE, 14, true), lpw(1f));
            TextView right;
            if ("invited".equals(m.optString("status"))) right = txt(L("لم يردّ بعد", "No reply yet"), MUTED, 14, false);
            else if (!m.isNull("pred_home") && !m.isNull("pred_away")) {
                int col = state.equals("settled") ? (m.optBoolean("winner") ? 0xFF7EE0C3 : 0xFFFF8F8F) : Color.WHITE;
                right = txt(m.optInt("pred_home") + " - " + m.optInt("pred_away") + (state.equals("settled") ? (m.optBoolean("winner") ? " ✓" : " ✗") : ""), col, 14, true);
            } else if (m.optBoolean("predicted")) right = txt(L("مخفي حتى بداية المباراة", "Hidden until kick-off"), MUTED, 14, false);
            else right = txt(L("لم يتوقع بعد", "Not predicted yet"), MUTED, 14, false);
            r.addView(right);
            rows.addView(r, lpm(0, 0, 0, 7));
        }
        card.addView(rows, lpm(0, 11, 0, 0));
        final long cid = c.optLong("id");
        if (state.equals("open") && mine != null && !mine.optBoolean("predicted")) {
            TextView p = gpBtn(L("توقّع هذه المباراة", "Predict this match"), false, true);
            p.setOnClickListener(new View.OnClickListener() {
                @Override public void onClick(View v) {
                    afterPredict = new Runnable() { @Override public void run() { fcReload(); } };
                    showPredictionModal(c.optLong("match_id"), c.optString("team_a", ""), c.optString("team_b", ""));
                }
            });
            card.addView(p, lpm(0, 11, 0, 0));
        }
        if ("invited".equals(c.optString("my_status")) && state.equals("open")) {
            LinearLayout ac = new LinearLayout(this);
            TextView ok = gpBtn(L("قبول", "Accept"), false, true);
            ok.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { fcRespond(cid, true); } });
            TextView no = gpBtn(L("رفض", "Decline"), true, true);
            no.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { fcRespond(cid, false); } });
            LinearLayout.LayoutParams a1 = lpw(1f); a1.setMargins(0, 0, dp(5), 0);
            LinearLayout.LayoutParams a2 = lpw(1f); a2.setMargins(dp(5), 0, 0, 0);
            ac.addView(ok, a1); ac.addView(no, a2);
            card.addView(ac, lpm(0, 11, 0, 0));
        }
        card.setLayoutParams(lpm(0, 0, 0, 12));
        return card;
    }

    protected void fcRespond(final long id, final boolean accept) {
        pool.execute(new Runnable() {
            @Override public void run() {
                String st = null;
                try { st = new JSONObject(rpc("respond_challenge", new JSONObject().put("p_id", id).put("p_accept", accept).toString())).optString("status", ""); } catch (Exception ignore) {}
                final String fs = st;
                fcLoad();
                runOnUiThread(new Runnable() {
                    @Override public void run() {
                        fcRender();
                        if (fs == null) toast(L("تعذّر الاتصال", "Connection failed"));
                        else if (fs.equals("ok")) toast(accept ? L("انضممت إلى التحدي", "You joined") : L("تم الرفض", "Declined"));
                        else if (fs.equals("match_started")) toast(L("بدأت المباراة", "The match has started"));
                        else toast(L("تعذّر تنفيذ الطلب", "Could not complete"));
                    }
                });
            }
        });
    }

    // ---------- مباريات الليلة / المباشرة (openTodayMatches) ----------
    protected boolean tmIsLive(JSONObject m) {
        String st = m.optString("status", "").toUpperCase().trim();
        if (st.equals("FINISHED")) return false;
        String ls = (m.optString("live_status", "").length() > 0 ? m.optString("live_status", "") : m.optString("api_status", "")).toUpperCase().trim();
        if (ls.equals("IN_PLAY") || ls.equals("PAUSED") || ls.equals("LIVE")) return true;
        if (ls.equals("FINISHED") || ls.equals("POSTPONED") || ls.equals("CANCELLED") || ls.equals("SUSPENDED")) return false;
        if (st.equals("LIVE") || st.equals("IN_PLAY") || st.equals("PAUSED") || st.equals("HALF_TIME")) return true;
        double mins = (System.currentTimeMillis() - isoMs(m.optString("match_date"))) / 60000.0;
        return mins >= 0 && mins <= 150;
    }

    protected LinearLayout tmBody;
    protected void openTodayMatches(String mode) {
        tmMode = "live".equals(mode) ? "live" : "tonight";
        if (tmDialog != null) { try { tmDialog.dismiss(); } catch (Exception ignore) {} }
        tmBody = uRoot();
        tmBody.addView(uLoading());
        tmDialog = uFull(tmBody);
        tmDialog.setOnDismissListener(new DialogInterface.OnDismissListener() {
            @Override public void onDismiss(DialogInterface di) { tmDialog = null; timerH.removeCallbacks(tmTick); }
        });
        tmLoad();
        timerH.removeCallbacks(tmTick);
        timerH.postDelayed(tmTick, 30000);
    }
    protected final Runnable tmTick = new Runnable() {
        @Override public void run() { if (tmDialog == null) return; tmLoad(); timerH.postDelayed(this, 30000); }
    };
    protected void tmLoad() {
        final String mode = tmMode;
        pool.execute(new Runnable() {
            @Override public void run() {
                List<JSONObject> rows = new ArrayList<JSONObject>();
                boolean ok = true; String er = "";
                try {
                    if (mode.equals("live")) {
                        JSONArray a = new JSONArray(get("matches?select=*&status=neq.FINISHED&order=match_date.asc"));
                        for (int i = 0; i < a.length(); i++) if (tmIsLive(a.getJSONObject(i))) rows.add(a.getJSONObject(i));
                    } else {
                        java.util.Calendar c = java.util.Calendar.getInstance();
                        c.set(java.util.Calendar.HOUR_OF_DAY, 0); c.set(java.util.Calendar.MINUTE, 0); c.set(java.util.Calendar.SECOND, 0); c.set(java.util.Calendar.MILLISECOND, 0);
                        long a0 = c.getTimeInMillis();
                        c.add(java.util.Calendar.DAY_OF_MONTH, 1); c.set(java.util.Calendar.HOUR_OF_DAY, 6);
                        long b0 = c.getTimeInMillis();
                        SimpleDateFormat f = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", java.util.Locale.US);
                        f.setTimeZone(TimeZone.getTimeZone("UTC"));
                        JSONArray a = new JSONArray(get("matches?select=*&match_date=gte." + f.format(new Date(a0)) + "&match_date=lt." + f.format(new Date(b0)) + "&order=match_date.asc"));
                        for (int i = 0; i < a.length(); i++) rows.add(a.getJSONObject(i));
                    }
                } catch (Exception e) { ok = false; er = String.valueOf(e.getMessage()); }
                final boolean fok = ok; final String fer = er;
                final List<JSONObject> fr = rows;
                runOnUiThread(new Runnable() {
                    @Override public void run() {
                        if (tmDialog == null || tmBody == null) return;
                        tmBody.removeAllViews();
                        boolean live = tmMode.equals("live");
                        tmBody.addView(uHeader(live ? L("المباريات المباشرة", "Live matches") : L("مباريات الليلة", "Tonight's matches"), GOLD, new Runnable() { @Override public void run() { if (tmDialog != null) tmDialog.dismiss(); } }));
                        if (!fok) { tmBody.addView(uEmpty(L("تعذّر تحميل المباريات", "Could not load matches") + "\n" + (fer.length() > 90 ? fer.substring(0, 90) : fer))); return; }
                        if (fr.isEmpty()) tmBody.addView(uEmpty(live ? L("لا توجد مباريات مباشرة الآن", "No live matches right now") : L("لا توجد مباريات اليوم", "No matches today")));
                        for (JSONObject m : fr) tmBody.addView(tmCard(m));
                    }
                });
            }
        });
    }

    protected View tmCard(JSONObject m) {
        boolean live = tmIsLive(m);
        boolean done = m.optString("status", "").toUpperCase().equals("FINISHED");
        long when = isoMs(m.optString("match_date"));
        String hm = when > 0 ? fmtTime(when) : "";
        String mid, tag; int tagC, tagBg;
        if (done) { mid = (m.isNull("home_score") ? 0 : m.optInt("home_score")) + " - " + (m.isNull("away_score") ? 0 : m.optInt("away_score")); tag = L("انتهت", "Full time"); tagC = 0xFFC9D3FF; tagBg = 0x14FFFFFF; }
        else if (live) { mid = (m.isNull("live_home") ? 0 : m.optInt("live_home")) + " - " + (m.isNull("live_away") ? 0 : m.optInt("live_away")); tag = "● " + L("مباشر", "LIVE"); tagC = 0xFF14F195; tagBg = 0x1F14F195; }
        else { mid = hm; tag = L("لم تبدأ", "Upcoming"); tagC = 0xFFFFD98A; tagBg = 0x1FF5C35A; }
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(dp(14), dp(12), dp(14), dp(12));
        card.setBackground(rbg(CARD, live ? 0x5914F195 : 0x14FFFFFF, 18));
        LinearLayout top = new LinearLayout(this);
        top.setGravity(Gravity.CENTER_VERTICAL);
        String comp = m.isNull("competition_name") ? "" : m.optString("competition_name", "");
        if (m.optString("competition_emblem", "").length() > 0 && !m.isNull("competition_emblem")) top.addView(lgCrest(m.optString("competition_emblem"), 16));
        TextView cn = txt(comp, MUTED, 12, false);
        cn.setSingleLine(true); cn.setEllipsize(android.text.TextUtils.TruncateAt.END); cn.setPadding(dp(6), 0, dp(6), 0);
        top.addView(cn, lpw(1f));
        TextView tg = txt(tag, tagC, 12, true);
        tg.setPadding(dp(10), dp(3), dp(10), dp(3)); tg.setBackground(rbg(tagBg, 0, 20));
        top.addView(tg);
        card.addView(top, lpm(0, 0, 0, 12));
        LinearLayout r = new LinearLayout(this);
        r.setGravity(Gravity.CENTER_VERTICAL);
        TextView a = txt(m.optString("team_a", ""), Color.WHITE, 15, true); a.setGravity(Gravity.CENTER);
        TextView b = txt(m.optString("team_b", ""), Color.WHITE, 15, true); b.setGravity(Gravity.CENTER);
        TextView md = txt(mid, live ? 0xFF14F195 : GOLD, (done || live) ? 24 : 18, true);
        md.setGravity(Gravity.CENTER); md.setLayoutDirection(View.LAYOUT_DIRECTION_LTR); md.setMinWidth(dp(74));
        r.addView(a, lpw(1f)); r.addView(md); r.addView(b, lpw(1f));
        card.addView(r);
        if (!(!done && !live && hm.length() > 0) && hm.length() > 0) {
            TextView t = txt("🕒 " + hm, 0xFF8D99CF, 12, false);
            t.setGravity(Gravity.CENTER);
            card.addView(t, lpm(0, 8, 0, 0));
        }
        card.setLayoutParams(lpm(0, 0, 0, 12));
        return card;
    }
}
