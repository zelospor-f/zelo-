package PKG;

import android.app.AlertDialog;
import android.app.Dialog;
import android.content.DialogInterface;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.HorizontalScrollView;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.PopupWindow;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.VideoView;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TimeZone;
import org.json.JSONArray;
import org.json.JSONObject;

// ستوريات ZELO: صف الدوائر + عارض الستوري + النشر + كبسولة "مباشر" وقائمتها.
// الملفات تُرفع إلى R2 (كالمنشورات) والسجل في جدول stories، ويُحذف كلاهما بعد 24 ساعة (cleanup-stories).
abstract class Stories extends FollowList {

    private static class StEye extends android.graphics.drawable.Drawable {
        final int color, px;
        final android.graphics.Paint p = new android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG);
        StEye(int color, int px) { this.color = color; this.px = px; }
        @Override public int getIntrinsicWidth() { return px; }
        @Override public int getIntrinsicHeight() { return px; }
        @Override public void setAlpha(int a) {}
        @Override public void setColorFilter(android.graphics.ColorFilter f) {}
        @Override public int getOpacity() { return android.graphics.PixelFormat.TRANSLUCENT; }
        @Override public void draw(android.graphics.Canvas c) {
            c.save();
            c.translate(getBounds().left, getBounds().top);
            float sc = px / 24f;
            c.scale(sc, sc);
            p.setStyle(android.graphics.Paint.Style.STROKE);
            p.setStrokeWidth(1.8f);
            p.setStrokeCap(android.graphics.Paint.Cap.ROUND);
            p.setStrokeJoin(android.graphics.Paint.Join.ROUND);
            p.setColor(color);
            android.graphics.Path a = new android.graphics.Path();
            a.moveTo(2f, 12f);
            a.quadTo(12f, 2f, 22f, 12f);
            a.quadTo(12f, 22f, 2f, 12f);
            a.close();
            c.drawPath(a, p);
            c.drawCircle(12f, 12f, 3.2f, p);
            c.restore();
        }
    }
    protected abstract void openReport(String type, String id, JSONObject target);
    protected abstract void blockUser(String target, String tag);

    private static final int ST_IMG_MS = 6000;
    private static final int ST_VID_MAX_MS = 30000;
    private static final long ST_VID_MAX_BYTES = 50L * 1024 * 1024;

    private final Handler stH = new Handler(Looper.getMainLooper());
    protected HorizontalScrollView stBar;
    protected LinearLayout stRowLl;
    protected final List<JSONObject> stAll = new ArrayList<JSONObject>();
    protected final List<List<JSONObject>> stGroups = new ArrayList<List<JSONObject>>();
    private final Set<String> stSeen = new LinkedHashSet<String>();
    private boolean stSeenLoaded = false;
    private boolean stBusy = false;
    private boolean stPosting = false;
    private PopupWindow stPw;
    private final Set<String> stMyLikes = new HashSet<String>();
    private ImageView stHeart;
    private FrameLayout stRootFl;
    private Runnable stTapRun;
    private long stLastTapT = 0;

    // ---- حالة العارض ----
    private Dialog stDlg;
    private FrameLayout stMedia;
    private LinearLayout stBars;
    private TextView stNameTv, stTimeTv, stCapTv, stViewsTv, stGoalsTv;
    private LinearLayout stStatsBox;
    private View stEyeIv, stBallIv;
    private View stDelBtn, stMenuBtn;
    private VideoView stVv;
    private int stCurG = -1, stCurI = 0;
    private long stStart = 0, stPausedAt = 0;
    private int stDur = 0;
    private boolean stPaused = false;
    private float stDownX, stDownY;
    private long stDownT;

    // ================= صف الدوائر =================
    protected View stBuildBar() {
        stBar = new HorizontalScrollView(this);
        stBar.setHorizontalScrollBarEnabled(false);
        stRowLl = new LinearLayout(this);
        stRowLl.setPadding(dp(10), dp(6), dp(10), dp(6));
        stBar.addView(stRowLl);
        stBar.setVisibility(View.GONE);
        return stBar;
    }

    private void stLoadSeen() {
        if (stSeenLoaded) return;
        stSeenLoaded = true;
        String s = getSharedPreferences("zn", MODE_PRIVATE).getString("st_seen", "");
        for (String x : s.split(",")) if (x.length() > 0) stSeen.add(x);
    }

    private void stSaveSeen() {
        List<String> l = new ArrayList<String>(stSeen);
        while (l.size() > 400) { stSeen.remove(l.get(0)); l.remove(0); }
        getSharedPreferences("zn", MODE_PRIVATE).edit().putString("st_seen", android.text.TextUtils.join(",", l)).apply();
    }

    protected void stLoad() {
        if (uid == null || stBusy) return;
        stBusy = true;
        pool.execute(new Runnable() {
            @Override public void run() {
                final List<JSONObject> rows = new ArrayList<JSONObject>();
                final Set<String> likes = new HashSet<String>();
                boolean ok = false;
                try {
                    try {
                        JSONArray lk = new JSONArray(get("story_likes?select=story_id&user_id=eq." + uid + "&limit=1000"));
                        for (int i = 0; i < lk.length(); i++) likes.add(lk.getJSONObject(i).optString("story_id"));
                    } catch (Exception ignore) {}
                    Set<String> blocked = new HashSet<String>(blockSet);
                    try {
                        JSONArray b = new JSONArray(get("user_blocks?select=blocked_id&user_id=eq." + uid + "&limit=1000"));
                        for (int i = 0; i < b.length(); i++) blocked.add(b.getJSONObject(i).optString("blocked_id"));
                    } catch (Exception ignore) {}
                    SimpleDateFormat f = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", java.util.Locale.US);
                    f.setTimeZone(TimeZone.getTimeZone("UTC"));
                    String now = f.format(new Date());
                    JSONArray a = new JSONArray(get("stories?select=id,user_id,media_type,media_url,media_path,caption,created_at,author_name,author_avatar&expires_at=gt." + now + "&order=created_at.asc&limit=200"));
                    for (int i = 0; i < a.length(); i++) {
                        JSONObject o = a.getJSONObject(i);
                        String au = o.optString("user_id", "");
                        if (blocked.contains(au) || muteSet.contains(au)) continue;
                        rows.add(o);
                    }
                    ok = true;
                } catch (Exception ignore) {}
                final boolean fok = ok;
                runOnUiThread(new Runnable() {
                    @Override public void run() {
                        stBusy = false;
                        if (fok) { stMyLikes.clear(); stMyLikes.addAll(likes); stApply(rows); }
                    }
                });
            }
        });
    }

    private boolean stUnseen(List<JSONObject> g) {
        for (JSONObject o : g) if (!stSeen.contains(o.optString("id"))) return true;
        return false;
    }

    // يجمّع حسب الناشر: ستورياتي أولاً، ثم غير المشاهد، ثم المشاهد
    protected void stApply(List<JSONObject> rows) {
        stLoadSeen();
        stAll.clear();
        stAll.addAll(rows);
        LinkedHashMap<String, List<JSONObject>> m = new LinkedHashMap<String, List<JSONObject>>();
        for (JSONObject o : rows) {
            String au = o.optString("user_id", "");
            List<JSONObject> l = m.get(au);
            if (l == null) { l = new ArrayList<JSONObject>(); m.put(au, l); }
            l.add(o);
        }
        stGroups.clear();
        List<List<JSONObject>> unseen = new ArrayList<List<JSONObject>>();
        List<List<JSONObject>> seen = new ArrayList<List<JSONObject>>();
        List<JSONObject> mine = null;
        for (Map.Entry<String, List<JSONObject>> e : m.entrySet()) {
            if (e.getKey().equals(uid)) { mine = e.getValue(); continue; }
            if (stUnseen(e.getValue())) unseen.add(e.getValue()); else seen.add(e.getValue());
        }
        if (mine != null) stGroups.add(mine);
        stGroups.addAll(unseen);
        stGroups.addAll(seen);
        stRender();
    }

    private void stRender() {
        if (stBar == null || stRowLl == null) return;
        stRowLl.removeAllViews();
        if (stGroups.isEmpty()) { stBar.setVisibility(View.GONE); return; }
        stBar.setVisibility(View.VISIBLE);
        stRowLl.addView(stCircle(-1, L("ستوري", "Story"), null, false));
        for (int i = 0; i < stGroups.size(); i++) {
            List<JSONObject> g = stGroups.get(i);
            JSONObject first = g.get(0);
            boolean mine = uid != null && uid.equals(first.optString("user_id"));
            String nm = mine ? L("ستورياتي", "My stories") : first.optString("author_name", "");
            String ph = first.isNull("author_avatar") ? null : first.optString("author_avatar", "");
            stRowLl.addView(stCircle(i, nm, ph, stUnseen(g) && !mine));
        }
    }

    private View stCircle(final int gi, String name, String photo, boolean unseen) {
        LinearLayout c = new LinearLayout(this);
        c.setOrientation(LinearLayout.VERTICAL);
        c.setGravity(Gravity.CENTER_HORIZONTAL);
        c.setPadding(dp(6), dp(2), dp(6), dp(2));
        FrameLayout ring = new FrameLayout(this);
        if (gi < 0) {
            ring.setBackground(oval(CARD, GOLD));
            TextView plus = tv(GOLD, 28, true);
            plus.setText("+");
            plus.setGravity(Gravity.CENTER);
            ring.addView(plus, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        } else {
            ring.setBackground(oval(0x00000000, unseen ? GOLD : 0xFF4A5AA8));
            View av = rpAvatar(name, photo, 50);
            ring.addView(av, new FrameLayout.LayoutParams(dp(50), dp(50), Gravity.CENTER));
        }
        c.addView(ring, new LinearLayout.LayoutParams(dp(60), dp(60)));
        TextView l = tv(0xFFE6E9FF, 11, false);
        l.setText(name);
        l.setSingleLine(true);
        l.setEllipsize(android.text.TextUtils.TruncateAt.END);
        l.setGravity(Gravity.CENTER);
        l.setPadding(0, dp(3), 0, 0);
        c.addView(l, new LinearLayout.LayoutParams(dp(64), ViewGroup.LayoutParams.WRAP_CONTENT));
        c.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) { if (gi < 0) stNew(); else stOpen(gi); }
        });
        return c;
    }

    // ================= كبسولة مباشر + القائمة =================
    protected View stLiveCapsule() {
        LinearLayout cap = new LinearLayout(this);
        cap.setGravity(Gravity.CENTER_VERTICAL);
        cap.setBackground(rbg(0xFF0D2B2A, 0xFF14F195, 20));
        TextView live = tv(0xFF14F195, 13, true);
        live.setText("LIVE");
        live.setGravity(Gravity.CENTER);
        live.setPaddingRelative(dp(14), 0, dp(6), 0);
        live.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) { openTodayMatches("live"); }
        });
        cap.addView(live, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.MATCH_PARENT));
        final TextView arrow = tv(0xFF14F195, 16, true);
        arrow.setText("▾");
        arrow.setGravity(Gravity.CENTER);
        arrow.setPaddingRelative(dp(6), 0, dp(12), 0);
        arrow.setContentDescription(L("المزيد", "More"));
        arrow.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) { stMenu(v); }
        });
        cap.addView(arrow, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.MATCH_PARENT));
        return cap;
    }

    private void stMenuItem(LinearLayout box, String glyph, String label, final Runnable act) {
        LinearLayout r = new LinearLayout(this);
        r.setGravity(Gravity.CENTER_VERTICAL);
        r.setPadding(dp(14), dp(12), dp(14), dp(12));
        TextView g = tv(GOLD, 18, true);
        g.setText(glyph);
        g.setGravity(Gravity.CENTER);
        r.addView(g, new LinearLayout.LayoutParams(dp(28), ViewGroup.LayoutParams.WRAP_CONTENT));
        TextView t = tv(Color.WHITE, 15, true);
        t.setText(label);
        t.setPadding(dp(10), 0, 0, 0);
        r.addView(t);
        r.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) {
                if (stPw != null) stPw.dismiss();
                act.run();
            }
        });
        box.addView(r, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
    }

    protected void stMenu(View anchor) {
        if (stPw != null && stPw.isShowing()) { stPw.dismiss(); return; }
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);
        box.setBackground(rbg(0xFF111A4A, 0x66F5C35A, 16));
        box.setPadding(0, dp(4), 0, dp(4));
        stMenuItem(box, "+", L("ستوري جديد", "New story"), new Runnable() { @Override public void run() { stNew(); } });
        stMenuItem(box, "🕐", L("الليلة", "Tonight"), new Runnable() { @Override public void run() { openTodayMatches("tonight"); } });
        stMenuItem(box, "⬆", L("كيف تكسب", "How to earn"), new Runnable() { @Override public void run() { openPointsPage(); } });
        stMenuItem(box, "🏆", L("الترتيب", "Ranking"), new Runnable() { @Override public void run() { openLeagueTable(); } });
        stMenuItem(box, "🎯", L("الرادار", "Radar"), new Runnable() { @Override public void run() { openFanRadar(); } });
        stMenuItem(box, "⭐", L("الاشتراكات", "Plans"), new Runnable() { @Override public void run() { openSubscriptions(); } });
        stPw = new PopupWindow(box, dp(210), ViewGroup.LayoutParams.WRAP_CONTENT, true);
        stPw.setBackgroundDrawable(new ColorDrawable(0x00000000));
        stPw.setOutsideTouchable(true);
        stPw.setElevation(dp(8));
        stPw.showAsDropDown(anchor, 0, dp(10));
    }

    // ================= العارض =================
    private boolean stMine(JSONObject s) { return uid != null && uid.equals(s.optString("user_id")); }

    protected void stOpen(int gi) {
        if (gi < 0 || gi >= stGroups.size()) return;
        stLoadSeen();
        stTeardown(false);
        stCurG = gi;
        List<JSONObject> g = stGroups.get(gi);
        int start = 0;
        for (int i = 0; i < g.size(); i++) if (!stSeen.contains(g.get(i).optString("id"))) { start = i; break; }
        stCurI = start;

        stDlg = new Dialog(this, android.R.style.Theme_Black_NoTitleBar_Fullscreen);
        FrameLayout root = new FrameLayout(this);
        stRootFl = root;
        root.setBackgroundColor(Color.BLACK);
        root.setLayoutDirection(View.LAYOUT_DIRECTION_LTR);
        stMedia = new FrameLayout(this);
        FrameLayout.LayoutParams mdl = new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT);
        mdl.setMargins(0, statusH() + dp(66), 0, navH() + dp(66));
        root.addView(stMedia, mdl);

        View touch = new View(this);
        touch.setOnTouchListener(new View.OnTouchListener() {
            @Override public boolean onTouch(View v, MotionEvent e) {
                int a = e.getActionMasked();
                if (a == MotionEvent.ACTION_DOWN) { stDownX = e.getX(); stDownY = e.getY(); stDownT = System.currentTimeMillis(); stPause(); return true; }
                if (a == MotionEvent.ACTION_UP || a == MotionEvent.ACTION_CANCEL) {
                    float dx = e.getX() - stDownX, dy = e.getY() - stDownY;
                    long dt = System.currentTimeMillis() - stDownT;
                    if (a == MotionEvent.ACTION_UP && dy > dp(110) && dy > Math.abs(dx)) { stTeardown(true); return true; }
                    stResume();
                    if (a == MotionEvent.ACTION_UP && dt < 350 && Math.abs(dx) < dp(14) && Math.abs(dy) < dp(14)) {
                        long now = System.currentTimeMillis();
                        JSONObject cur = stCurrent();
                        if (stTapRun != null && now - stLastTapT < 320 && cur != null && !stMine(cur)) {
                            stH.removeCallbacks(stTapRun);
                            stTapRun = null;
                            stLikeCurrent(true);
                            stBurst();
                        } else {
                            final boolean left = stDownX < v.getWidth() / 3f;
                            stLastTapT = now;
                            if (stTapRun != null) stH.removeCallbacks(stTapRun);
                            stTapRun = new Runnable() {
                                @Override public void run() { stTapRun = null; if (left) stPrev(); else stNext(); }
                            };
                            stH.postDelayed(stTapRun, 260);
                        }
                    }
                    return true;
                }
                return true;
            }
        });
        root.addView(touch, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        stBars = new LinearLayout(this);
        stBars.setLayoutDirection(View.LAYOUT_DIRECTION_LTR);
        FrameLayout.LayoutParams bl = new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(3), Gravity.TOP);
        bl.setMargins(dp(8), statusH() + dp(8), dp(8), 0);
        root.addView(stBars, bl);

        LinearLayout head = new LinearLayout(this);
        head.setGravity(Gravity.CENTER_VERTICAL);
        head.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);
        FrameLayout.LayoutParams hl = new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.TOP);
        hl.setMargins(dp(12), statusH() + dp(20), dp(12), 0);
        LinearLayout nameBox = new LinearLayout(this);
        nameBox.setOrientation(LinearLayout.VERTICAL);
        stNameTv = tv(Color.WHITE, 14, true);
        stNameTv.setShadowLayer(4f, 0f, 1f, 0xAA000000);
        stTimeTv = tv(0xFFD8DCF5, 11, false);
        stTimeTv.setShadowLayer(4f, 0f, 1f, 0xAA000000);
        nameBox.addView(stNameTv);
        nameBox.addView(stTimeTv);
        head.addView(nameBox, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        stMenuBtn = tv(Color.WHITE, 22, true);
        ((TextView) stMenuBtn).setText("⋮");
        ((TextView) stMenuBtn).setGravity(Gravity.CENTER);
        stMenuBtn.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { stOthersMenu(); } });
        head.addView(stMenuBtn, new LinearLayout.LayoutParams(dp(40), dp(40)));
        TextView x = tv(Color.WHITE, 22, true);
        x.setText("✕");
        x.setGravity(Gravity.CENTER);
        x.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { stTeardown(true); } });
        head.addView(x, new LinearLayout.LayoutParams(dp(40), dp(40)));
        root.addView(head, hl);

        stCapTv = tv(Color.WHITE, 16, false);
        stCapTv.setGravity(Gravity.CENTER);
        stCapTv.setShadowLayer(6f, 0f, 1f, 0xCC000000);
        stCapTv.setPadding(dp(18), dp(10), dp(18), dp(10));
        FrameLayout.LayoutParams cl = new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.BOTTOM);
        cl.setMargins(0, 0, 0, navH() + dp(74));
        root.addView(stCapTv, cl);

        LinearLayout bottom = new LinearLayout(this);
        bottom.setGravity(Gravity.CENTER_VERTICAL);
        bottom.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);
        bottom.setPadding(dp(16), 0, dp(16), 0);
        stHeart = new ImageView(this);
        stHeart.setScaleType(ImageView.ScaleType.CENTER);
        stHeart.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { stLikeCurrent(false); } });
        bottom.addView(stHeart, new LinearLayout.LayoutParams(dp(52), dp(44)));
        stStatsBox = new LinearLayout(this);
        stStatsBox.setGravity(Gravity.CENTER_VERTICAL);
        stStatsBox.setLayoutDirection(View.LAYOUT_DIRECTION_LTR);
        ImageView eye = new ImageView(this);
        eye.setImageDrawable(new StEye(0xFFE6E9FF, dp(22)));
        stEyeIv = eye;
        stStatsBox.addView(eye, new LinearLayout.LayoutParams(dp(24), dp(24)));
        stViewsTv = tv(0xFFE6E9FF, 15, true);
        stViewsTv.setPadding(dp(6), 0, dp(18), 0);
        stStatsBox.addView(stViewsTv);
        ImageView ball = new ImageView(this);
        ball.setImageDrawable(new Ic(2, 0xFF14F195, false, dp(20)));
        stBallIv = ball;
        stStatsBox.addView(ball, new LinearLayout.LayoutParams(dp(24), dp(24)));
        stGoalsTv = tv(0xFF14F195, 15, true);
        stGoalsTv.setPadding(dp(6), 0, 0, 0);
        stStatsBox.addView(stGoalsTv);
        bottom.addView(stStatsBox, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        TextView del = tv(0xFFFF8A8A, 14, true);
        del.setText(L("حذف", "Delete"));
        del.setGravity(Gravity.CENTER);
        del.setBackground(rbg(0x66000000, 0x66FF8A8A, 18));
        del.setPadding(dp(16), dp(8), dp(16), dp(8));
        del.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { stDeleteCurrent(); } });
        stDelBtn = del;
        bottom.addView(del, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        FrameLayout.LayoutParams bol = new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.BOTTOM);
        bol.setMargins(0, 0, 0, navH() + dp(10));
        root.addView(bottom, bol);

        stDlg.setContentView(root);
        stDlg.setOnDismissListener(new DialogInterface.OnDismissListener() {
            @Override public void onDismiss(DialogInterface di) { stTeardown(true); }
        });
        stDlg.show();
        stShowItem();
    }

    private void stBuildBars(int n, int cur) {
        stBars.removeAllViews();
        for (int i = 0; i < n; i++) {
            FrameLayout seg = new FrameLayout(this);
            seg.setBackground(rbg(0x55FFFFFF, 0, 2));
            View fill = new View(this);
            fill.setBackground(rbg(Color.WHITE, 0, 2));
            fill.setPivotX(0f);
            fill.setScaleX(i < cur ? 1f : 0f);
            seg.addView(fill, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.MATCH_PARENT, 1f);
            lp.setMargins(dp(2), 0, dp(2), 0);
            stBars.addView(seg, lp);
        }
    }

    private void stSetFill(float f) {
        if (stBars == null || stCurI >= stBars.getChildCount()) return;
        View seg = stBars.getChildAt(stCurI);
        if (seg instanceof FrameLayout && ((FrameLayout) seg).getChildCount() > 0) ((FrameLayout) seg).getChildAt(0).setScaleX(Math.max(0f, Math.min(1f, f)));
    }

    private final Runnable stTick = new Runnable() {
        @Override public void run() {
            if (stDlg == null || !stDlg.isShowing()) return;
            if (!stPaused && stDur > 0) {
                long el = System.currentTimeMillis() - stStart;
                stSetFill(el / (float) stDur);
                if (el >= stDur) { stNext(); return; }
            }
            stH.postDelayed(this, 40);
        }
    };

    private void stShowItem() {
        if (stDlg == null || stCurG < 0 || stCurG >= stGroups.size()) return;
        List<JSONObject> g = stGroups.get(stCurG);
        if (stCurI < 0 || stCurI >= g.size()) { stTeardown(true); return; }
        final JSONObject s = g.get(stCurI);
        stH.removeCallbacks(stTick);
        stMedia.removeAllViews();
        stVv = null;
        stPaused = false;
        stDur = 0;
        stBuildBars(g.size(), stCurI);

        final boolean mine = stMine(s);
        String nm = s.optString("author_name", "");
        stNameTv.setText(mine ? L("ستورياتي", "My stories") : nm);
        stTimeTv.setText(ago(s.optString("created_at", "")));
        String cap = s.isNull("caption") ? "" : s.optString("caption", "");
        stCapTv.setText(cap);
        stCapTv.setVisibility(cap.length() > 0 ? View.VISIBLE : View.GONE);
        stMenuBtn.setVisibility(mine ? View.GONE : View.VISIBLE);
        stDelBtn.setVisibility(mine ? View.VISIBLE : View.GONE);
        stStatsBox.setVisibility(View.VISIBLE);
        stStatsBox.setGravity(mine ? (Gravity.CENTER_VERTICAL | Gravity.LEFT) : (Gravity.CENTER_VERTICAL | Gravity.RIGHT));
        stEyeIv.setVisibility(View.VISIBLE);
        stViewsTv.setVisibility(View.VISIBLE);
        stBallIv.setVisibility(mine ? View.VISIBLE : View.GONE);
        stGoalsTv.setPadding(mine ? dp(6) : dp(10), 0, 0, 0);
        stViewsTv.setText("0");
        stGoalsTv.setText("0");
        stHeart.setVisibility(mine ? View.GONE : View.VISIBLE);
        stPaintHeart(s.optString("id", ""));

        final String url = s.optString("media_url", "");
        if ("video".equals(s.optString("media_type"))) {
            final VideoView vv = new VideoView(this);
            stVv = vv;
            vv.setOnPreparedListener(new android.media.MediaPlayer.OnPreparedListener() {
                @Override public void onPrepared(android.media.MediaPlayer mp) {
                    if (stVv != vv) return;
                    stDur = Math.max(1500, Math.min(mp.getDuration(), ST_VID_MAX_MS));
                    stStart = System.currentTimeMillis();
                    if (!stPaused) vv.start();
                }
            });
            vv.setOnCompletionListener(new android.media.MediaPlayer.OnCompletionListener() {
                @Override public void onCompletion(android.media.MediaPlayer mp) { if (stVv == vv) stNext(); }
            });
            vv.setOnErrorListener(new android.media.MediaPlayer.OnErrorListener() {
                @Override public boolean onError(android.media.MediaPlayer mp, int w, int e) {
                    toast(L("تعذّر تشغيل الفيديو", "Could not play the video"));
                    if (stVv == vv) stNext();
                    return true;
                }
            });
            stMedia.addView(vv, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT, Gravity.CENTER));
            vv.setVideoURI(Uri.parse(url));
        } else {
            ImageView iv = new ImageView(this);
            iv.setScaleType(ImageView.ScaleType.FIT_CENTER);
            loadImage(url, iv);
            stMedia.addView(iv, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
            stDur = ST_IMG_MS;
            stStart = System.currentTimeMillis();
        }
        stH.post(stTick);

        final String sid = s.optString("id", "");
        if (mine) {
            pool.execute(new Runnable() {
                @Override public void run() {
                    try {
                        JSONArray a = new JSONArray(get("story_views?select=viewer_id&story_id=eq." + sid + "&limit=1000"));
                        final int n = a.length();
                        int lc = 0;
                        try { lc = new JSONArray(get("story_likes?select=user_id&story_id=eq." + sid + "&limit=1000")).length(); } catch (Exception ignore) {}
                        final int fl = lc;
                        runOnUiThread(new Runnable() {
                            @Override public void run() {
                                if (stDlg != null && stCurG >= 0 && stCurG < stGroups.size() && stCurI < stGroups.get(stCurG).size()
                                    && sid.equals(stGroups.get(stCurG).get(stCurI).optString("id")))
                                    { stViewsTv.setText(String.valueOf(n)); stGoalsTv.setText(String.valueOf(fl)); }
                            }
                        });
                    } catch (Exception ignore) {}
                }
            });
        } else {
            pool.execute(new Runnable() {
                @Override public void run() {
                    try {
                        final int n = Integer.parseInt(rpc("story_like_count", "{\"p_story_id\":" + sid + "}").trim());
                        int vc = 0;
                        try { vc = Integer.parseInt(rpc("story_view_count", "{\"p_story_id\":" + sid + "}").trim()); } catch (Exception ignore) {}
                        final int fv = vc;
                        runOnUiThread(new Runnable() {
                            @Override public void run() {
                                if (stDlg != null && stCurG >= 0 && stCurG < stGroups.size() && stCurI < stGroups.get(stCurG).size()
                                    && sid.equals(stGroups.get(stCurG).get(stCurI).optString("id"))) {
                                    stGoalsTv.setText(String.valueOf(n));
                                    stViewsTv.setText(String.valueOf(Math.max(1, fv)));
                                }
                            }
                        });
                    } catch (Exception ignore) {}
                }
            });
        }
        if (!mine && !stSeen.contains(sid)) {
            stSeen.add(sid);
            stSaveSeen();
            pool.execute(new Runnable() {
                @Override public void run() {
                    try { send("POST", "story_views", "{\"story_id\":" + sid + ",\"viewer_id\":\"" + uid + "\"}"); } catch (Exception ignore) {}
                }
            });
        }
    }

    private void stPaintHeart(String sid) {
        if (stHeart == null) return;
        boolean liked = stMyLikes.contains(sid);
        stHeart.setImageDrawable(new Ic(2, liked ? 0xFF14F195 : Color.WHITE, liked, dp(30)));
    }

    private void stLikeCurrent(boolean onlyLike) {
        final JSONObject s = stCurrent();
        if (s == null || stMine(s)) return;
        final String sid = s.optString("id", "");
        final boolean was = stMyLikes.contains(sid);
        if (onlyLike && was) return;
        final boolean now = !was;
        if (now) stMyLikes.add(sid); else stMyLikes.remove(sid);
        stPaintHeart(sid);
        stBumpGoals(now ? 1 : -1);
        pool.execute(new Runnable() {
            @Override public void run() {
                boolean ok = true;
                try {
                    if (now) send("POST", "story_likes", "{\"story_id\":" + sid + ",\"user_id\":\"" + uid + "\"}");
                    else send("DELETE", "story_likes?story_id=eq." + sid + "&user_id=eq." + uid, null);
                } catch (Exception e) {
                    String m = String.valueOf(e.getMessage());
                    ok = now && (m.indexOf("23505") >= 0 || m.indexOf("HTTP 409") >= 0);
                }
                if (!ok) {
                    runOnUiThread(new Runnable() {
                        @Override public void run() {
                            if (now) stMyLikes.remove(sid); else stMyLikes.add(sid);
                            stPaintHeart(sid);
                            stBumpGoals(now ? -1 : 1);
                        }
                    });
                }
            }
        });
    }

    private void stBumpGoals(int d) {
        try {
            int n = Integer.parseInt(stGoalsTv.getText().toString().trim());
            stGoalsTv.setText(String.valueOf(Math.max(0, n + d)));
        } catch (Exception ignore) {}
    }

    // قلب كبير يظهر وسط الشاشة عند الإعجاب بالضغط المزدوج
    private void stBurst() {
        if (stRootFl == null) return;
        final FrameLayout rt = stRootFl;
        final ImageView h = new ImageView(this);
        h.setImageDrawable(new Ic(2, 0xFF14F195, true, dp(110)));
        h.setScaleX(0.6f);
        h.setScaleY(0.6f);
        rt.addView(h, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.CENTER));
        h.animate().scaleX(1.25f).scaleY(1.25f).alpha(0f).setDuration(650).withEndAction(new Runnable() {
            @Override public void run() { try { rt.removeView(h); } catch (Exception ignore) {} }
        }).start();
    }

    private void stPause() {
        if (stPaused) return;
        stPaused = true;
        stPausedAt = System.currentTimeMillis();
        try { if (stVv != null && stVv.isPlaying()) stVv.pause(); } catch (Exception ignore) {}
    }

    private void stResume() {
        if (!stPaused) return;
        stPaused = false;
        stStart += System.currentTimeMillis() - stPausedAt;
        try { if (stVv != null && stDur > 0) stVv.start(); } catch (Exception ignore) {}
    }

    private void stNext() {
        if (stDlg == null || stCurG < 0) return;
        List<JSONObject> g = stGroups.get(stCurG);
        if (stCurI + 1 < g.size()) { stCurI++; stShowItem(); return; }
        if (stCurG + 1 < stGroups.size()) { stOpen(stCurG + 1); return; }
        stTeardown(true);
    }

    private void stPrev() {
        if (stDlg == null) return;
        if (stCurI > 0) stCurI--;
        stShowItem();
    }

    // يغلق العارض. refresh=true يعيد ترتيب الصف (المشاهَد يصير رمادياً)
    private void stTeardown(boolean refresh) {
        stH.removeCallbacks(stTick);
        if (stTapRun != null) { stH.removeCallbacks(stTapRun); stTapRun = null; }
        try { if (stVv != null) stVv.stopPlayback(); } catch (Exception ignore) {}
        stVv = null;
        Dialog d = stDlg;
        stDlg = null;
        stCurG = -1;
        if (d != null) { try { d.setOnDismissListener(null); d.dismiss(); } catch (Exception ignore) {} }
        if (refresh) stApply(new ArrayList<JSONObject>(stAll));
    }

    private JSONObject stCurrent() {
        if (stCurG < 0 || stCurG >= stGroups.size()) return null;
        List<JSONObject> g = stGroups.get(stCurG);
        if (stCurI < 0 || stCurI >= g.size()) return null;
        return g.get(stCurI);
    }

    private void stOthersMenu() {
        final JSONObject s = stCurrent();
        if (s == null) return;
        stPause();
        final String au = s.optString("user_id", "");
        final String an = s.optString("author_name", "");
        String[] items = { L("إبلاغ عن الستوري", "Report story"), L("حظر ", "Block ") + an };
        new AlertDialog.Builder(this)
            .setItems(items, new DialogInterface.OnClickListener() {
                @Override public void onClick(DialogInterface d, int which) {
                    if (which == 0) {
                        JSONObject t = new JSONObject();
                        try {
                            t.put("user_id", au);
                            t.put("author_name", an);
                            t.put("content", s.isNull("caption") ? "" : s.optString("caption", ""));
                            t.put("created_at", s.optString("created_at", ""));
                            if ("video".equals(s.optString("media_type"))) t.put("video_url", s.optString("media_url", ""));
                            else t.put("image_url", s.optString("media_url", ""));
                        } catch (Exception ignore) {}
                        openReport("story", s.optString("id", ""), t);
                    } else {
                        blockUser(au, an);
                    }
                }
            })
            .setOnDismissListener(new DialogInterface.OnDismissListener() {
                @Override public void onDismiss(DialogInterface d) { stResume(); }
            })
            .show();
    }

    private void stDeleteCurrent() {
        final JSONObject s = stCurrent();
        if (s == null || !stMine(s)) return;
        stPause();
        new AlertDialog.Builder(this)
            .setMessage(L("حذف هذا الستوري؟", "Delete this story?"))
            .setNegativeButton(T("إلغاء"), null)
            .setPositiveButton(L("حذف", "Delete"), new DialogInterface.OnClickListener() {
                @Override public void onClick(DialogInterface d, int w) {
                    final String sid = s.optString("id", "");
                    final String path = s.optString("media_path", "");
                    stAll.remove(s);
                    stTeardown(true);
                    toast(L("تم حذف الستوري", "Story deleted"));
                    pool.execute(new Runnable() {
                        @Override public void run() {
                            try { send("DELETE", "stories?id=eq." + sid, null); } catch (Exception ignore) {}
                            if (path.length() > 0) r2Delete(path);
                        }
                    });
                }
            })
            .setOnDismissListener(new DialogInterface.OnDismissListener() {
                @Override public void onDismiss(DialogInterface d) { stResume(); }
            })
            .show();
    }

    // ================= النشر =================
    private TextView stSheetRow(String text) {
        TextView t = tv(Color.WHITE, 16, true);
        t.setText(text);
        t.setGravity(Gravity.CENTER_VERTICAL);
        t.setPadding(dp(18), dp(16), dp(18), dp(16));
        t.setBackground(rbg(CARD, 0x33FFFFFF, 14));
        return t;
    }

    protected void stNew() {
        if (uid == null) { toast(L("سجّل الدخول أولاً", "Sign in first")); return; }
        final Dialog d = sheetDialog(false);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackground(rbg(NAVY, 0x22FFFFFF, 22));
        root.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);
        root.setPadding(dp(16), dp(16), dp(16), dp(16) + navH());
        TextView h = tv(GOLD, 17, true);
        h.setText(L("ستوري جديد", "New story"));
        h.setGravity(Gravity.CENTER);
        root.addView(h, new LinearLayout.LayoutParams(-1, -2));
        TextView sub = tv(MUTED, 12, false);
        sub.setGravity(Gravity.CENTER);
        sub.setText(L("يختفي بعد 24 ساعة", "Disappears after 24 hours"));
        sub.setPadding(0, dp(4), 0, 0);
        root.addView(sub, new LinearLayout.LayoutParams(-1, -2));
        TextView gal = stSheetRow(L("من المعرض", "From gallery"));
        TextView cam = stSheetRow(L("الكاميرا", "Camera"));
        TextView no = stSheetRow(L("إلغاء", "Cancel"));
        no.setTextColor(MUTED);
        no.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1, -2);
        lp.topMargin = dp(10);
        root.addView(gal, lp); root.addView(cam, lp); root.addView(no, lp);
        gal.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { d.dismiss(); stPick(false); } });
        cam.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { d.dismiss(); stPick(true); } });
        no.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { d.dismiss(); } });
        d.setContentView(root);
        d.show();
    }

    private void stPick(boolean camera) {
        MediaCb cb = new MediaCb() { @Override public void picked(Uri u, boolean video) { stPrepare(u, video); } };
        if (camera) mediaCameraShow(cb); else mediaAttachShow(cb);
    }

    private Bitmap stDecode(Uri u) {
        try {
            BitmapFactory.Options o = new BitmapFactory.Options();
            o.inJustDecodeBounds = true;
            InputStream in = getContentResolver().openInputStream(u);
            BitmapFactory.decodeStream(in, null, o);
            in.close();
            int s = 1;
            while (Math.max(o.outWidth, o.outHeight) / s > 2400) s *= 2;
            o = new BitmapFactory.Options();
            o.inSampleSize = s;
            in = getContentResolver().openInputStream(u);
            Bitmap full = BitmapFactory.decodeStream(in, null, o);
            in.close();
            if (full == null) return null;
            float sc = Math.min(1f, 1440f / Math.max(full.getWidth(), full.getHeight()));
            Bitmap b = sc < 1f ? Bitmap.createScaledBitmap(full, Math.round(full.getWidth() * sc), Math.round(full.getHeight() * sc), true) : full;
            return mpExifFix(u, b);
        } catch (Throwable e) { return null; }
    }

    private String stCheckVideo(Uri u) {
        try {
            String name = "video.mp4"; long size = 0;
            android.database.Cursor c = getContentResolver().query(u, null, null, null, null);
            if (c != null) {
                if (c.moveToFirst()) {
                    int ni = c.getColumnIndex(android.provider.OpenableColumns.DISPLAY_NAME), si = c.getColumnIndex(android.provider.OpenableColumns.SIZE);
                    if (ni >= 0) name = c.getString(ni);
                    if (si >= 0) size = c.getLong(si);
                }
                c.close();
            }
            if (name == null || !name.toLowerCase().endsWith(".mp4")) return L("الصيغة المقبولة MP4 فقط.", "Only MP4 files are allowed.");
            if (size > ST_VID_MAX_BYTES) return L("حجم الفيديو يتجاوز 50 ميغابايت.", "Video is larger than 50 MB.");
            android.media.MediaMetadataRetriever mr = new android.media.MediaMetadataRetriever();
            mr.setDataSource(this, u);
            String dur = mr.extractMetadata(android.media.MediaMetadataRetriever.METADATA_KEY_DURATION);
            mr.release();
            if (dur != null && Long.parseLong(dur) > ST_VID_MAX_MS + 500) return L("مدة الستوري تتجاوز 30 ثانية.", "A story can be up to 30 seconds.");
            return null;
        } catch (Exception e) { return L("تعذّر قراءة الفيديو.", "Could not read the video."); }
    }

    private void stPrepare(final Uri u, final boolean video) {
        pool.execute(new Runnable() {
            @Override public void run() {
                final String err = video ? stCheckVideo(u) : null;
                final Bitmap bm = (video || err != null) ? null : stDecode(u);
                runOnUiThread(new Runnable() {
                    @Override public void run() {
                        if (err != null) { toast(err); return; }
                        if (!video && bm == null) { toast(L("الملف ليس صورة", "Not an image")); return; }
                        stCompose(u, video, bm);
                    }
                });
            }
        });
    }

    private void stCompose(final Uri vid, final boolean video, final Bitmap img) {
        final Dialog d = sheetDialog(false);
        ScrollView sc = new ScrollView(this);
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setBackground(rbg(NAVY, 0x22FFFFFF, 22));
        box.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);
        box.setPadding(dp(16), dp(16), dp(16), dp(16) + navH());
        TextView h = tv(GOLD, 17, true);
        h.setText(L("ستوري جديد", "New story"));
        h.setGravity(Gravity.CENTER);
        box.addView(h, new LinearLayout.LayoutParams(-1, -2));
        if (!video && img != null) {
            ImageView iv = new ImageView(this);
            iv.setImageBitmap(img);
            iv.setAdjustViewBounds(true);
            iv.setScaleType(ImageView.ScaleType.FIT_CENTER);
            iv.setBackground(rbg(CARD, 0x33FFFFFF, 12));
            LinearLayout.LayoutParams ip = new LinearLayout.LayoutParams(-1, dp(240));
            ip.topMargin = dp(12);
            box.addView(iv, ip);
        } else {
            TextView vt = tv(Color.WHITE, 15, true);
            vt.setText(L("فيديو جاهز للنشر", "Video ready to post"));
            vt.setGravity(Gravity.CENTER);
            vt.setPadding(dp(14), dp(30), dp(14), dp(30));
            vt.setBackground(rbg(CARD, 0x33FFFFFF, 12));
            LinearLayout.LayoutParams vp = new LinearLayout.LayoutParams(-1, -2);
            vp.topMargin = dp(12);
            box.addView(vt, vp);
        }
        final EditText cap = new EditText(this);
        cap.setTextColor(Color.WHITE);
        cap.setHintTextColor(0xFF6B76B0);
        cap.setTextSize(15);
        cap.setHint(L("أضف نصاً (اختياري)", "Add a caption (optional)"));
        cap.setMinLines(2);
        cap.setGravity(Gravity.TOP | Gravity.START);
        cap.setFilters(new android.text.InputFilter[] { new android.text.InputFilter.LengthFilter(200) });
        cap.setBackground(rbg(0xFF0D1540, 0x1CFFFFFF, 14));
        cap.setPadding(dp(12), dp(10), dp(12), dp(10));
        LinearLayout.LayoutParams cp = new LinearLayout.LayoutParams(-1, -2);
        cp.topMargin = dp(12);
        box.addView(cap, cp);
        final TextView go = tv(NAVY, 16, true);
        go.setText(L("نشر", "Post"));
        go.setGravity(Gravity.CENTER);
        go.setBackground(rbg(GOLD, 0, 24));
        go.setPadding(0, dp(13), 0, dp(13));
        LinearLayout.LayoutParams gp = new LinearLayout.LayoutParams(-1, -2);
        gp.topMargin = dp(12);
        box.addView(go, gp);
        TextView hint = tv(MUTED, 11, false);
        hint.setGravity(Gravity.CENTER);
        hint.setText(L("يظهر لجميع المستخدمين ويُحذف تلقائياً بعد 24 ساعة", "Visible to everyone and deleted automatically after 24 hours"));
        hint.setPadding(0, dp(8), 0, 0);
        box.addView(hint, new LinearLayout.LayoutParams(-1, -2));
        go.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) {
                stPublish(d, go, cap.getText().toString().trim(), video, vid, img);
            }
        });
        sc.addView(box);
        keyboardLift(d, sc);
        d.setContentView(sc);
        d.show();
    }

    private void stStage(final TextView go, final String t) {
        runOnUiThread(new Runnable() { @Override public void run() { go.setText(t); } });
    }

    private void stPublish(final Dialog d, final TextView go, final String caption, final boolean video, final Uri vid, final Bitmap img) {
        if (stPosting) return;
        stPosting = true;
        go.setAlpha(0.6f);
        go.setText(L("جارٍ النشر...", "Posting..."));
        pool.execute(new Runnable() {
            @Override public void run() {
                String key = null, pub = null, error = null;
                try {
                    if (video) {
                        JSONObject sg = r2UploadVideo(vid, new R2Progress() { @Override public void on(int pct, double mb) {
                            stStage(go, L("جارٍ رفع الفيديو ", "Uploading ") + pct + "%");
                        } });
                        key = sg.getString("key"); pub = sg.getString("publicUrl");
                    } else {
                        ByteArrayOutputStream bo = new ByteArrayOutputStream();
                        img.compress(Bitmap.CompressFormat.JPEG, 80, bo);
                        JSONObject si = r2UploadBytes(bo.toByteArray(), "image", "image/jpeg");
                        key = si.getString("key"); pub = si.getString("publicUrl");
                    }
                    JSONObject o = new JSONObject();
                    o.put("user_id", uid);
                    o.put("media_type", video ? "video" : "image");
                    o.put("media_url", pub);
                    o.put("media_path", key);
                    o.put("caption", caption.length() == 0 ? JSONObject.NULL : caption);
                    o.put("author_name", uname == null ? "" : uname);
                    o.put("author_avatar", (uavatar == null || uavatar.length() == 0) ? JSONObject.NULL : uavatar);
                    try {
                        cmHttp("POST", url + "/rest/v1/stories?select=id", o.toString().getBytes("UTF-8"), "application/json", null);
                    } catch (Exception e) {
                        if (key != null) r2Delete(key);
                        throw e;
                    }
                } catch (Exception e) { error = String.valueOf(e.getMessage()); }
                final String fe = error;
                runOnUiThread(new Runnable() {
                    @Override public void run() {
                        stPosting = false;
                        if (fe == null) {
                            try { d.dismiss(); } catch (Exception ignore) {}
                            toast(L("تم نشر الستوري", "Story posted"));
                            stLoad();
                            return;
                        }
                        go.setAlpha(1f);
                        go.setText(L("نشر", "Post"));
                        if (fe.indexOf("premium_required") >= 0) { toast(L("الفيديو في الباقة المميّزة، أما الصور فللجميع.", "Video needs the Premium plan; photos are free.")); openSubscriptions(); }
                        else if (fe.indexOf("story limit reached") >= 0) toast(L("وصلت الحد الأقصى: 10 ستوريات خلال 24 ساعة.", "Limit reached: 10 stories per 24 hours."));
                        else if (fe.indexOf("account_banned") >= 0) { /* الرسالة تظهر من banCheck */ }
                        else toast(L("فشل النشر: ", "Post failed: ") + fe);
                    }
                });
            }
        });
    }
}
