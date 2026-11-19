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

abstract class Leaderboard extends GuessPlayer {
    // ===== من leaderboard.js: المتصدرون (الأندية | التحديات) + أبطال نادٍ + ترتيب الدوريات والهدّافون =====
    protected static final String LB_COIN_URL = "https://raw.githubusercontent.com/zelospor-f/zelo-/main/zelo-coin.png";
    // الميداليات: {اللون، الإيموجي، حجم الصورة، ارتفاع المنصّة} بترتيب العرض 2 - 1 - 3
    protected static final int[] MED_C = { 0xFFC9D3E6, 0xFFF5C35A, 0xFFCD7F32 };
    protected static final String[] MED_E = { "🥈", "👑", "🥉" };
    protected static final int[] MED_SZ = { 46, 56, 44 };
    protected static final int[] MED_H = { 70, 104, 54 };

    protected static class LbItem {
        String name = "", sub = "", photo = "", unit = "", meText = "", clubId = "";
        long pts = 0;
        boolean logo = false, me = false;
    }

    protected String ldTab = "clubs";
    protected Dialog ldDialog;
    protected LinearLayout ldRoot;
    protected FrameLayout ldHolder;
    protected View ldBar;

    protected String num(long n) { return String.format(java.util.Locale.US, "%,d", n); }
    protected int alpha(int c, int a) { return (c & 0x00FFFFFF) | (a << 24); }

    // رابط صورة آمن فقط (http/https)
    protected String lbSafePhoto(String u) {
        u = u == null ? "" : u.trim();
        return (u.matches("(?i)^https?://.*") || u.startsWith("data:image/svg+xml")) ? u : "";
    }

    protected ImageView lbCoin(int sizeDp) {
        ImageView iv = new ImageView(this);
        iv.setScaleType(ImageView.ScaleType.FIT_CENTER);
        loadImage(LB_COIN_URL, iv);
        iv.setBackgroundColor(0x00000000);
        iv.setLayoutParams(new LinearLayout.LayoutParams(dp(sizeDp), dp(sizeDp)));
        return iv;
    }

    // صورة دائرية مع حرف احتياطي (أو شعار نادٍ داخل مربع)
    protected View lbAvatar(String photo, String initial, int sizeDp, int borderCol, boolean logo, int borderDp) {
        FrameLayout f = new FrameLayout(this);
        GradientDrawable g = new GradientDrawable();
        g.setShape(GradientDrawable.OVAL);
        g.setColor(NAVY);
        g.setStroke(dp(borderDp), borderCol);
        f.setBackground(g);
        TextView t = tv(Color.WHITE, Math.max(10, (int) (sizeDp * 0.4f)), true);
        t.setText(initial);
        t.setGravity(Gravity.CENTER);
        f.addView(t, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        String u = lbSafePhoto(photo);
        if (u.length() > 0) {
            ImageView iv = new ImageView(this);
            iv.setScaleType(logo ? ImageView.ScaleType.FIT_CENTER : ImageView.ScaleType.CENTER_CROP);
            if (!logo) {
                iv.setOutlineProvider(new ViewOutlineProvider() {
                    @Override public void getOutline(View v, Outline o) { o.setOval(0, 0, v.getWidth(), v.getHeight()); }
                });
                iv.setClipToOutline(true);
            }
            FrameLayout.LayoutParams ilp = new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT);
            int pad = logo ? dp(6) : dp(borderDp);
            ilp.setMargins(pad, pad, pad, pad);
            f.addView(iv, ilp);
            loadImage(u, iv);
        }
        f.setLayoutParams(new LinearLayout.LayoutParams(dp(sizeDp), dp(sizeDp)));
        return f;
    }

    protected void lbDirection(Dialog d) {
        d.getWindow().getDecorView().setLayoutDirection(isRtlLang() ? View.LAYOUT_DIRECTION_RTL : View.LAYOUT_DIRECTION_LTR);
    }

    protected interface TabPick { void on(int i); }

