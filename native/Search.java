package PKG;

import android.graphics.RadialGradient;
import android.graphics.SweepGradient;
import android.graphics.LinearGradient;
import android.graphics.Shader;
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

abstract class Search extends Push {
    // ===== من search.js: شاشة البحث (فرق + لاعبون) =====
    protected Dialog srDlg;
    protected LinearLayout srBody;
    protected String srQ = "", srTab = "all";
    protected int srSeq = 0;
    protected final Runnable srRun = new Runnable() { @Override public void run() { srSearch(); } };

    // تطبيع النص: عربي/إنجليزي بدون تشكيل ولا فروق الهمزات
    protected String norm(String s) {
        return String.valueOf(s == null ? "" : s).toLowerCase()
            .replaceAll("[ً-ْـ]", "").replaceAll("[أإآ]", "ا").replace('ى', 'ي').replace('ة', 'ه')
            .replaceAll("\\s+", " ").trim();
    }

    protected void openSearchScreen() {
        if (srDlg != null) { try { srDlg.dismiss(); } catch (Exception ignore) {} }
        srQ = ""; srTab = "all"; srSeq = 0;
        final Dialog d = sheetDialog(true);
        srDlg = d;
        d.getWindow().setBackgroundDrawable(new ColorDrawable(NAVY));
        d.getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE | WindowManager.LayoutParams.SOFT_INPUT_STATE_VISIBLE);
        lbDirection(d);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(18), statusH() + dp(6), dp(18), 0);
        LinearLayout top = new LinearLayout(this);
        top.setGravity(Gravity.CENTER_VERTICAL);
        top.addView(backBtn(new Runnable() { @Override public void run() { d.dismiss(); } }));
        final EditText in = new EditText(this);
        in.setHint(L("ابحث عن فريق أو لاعب…", "Search teams or players…"));
        in.setHintTextColor(MUTED); in.setTextColor(Color.WHITE); in.setTextSize(14);
        in.setSingleLine(true);
        in.setBackground(rbg(0x12FFFFFF, 0x73F5C35A, 14));
        in.setPadding(dp(14), 0, dp(14), 0);
        in.setImeOptions(android.view.inputmethod.EditorInfo.IME_ACTION_SEARCH);
        in.addTextChangedListener(new android.text.TextWatcher() {
            @Override public void beforeTextChanged(CharSequence s, int a, int b, int c) {}
            @Override public void onTextChanged(CharSequence s, int a, int b, int c) { srQ = s.toString(); timerH.removeCallbacks(srRun); timerH.postDelayed(srRun, 300); }
            @Override public void afterTextChanged(android.text.Editable s) {}
        });
        LinearLayout.LayoutParams il = new LinearLayout.LayoutParams(0, dp(42), 1f);
        il.setMargins(dp(10), 0, 0, 0);
        top.addView(in, il);
        root.addView(top);
        final String[][] tabs = { { "all", L("الكل", "All") }, { "players", L("لاعبون", "Players") }, { "teams", L("فرق", "Teams") } };
        final TextView[] tv = new TextView[3];
        LinearLayout tr = new LinearLayout(this);
        for (int i = 0; i < 3; i++) {
            final int ti = i;
            tv[i] = txt(tabs[i][1], 0xFFCFD8FF, 13, true);
            tv[i].setPadding(dp(16), dp(6), dp(16), dp(6));
            tv[i].setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) {
                srTab = tabs[ti][0];
                for (int q = 0; q < 3; q++) { boolean on = tabs[q][0].equals(srTab); tv[q].setTextColor(on ? NAVY : 0xFFCFD8FF); tv[q].setBackground(rbg(on ? GOLD : 0x00000000, on ? GOLD : 0x2EFFFFFF, 20)); }
                srSearch();
            } });
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            lp.setMargins(0, 0, dp(7), 0);
            tr.addView(tv[i], lp);
        }
        tv[0].performClick();
        root.addView(tr, lpm(0, 12, 0, 0));
        srBody = new LinearLayout(this);
        srBody.setOrientation(LinearLayout.VERTICAL);
        srBody.setPadding(0, 0, 0, navH() + dp(24));
        ScrollView sc = new ScrollView(this);
        sc.addView(srBody);
        root.addView(sc, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));
        d.setContentView(root);
        d.setOnDismissListener(new DialogInterface.OnDismissListener() { @Override public void onDismiss(DialogInterface di) { srDlg = null; srBody = null; timerH.removeCallbacks(srRun); } });
        d.show();
        srSearch();
    }

    protected void srMsg(String s) {
        if (srBody == null) return;
        srBody.removeAllViews();
        TextView m = txt(s, MUTED, 13, true);
        m.setGravity(Gravity.CENTER);
        m.setPadding(dp(10), dp(40), dp(10), dp(40));
        srBody.addView(m);
    }

    protected void srSearch() {
        if (srBody == null) return;
        final String q = srQ.trim();
        final int my = ++srSeq;
        if (norm(q).length() < 2) { srMsg(L("اكتب اسم فريق أو لاعب للبحث", "Type a team or player name to search")); return; }
        final boolean wantTeams = !srTab.equals("players"), wantPlayers = !srTab.equals("teams");
        srMsg(L("جارٍ البحث…", "Searching…"));
        final List<String[]> teams = new ArrayList<String[]>();
        if (wantTeams) {
            String nq = norm(q);
            for (String[] c : ClubsData.ALL) {
                if (teams.size() >= 20) break;
                if (norm(c[2]).contains(nq) || norm(c[3]).contains(nq)) teams.add(c);
            }
        }
        pool.execute(new Runnable() {
            @Override public void run() {
                final List<JSONObject> rows = new ArrayList<JSONObject>();
                boolean err = false;
                if (wantPlayers) {
                    try {
                        JSONArray a = new JSONArray(rpc("search_users", new JSONObject().put("p_q", q.replaceFirst("^@+", "")).toString()));
                        Set<String> bl = new HashSet<String>();
                        try { JSONArray b = new JSONArray(get("user_blocks?select=blocked_id&user_id=eq." + uid)); for (int i = 0; i < b.length(); i++) bl.add(b.getJSONObject(i).optString("blocked_id")); } catch (Exception ignore) {}
                        for (int i = 0; i < a.length(); i++) { JSONObject r = a.getJSONObject(i); String id = r.optString("user_id"); if (!id.equals(uid) && !bl.contains(id)) rows.add(r); }
                    } catch (Exception e) { err = true; }
                }
                final boolean fe = err;
                runOnUiThread(new Runnable() { @Override public void run() { if (my == srSeq) srRender(teams, rows, fe); } });
            }
        });
    }

    protected void srSection(String title, int n, LinearLayout card) {
        LinearLayout h = new LinearLayout(this);
        h.setPadding(dp(2), dp(16), dp(2), dp(8));
        h.addView(txt(title, MUTED, 12, true), lpw(1f));
        h.addView(txt(String.valueOf(n), MUTED, 12, true));
        srBody.addView(h);
        srBody.addView(card);
    }
    protected LinearLayout srCard() {
        LinearLayout c = new LinearLayout(this);
        c.setOrientation(LinearLayout.VERTICAL);
        c.setBackground(rbg(0x0DFFFFFF, 0x17FFFFFF, 20));
        return c;
    }
    protected View srRow(View av, String name, String sub, View.OnClickListener ck) {
        LinearLayout r = new LinearLayout(this);
        r.setGravity(Gravity.CENTER_VERTICAL);
        r.setPadding(dp(14), dp(11), dp(14), dp(11));
        r.addView(av, new LinearLayout.LayoutParams(dp(42), dp(42)));
        LinearLayout t = new LinearLayout(this);
        t.setOrientation(LinearLayout.VERTICAL);
        t.setPadding(dp(12), 0, dp(12), 0);
        TextView n = txt(name, Color.WHITE, 14, true);
        n.setSingleLine(true); n.setEllipsize(android.text.TextUtils.TruncateAt.END);
        t.addView(n);
        if (sub.length() > 0) t.addView(txt(sub, MUTED, 12, false));
        r.addView(t, lpw(1f));
        r.addView(txt(isRtlLang() ? "‹" : "›", 0xFF6F7BB8, 20, true));
        r.setOnClickListener(ck);
        return r;
    }

    protected void srRender(List<String[]> teams, List<JSONObject> rows, boolean err) {
        if (srBody == null) return;
        srBody.removeAllViews();
        if (teams.isEmpty() && rows.isEmpty()) { srMsg(err ? L("تعذّر البحث الآن", "Search unavailable") : L("لا نتائج", "No results")); return; }
        if (!teams.isEmpty()) {
            LinearLayout card = srCard();
            for (final String[] c : teams) {
                String name = isAr() ? c[2] : c[3], sub = isAr() ? c[3] : c[2];
                card.addView(srRow(lbAvatar(c[5], initial(name), 42, GOLD, true, 2), name, sub, new View.OnClickListener() { @Override public void onClick(View v) { if (srDlg != null) srDlg.dismiss(); openClubFans(c[1]); } }));
            }
            srSection(L("فرق", "Teams"), teams.size(), card);
        }
        if (!rows.isEmpty()) {
            LinearLayout card = srCard();
            for (final JSONObject r : rows) {
                String nick = isAr() ? (r.optString("nickname_ar").length() > 0 && !r.isNull("nickname_ar") ? r.optString("nickname_ar") : r.optString("nickname_en")) : (r.optString("nickname_en").length() > 0 && !r.isNull("nickname_en") ? r.optString("nickname_en") : r.optString("nickname_ar"));
                if (nick == null || nick.length() == 0 || "null".equals(nick)) nick = r.isNull("username") ? "" : r.optString("username");
                String ph = r.isNull("photo_url") ? "" : r.optString("photo_url");
                final String id = r.optString("user_id");
                card.addView(srRow(lbAvatar(ph, initial(nick), 42, GOLD, false, 2), nick, r.isNull("username") || r.optString("username").length() == 0 ? "" : "@" + r.optString("username"),
                    new View.OnClickListener() { @Override public void onClick(View v) { if (srDlg != null) srDlg.dismiss(); openProfile(id); } }));
            }
            srSection(L("لاعبون", "Players"), rows.size(), card);
        }
        TextView h = txt(L("اضغط على فريق لفتح جمهوره، أو على لاعب لفتح ملفه", "Tap a team to open its fans, or a player to open the profile"), 0xFF6F7BB8, 12, false);
        h.setGravity(Gravity.CENTER);
        srBody.addView(h, lpm(0, 16, 0, 0));
    }
}
