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


abstract class Boost extends Subscriptions {
    protected int bDaily = 1, bDays = 1;
    protected long bBalance = 0, bAudience = -1;
    protected TextView bDailyV, bDaysV, bTotal, bReach, bBal, bMsg, bBtn;
    protected boolean bBusy = false;

    protected void openBoost(final String pk) {
        if (uid == null) return;
        fetchTier(new TierCb() {
            @Override public void on(int t) {
                if (t <= 0) { toast(L("التعزيز للمشتركين فقط", "Boost is for subscribers only")); openSubscriptions(); return; }
                showBoost(pk);
            }
        });
    }

    protected void showBoost(final String pk) {
        bDaily = 1; bDays = 1; bBalance = 0; bAudience = -1; bBusy = false;
        final Dialog d = sheetDialog(false);
        ScrollView sc = new ScrollView(this);
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setPadding(dp(18), dp(16), dp(18), navH() + dp(14));
        GradientDrawable pbg = new GradientDrawable();
        pbg.setColor(0xFF121215);
        pbg.setCornerRadii(new float[] { dp(24), dp(24), dp(24), dp(24), 0, 0, 0, 0 });
        pbg.setStroke(dp(1), 0x40F5C35A);
        box.setBackground(pbg);
        TextView title = tv(Color.WHITE, 18, true);
        title.setText(L("تعزيز المنشور", "Boost post"));
        title.setGravity(Gravity.CENTER);
        box.addView(title);
        TextView ds = tv(MUTED, 13, false);
        ds.setText(L("اختر الميزانية اليومية والمدة. تُخصم النقاط حسب الظهور الفعلي فقط.", "Choose the daily budget and duration. Points are deducted only for actual impressions."));
        ds.setPadding(0, dp(8), 0, dp(14));
        box.addView(ds);

        LinearLayout r1 = new LinearLayout(this);
        TextView l1 = tv(MUTED, 13, false); l1.setText(L("الميزانية اليومية", "Daily budget"));
        bDailyV = tv(Color.WHITE, 15, true);
        r1.addView(l1, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        r1.addView(bDailyV);
        box.addView(r1);
        SeekBar s1 = new SeekBar(this);
        s1.setMax(499);
        s1.setProgress(0);
        s1.getProgressDrawable().setColorFilter(GOLD, android.graphics.PorterDuff.Mode.SRC_IN);
        s1.getThumb().setColorFilter(GOLD, android.graphics.PorterDuff.Mode.SRC_IN);
        box.addView(s1);

        LinearLayout r2 = new LinearLayout(this);
        r2.setPadding(0, dp(14), 0, 0);
        TextView l2 = tv(MUTED, 13, false); l2.setText(L("المدة", "Duration"));
        bDaysV = tv(Color.WHITE, 15, true);
        r2.addView(l2, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        r2.addView(bDaysV);
        box.addView(r2);
        SeekBar s2 = new SeekBar(this);
        s2.setMax(29);
        s2.setProgress(0);
        s2.getProgressDrawable().setColorFilter(GOLD, android.graphics.PorterDuff.Mode.SRC_IN);
        s2.getThumb().setColorFilter(GOLD, android.graphics.PorterDuff.Mode.SRC_IN);
        box.addView(s2);

        LinearLayout r3 = new LinearLayout(this);
        r3.setPadding(0, dp(16), 0, 0);
        TextView l3 = tv(MUTED, 13, false); l3.setText(L("الإجمالي", "Total"));
        bTotal = tv(Color.WHITE, 15, true);
        r3.addView(l3, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        r3.addView(bTotal);
        box.addView(r3);
        LinearLayout r4 = new LinearLayout(this);
        r4.setPadding(0, dp(8), 0, 0);
        TextView l4 = tv(MUTED, 13, false); l4.setText(L("الوصول اليومي المتوقع", "Expected daily reach"));
        bReach = tv(Color.WHITE, 13, true);
        r4.addView(l4, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        r4.addView(bReach);
        box.addView(r4);
        bBal = tv(MUTED, 13, false);
        bBal.setPadding(0, dp(8), 0, 0);
        box.addView(bBal);
        bMsg = tv(0xFFFF6B6B, 12, false);
        bMsg.setPadding(0, dp(8), 0, dp(6));
        box.addView(bMsg);
        bBtn = pill(L("تعزيز المنشور", "Boost post"), NAVY, GOLD, 0);
        box.addView(bBtn);

        SeekBar.OnSeekBarChangeListener ch = new SeekBar.OnSeekBarChangeListener() {
            @Override public void onProgressChanged(SeekBar sb, int p, boolean u) {
                if (sb.getMax() == 499) bDaily = p + 1; else bDays = p + 1;
                updateBoost();
            }
            @Override public void onStartTrackingTouch(SeekBar sb) {}
            @Override public void onStopTrackingTouch(SeekBar sb) {}
        };
        s1.setOnSeekBarChangeListener(ch);
        s2.setOnSeekBarChangeListener(ch);
        bBtn.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) { submitBoost(pk, d); }
        });
        sc.addView(box);
        d.setContentView(sc);
        d.show();
        updateBoost();
        pool.execute(new Runnable() {
            @Override public void run() {
                try {
                    JSONArray a = new JSONArray(get("users?select=points&user_id=eq." + uid));
                    if (a.length() > 0) bBalance = a.getJSONObject(0).optLong("points", 0);
                } catch (Exception ignore) {}
                try { bAudience = Long.parseLong(rpc("boost_audience_size", "{}").trim()); } catch (Exception ignore) {}
                runOnUiThread(new Runnable() { @Override public void run() { updateBoost(); } });
            }
        });
    }

    protected void updateBoost() {
        if (bDailyV == null) return;
        long daily = bDaily * 1000L;
        boolean enough = bBalance >= daily;
        bDailyV.setText(nfmt(daily) + " ZELO");
        bDaysV.setText(bDays + L(" يومًا", " days"));
        bTotal.setText(nfmt(daily * bDays) + " ZELO");
        if (bAudience < 0) bReach.setText("—");
        else bReach.setText(L("حتى ", "Up to ") + nfmt(Math.min(daily * 10, bAudience * 3)) + L(" ظهور يوميًا (تقديري)", " impressions per day (estimate)"));
        bBal.setText(L("رصيدك: ", "Your balance: ") + nfmt(bBalance) + " ZELO");
        bMsg.setText(enough ? "" : L("رصيدك لا يكفي لميزانية يوم واحد. اربح نقاطًا أولًا.", "Your balance isn't enough for one day's budget. Earn points first."));
        bBtn.setAlpha(!enough || bBusy ? 0.5f : 1f);
    }

    protected void submitBoost(final String pk, final Dialog d) {
        if (bBusy || bBalance < bDaily * 1000L) return;
        bBusy = true;
        updateBoost();
        pool.execute(new Runnable() {
            @Override public void run() {
                String err = null;
                try {
                    JSONObject b = new JSONObject();
                    b.put("p_user_id", uid);
                    b.put("p_post_id", Long.parseLong(pk));
                    b.put("p_daily_points", bDaily * 1000L);
                    b.put("p_days", bDays);
                    rpc("create_boost", b.toString());
                } catch (Exception e) { err = String.valueOf(e.getMessage()); }
                final String fe = err;
                runOnUiThread(new Runnable() {
                    @Override public void run() {
                        bBusy = false;
                        if (fe == null) { d.dismiss(); toast(L("تم تعزيز المنشور ✅", "Post boosted ✅")); loadBalance(); return; }
                        String m = L("تعذّر التعزيز، حاول لاحقًا", "Boost failed, try again later");
                        if (fe.contains("premium_required")) m = "التعزيز للمشتركين فقط";
                        else if (fe.contains("insufficient_balance")) m = "رصيدك لا يكفي";
                        else if (fe.contains("already_active")) m = "هذا المنشور معزّز حاليًا";
                        else if (fe.contains("not_owner")) m = "لا يمكنك تعزيز منشور ليس لك";
                        toast(m);
                        updateBoost();
                    }
                });
            }
        });
    }

    // ================= مؤشر الصعود + شارة التعزيز + إحصائيات التعزيز =================
    protected final HashMap<String, JSONObject> boostActive = new HashMap<String, JSONObject>(); // post_id -> {id, owner_id}
    protected final HashSet<String> rising = new HashSet<String>();
    protected final HashMap<String, JSONObject> myBoost = new HashMap<String, JSONObject>(); // post_id -> أحدث تعزيز لي
    protected final List<JSONObject> myBoostList = new ArrayList<JSONObject>();
    protected final HashSet<String> boostSeen = new HashSet<String>();
    protected boolean everBoosted = false;

    protected void openBoostStats() {}

    protected GradientDrawable bxBg(int fill, int stroke, int rDp) {
        GradientDrawable g = new GradientDrawable();
        g.setColor(fill);
        g.setCornerRadius(dp(rDp));
        if (stroke != 0) g.setStroke(dp(1), stroke);
        return g;
    }

    protected long bxParse(String iso) {
        try {
            SimpleDateFormat f = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss");
            f.setTimeZone(TimeZone.getTimeZone("UTC"));
            return f.parse(iso.substring(0, 19)).getTime();
        } catch (Exception e) { return 0; }
    }

    // يحمّل التعزيزات النشطة وإحصائيات تعزيزاتي (أول صفحة)، ومنشورات الصعود
    protected void loadBoostMeta(String fids, boolean first) {
        if (uid == null) return;
        if (first) {
            try {
                JSONArray a = new JSONArray(rpc("get_active_boosts", "{}"));
                boostActive.clear();
                for (int i = 0; i < a.length(); i++) {
                    JSONObject o = a.getJSONObject(i);
                    boostActive.put(String.valueOf(o.optLong("post_id")), o);
                }
            } catch (Exception ignore) {}
            try {
                JSONArray a = new JSONArray(rpc("my_boost_stats", "{}"));
                myBoost.clear(); myBoostList.clear();
                for (int i = 0; i < a.length(); i++) {
                    JSONObject o = a.getJSONObject(i);
                    myBoostList.add(o);
                    String k = String.valueOf(o.optLong("post_id"));
                    if (!myBoost.containsKey(k)) myBoost.put(k, o);
                }
                everBoosted = myBoostList.size() > 0;
            } catch (Exception ignore) {}
        }
        if (fids != null && fids.length() > 0) {
            try {
                JSONArray a = new JSONArray(rpc("rising_posts", "{\"p_ids\":[" + fids + "]}"));
                for (int i = 0; i < a.length(); i++) rising.add(String.valueOf(a.getJSONObject(i).optLong("post_id")));
            } catch (Exception ignore) {}
        }
        runOnUiThread(new Runnable() { @Override public void run() { refreshUi(); } });
    }

    // منشورات معزَّزة نشطة تُحقن في أعلى الصفحة الرئيسية (ليست لي، غير موجودة، وغير مكتومة)
    protected List<JSONObject> boostedForFeed(List<JSONObject> have) {
        List<JSONObject> out = new ArrayList<JSONObject>();
        try {
            HashSet<String> haveIds = new HashSet<String>();
            for (JSONObject h : have) haveIds.add(String.valueOf(h.optLong("id")));
            StringBuilder ids = new StringBuilder();
            int n = 0;
            for (Map.Entry<String, JSONObject> e : boostActive.entrySet()) {
                String owner = e.getValue().optString("owner_id", "");
                if (owner.equals(uid) || haveIds.contains(e.getKey()) || muteSet.contains(owner) || blockSet.contains(owner) || hiddenSet.contains(e.getKey())) continue;
                if (n >= 3) break;
                if (ids.length() > 0) ids.append(",");
                ids.append(e.getKey());
                n++;
            }
            if (ids.length() == 0) return out;
            JSONArray a = new JSONArray(get("posts?select=id,user_id,author_name,content,created_at,image_url,video_url,video_path,topic_type,topic_name,topic_name_b&id=in.(" + ids + ")"));
            for (int i = 0; i < a.length(); i++) out.add(a.getJSONObject(i));
        } catch (Exception ignore) {}
        return out;
    }

    protected void bxChip(String num, String label, LinearLayout row) {
        LinearLayout c = new LinearLayout(this);
        c.setOrientation(LinearLayout.VERTICAL);
        c.setGravity(Gravity.CENTER);
        c.setPadding(dp(4), dp(8), dp(4), dp(8));
        c.setBackground(bxBg(0x14FFFFFF, 0x1AFFFFFF, 10));
        TextView n = tv(Color.WHITE, 16, true);
        n.setText(num);
        n.setGravity(Gravity.CENTER);
        TextView l = tv(MUTED, 11, false);
        l.setText(label);
        l.setGravity(Gravity.CENTER);
        c.addView(n);
        c.addView(l);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
        lp.setMarginStart(dp(3)); lp.setMarginEnd(dp(3));
        row.addView(c, lp);
    }

    // شريط التقدّم الذهبي المتدرّج مع فقاعة النسبة
    protected View bxBar(int pct, boolean live) {
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        int p = Math.max(0, Math.min(100, pct));
        int bp = Math.max(8, Math.min(92, p));
        LinearLayout top = new LinearLayout(this);
        top.setLayoutDirection(View.LAYOUT_DIRECTION_LTR);
        top.addView(new View(this), new LinearLayout.LayoutParams(0, 1, bp));
        TextView bub = tv(NAVY, 10, true);
        bub.setText(p + "%");
        bub.setGravity(Gravity.CENTER);
        bub.setPadding(dp(6), dp(1), dp(6), dp(1));
        bub.setBackground(bxBg(live ? GOLD : 0xFF9AA6D8, 0, 8));
        top.addView(bub);
        top.addView(new View(this), new LinearLayout.LayoutParams(0, 1, 100 - bp));
        box.addView(top);
        LinearLayout track = new LinearLayout(this);
        track.setLayoutDirection(View.LAYOUT_DIRECTION_LTR);
        track.setBackground(bxBg(0x22FFFFFF, 0, 4));
        GradientDrawable fg = new GradientDrawable(GradientDrawable.Orientation.LEFT_RIGHT, live ? new int[] { 0xFFB8860B, GOLD, 0xFFFFE7AD } : new int[] { 0xFF5A648F, 0xFF9AA6D8 });
        fg.setCornerRadius(dp(4));
        View fill = new View(this);
        fill.setBackground(fg);
        track.addView(fill, new LinearLayout.LayoutParams(0, dp(8), Math.max(p, 1)));
        track.addView(new View(this), new LinearLayout.LayoutParams(0, dp(8), 100 - Math.max(p, 1)));
        LinearLayout.LayoutParams tl = new LinearLayout.LayoutParams(-1, dp(8));
        tl.topMargin = dp(2);
        box.addView(track, tl);
        return box;
    }

    protected int bxPct(JSONObject b) {
        long t = b.optLong("target", 0);
        if (t <= 0) return 0;
        return (int) Math.min(100, b.optLong("impressions", 0) * 100 / t);
    }

    protected String bxLeft(JSONObject b) {
        long ms = bxParse(b.optString("end_at", "")) - System.currentTimeMillis();
        if (ms <= 0) return L("انتهى", "Ended");
        long h = ms / 3600000L;
        if (h >= 48) return L("ينتهي بعد ", "Ends in ") + (h / 24) + L(" يوماً", " days");
        if (h < 1) return L("ينتهي بعد أقل من ساعة", "Ends in under 1 hour");
        return L("ينتهي بعد ", "Ends in ") + h + L(" ساعة", " h");
    }

    protected View bxSupport(JSONObject b) {
        TextView t = tv(MUTED, 12, true);
        long c = b.optLong("tips_count", 0);
        if (c > 0) t.setText("🎁 " + L("الدعم المستلم · ", "Support received · ") + c + (c == 1 ? L(" داعم", " supporter") : L(" داعمين", " supporters")) + " · " + nfmt(b.optLong("tips_net", 0)) + " ZELO");
        else t.setText("🎁 " + L("الدعم المستلم · لا يوجد بعد", "Support received · none yet"));
        t.setTextColor(c > 0 ? GOLD : MUTED);
        return t;
    }

    protected void bxChips4(LinearLayout row, JSONObject b) {
        bxChip(nfmt(b.optLong("impressions", 0)), L("ظهور", "Reach"), row);
        bxChip(nfmt(b.optLong("comments", 0)), L("تعليقات", "Comments"), row);
        bxChip(nfmt(b.optLong("followers", 0)), L("متابعون جدد", "New followers"), row);
        bxChip(nfmt(b.optLong("likes", 0)), L("أهداف", "Goals"), row);
    }

    // يُستدعى من bindPost: الصعود + الشارة + سطر صاحب المنشور + تسجيل الظهور
    protected void bindBoost(Holder h, JSONObject o, int[] s) {
        final String pk = String.valueOf(o.optLong("id"));
        String owner = o.optString("user_id", "");
        boolean mine = owner.equals(uid);
        if (rising.contains(pk)) {
            h.vw.setText(s[3] + " ↑");
            setIc(h.vw, 3, 0xFF14F195, false);
        }
        JSONObject my = mine ? myBoost.get(pk) : null;
        JSONObject act = boostActive.get(pk);
        boolean activeMine = my != null && "active".equals(my.optString("status"));
        boolean on = act != null || activeMine;
        if (h.boostPill != null) {
            h.boostPill.setText("⚡ " + L("معزَّز", "Boosted"));
            h.boostPill.setVisibility(on ? View.VISIBLE : View.GONE);
        }
        if (h.boostBox != null) {
            h.boostBox.removeAllViews();
            h.boostBox.setVisibility(View.GONE);
            if (my != null) {
                boolean live = activeMine;
                h.boostBox.setVisibility(View.VISIBLE);
                LinearLayout hd = new LinearLayout(this);
                hd.setGravity(Gravity.CENTER_VERTICAL);
                TextView a = tv(live ? GOLD : MUTED, 13, true);
                a.setText(live ? "⚡ " + L("التعزيز نشط", "Boost active") : L("انتهى التعزيز", "Boost ended"));
                TextView b2 = tv(MUTED, 12, false);
                b2.setText(bxLeft(my));
                hd.addView(a, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
                hd.addView(b2);
                h.boostBox.addView(hd);
                h.boostBox.addView(bxBar(bxPct(my), live));
                TextView rc = tv(MUTED, 12, false);
                rc.setText(L("وصل إلى ", "Reached ") + nfmt(my.optLong("impressions", 0)) + L(" من ", " of ") + nfmt(my.optLong("target", 0)) + L(" ظهوراً", " impressions"));
                rc.setPadding(0, dp(4), 0, dp(8));
                h.boostBox.addView(rc);
                LinearLayout chips = new LinearLayout(this);
                bxChips4(chips, my);
                h.boostBox.addView(chips);
                View sp = bxSupport(my);
                sp.setPadding(0, dp(8), 0, dp(2));
                h.boostBox.addView(sp);
                TextView lk = tv(GOLD, 12, true);
                lk.setText(L("عرض كل الإحصائيات ‹", "View all stats ›"));
                lk.setPadding(0, dp(6), 0, dp(2));
                lk.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { openBoostStats(); } });
                h.boostBox.addView(lk);
            }
        }
        if (act != null && !mine && uid != null) {
            final long bid = act.optLong("id");
            if (boostSeen.add(String.valueOf(bid))) {
                pool.execute(new Runnable() {
                    @Override public void run() {
                        try { rpc("record_boost_impression", "{\"p_boost_id\":" + bid + ",\"p_viewer_id\":\"" + uid + "\"}"); } catch (Exception ignore) {}
                    }
                });
            }
        }
    }
}