    // شريط التبويبين الدائري
    protected View lbTabBar(String[] labels, int on, final TabPick pick) {
        LinearLayout bar = new LinearLayout(this);
        bar.setPadding(dp(4), dp(4), dp(4), dp(4));
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(0x12FFFFFF);
        bg.setCornerRadius(dp(30));
        bg.setStroke(dp(1), 0x1AFFFFFF);
        bar.setBackground(bg);
        for (int i = 0; i < labels.length; i++) {
            final int idx = i;
            TextView t = tv(i == on ? NAVY : MUTED, 14, true);
            t.setText(labels[i]);
            t.setGravity(Gravity.CENTER);
            t.setPadding(0, dp(9), 0, dp(9));
            GradientDrawable g = new GradientDrawable(GradientDrawable.Orientation.LEFT_RIGHT, i == on ? new int[] { 0xFFFFE7AD, 0xFFF5C35A } : new int[] { 0, 0 });
            g.setCornerRadius(dp(30));
            t.setBackground(g);
            t.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { pick.on(idx); } });
            bar.addView(t, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        }
        return bar;
    }

    // ---------------- شاشة المتصدرون ----------------
    protected void openLeaders(String which) {
        if (which != null) ldTab = which;
        closeLeaders();
        ldDialog = sheetDialog(true);
        lbDirection(ldDialog);
        ldHolder = new FrameLayout(this);
        ScrollView sc = new ScrollView(this);
        ldRoot = new LinearLayout(this);
        ldRoot.setOrientation(LinearLayout.VERTICAL);
        ldRoot.setPadding(dp(14), statusH() + dp(6), dp(14), navH() + dp(110));
        sc.addView(ldRoot);
        ldHolder.addView(sc, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        ldDialog.setContentView(ldHolder);
        ldDialog.show();
        ldDraw();
    }

    protected void closeLeaders() {
        if (ldDialog != null) { try { ldDialog.dismiss(); } catch (Exception ignore) {} }
        ldDialog = null; ldRoot = null; ldHolder = null; ldBar = null;
    }

    protected void ldDraw() {
        if (ldRoot == null) return;
        ldRoot.removeAllViews();
        LinearLayout head = new LinearLayout(this);
        head.setGravity(Gravity.CENTER_VERTICAL);
        head.addView(backBtn(new Runnable() { @Override public void run() { closeLeaders(); } }));
        TextView title = tv(Color.WHITE, 21, true);
        title.setText(L("المتصدرون", "Leaders"));
        title.setPadding(dp(12), 0, dp(12), 0);
        head.addView(title, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        LinearLayout.LayoutParams hl = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        hl.setMargins(0, 0, 0, dp(12));
        ldRoot.addView(head, hl);
        LinearLayout.LayoutParams tl = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        tl.setMargins(0, 0, 0, dp(14));
        ldRoot.addView(lbTabBar(new String[] { L("الأندية", "Clubs"), L("التحديات", "Challenges") }, ldTab.equals("clubs") ? 0 : 1, new TabPick() {
            @Override public void on(int i) { ldTab = i == 0 ? "clubs" : "challenges"; ldDraw(); }
        }), tl);
        final LinearLayout body = new LinearLayout(this);
        body.setOrientation(LinearLayout.VERTICAL);
        TextView ld = tv(MUTED, 15, true);
        ld.setText("");
        ld.setGravity(Gravity.CENTER);
        ld.setPadding(0, dp(40), 0, dp(40));
        body.addView(ld);
        ldRoot.addView(body);
        if (ldBar != null && ldHolder != null) { ldHolder.removeView(ldBar); ldBar = null; }
        final String tab = ldTab;
        pool.execute(new Runnable() {
            @Override public void run() {
                final List<LbItem> list = new ArrayList<LbItem>();
                final String[] bar = { "", "" };
                final long[] barPts = { 0 };
                boolean ok = true;
                try {
                    if (tab.equals("clubs")) ldClubsData(list, bar, barPts); else ldChallengesData(list, bar, barPts);
                } catch (Exception e) { ok = false; }
                final boolean fok = ok;
                runOnUiThread(new Runnable() {
                    @Override public void run() {
                        if (ldRoot == null || !tab.equals(ldTab)) return;
                        body.removeAllViews();
                        if (!fok) { body.addView(lbEmpty(L("تعذّر تحميل البيانات", "Could not load data"))); return; }
                        if (list.isEmpty()) {
                            body.addView(lbEmpty(tab.equals("clubs") ? tr("noClubsYet", "لا توجد أندية بعد. كن أول من يختار ناديه!", "No clubs yet. Be the first to pick yours!") : L("لا توجد نتائج هذا الأسبوع بعد", "No results this week yet")));
                            return;
                        }
                        if (tab.equals("challenges")) {
                            TextView wk = tv(Color.WHITE, 13, true);
                            wk.setText(L("تحدّي هذا الأسبوع", "This week's challenge"));
                            wk.setPadding(dp(14), dp(9), dp(14), dp(9));
                            GradientDrawable wg = new GradientDrawable();
                            wg.setColor(0x402C4BB5);
                            wg.setCornerRadius(dp(14));
                            wg.setStroke(dp(1), 0x59F5C35A);
                            wk.setBackground(wg);
                            LinearLayout.LayoutParams wl = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
                            wl.setMargins(0, 0, 0, dp(12));
                            body.addView(wk, wl);
                        }
                        body.addView(ldPodium(list));
                        for (int i = 3; i < list.size(); i++) body.addView(ldRow(list.get(i), i + 1));
                        int mine = -1;
                        for (int i = 0; i < list.size(); i++) if (list.get(i).me) { mine = i; break; }
                        if (mine >= 0) ldShowBar(mine + 1, bar[0], bar[1], barPts[0]);
                    }
                });
            }
        });
    }

    protected View lbEmpty(String text) {
        TextView t = tv(MUTED, 15, true);
        t.setText(text);
        t.setGravity(Gravity.CENTER);
        t.setPadding(dp(10), dp(40), dp(10), dp(40));
        return t;
    }

    protected void ldClubsData(List<LbItem> out, String[] bar, long[] barPts) throws Exception {
        Map<String, Long> clubPts = new HashMap<String, Long>();
        Map<String, Integer> clubMem = new HashMap<String, Integer>();
        String myClub = null;
        long myPts = 0;
        JSONArray a = new JSONArray(get("club_fans_rankings?select=user_id,club_id,total_fan_points"));
        for (int i = 0; i < a.length(); i++) {
            JSONObject f = a.getJSONObject(i);
            String cid = f.optString("club_id", "");
            long p = f.optLong("total_fan_points", 0);
            if (uid != null && uid.equals(f.optString("user_id", ""))) { myClub = cid; myPts = p; }
            Long cp = clubPts.get(cid);
            clubPts.put(cid, (cp == null ? 0 : cp) + p);
            Integer cm = clubMem.get(cid);
            clubMem.put(cid, (cm == null ? 0 : cm) + 1);
        }
        List<LbItem> tmp = new ArrayList<LbItem>();
        List<Integer> mems = new ArrayList<Integer>();
        for (String[] c : ClubsData.ALL) {
            Integer m = clubMem.get(c[1]);
            if (m == null || m <= 0) continue;
            LbItem it = new LbItem();
            it.name = getClubName(c);
            it.pts = clubPts.get(c[1]) == null ? 0 : clubPts.get(c[1]);
            it.photo = c[5];
            it.logo = true;
            it.unit = L("نقطة", "pts");
            it.clubId = c[1];
            it.sub = "👥 " + num(m) + " " + tr("fansLabel", "مشجع", "Fans");
            it.me = c[1].equals(myClub);
            it.meText = tr("yourClub", "ناديك", "Your club") + " · " + tr("yourPts", "نقاطك", "Your points") + ": " + num(myPts);
            tmp.add(it);
            mems.add(m);
        }
        // الترتيب: النقاط ثم عدد المشجعين
        final Map<LbItem, Integer> memOf = new HashMap<LbItem, Integer>();
        for (int i = 0; i < tmp.size(); i++) memOf.put(tmp.get(i), mems.get(i));
        java.util.Collections.sort(tmp, new java.util.Comparator<LbItem>() {
            @Override public int compare(LbItem x, LbItem y) {
                if (x.pts != y.pts) return x.pts < y.pts ? 1 : -1;
                return memOf.get(y) - memOf.get(x);
            }
        });
        for (int i = 0; i < tmp.size() && i < 100; i++) out.add(tmp.get(i));
        for (LbItem it : out) if (it.me) {
            bar[0] = tr("yourClub", "ناديك", "Your club") + ": " + it.name;
            bar[1] = tr("yourPts", "نقاطك", "Your points") + ": " + num(myPts);
            barPts[0] = it.pts;
        }
    }

    protected void ldChallengesData(List<LbItem> out, String[] bar, long[] barPts) throws Exception {
        JSONArray rows = new JSONArray(get("weekly_match_rankings?select=user_id,username,photo_url,points_earned&is_eliminated=eq.false&category=eq.weekly&order=points_earned.desc&limit=50"));
        Map<String, String> ph = new HashMap<String, String>();
        try {
            StringBuilder ids = new StringBuilder();
            for (int i = 0; i < rows.length(); i++) { if (ids.length() > 0) ids.append(","); ids.append(rows.getJSONObject(i).optString("user_id", "")); }
            if (ids.length() > 0) {
                JSONArray pp = new JSONArray(get("public_profiles?select=user_id,photo_url&user_id=in.(" + ids + ")"));
                for (int i = 0; i < pp.length(); i++) {
                    JSONObject x = pp.getJSONObject(i);
                    if (x.optString("photo_url", "").length() > 0 && !x.isNull("photo_url")) ph.put(x.optString("user_id"), x.optString("photo_url"));
                }
            }
        } catch (Exception ignore) {}
        for (int i = 0; i < rows.length(); i++) {
            JSONObject x = rows.getJSONObject(i);
            LbItem it = new LbItem();
            it.name = x.optString("username", "").length() > 0 && !x.isNull("username") ? x.optString("username") : L("مستخدم", "User");
            it.pts = x.optLong("points_earned", 0);
            String p = ph.get(x.optString("user_id"));
            it.photo = p != null ? p : (x.isNull("photo_url") ? "" : x.optString("photo_url", ""));
            it.unit = L("نقطة", "pts");
            it.me = uid != null && uid.equals(x.optString("user_id", ""));
            it.meText = L("أنت", "You");
            out.add(it);
            if (it.me) { bar[0] = L("مركزك في التحدّي", "Your rank"); bar[1] = ""; barPts[0] = it.pts; }
        }
    }

    protected String initial(String s) {
        s = s == null ? "" : s.trim();
        return s.length() == 0 ? "?" : s.substring(0, 1).toUpperCase();
    }

    protected View ldPodium(final List<LbItem> items) {
        LinearLayout pod = new LinearLayout(this);
        pod.setGravity(Gravity.BOTTOM);
        pod.setMinimumHeight(dp(196));
        int[] order = { 1, 0, 2 };
        for (int k = 0; k < 3; k++) {
            LinearLayout col = new LinearLayout(this);
            col.setOrientation(LinearLayout.VERTICAL);
            col.setGravity(Gravity.CENTER_HORIZONTAL | Gravity.BOTTOM);
            col.setPadding(dp(4), 0, dp(4), 0);
            int idx = order[k];
            if (idx < items.size()) {
                final LbItem it = items.get(idx);
                int c = MED_C[k];
                TextView md = tv(Color.WHITE, k == 1 ? 22 : 18, false);
                md.setText(MED_E[k]);
                md.setGravity(Gravity.CENTER);
                col.addView(md);
                View av = lbAvatar(it.photo, initial(it.name), MED_SZ[k], c, it.logo, 2);
                LinearLayout.LayoutParams alp = new LinearLayout.LayoutParams(dp(MED_SZ[k]), dp(MED_SZ[k]));
                alp.setMargins(0, dp(6), 0, dp(6));
                col.addView(av, alp);
                TextView nm = tv(Color.WHITE, 12, true);
                nm.setText(it.name);
                nm.setSingleLine(true);
                nm.setEllipsize(android.text.TextUtils.TruncateAt.END);
                nm.setGravity(Gravity.CENTER);
                col.addView(nm, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
                LinearLayout pb = new LinearLayout(this);
                pb.setOrientation(LinearLayout.VERTICAL);
                pb.setGravity(Gravity.CENTER);
                GradientDrawable g = new GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM, new int[] { alpha(c, 0x33), alpha(c, 0x0D) });
                g.setCornerRadii(new float[] { dp(16), dp(16), dp(16), dp(16), 0, 0, 0, 0 });
                g.setStroke(dp(1), alpha(c, 0x66));
                pb.setBackground(g);
                TextView pv = tv(c, 14, true);
                pv.setText(num(it.pts));
                pv.setGravity(Gravity.CENTER);
                pb.addView(pv);
                TextView un = tv(MUTED, 10, false);
                un.setText(it.unit);
                un.setGravity(Gravity.CENTER);
                pb.addView(un);
                LinearLayout.LayoutParams plp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(MED_H[k]));
                plp.setMargins(0, dp(6), 0, 0);
                col.addView(pb, plp);
                if (it.clubId.length() > 0) col.setOnClickListener(new View.OnClickListener() {
                    @Override public void onClick(View v) { openClubFans(it.clubId); }
                });
            }
            pod.addView(col, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        }
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        lp.setMargins(0, 0, 0, dp(12));
        pod.setLayoutParams(lp);
        return pod;
    }

    protected View ldRow(final LbItem it, int rank) {
        LinearLayout r = new LinearLayout(this);
        r.setGravity(Gravity.CENTER_VERTICAL);
        r.setPadding(dp(12), dp(9), dp(12), dp(9));
        GradientDrawable g = new GradientDrawable();
        g.setCornerRadius(dp(18));
        if (it.me) {
            g = new GradientDrawable(GradientDrawable.Orientation.LEFT_RIGHT, new int[] { 0x29F5C35A, 0x332C4BB5 });
            g.setCornerRadius(dp(18));
            g.setStroke(dp(1), GOLD);
        } else {
            g.setColor(0x0DFFFFFF);
            g.setStroke(dp(1), 0x14FFFFFF);
        }
        r.setBackground(g);
        TextView rk = tv(MUTED, 15, true);
        rk.setText("#" + rank);
        rk.setGravity(Gravity.CENTER);
        r.addView(rk, new LinearLayout.LayoutParams(dp(34), ViewGroup.LayoutParams.WRAP_CONTENT));
        View av = lbAvatar(it.photo, initial(it.name), 40, 0xFF9FB2FF, it.logo, 2);
        LinearLayout.LayoutParams avl = new LinearLayout.LayoutParams(dp(40), dp(40));
        avl.setMargins(dp(4), 0, dp(10), 0);
        r.addView(av, avl);
        LinearLayout nm = new LinearLayout(this);
        nm.setOrientation(LinearLayout.VERTICAL);
        TextView n1 = tv(Color.WHITE, 14, true);
        n1.setText(it.name);
        n1.setSingleLine(true);
        n1.setEllipsize(android.text.TextUtils.TruncateAt.END);
        nm.addView(n1);
        if (it.me) {
            TextView me = tv(GOLD, 11, true);
            me.setText("⭐ " + it.meText);
            nm.addView(me);
        } else if (it.sub.length() > 0) {
            TextView sb = tv(0xFFFFD98A, 11, false);
            sb.setText(it.sub);
            sb.setPadding(dp(8), dp(1), dp(8), dp(1));
            GradientDrawable sg = new GradientDrawable();
            sg.setColor(0x1AF5C35A);
            sg.setCornerRadius(dp(7));
            sg.setStroke(dp(1), 0x40F5C35A);
            sb.setBackground(sg);
            LinearLayout.LayoutParams slp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            slp.setMargins(0, dp(3), 0, 0);
            nm.addView(sb, slp);
        }
        r.addView(nm, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        LinearLayout pt = new LinearLayout(this);
        pt.setGravity(Gravity.CENTER_VERTICAL);
        pt.setLayoutDirection(View.LAYOUT_DIRECTION_LTR);
        pt.setPadding(dp(10), dp(5), dp(10), dp(5));
        GradientDrawable pg = new GradientDrawable();
        pg.setColor(0x1AF5C35A);
        pg.setCornerRadius(dp(12));
        pg.setStroke(dp(1), 0x66F5C35A);
        pt.setBackground(pg);
        TextView pv = tv(GOLD, 14, true);
        pv.setText(num(it.pts));
        pt.addView(pv);
        ImageView coin = lbCoin(18);
        ((LinearLayout.LayoutParams) coin.getLayoutParams()).setMargins(dp(6), 0, 0, 0);
        pt.addView(coin);
        r.addView(pt);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        lp.setMargins(0, 0, 0, dp(8));
        r.setLayoutParams(lp);
        if (it.clubId.length() > 0) r.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) { openClubFans(it.clubId); }
        });
        return r;
    }

    // شريط مركزي الثابت أسفل الشاشة
    protected void ldShowBar(int rank, String title, String sub, long pts) {
        if (ldHolder == null) return;
        if (ldBar != null) ldHolder.removeView(ldBar);
        LinearLayout b = new LinearLayout(this);
        b.setGravity(Gravity.CENTER_VERTICAL);
        b.setPadding(dp(14), dp(10), dp(14), dp(10));
        GradientDrawable g = new GradientDrawable(GradientDrawable.Orientation.LEFT_RIGHT, new int[] { 0x38F5C35A, 0x4D2C4BB5 });
        g.setCornerRadius(dp(18));
        g.setStroke(dp(1), GOLD);
        b.setBackground(g);
        TextView rk = tv(0xFFFFE7AD, 16, true);
        rk.setText("#" + rank);
        rk.setGravity(Gravity.CENTER);
        b.addView(rk, new LinearLayout.LayoutParams(dp(40), ViewGroup.LayoutParams.WRAP_CONTENT));
        LinearLayout mid = new LinearLayout(this);
        mid.setOrientation(LinearLayout.VERTICAL);
        TextView t1 = tv(Color.WHITE, 14, true);
        t1.setText(title);
        mid.addView(t1);
        if (sub != null && sub.length() > 0) { TextView t2 = tv(0xFFCFD8FF, 12, false); t2.setText(sub); mid.addView(t2); }
        b.addView(mid, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        LinearLayout pt = new LinearLayout(this);
        pt.setGravity(Gravity.CENTER_VERTICAL);
        pt.setLayoutDirection(View.LAYOUT_DIRECTION_LTR);
        TextView pv = tv(GOLD, 14, true);
        pv.setText(num(pts));
        pt.addView(pv);
        ImageView coin = lbCoin(18);
        ((LinearLayout.LayoutParams) coin.getLayoutParams()).setMargins(dp(6), 0, 0, 0);
        pt.addView(coin);
        b.addView(pt);
        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.BOTTOM);
        lp.setMargins(dp(12), 0, dp(12), navH() + dp(8));
        ldBar = b;
        ldHolder.addView(b, lp);
    }

    // ---------------- أبطال نادٍ معيّن (openSpecificClubFans) ----------------
    protected void openClubFans(final String clubId) {
        final String[] club = ClubsData.byId(clubId);
        if (club == null) return;
        final String clubName = getClubName(club);
        final Dialog d = sheetDialog(true);
        lbDirection(d);
        ScrollView sc = new ScrollView(this);
        final LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(15), statusH() + dp(6), dp(15), navH() + dp(24));
        root.addView(backBtn(new Runnable() { @Override public void run() { d.dismiss(); } }));
        LinearLayout hero = new LinearLayout(this);
        hero.setGravity(Gravity.CENTER_VERTICAL);
        hero.setPadding(dp(14), dp(14), dp(14), dp(14));
        GradientDrawable hg = new GradientDrawable(GradientDrawable.Orientation.TL_BR, new int[] { 0xF2111A4A, 0xF20A1033 });
        hg.setCornerRadius(dp(18));
        hg.setStroke(dp(1), 0x4DF5C35A);
        hero.setBackground(hg);
        FrameLayout lbox = new FrameLayout(this);
        GradientDrawable lg = new GradientDrawable();
        lg.setColor(0x66000000);
        lg.setCornerRadius(dp(14));
        lg.setStroke(dp(1), 0x1AFFFFFF);
        lbox.setBackground(lg);
        ImageView li = new ImageView(this);
        li.setScaleType(ImageView.ScaleType.FIT_CENTER);
        FrameLayout.LayoutParams lil = new FrameLayout.LayoutParams(dp(40), dp(40), Gravity.CENTER);
        lbox.addView(li, lil);
        loadImage(club[5], li);
        hero.addView(lbox, new LinearLayout.LayoutParams(dp(56), dp(56)));
        LinearLayout tx = new LinearLayout(this);
        tx.setOrientation(LinearLayout.VERTICAL);
        tx.setPadding(dp(12), 0, dp(12), 0);
        Map<String, String> pm = new HashMap<String, String>();
        pm.put("club", clubName);
        TextView h1 = tv(Color.WHITE, 17, true);
        h1.setText(tr("topFansOf", "أبطال {club}", "Top Fans of {club}", pm));
        tx.addView(h1);
        TextView h2 = tv(GOLD, 12, true);
        h2.setText(tr("topFansSub", "تنافس لتكون المشجع الأول لناديك!", "Compete to be the #1 fan for your club!") + " 🚀");
        tx.addView(h2);
        hero.addView(tx, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        LinearLayout.LayoutParams hl = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        hl.setMargins(0, dp(14), 0, dp(16));
        root.addView(hero, hl);
        final LinearLayout list = new LinearLayout(this);
        list.setOrientation(LinearLayout.VERTICAL);
        TextView ld = tv(GOLD, 15, true);
        ld.setText("");
        ld.setGravity(Gravity.CENTER);
        ld.setPadding(0, dp(40), 0, dp(40));
        list.addView(ld);
        root.addView(list);
        sc.addView(root);
        d.setContentView(sc);
        d.show();
        pool.execute(new Runnable() {
            @Override public void run() {
                JSONArray fans = null;
                final Map<String, JSONObject> profs = new HashMap<String, JSONObject>();
                try {
                    fans = new JSONArray(get("club_fans_rankings?select=user_id,total_fan_points,referrals_count&club_id=eq." + clubId + "&order=total_fan_points.desc&limit=100"));
                    try {
                        StringBuilder ids = new StringBuilder();
                        for (int i = 0; i < fans.length(); i++) { if (ids.length() > 0) ids.append(","); ids.append(fans.getJSONObject(i).optString("user_id", "")); }
                        if (ids.length() > 0) {
                            JSONArray pr = new JSONArray(get("public_profiles?select=user_id,photo_url,username&user_id=in.(" + ids + ")"));
                            for (int i = 0; i < pr.length(); i++) profs.put(pr.getJSONObject(i).optString("user_id"), pr.getJSONObject(i));
                        }
                    } catch (Exception ignore) {}
                } catch (Exception ignore) {}
                final JSONArray ff = fans;
                runOnUiThread(new Runnable() {
                    @Override public void run() {
                        list.removeAllViews();
                        if (ff == null || ff.length() == 0) {
                            TextView e = tv(0xFF94A3B8, 14, true);
                            e.setText(tr("noFansYet", "لا يوجد مشجعين مسجلين في هذا النادي حتى الآن. كن أنت الأول! 🚀", "No fans registered for this club yet. Be the first! 🚀"));
                            e.setGravity(Gravity.CENTER);
                            e.setPadding(dp(30), dp(30), dp(30), dp(30));
                            GradientDrawable eg = new GradientDrawable();
                            eg.setColor(0xCC111A4A);
                            eg.setCornerRadius(dp(16));
                            eg.setStroke(dp(1), 0x4D2C4BB5);
                            e.setBackground(eg);
                            list.addView(e);
                            return;
                        }
                        String[] badges = { "👑", "🥈", "🥉" };
                        int[] tops = { 0x66FFD700, 0x59C0C0C0, 0x59CD7F32 };
                        for (int i = 0; i < ff.length(); i++) {
                            JSONObject fan = ff.optJSONObject(i);
                            if (fan == null) continue;
                            String fid = fan.optString("user_id", "");
                            boolean isMe = uid != null && uid.equals(fid);
                            JSONObject pf = profs.get(fid);
                            String un = pf == null || pf.isNull("username") ? (isMe && uname != null ? uname : "") : pf.optString("username", "");
                            String photo = pf == null || pf.isNull("photo_url") ? (isMe && uavatar != null ? uavatar : "") : pf.optString("photo_url", "");
                            LinearLayout row = new LinearLayout(this_());
                            row.setLayoutDirection(View.LAYOUT_DIRECTION_LTR);
                            row.setGravity(Gravity.CENTER_VERTICAL);
                            row.setPadding(dp(14), dp(10), dp(14), dp(10));
                            GradientDrawable g;
                            if (isMe) {
                                g = new GradientDrawable(GradientDrawable.Orientation.LEFT_RIGHT, new int[] { 0x334A6CFF, 0x262C4BB5 });
                                g.setStroke(dp(1), 0x994A6CFF);
                            } else {
                                g = new GradientDrawable(GradientDrawable.Orientation.TL_BR, new int[] { 0xF2111A4A, 0xF20A1033 });
                                g.setStroke(dp(1), i < 3 ? tops[i] : 0x4D2C4BB5);
                            }
                            g.setCornerRadius(dp(18));
                            row.setBackground(g);
                            TextView rk = tv(0xFF94A3B8, 17, true);
                            rk.setText(i < 3 ? badges[i] : "#" + (i + 1));
                            rk.setGravity(Gravity.CENTER);
                            rk.setTypeface(i < 3 ? Typeface.DEFAULT_BOLD : Typeface.MONOSPACE, Typeface.BOLD);
                            row.addView(rk, new LinearLayout.LayoutParams(dp(36), ViewGroup.LayoutParams.WRAP_CONTENT));
                            View av = lbAvatar(photo, initial(un), 38, 0x2EFFFFFF, false, 1);
                            LinearLayout.LayoutParams avl = new LinearLayout.LayoutParams(dp(38), dp(38));
                            avl.setMargins(dp(4), 0, dp(10), 0);
                            row.addView(av, avl);
                            TextView nm = tv(Color.WHITE, 15, true);
                            nm.setText(un.length() > 0 ? "@" + un : tr("anonymousFan", "مشجع مجهول", "Anonymous Fan"));
                            nm.setSingleLine(true);
                            nm.setEllipsize(android.text.TextUtils.TruncateAt.END);
                            row.addView(nm, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
                            if (isMe) {
                                TextView yb = tv(Color.WHITE, 11, true);
                                yb.setText(tr("youLabel", "أنت", "You"));
                                yb.setPadding(dp(8), dp(2), dp(8), dp(2));
                                GradientDrawable yg = new GradientDrawable(GradientDrawable.Orientation.LEFT_RIGHT, new int[] { 0xFF4A6CFF, 0xFF2C4BB5 });
                                yg.setCornerRadius(dp(8));
                                yb.setBackground(yg);
                                LinearLayout.LayoutParams ylp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
                                ylp.setMargins(dp(6), 0, dp(6), 0);
                                row.addView(yb, ylp);
                            }
                            LinearLayout st = new LinearLayout(this_());
                            st.setOrientation(LinearLayout.VERTICAL);
                            st.setGravity(Gravity.END);
                            LinearLayout pl = new LinearLayout(this_());
                            pl.setGravity(Gravity.CENTER_VERTICAL | Gravity.END);
                            TextView pv = tv(GOLD, 17, true);
                            pv.setText(num(fan.optLong("total_fan_points", 0)));
                            pl.addView(pv);
                            ImageView coin = lbCoin(20);
                            ((LinearLayout.LayoutParams) coin.getLayoutParams()).setMargins(dp(6), 0, 0, 0);
                            pl.addView(coin);
                            st.addView(pl);
                            TextView rf = tv(0xFF94A3B8, 12, true);
                            rf.setText(num(fan.optLong("referrals_count", 0)) + " 👥");
                            rf.setGravity(Gravity.END);
                            st.addView(rf);
                            row.addView(st);
                            LinearLayout.LayoutParams rl = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
                            rl.setMargins(0, 0, 0, dp(10));
                            list.addView(row, rl);
                        }
                    }
                });
            }
        });
    }

    // ---------------- شاشة الترتيب: جدول الدوري + الهدّافون ----------------
    // {الرمز، عربي، إنجليزي، top، mid، bot، champions-league؟}
    protected static final String[][] LEAGUES = {
        { "PD", "الدوري الإسباني", "La Liga", "4", "1", "3", "0" },
        { "PL", "الدوري الإنجليزي", "Premier League", "4", "1", "3", "0" },
        { "SA", "الدوري الإيطالي", "Serie A", "4", "1", "3", "0" },
        { "BL1", "الدوري الألماني", "Bundesliga", "4", "1", "2", "0" },
        { "FL1", "الدوري الفرنسي", "Ligue 1", "3", "1", "2", "0" },
        { "CL", "دوري أبطال أوروبا", "Champions League", "8", "16", "12", "1" },
        { "PPL", "الدوري البرتغالي", "Primeira Liga", "2", "1", "2", "0" },
        { "DED", "الدوري الهولندي", "Eredivisie", "2", "1", "2", "0" },
        { "ELC", "تشامبيونشيب إنجلترا", "Championship", "2", "4", "3", "0" },
        { "BSA", "الدوري البرازيلي", "Brasileirão", "4", "2", "4", "0" }
    };
    protected String lgCur = "PD";
    protected int lgTab = 0;
    protected Dialog lgDialog;
    protected LinearLayout lgRoot;

    protected String[] lgInfo() {
        for (String[] l : LEAGUES) if (l[0].equals(lgCur)) return l;
        return LEAGUES[0];
    }

    protected int zoneColor(int pos, int total, String[] l) {
        if (l[6].equals("1")) {
            if (pos <= 8) return 0xFF14F195;
            if (pos <= 24) return 0xFF6AA8FF;
            return 0xFFFF5A6E;
        }
        int top = Integer.parseInt(l[3]), mid = Integer.parseInt(l[4]), bot = Integer.parseInt(l[5]);
        if (pos <= top) return 0xFF14F195;
        if (pos <= top + mid) return 0xFF6AA8FF;
        if (pos > total - bot) return 0xFFFF5A6E;
        return 0x00000000;
    }

    protected void openLeagueTable() {
        String s = getSharedPreferences("zelo_lang", MODE_PRIVATE).getString("zelo_league_last", null);
        if (s != null) for (String[] l : LEAGUES) if (l[0].equals(s)) lgCur = s;
        lgTab = 0;
        if (lgDialog != null) { try { lgDialog.dismiss(); } catch (Exception ignore) {} }
        lgDialog = sheetDialog(true);
        lbDirection(lgDialog);
        ScrollView sc = new ScrollView(this);
        lgRoot = new LinearLayout(this);
        lgRoot.setOrientation(LinearLayout.VERTICAL);
        lgRoot.setPadding(dp(14), statusH() + dp(6), dp(14), navH() + dp(24));
        sc.addView(lgRoot);
        lgDialog.setContentView(sc);
        lgDialog.show();
        lgDraw();
    }

    protected TextView lgCell(String text, int wDp, int color, int size, boolean bold, int gravity) {
        TextView t = tv(color, size, bold);
        t.setText(text);
        t.setGravity(gravity);
        t.setLayoutParams(wDp > 0 ? new LinearLayout.LayoutParams(dp(wDp), ViewGroup.LayoutParams.WRAP_CONTENT) : new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        return t;
    }

    protected View lgCrest(String url, int sizeDp) {
        ImageView iv = new ImageView(this);
        iv.setScaleType(ImageView.ScaleType.FIT_CENTER);
        iv.setLayoutParams(new LinearLayout.LayoutParams(dp(sizeDp), dp(sizeDp)));
        String u = lbSafePhoto(url);
        if (u.length() > 0) loadImage(u, iv);
        return iv;
    }

    protected void lgDraw() {
        if (lgRoot == null) return;
        lgRoot.removeAllViews();
        final String[] l = lgInfo();
        LinearLayout head = new LinearLayout(this);
        head.setGravity(Gravity.CENTER_VERTICAL);
        head.addView(backBtn(new Runnable() { @Override public void run() { if (lgDialog != null) lgDialog.dismiss(); lgDialog = null; lgRoot = null; } }));
        TextView title = tv(Color.WHITE, 21, true);
        title.setText(L("الترتيب", "Ranking"));
        title.setPadding(dp(12), 0, dp(12), 0);
        head.addView(title, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        LinearLayout.LayoutParams hl = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        hl.setMargins(0, 0, 0, dp(12));
        lgRoot.addView(head, hl);

        LinearLayout pick = new LinearLayout(this);
        pick.setGravity(Gravity.CENTER_VERTICAL);
        pick.setPadding(dp(14), dp(10), dp(14), dp(10));
        GradientDrawable pg = new GradientDrawable();
        pg.setColor(0x402C4BB5);
        pg.setCornerRadius(dp(16));
        pg.setStroke(dp(1), 0x59F5C35A);
        pick.setBackground(pg);
        TextView pn = tv(Color.WHITE, 16, true);
        pn.setText(L(l[1], l[2]));
        pick.addView(pn, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        TextView ps = tv(0xFFCFD8FF, 12, false);
        ps.setText(L("تغيير الدوري", "Change league"));
        ps.setPadding(dp(8), 0, dp(8), 0);
        pick.addView(ps);
        TextView pa = tv(GOLD, 14, false);
        pa.setText("▾");
        pick.addView(pa);
        pick.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { lgPick(); } });
        LinearLayout.LayoutParams pl = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        pl.setMargins(0, 0, 0, dp(12));
        lgRoot.addView(pick, pl);

        LinearLayout.LayoutParams tl = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        tl.setMargins(0, 0, 0, dp(12));
        lgRoot.addView(lbTabBar(new String[] { L("الترتيب", "Table"), L("الهدّافون", "Top scorers") }, lgTab, new TabPick() {
            @Override public void on(int i) { lgTab = i; lgDraw(); }
        }), tl);

        final LinearLayout body = new LinearLayout(this);
        body.setOrientation(LinearLayout.VERTICAL);
        TextView ld = tv(0xFF94A3B8, 15, true);
        ld.setText("");
        ld.setGravity(Gravity.CENTER);
        ld.setPadding(0, dp(30), 0, dp(30));
        body.addView(ld);
        lgRoot.addView(body);
        final String cur = lgCur;
        final int tab = lgTab;
        pool.execute(new Runnable() {
            @Override public void run() {
                JSONArray data = null;
                try {
                    if (tab == 0) data = new JSONArray(get("standings?select=*&competition_code=eq." + cur + "&order=position.asc"));
                    else data = new JSONArray(get("scorers?select=*&competition_code=eq." + cur + "&order=goals.desc&limit=20"));
                } catch (Exception ignore) {}
                final JSONArray fd = data;
                runOnUiThread(new Runnable() {
                    @Override public void run() {
                        if (lgRoot == null || !cur.equals(lgCur) || tab != lgTab) return;
                        body.removeAllViews();
                        if (fd == null) { body.addView(lbEmpty(L("تعذّر تحميل البيانات", "Could not load data"))); return; }
                        if (fd.length() == 0) { body.addView(lbEmpty(L("لا توجد بيانات لهذا الدوري بعد", "No data for this league yet"))); return; }
                        if (tab == 0) lgStandings(body, fd, l); else lgScorers(body, fd);
                    }
                });
            }
        });
    }

    protected void lgStandings(LinearLayout body, JSONArray data, String[] l) {
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setPadding(dp(8), 0, dp(8), 0);
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(0x0AFFFFFF);
        bg.setCornerRadius(dp(20));
        bg.setStroke(dp(1), 0x14FFFFFF);
        box.setBackground(bg);
        LinearLayout th = new LinearLayout(this);
        th.setGravity(Gravity.CENTER_VERTICAL);
        th.addView(lgCell("#", 34, MUTED, 11, true, Gravity.CENTER));
        th.addView(lgCell(L("الفريق", "Team"), 0, MUTED, 11, true, Gravity.START));
        th.addView(lgCell(L("لعب", "P"), 34, MUTED, 11, true, Gravity.CENTER));
        th.addView(lgCell(L("فرق", "GD"), 40, MUTED, 11, true, Gravity.CENTER));
        th.addView(lgCell(L("نقاط", "Pts"), 40, MUTED, 11, true, Gravity.CENTER));
        box.addView(th, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(34)));
        int total = data.length();
        for (int i = 0; i < total; i++) {
            JSONObject t = data.optJSONObject(i);
            if (t == null) continue;
            int pos = t.optInt("position", i + 1);
            FrameLayout cell = new FrameLayout(this);
            View top = new View(this);
            top.setBackgroundColor(0x0FFFFFFF);
            cell.addView(top, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(1), Gravity.TOP));
            View z = new View(this);
            GradientDrawable zg = new GradientDrawable();
            zg.setColor(zoneColor(pos, total, l));
            zg.setCornerRadius(dp(4));
            z.setBackground(zg);
            FrameLayout.LayoutParams zl = new FrameLayout.LayoutParams(dp(4), ViewGroup.LayoutParams.MATCH_PARENT, Gravity.START);
            zl.setMargins(0, dp(6), 0, dp(6));
            cell.addView(z, zl);
            LinearLayout row = new LinearLayout(this);
            row.setGravity(Gravity.CENTER_VERTICAL);
            row.addView(lgCell(String.valueOf(pos), 34, 0xFFCFD8FF, 13, false, Gravity.CENTER));
            LinearLayout nm = new LinearLayout(this);
            nm.setGravity(Gravity.CENTER_VERTICAL);
            nm.addView(lgCrest(t.optString("crest", ""), 26));
            TextView tn = tv(Color.WHITE, 13, true);
            tn.setText(teamName(t.optString("team_name", "")));
            tn.setSingleLine(true);
            tn.setEllipsize(android.text.TextUtils.TruncateAt.END);
            tn.setPadding(dp(9), 0, dp(9), 0);
            nm.addView(tn);
            row.addView(nm, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
            int gdv = t.optInt("gd", 0);
            row.addView(lgCell(String.valueOf(t.optInt("played", 0)), 34, 0xFFCFD8FF, 13, false, Gravity.CENTER));
            TextView gd = lgCell(gdv > 0 ? "+" + gdv : String.valueOf(gdv), 40, 0xFFCFD8FF, 13, false, Gravity.CENTER);
            gd.setLayoutDirection(View.LAYOUT_DIRECTION_LTR);
            row.addView(gd);
            row.addView(lgCell(String.valueOf(t.optInt("points", 0)), 40, 0xFFFFD98A, 15, true, Gravity.CENTER));
            cell.addView(row, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
            box.addView(cell, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(46)));
        }
        body.addView(box);
        // مفتاح الألوان
        LinearLayout leg = new LinearLayout(this);
        leg.setPadding(dp(4), dp(12), dp(4), dp(12));
        if (l[6].equals("1")) {
            leg.addView(legItem(0xFF14F195, L("مباشرة لدور الـ16", "Last 16")));
            leg.addView(legItem(0xFF6AA8FF, L("الملحق", "Play-offs")));
            leg.addView(legItem(0xFFFF5A6E, L("خروج", "Out")));
        } else if (l[0].equals("ELC")) {
            leg.addView(legItem(0xFF14F195, L("صعود مباشر", "Promotion")));
            leg.addView(legItem(0xFF6AA8FF, L("ملحق الصعود", "Play-offs")));
            leg.addView(legItem(0xFFFF5A6E, L("الهبوط", "Relegation")));
        } else {
            leg.addView(legItem(0xFF14F195, L("دوري الأبطال", "Champions League")));
            leg.addView(legItem(0xFF6AA8FF, L("أوروبا", "Europe")));
            leg.addView(legItem(0xFFFF5A6E, L("الهبوط", "Relegation")));
        }
        body.addView(leg);
    }

    protected View legItem(int color, String text) {
        LinearLayout r = new LinearLayout(this);
        r.setGravity(Gravity.CENTER_VERTICAL);
        View sq = new View(this);
        GradientDrawable g = new GradientDrawable();
        g.setColor(color);
        g.setCornerRadius(dp(3));
        sq.setBackground(g);
        r.addView(sq, new LinearLayout.LayoutParams(dp(10), dp(10)));
        TextView t = tv(0xFFCFD8FF, 11, false);
        t.setText(text);
        t.setPadding(dp(6), 0, dp(14), 0);
        r.addView(t);
        return r;
    }

    protected void lgScorers(LinearLayout body, JSONArray data) {
        int[] medal = { 0xFFFFD98A, 0xFFC9D3E6, 0xFFD9965B };
        for (int i = 0; i < data.length(); i++) {
            JSONObject p = data.optJSONObject(i);
            if (p == null) continue;
            int col = i < 3 ? medal[i] : MUTED;
            LinearLayout row = new LinearLayout(this);
            row.setGravity(Gravity.CENTER_VERTICAL);
            row.setPadding(dp(12), dp(9), dp(12), dp(9));
            GradientDrawable g;
            if (i == 0) {
                g = new GradientDrawable(GradientDrawable.Orientation.LEFT_RIGHT, new int[] { 0x38F5C35A, 0x472C4BB5 });
                g.setStroke(dp(1), GOLD);
            } else {
                g = new GradientDrawable();
                g.setColor(0x0DFFFFFF);
                g.setStroke(dp(1), 0x14FFFFFF);
            }
            g.setCornerRadius(dp(16));
            row.setBackground(g);
            row.addView(lgCell(String.valueOf(i + 1), 24, col, 15, true, Gravity.CENTER));
            LinearLayout mid = new LinearLayout(this);
            mid.setOrientation(LinearLayout.VERTICAL);
            mid.setPadding(dp(8), 0, dp(8), 0);
            TextView nm = tv(Color.WHITE, 14, true);
            nm.setText(p.optString("player_name", ""));
            nm.setSingleLine(true);
            nm.setEllipsize(android.text.TextUtils.TruncateAt.END);
            mid.addView(nm);
            LinearLayout tm = new LinearLayout(this);
            tm.setGravity(Gravity.CENTER_VERTICAL);
            tm.setPadding(0, dp(3), 0, 0);
            tm.addView(lgCrest(p.optString("team_crest", ""), 16));
            String ast = p.isNull("assists") || !p.has("assists") ? "" : " · " + p.optInt("assists") + " " + L("تمريرة حاسمة", "assists");
            TextView tt = tv(MUTED, 12, false);
            tt.setText(teamName(p.optString("team_name", "")) + ast);
            tt.setPadding(dp(6), 0, 0, 0);
            tm.addView(tt);
            mid.addView(tm);
            row.addView(mid, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
            LinearLayout gl = new LinearLayout(this);
            gl.setOrientation(LinearLayout.VERTICAL);
            gl.setGravity(Gravity.CENTER_HORIZONTAL);
            TextView gn = tv(GOLD, 22, true);
            gn.setText(String.valueOf(p.optInt("goals", 0)));
            gn.setGravity(Gravity.CENTER);
            gl.addView(gn);
            TextView gs = tv(MUTED, 10, false);
            gs.setText(L("هدف", "goals"));
            gs.setGravity(Gravity.CENTER);
            gl.addView(gs);
            row.addView(gl, new LinearLayout.LayoutParams(dp(44), ViewGroup.LayoutParams.WRAP_CONTENT));
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            lp.setMargins(0, 0, 0, dp(8));
            body.addView(row, lp);
        }
    }

    // نافذة اختيار الدوري من أسفل الشاشة
    protected void lgPick() {
        final Dialog d = sheetDialog(false);
        lbDirection(d);
        ScrollView sc = new ScrollView(this);
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setPadding(dp(16), dp(14), dp(16), navH() + dp(24));
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(NAVY);
        bg.setCornerRadii(new float[] { dp(22), dp(22), dp(22), dp(22), 0, 0, 0, 0 });
        bg.setStroke(dp(1), 0x59F5C35A);
        box.setBackground(bg);
        for (final String[] x : LEAGUES) {
            boolean on = x[0].equals(lgCur);
            TextView it = tv(on ? 0xFFFFD98A : 0xFFF4F6FF, 16, true);
            it.setText(L(x[1], x[2]));
            it.setPadding(dp(10), dp(13), dp(10), dp(13));
            GradientDrawable ig = new GradientDrawable();
            ig.setColor(on ? 0x26F5C35A : 0x00000000);
            ig.setCornerRadius(dp(12));
            it.setBackground(ig);
            it.setOnClickListener(new View.OnClickListener() {
                @Override public void onClick(View v) {
                    lgCur = x[0];
                    getSharedPreferences("zelo_lang", MODE_PRIVATE).edit().putString("zelo_league_last", lgCur).apply();
                    d.dismiss();
                    lgDraw();
                }
            });
            box.addView(it);
        }
        sc.addView(box);
        d.setContentView(sc);
        d.show();
    }
}
