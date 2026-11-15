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

abstract class Leagues extends Matches {
    // ===== من leagues.js: صفحة المباريات (قائمة الدوريات ← داخل الدوري: قادمة / منتهية مع توقعك) + شاشة «تنبّأ» =====
    protected static final String[][] LQ_NAMES = {
        { "PL", "الدوري الإنجليزي الممتاز", "Premier League", "🏴" }, { "ELC", "دوري الدرجة الأولى الإنجليزي", "Championship", "🏴" },
        { "PD", "الدوري الإسباني", "La Liga", "🇪🇸" }, { "SA", "الدوري الإيطالي", "Serie A", "🇮🇹" },
        { "BL1", "الدوري الألماني", "Bundesliga", "🇩🇪" }, { "FL1", "الدوري الفرنسي", "Ligue 1", "🇫🇷" },
        { "DED", "الدوري الهولندي", "Eredivisie", "🇳🇱" }, { "PPL", "الدوري البرتغالي", "Primeira Liga", "🇵🇹" },
        { "BSA", "الدوري البرازيلي", "Brasileirão", "🇧🇷" }, { "CL", "دوري أبطال أوروبا", "Champions League", "⭐" },
        { "EL", "الدوري الأوروبي", "Europa League", "⭐" }, { "CLI", "كوبا ليبرتادوريس", "Copa Libertadores", "🏆" },
        { "WC", "كأس العالم", "World Cup", "🌍" }, { "EC", "بطولة أوروبا", "Euro", "🌍" }
    };
    protected static final String[] LQ_ORDER = { "CL", "EL", "PL", "PD", "SA", "BL1", "FL1", "PPL", "DED", "ELC", "BSA", "CLI", "WC", "EC" };
    protected LinearLayout lqBox;
    protected ScrollView lqScroll;
    protected String lqCode = null, lqTabKey = "up";
    protected Dialog lqPredDialog;
    protected LinearLayout lqPredBody;

    protected String[] lqInfo(String code) {
        for (String[] n : LQ_NAMES) if (n[0].equals(code)) return n;
        return null;
    }
    protected String lqName(String code, String fallback) {
        String[] n = lqInfo(code);
        if (n != null) return isAr() ? n[1] : n[2];
        return fallback != null && fallback.length() > 0 ? fallback : code;
    }
    protected String lqFlag(String code) { String[] n = lqInfo(code); return n == null ? "⚽" : n[3]; }

    // شعار الدوري: الصورة، وإلا الإيموجي
    protected View lqLogo(String code, String emblem, int sizeDp) {
        if (emblem == null || emblem.length() == 0 || emblem.equals("null")) {
            TextView t = txt(lqFlag(code), Color.WHITE, 20, false);
            t.setGravity(Gravity.CENTER);
            return t;
        }
        ImageView iv = new ImageView(this);
        iv.setScaleType(ImageView.ScaleType.FIT_CENTER);
        iv.setLayoutParams(new LinearLayout.LayoutParams(dp(sizeDp), dp(sizeDp)));
        loadImage(emblem, iv);
        return iv;
    }

    protected View lqIconBox(String code, String emblem, int boxDp) {
        FrameLayout f = new FrameLayout(this);
        f.setBackground(rbg(0xFF14206B, 0x59F5C35A, 12));
        View l = lqLogo(code, emblem, 28);
        f.addView(l, new FrameLayout.LayoutParams(l instanceof ImageView ? dp(28) : ViewGroup.LayoutParams.WRAP_CONTENT, l instanceof ImageView ? dp(28) : ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.CENTER));
        f.setLayoutParams(new LinearLayout.LayoutParams(dp(boxDp), dp(boxDp)));
        return f;
    }

    // ---------- المباريات (تبويب) ----------
    protected void openMatchesPage() {
        lqScroll = new ScrollView(this);
        lqBox = new LinearLayout(this);
        lqBox.setOrientation(LinearLayout.VERTICAL);
        lqBox.setPadding(dp(14), statusH() + dp(6), dp(14), dp(24));
        lqScroll.addView(lqBox);
        lqCode = null;
        pgOpen(lqScroll, 7);
        lqHub();
    }

    @Override protected void onPageClosed() { lqBox = null; lqScroll = null; lqCode = null; }

    protected void lqHub() {
        if (lqBox == null) return;
        lqCode = null;
        lqBox.removeAllViews();
        lqBox.addView(uLoading());
        lqScroll.scrollTo(0, 0);
        pool.execute(new Runnable() {
            @Override public void run() {
                Map<String, String[]> by = new HashMap<String, String[]>();   // code → {name, emblem, up}
                try {
                    SimpleDateFormat f = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", java.util.Locale.US);
                    f.setTimeZone(TimeZone.getTimeZone("UTC"));
                    String since = f.format(new Date(System.currentTimeMillis() - 30L * 86400000L));
                    JSONArray a = new JSONArray(get("matches?select=competition_code,competition_name,competition_emblem,status&match_date=gte." + since + "&competition_code=not.is.null&limit=2000"));
                    for (int i = 0; i < a.length(); i++) {
                        JSONObject r = a.getJSONObject(i);
                        String code = r.optString("competition_code");
                        String[] o = by.get(code);
                        if (o == null) { o = new String[] { r.isNull("competition_name") ? "" : r.optString("competition_name"), "", "0" }; by.put(code, o); }
                        String st = r.optString("status");
                        if (st.equals("NOT_STARTED") || st.equals("LIVE")) o[2] = String.valueOf(Integer.parseInt(o[2]) + 1);
                        if (!r.isNull("competition_emblem") && r.optString("competition_emblem").length() > 0) o[1] = r.optString("competition_emblem");
                    }
                } catch (Exception ignore) {}
                final List<String> codes = new ArrayList<String>(by.keySet());
                java.util.Collections.sort(codes, new java.util.Comparator<String>() {
                    @Override public int compare(String x, String y) {
                        int ix = java.util.Arrays.asList(LQ_ORDER).indexOf(x), iy = java.util.Arrays.asList(LQ_ORDER).indexOf(y);
                        return (ix < 0 ? 99 : ix) - (iy < 0 ? 99 : iy);
                    }
                });
                final Map<String, String[]> fby = by;
                runOnUiThread(new Runnable() {
                    @Override public void run() {
                        if (lqBox == null || lqCode != null) return;
                        lqBox.removeAllViews();
                        LinearLayout top = new LinearLayout(this_());
                        top.setGravity(Gravity.CENTER_VERTICAL);
                        top.addView(txt("⚽ " + L("المباريات", "Matches"), Color.WHITE, 19, true), lpw(1f));
                        lqBox.addView(top, lpm(0, 0, 0, 14));
                        lqBox.addView(fcEntryView());
                        fcRefreshBadge();
                        TextView hint = txt(L("اختر دوريًا وتوقّع مبارياته مباشرة", "Pick a league and predict its matches"), 0xFF8D99CF, 13, false);
                        hint.setPadding(dp(2), 0, dp(2), dp(4));
                        lqBox.addView(hint);
                        lqBox.addView(lqSection(L("الدوريات والبطولات", "Leagues & cups")));
                        if (codes.isEmpty()) lqBox.addView(uEmpty(L("لا توجد مباريات الآن", "No matches right now")));
                        for (final String code : codes) {
                            String[] o = fby.get(code);
                            LinearLayout row = new LinearLayout(this_());
                            row.setGravity(Gravity.CENTER_VERTICAL);
                            row.setPadding(dp(12), dp(12), dp(12), dp(12));
                            row.setBackground(rbg(CARD, 0x12FFFFFF, 16));
                            row.addView(lqIconBox(code, o[1], 42));
                            LinearLayout nm = new LinearLayout(this_());
                            nm.setOrientation(LinearLayout.VERTICAL);
                            nm.setPadding(dp(12), 0, dp(12), 0);
                            nm.addView(txt(lqName(code, o[0]), Color.WHITE, 15, true));
                            nm.addView(txt(o[0], 0xFF8D99CF, 12, false));
                            row.addView(nm, lpw(1f));
                            int up = Integer.parseInt(o[2]);
                            if (up > 0) {
                                TextView n = txt(String.valueOf(up), GOLD, 12, true);
                                n.setGravity(Gravity.CENTER); n.setPadding(dp(8), dp(3), dp(8), dp(3)); n.setMinWidth(dp(26));
                                n.setBackground(rbg(0x26F5C35A, 0, 20));
                                row.addView(n);
                            }
                            row.addView(txt(isAr() ? "‹" : "›", 0xFF8D99CF, 18, false));
                            row.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { lqOpen(code, "up"); } });
                            lqBox.addView(row, lpm(0, 0, 0, 8));
                        }
                        lqBox.addView(lqSection(L("الدوريات العربية", "Arab leagues")));
                        LinearLayout soon = new LinearLayout(this_());
                        soon.setGravity(Gravity.CENTER_VERTICAL);
                        soon.setPadding(dp(12), dp(12), dp(12), dp(12));
                        soon.setBackground(rbg(CARD, 0x12FFFFFF, 16));
                        soon.setAlpha(0.75f);
                        FrameLayout ib = new FrameLayout(this_());
                        ib.setBackground(rbg(0xFF14206B, 0x59F5C35A, 12));
                        TextView mo = txt("🌙", Color.WHITE, 20, false);
                        ib.addView(mo, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.CENTER));
                        soon.addView(ib, new LinearLayout.LayoutParams(dp(42), dp(42)));
                        LinearLayout nm = new LinearLayout(this_());
                        nm.setOrientation(LinearLayout.VERTICAL);
                        nm.setPadding(dp(12), 0, dp(12), 0);
                        nm.addView(txt(L("الدوري السعودي والمصري وغيرها", "Saudi, Egyptian & more"), Color.WHITE, 15, true));
                        nm.addView(txt(L("قريبًا", "Coming soon"), 0xFF8D99CF, 12, false));
                        soon.addView(nm, lpw(1f));
                        lqBox.addView(soon, lpm(0, 0, 0, 8));
                    }
                });
            }
        });
    }

    protected View lqSection(String s) {
        TextView t = txt(s, GOLD, 13, true);
        t.setPadding(dp(2), dp(14), dp(2), dp(6));
        return t;
    }

    // ---------- داخل الدوري ----------
    protected void lqOpen(final String code, String tab) {
        if (lqBox == null) return;
        lqCode = code;
        lqTabKey = tab.equals("fin") ? "fin" : "up";
        lqBox.removeAllViews();
        lqBox.addView(uLoading());
        final String tk = lqTabKey;
        pool.execute(new Runnable() {
            @Override public void run() {
                JSONArray ms = new JSONArray();
                Map<String, String> crests = new HashMap<String, String>();
                try {
                    loadPredictions();
                    ms = new JSONArray(get("matches?select=*&competition_code=eq." + code + "&status=neq.CANCELLED&order=match_date.asc&limit=400"));
                    JSONArray st = new JSONArray(get("standings?select=team_name,crest&competition_code=eq." + code));
                    for (int i = 0; i < st.length(); i++) { JSONObject t = st.getJSONObject(i); if (!t.isNull("crest") && t.optString("crest").length() > 0) crests.put(t.optString("team_name").trim().toLowerCase(), t.optString("crest")); }
                } catch (Exception ignore) {}
                final JSONArray fm = ms;
                final Map<String, String> fc = crests;
                runOnUiThread(new Runnable() {
                    @Override public void run() {
                        if (lqBox == null || !code.equals(lqCode)) return;
                        lqRenderLeague(code, tk, fm, fc);
                    }
                });
            }
        });
    }

    protected void lqRenderLeague(final String code, String tab, JSONArray ms, Map<String, String> crests) {
        lqBox.removeAllViews();
        List<JSONObject> up = new ArrayList<JSONObject>(), fin = new ArrayList<JSONObject>();
        String emblem = "", compName = "";
        for (int i = 0; i < ms.length(); i++) {
            JSONObject m = ms.optJSONObject(i);
            if (m == null) continue;
            if (emblem.length() == 0 && !m.isNull("competition_emblem")) emblem = m.optString("competition_emblem", "");
            if (compName.length() == 0 && !m.isNull("competition_name")) compName = m.optString("competition_name", "");
            String st = m.optString("status");
            if (st.equals("NOT_STARTED") || st.equals("LIVE")) up.add(m);
            else if (st.equals("FINISHED")) fin.add(0, m);
        }
        LinearLayout top = new LinearLayout(this);
        top.setGravity(Gravity.CENTER_VERTICAL);
        top.addView(backBtn(new Runnable() { @Override public void run() { lqHub(); } }));
        View ic = lqIconBox(code, emblem, 38);
        LinearLayout.LayoutParams il = new LinearLayout.LayoutParams(dp(38), dp(38));
        il.setMargins(dp(10), 0, dp(10), 0);
        top.addView(ic, il);
        LinearLayout nm = new LinearLayout(this);
        nm.setOrientation(LinearLayout.VERTICAL);
        nm.addView(txt(lqName(code, compName), Color.WHITE, 17, true));
        String[] info = lqInfo(code);
        if (info != null && isAr()) nm.addView(txt(info[2], MUTED, 12, false));
        top.addView(nm, lpw(1f));
        lqBox.addView(top, lpm(0, 0, 0, 14));
        lqBox.addView(lbTabBar(new String[] { L("القادمة", "Upcoming") + " (" + up.size() + ")", L("المنتهية", "Finished") + " (" + fin.size() + ")" }, tab.equals("up") ? 0 : 1, new TabPick() {
            @Override public void on(int i) { lqOpen(code, i == 0 ? "up" : "fin"); }
        }), lpm(0, 0, 0, 6));
        List<JSONObject> arr = tab.equals("up") ? up : fin;
        if (arr.isEmpty()) { lqBox.addView(uEmpty(L("لا توجد مباريات", "No matches"))); lqScroll.scrollTo(0, 0); return; }
        String last = "";
        for (JSONObject m : arr) {
            String d = fmtDay(isoMs(m.optString("match_date")));
            if (!d.equals(last)) { lqBox.addView(lqDayHead(d)); last = d; }
            lqBox.addView(makeCard(m, crests, false));
        }
        lqScroll.scrollTo(0, 0);
    }

    protected View lqDayHead(String d) {
        LinearLayout r = new LinearLayout(this);
        r.setGravity(Gravity.CENTER_VERTICAL);
        r.addView(txt(d, 0xFFFFD98A, 13, true));
        View line = new View(this);
        line.setBackgroundColor(0x40F5C35A);
        LinearLayout.LayoutParams ll = new LinearLayout.LayoutParams(0, dp(1), 1f);
        ll.setMargins(dp(10), 0, 0, 0);
        r.addView(line, ll);
        r.setLayoutParams(lpm(2, 16, 2, 8));
        return r;
    }

    // دائرة شعار الفريق مع حرف احتياطي
    protected View lqTeam(String n, Map<String, String> crests) {
        LinearLayout t = new LinearLayout(this);
        t.setOrientation(LinearLayout.VERTICAL);
        t.setGravity(Gravity.CENTER_HORIZONTAL);
        String u = crests.get(n == null ? "" : n.trim().toLowerCase());
        t.addView(lbAvatar(u == null ? "" : u, initial(n), 36, 0x40FFFFFF, true, 1), new LinearLayout.LayoutParams(dp(36), dp(36)));
        TextView nm = txt(n, Color.WHITE, 12, true);
        nm.setSingleLine(true); nm.setEllipsize(android.text.TextUtils.TruncateAt.END); nm.setGravity(Gravity.CENTER);
        nm.setPadding(0, dp(6), 0, 0);
        t.addView(nm, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        return t;
    }

    // بطاقة المباراة (مشتركة بين صفحة الدوري وشاشة التنبؤ)
    protected View makeCard(final JSONObject m, Map<String, String> crests, boolean showComp) {
        boolean live = m.optString("status").equals("LIVE");
        boolean fin = m.optString("status").equals("FINISHED");
        final long id = m.optLong("id");
        long when = isoMs(m.optString("match_date"));
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(dp(14), dp(12), dp(14), dp(12));
        card.setBackground(rbg(0x0DFFFFFF, live ? 0x73FF5F7D : 0x17FFFFFF, 20));
        if (!fin) {
            LinearLayout rt = new LinearLayout(this);
            TextView c1 = txt("💬 " + L("غرفة المباراة", "Match room"), GOLD, 12, true);
            c1.setPadding(dp(11), dp(5), dp(11), dp(5)); c1.setBackground(rbg(0, 0x66F5C35A, 20));
            c1.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { openMatchRoom(String.valueOf(id)); } });
            TextView c2 = txt("＋ " + L("إنشاء غرفة", "Create room"), 0xFFFFD98A, 12, true);
            c2.setPadding(dp(11), dp(5), dp(11), dp(5)); c2.setBackground(rbg(0x14F5C35A, 0x8CF5C35A, 20));
            c2.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { createMatchRoom(String.valueOf(id)); } });
            rt.addView(c1);
            View sp = new View(this);
            rt.addView(sp, lpw(1f));
            rt.addView(c2);
            card.addView(rt, lpm(0, 0, 0, 10));
        }
        if (showComp && !m.isNull("competition_name") && m.optString("competition_name").length() > 0) {
            TextView cm = txt(lqName(m.optString("competition_code"), m.optString("competition_name")), MUTED, 12, true);
            cm.setGravity(Gravity.CENTER);
            card.addView(cm, lpm(0, 0, 0, 8));
        }
        LinearLayout mid = new LinearLayout(this);
        mid.setOrientation(LinearLayout.VERTICAL);
        mid.setGravity(Gravity.CENTER_HORIZONTAL);
        TextView big, tag;
        if (fin) { big = txt((m.isNull("home_score") ? "-" : m.optString("home_score")) + " - " + (m.isNull("away_score") ? "-" : m.optString("away_score")), Color.WHITE, 24, true); tag = txt(L("انتهت", "Full time"), 0xFFC9D3FF, 10, true); }
        else if (live) { big = txt((m.isNull("live_home") ? 0 : m.optInt("live_home")) + " - " + (m.isNull("live_away") ? 0 : m.optInt("live_away")), 0xFFFF5F7D, 24, true); tag = txt("● " + L("مباشر", "LIVE"), 0xFFFF5F7D, 10, true); }
        else { big = txt(fmtTime(when), GOLD, 21, true); tag = txt(L("بتوقيتك", "Your time"), 0xFFC9D3FF, 10, true); }
        big.setLayoutDirection(View.LAYOUT_DIRECTION_LTR);
        tag.setPadding(dp(9), dp(1), dp(9), dp(1)); tag.setBackground(rbg(0x14FFFFFF, 0, 20));
        mid.addView(big);
        mid.addView(tag);
        LinearLayout row = new LinearLayout(this);
        row.setGravity(Gravity.CENTER_VERTICAL);
        row.addView(lqTeam(m.optString("team_a"), crests), lpw(1f));
        LinearLayout.LayoutParams ml = new LinearLayout.LayoutParams(dp(86), ViewGroup.LayoutParams.WRAP_CONTENT);
        row.addView(mid, ml);
        row.addView(lqTeam(m.optString("team_b"), crests), lpw(1f));
        card.addView(row);
        String k = String.valueOf(id);
        if (fin) {
            JSONObject p = predMap.get(k);
            TextView c;
            if (p != null && !p.isNull("predicted_home")) {
                int ph = p.optInt("predicted_home"), pa = p.optInt("predicted_away"), hs = m.optInt("home_score"), as = m.optInt("away_score");
                boolean exact = ph == hs && pa == as;
                boolean win = Integer.signum(ph - pa) == Integer.signum(hs - as);
                String t = exact ? L("نتيجة دقيقة 🎯", "Exact score 🎯") : win ? L("أصبت ✓", "Correct ✓") : L("لم تصب ✗", "Missed ✗");
                c = txt(L("توقعك", "Your pick") + " " + ph + " - " + pa + " · " + t, (exact || win) ? 0xFF14F195 : 0xFFFF8F9D, 12, true);
                c.setBackground(rbg((exact || win) ? 0x1F14F195 : 0x1FFF5A6E, (exact || win) ? 0x6614F195 : 0x66FF5A6E, 20));
            } else {
                c = txt(L("لم تتوقع هذه المباراة", "You did not predict this match"), 0xFF8D99CF, 12, false);
            }
            c.setPadding(dp(12), dp(4), dp(12), dp(4));
            c.setGravity(Gravity.CENTER);
            LinearLayout w = new LinearLayout(this);
            w.setGravity(Gravity.CENTER);
            w.addView(c);
            card.addView(w, lpm(0, 10, 0, 0));
        } else {
            boolean started = System.currentTimeMillis() + 3600000 >= when;
            boolean has = predSet.contains(k);
            LinearLayout acts = new LinearLayout(this);
            String label;
            TextView pb;
            if (has) {
                JSONObject p = predMap.get(k);
                String extra = (p != null && !p.isNull("predicted_home")) ? " · " + p.optInt("predicted_home") + " - " + p.optInt("predicted_away") : "";
                pb = txt(L("تم التوقع", "Predicted") + extra, GOLD, 14, true);
                pb.setBackground(rbg(0x33F5C35A, GOLD, 14));
            } else if (started) {
                pb = txt(L("مغلق", "Closed"), MUTED, 14, true);
                pb.setBackground(rbg(0x0DFFFFFF, 0xFF14206B, 14));
            } else {
                pb = txt(L("توقّع واكسب", "Predict & win"), NAVY, 14, true);
                GradientDrawable g = new GradientDrawable(GradientDrawable.Orientation.LEFT_RIGHT, new int[] { 0xFFFFE7AD, 0xFFF5C35A });
                g.setCornerRadius(dp(14));
                pb.setBackground(g);
                final String ta = m.optString("team_a"), tb = m.optString("team_b");
                pb.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { showPredictionModal(id, ta, tb); } });
            }
            pb.setGravity(Gravity.CENTER);
            pb.setPadding(dp(8), dp(12), dp(8), dp(12));
            acts.addView(pb, lpw(1f));
            if (!started) { LinearLayout.LayoutParams fl = lpw(1f); fl.setMargins(dp(10), 0, 0, 0); acts.addView(fcMatchButton(id), fl); }
            card.addView(acts, lpm(0, 10, 0, 0));
        }
        card.setLayoutParams(lpm(0, 0, 0, 10));
        return card;
    }

    // ---------- شاشة «تنبّأ»: كل المباريات المتاحة للتوقع ----------
    protected void openPredictList() {
        if (lqPredDialog != null) { try { lqPredDialog.dismiss(); } catch (Exception ignore) {} }
        lqPredBody = uRoot();
        lqPredBody.addView(uLoading());
        lqPredDialog = uFull(lqPredBody);
        lqPredDialog.setOnDismissListener(new DialogInterface.OnDismissListener() { @Override public void onDismiss(DialogInterface di) { lqPredDialog = null; } });
        lqPredLoad();
    }
    protected void lqPredLoad() {
        pool.execute(new Runnable() {
            @Override public void run() {
                JSONArray ms = new JSONArray();
                Map<String, String> crests = new HashMap<String, String>();
                try {
                    loadPredictions();
                    SimpleDateFormat f = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", java.util.Locale.US);
                    f.setTimeZone(TimeZone.getTimeZone("UTC"));
                    String from = f.format(new Date(System.currentTimeMillis() - 3 * 3600000L));
                    ms = new JSONArray(get("matches?select=*&status=in.(NOT_STARTED,LIVE)&match_date=gte." + from + "&order=match_date.asc&limit=80"));
                    JSONArray st = new JSONArray(get("standings?select=team_name,crest"));
                    for (int i = 0; i < st.length(); i++) { JSONObject t = st.getJSONObject(i); if (!t.isNull("crest") && t.optString("crest").length() > 0) crests.put(t.optString("team_name").trim().toLowerCase(), t.optString("crest")); }
                } catch (Exception ignore) {}
                final JSONArray fm = ms;
                final Map<String, String> fc = crests;
                runOnUiThread(new Runnable() {
                    @Override public void run() {
                        if (lqPredDialog == null) return;
                        lqPredBody.removeAllViews();
                        lqPredBody.addView(uHeader(L("تنبّأ بنتائج المباريات", "Predict match results"), Color.WHITE, new Runnable() { @Override public void run() { if (lqPredDialog != null) lqPredDialog.dismiss(); } }));
                        lqPredBody.addView(fcEntryView());
                        fcRefreshBadge();
                        if (fm.length() == 0) lqPredBody.addView(uEmpty(L("لا توجد مباريات متاحة الآن", "No matches available now")));
                        String last = "";
                        for (int i = 0; i < fm.length(); i++) {
                            JSONObject m = fm.optJSONObject(i);
                            if (m == null) continue;
                            String d = fmtDay(isoMs(m.optString("match_date")));
                            if (!d.equals(last)) { lqPredBody.addView(lqDayHead(d)); last = d; }
                            lqPredBody.addView(makeCard(m, fc, true));
                        }
                    }
                });
            }
        });
    }

    // بعد التوقع: أعد رسم الصفحة المفتوحة
    @Override protected void refreshMatchViews() {
        super.refreshMatchViews();
        if (lqBox != null && lqCode != null) lqOpen(lqCode, lqTabKey);
        if (lqPredDialog != null) lqPredLoad();
    }
}
