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


abstract class AdminReports extends Boost {
    // ===== من admin-reports.js: لوحة البلاغات للإدارة + حالة الحظر والطعن للمستخدم =====
    protected static final String ADMIN_ID = "eb880283-f32e-4fb5-a84a-e6007b633352";
    protected static final String[][] REASONS = {
        { "spam", "محتوى مزعج أو إعلاني" }, { "abuse", "إساءة أو تحرّش" }, { "hate", "خطاب كراهية" },
        { "violence", "عنف أو محتوى صادم" }, { "adult", "محتوى للبالغين" }, { "misinfo", "معلومات مضللة" }, { "other", "سبب آخر" }
    };
    protected JSONObject myBan = null;
    protected JSONObject myAppeal = null;
    protected boolean banShown = false;
    protected LinearLayout admBody;
    protected TextView[] admTabs;
    protected int admTab = 0;
    protected Dialog admDlg;

    protected boolean isAdmin() { return ADMIN_ID.equals(uid); }

    protected String reasonText(String r) {
        if (r == null) return "";
        if (r.startsWith("other:")) return "سبب آخر: " + r.substring(6).trim();
        for (String[] x : REASONS) if (x[0].equals(r)) return x[1];
        return r;
    }

    protected boolean isFuture(String iso) {
        try {
            if (iso == null || iso.length() < 19 || "null".equals(iso)) return true; // بلا تاريخ = دائم
            SimpleDateFormat f = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss");
            f.setTimeZone(TimeZone.getTimeZone("UTC"));
            return f.parse(iso.substring(0, 19)).getTime() > System.currentTimeMillis();
        } catch (Exception e) { return true; }
    }

    protected GradientDrawable box(int fill, int stroke, int radius) {
        GradientDrawable g = new GradientDrawable();
        g.setColor(fill);
        g.setCornerRadius(dp(radius));
        if (stroke != 0) g.setStroke(dp(1), stroke);
        return g;
    }

    protected TextView admBtn(String text, int fg, int bg, int stroke) {
        TextView b = tv(fg, 14, true);
        b.setText(text);
        b.setGravity(Gravity.CENTER);
        b.setBackground(box(bg, stroke, 12));
        b.setPadding(dp(6), dp(11), dp(6), dp(11));
        return b;
    }

    // ---------------- لوحة الإدارة ----------------
    protected void openReportsPanel() {
        if (!isAdmin()) return;
        final Dialog d = sheetDialog(true);
        admDlg = d;
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        LinearLayout bar = new LinearLayout(this);
        bar.setGravity(Gravity.CENTER_VERTICAL);
        bar.setPadding(dp(14), dp(12), dp(14), dp(12));
        bar.addView(backBtn(new Runnable() { @Override public void run() { d.dismiss(); } }));
        View bsp = new View(this);
        bar.addView(bsp, new LinearLayout.LayoutParams(dp(12), 1));
        TextView title = tv(GOLD, 18, true);
        title.setText("🚩 الإدارة");
        bar.addView(title);
        root.addView(bar);
        LinearLayout tabs = new LinearLayout(this);
        tabs.setPadding(dp(10), 0, dp(10), dp(8));
        String[] tn = { "البلاغات", "الغرف", "المحظورون", "الطعون" };
        admTabs = new TextView[4];
        for (int q = 0; q < 4; q++) {
            final int qi = q;
            TextView t = tv(0xFFCBD5E1, 13, true);
            t.setText(tn[q]);
            t.setGravity(Gravity.CENTER);
            t.setPadding(dp(4), dp(10), dp(4), dp(10));
            t.setOnClickListener(new View.OnClickListener() {
                @Override public void onClick(View v) { admTab = qi; admLoad(); }
            });
            admTabs[q] = t;
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
            lp.setMargins(dp(3), 0, dp(3), 0);
            tabs.addView(t, lp);
        }
        root.addView(tabs);
        ScrollView sc = new ScrollView(this);
        admBody = new LinearLayout(this);
        admBody.setOrientation(LinearLayout.VERTICAL);
        admBody.setPadding(dp(14), dp(4), dp(14), navH() + dp(20));
        sc.addView(admBody);
        root.addView(sc, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));
        d.setContentView(root);
        d.show();
        admTab = 0;
        admLoad();
    }

    protected void admMsg(String text) {
        admBody.removeAllViews();
        TextView e = tv(MUTED, 15, false);
        e.setText(text);
        e.setGravity(Gravity.CENTER);
        e.setPadding(dp(10), dp(60), dp(10), dp(60));
        admBody.addView(e);
    }

    protected void admLoad() {
        final int tab = admTab;
        for (int q = 0; q < 4; q++) {
            admTabs[q].setBackground(q == tab ? box(GOLD, 0, 20) : box(0x00000000, 0x30FFFFFF, 20));
            admTabs[q].setTextColor(q == tab ? NAVY : 0xFFCBD5E1);
        }
        admMsg("");
        final String fn = tab == 0 ? "admin_list_reports" : tab == 1 ? "admin_list_room_reports" : tab == 2 ? "admin_list_bans" : "admin_list_appeals";
        pool.execute(new Runnable() {
            @Override public void run() {
                try {
                    final JSONArray a = new JSONArray(rpc(fn, "{}"));
                    final Map<String, String> ph = new HashMap<String, String>();
                    if (tab < 2 && a.length() > 0) {
                        try {
                            Set<String> ids = new HashSet<String>();
                            for (int i = 0; i < a.length(); i++) { String x = a.getJSONObject(i).optString("author_id", ""); if (x.length() > 0 && !"null".equals(x)) ids.add(x); }
                            if (!ids.isEmpty()) {
                                StringBuilder sb = new StringBuilder();
                                for (String x : ids) { if (sb.length() > 0) sb.append(","); sb.append(x); }
                                JSONArray pa = new JSONArray(get("public_profiles?select=user_id,photo_url&user_id=in.(" + sb + ")"));
                                for (int i = 0; i < pa.length(); i++) {
                                    JSONObject po = pa.getJSONObject(i);
                                    String p = po.isNull("photo_url") ? "" : po.optString("photo_url", "");
                                    if (isImg(p)) ph.put(po.optString("user_id"), p);
                                }
                            }
                        } catch (Exception ignore) {}
                    }
                    runOnUiThread(new Runnable() {
                        @Override public void run() { if (tab == admTab) admRender(tab, a, ph); }
                    });
                } catch (final Exception e) {
                    runOnUiThread(new Runnable() {
                        @Override public void run() { admMsg(String.valueOf(e.getMessage())); }
                    });
                }
            }
        });
    }

    protected LinearLayout admCard() {
        LinearLayout c = new LinearLayout(this);
        c.setOrientation(LinearLayout.VERTICAL);
        c.setPadding(dp(14), dp(14), dp(14), dp(14));
        c.setBackground(box(0xB3111A4A, 0x40F5C35A, 18));
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        lp.setMargins(0, 0, 0, dp(12));
        admBody.addView(c, lp);
        return c;
    }

    protected void admRender(final int tab, JSONArray a, Map<String, String> photos) {
        admBody.removeAllViews();
        if (a.length() == 0) {
            admMsg(tab == 0 ? "✅ لا توجد بلاغات جديدة" : tab == 1 ? "✅ لا توجد بلاغات على رسائل الغرف" : tab == 2 ? "لا توجد حسابات محظورة" : "لا توجد طعون");
            return;
        }
        for (int i = 0; i < a.length(); i++) {
            JSONObject r;
            try { r = a.getJSONObject(i); } catch (Exception e) { continue; }
            LinearLayout card = admCard();
            if (tab <= 1) admReportCard(tab, card, r, photos);
            else if (tab == 2) admBanCard(card, r);
            else admAppealCard(card, r);
        }
    }

    protected void admReportCard(final int tab, LinearLayout card, JSONObject r, Map<String, String> photos) {
        final long rid = r.optLong("report_id");
        LinearLayout head = new LinearLayout(this);
        TextView h1 = tv(MUTED, 12, false);
        if (tab == 0) h1.setText(("comment".equals(r.optString("target_type")) ? "رد" : "منشور") + " #" + r.optLong("target_id"));
        else h1.setText("رسالة غرفة #" + r.optLong("message_id"));
        head.addView(h1, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        int cnt = r.optInt("report_count", 1);
        if (cnt > 1) {
            TextView bd = tv(0xFFFF9B9B, 12, true);
            bd.setText(cnt + " بلاغات");
            bd.setBackground(box(0x26FF6B6B, 0, 12));
            bd.setPadding(dp(10), dp(2), dp(10), dp(2));
            head.addView(bd);
        }
        card.addView(head);
        TextView rs = tv(GOLD, 15, true);
        rs.setText("🚩 " + reasonText(r.optString("reason", "")));
        rs.setPadding(0, dp(8), 0, dp(8));
        card.addView(rs);
        String dt = r.isNull("details") ? "" : r.optString("details", "");
        if (dt.length() > 0) {
            TextView dtv = tv(0xFFCBD5E1, 13, false);
            dtv.setText("📝 " + dt);
            dtv.setPadding(0, 0, 0, dp(8));
            card.addView(dtv);
        }
        LinearLayout cb = new LinearLayout(this);
        cb.setOrientation(LinearLayout.VERTICAL);
        cb.setPadding(dp(12), dp(10), dp(12), dp(10));
        cb.setBackground(box(0x0DFFFFFF, 0, 12));
        String content = r.isNull("content") ? "" : r.optString("content", "");
        JSONObject sn = r.isNull("snapshot") ? null : r.optJSONObject("snapshot");
        boolean fromSnap = false;
        if (content.length() == 0 && sn != null && sn.optString("content", "").length() > 0) { content = sn.optString("content", ""); fromSnap = true; }
        if (fromSnap) {
            TextView sl = tv(MUTED, 11, false);
            sl.setText("🗂 نسخة محفوظة وقت البلاغ (المحتوى حُذف أو غُيّر)");
            sl.setPadding(0, 0, 0, dp(6));
            cb.addView(sl);
        }
        TextView ct = tv(0xFFE8ECFF, 15, false);
        ct.setText(content.length() > 0 ? content : (tab == 0 ? "(بلا نص)" : "(الرسالة محذوفة أو منتهية)"));
        cb.addView(ct);
        String im = r.isNull("image_url") ? "" : r.optString("image_url", "");
        if (!im.startsWith("http") && sn != null) im = sn.optString("image_url", "");
        final String vu = sn != null ? sn.optString("video_url", "") : "";
        if (vu.startsWith("http")) {
            TextView vt = tv(GOLD, 13, true);
            vt.setText("🎬 فيديو مرفق (اضغط للتشغيل)");
            vt.setPadding(0, dp(8), 0, 0);
            vt.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { playVideo(vu); } });
            cb.addView(vt);
        }
        if (im.startsWith("http")) {
            ImageView iv = new ImageView(this);
            iv.setScaleType(ImageView.ScaleType.CENTER_CROP);
            loadImage(im, iv);
            LinearLayout.LayoutParams ilp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(190));
            ilp.setMargins(0, dp(8), 0, 0);
            cb.addView(iv, ilp);
        }
        card.addView(cb);
        final String au = r.isNull("author_id") ? "" : r.optString("author_id", "");
        final String an = r.optString("author_name", "");
        LinearLayout ar = new LinearLayout(this);
        ar.setGravity(Gravity.CENTER_VERTICAL);
        ar.setPadding(0, dp(10), 0, dp(4));
        FrameLayout av = new FrameLayout(this);
        TextView l = tv(NAVY, 15, true);
        l.setText(an.length() > 0 ? an.substring(0, 1).toUpperCase() : "?");
        l.setGravity(Gravity.CENTER);
        l.setBackground(oval(0xFF2C4BB5, 0));
        l.setTextColor(Color.WHITE);
        av.addView(l, new FrameLayout.LayoutParams(dp(34), dp(34)));
        String p = photos.get(au);
        if (p != null) {
            ImageView pi = new ImageView(this);
            pi.setScaleType(ImageView.ScaleType.CENTER_CROP);
            pi.setOutlineProvider(new ViewOutlineProvider() {
                @Override public void getOutline(View v, Outline o) { o.setOval(0, 0, v.getWidth(), v.getHeight()); }
            });
            pi.setClipToOutline(true);
            loadImage(p, pi);
            av.addView(pi, new FrameLayout.LayoutParams(dp(34), dp(34)));
        }
        ar.addView(av, new LinearLayout.LayoutParams(dp(34), dp(34)));
        LinearLayout nm = new LinearLayout(this);
        nm.setOrientation(LinearLayout.VERTICAL);
        nm.setPadding(dp(10), 0, dp(10), 0);
        TextView n1 = tv(Color.WHITE, 15, true);
        n1.setText(an);
        nm.addView(n1);
        TextView n2 = tv(MUTED, 11, false);
        n2.setText("الكاتب" + (au.length() > 0 ? " · اضغط لفتح الملف الشخصي" : ""));
        nm.addView(n2);
        ar.addView(nm);
        if (au.length() > 0) ar.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) { openProfile(au); }
        });
        card.addView(ar);
        TextView rep = tv(MUTED, 12, false);
        rep.setText("المبلِّغ: " + r.optString("reporter_name", ""));
        rep.setPadding(0, dp(4), 0, dp(6));
        card.addView(rep);
        LinearLayout btns = new LinearLayout(this);
        TextView del = admBtn("حذف", 0xFFFF9B9B, 0x2EFF4D4D, 0x80FF4D4D);
        TextView ban = admBtn("حظر الكاتب", GOLD, 0x26F5C35A, 0x80F5C35A);
        TextView dis = admBtn("تجاهل", Color.WHITE, 0x00000000, 0x30FFFFFF);
        LinearLayout.LayoutParams bl = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
        bl.setMargins(dp(3), 0, dp(3), 0);
        btns.addView(del, bl);
        btns.addView(ban, bl);
        btns.addView(dis, bl);
        card.addView(btns);
        del.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) {
                new AlertDialog.Builder(AdminReports.this).setMessage(tab == 0 ? "حذف هذا المحتوى نهائيًا؟" : "حذف هذه الرسالة نهائيًا؟")
                    .setPositiveButton("حذف", new DialogInterface.OnClickListener() {
                        @Override public void onClick(DialogInterface di, int w) { admResolve(tab, rid, "delete"); }
                    }).setNegativeButton("إلغاء", null).show();
            }
        });
        dis.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) { admResolve(tab, rid, "dismiss"); }
        });
        ban.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) {
                if (au.length() == 0) { toast("لا يوجد كاتب لهذا المحتوى (ربما حُذف)"); return; }
                pickBan(au, an);
            }
        });
    }

    protected void admResolve(final int tab, final long rid, final String act) {
        pool.execute(new Runnable() {
            @Override public void run() {
                try {
                    JSONObject b = new JSONObject();
                    b.put("p_report_id", rid);
                    b.put("p_action", act);
                    rpc(tab == 0 ? "admin_resolve_report" : "admin_resolve_room_report", b.toString());
                    runOnUiThread(new Runnable() { @Override public void run() { admLoad(); } });
                } catch (final Exception e) {
                    runOnUiThread(new Runnable() { @Override public void run() { toast("تعذّر: " + e.getMessage()); } });
                }
            }
        });
    }

    protected void pickBan(final String target, String name) {
        final Dialog d = sheetDialog(false);
        LinearLayout b = new LinearLayout(this);
        b.setOrientation(LinearLayout.VERTICAL);
        b.setPadding(dp(16), dp(16), dp(16), navH() + dp(8));
        b.setBackground(box(0xFF0F1A5C, 0, 22));
        TextView t = tv(Color.WHITE, 17, true);
        t.setText(name);
        b.addView(t);
        TextView s1 = tv(MUTED, 13, false);
        s1.setText("حظر من النشر (يتصفح فقط)");
        s1.setPadding(0, dp(8), 0, dp(2));
        b.addView(s1);
        addBanOpt(b, d, target, "7 أيام", "post", 7, false);
        addBanOpt(b, d, target, "30 يومًا", "post", 30, false);
        TextView s2 = tv(0xFFFF9B9B, 13, false);
        s2.setText("حظر الحساب بالكامل (دائم)");
        s2.setPadding(0, dp(12), 0, dp(2));
        b.addView(s2);
        addBanOpt(b, d, target, "حظر الحساب نهائيًا", "full", 0, true);
        TextView cn = admBtn("إلغاء", Color.WHITE, 0x00000000, 0x30FFFFFF);
        cn.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { d.dismiss(); } });
        LinearLayout.LayoutParams cl = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        cl.setMargins(0, dp(8), 0, 0);
        b.addView(cn, cl);
        d.setContentView(b);
        d.show();
    }

    protected void addBanOpt(LinearLayout b, final Dialog d, final String target, String label, final String kind, final int days, boolean red) {
        TextView o = admBtn(label, red ? 0xFFFF9B9B : Color.WHITE, 0x0FFFFFFF, red ? 0x80FF4D4D : 0x30FFFFFF);
        o.setPadding(dp(6), dp(13), dp(6), dp(13));
        o.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) {
                d.dismiss();
                new AlertDialog.Builder(AdminReports.this).setMessage("تأكيد الحظر؟")
                    .setPositiveButton("تأكيد", new DialogInterface.OnClickListener() {
                        @Override public void onClick(DialogInterface di, int w) { doBan(target, kind, days); }
                    }).setNegativeButton("إلغاء", null).show();
            }
        });
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        lp.setMargins(0, dp(8), 0, 0);
        b.addView(o, lp);
    }

    protected void doBan(final String target, final String kind, final int days) {
        pool.execute(new Runnable() {
            @Override public void run() {
                try {
                    JSONObject b = new JSONObject();
                    b.put("p_user_id", target);
                    b.put("p_kind", kind);
                    if (days > 0) b.put("p_days", days); else b.put("p_days", JSONObject.NULL);
                    b.put("p_reason", "admin");
                    rpc("admin_ban_user", b.toString());
                    runOnUiThread(new Runnable() { @Override public void run() { toast("تم الحظر"); admLoad(); } });
                } catch (final Exception e) {
                    runOnUiThread(new Runnable() { @Override public void run() { toast("تعذّر: " + e.getMessage()); } });
                }
            }
        });
    }

    protected void admBanCard(LinearLayout card, JSONObject b) {
        final String target = b.optString("user_id", "");
        TextView n = tv(GOLD, 15, true);
        String un = b.isNull("username") ? "" : b.optString("username", "");
        n.setText(b.optString("name", "") + (un.length() > 0 ? "  @" + un : ""));
        card.addView(n);
        TextView m = tv(MUTED, 13, false);
        m.setPadding(0, dp(8), 0, dp(8));
        if ("full".equals(b.optString("kind"))) m.setText("🚫 حظر الحساب (دائم)");
        else m.setText("✍️ حظر من النشر حتى " + (b.isNull("banned_until") ? "" : b.optString("banned_until", "").replace("T", " ").replaceAll("\\..*$", "")));
        card.addView(m);
        TextView un2 = admBtn("إلغاء الحظر", Color.WHITE, 0x00000000, 0x30FFFFFF);
        un2.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) {
                pool.execute(new Runnable() {
                    @Override public void run() {
                        try {
                            rpc("admin_unban_user", new JSONObject().put("p_user_id", target).toString());
                            runOnUiThread(new Runnable() { @Override public void run() { admLoad(); } });
                        } catch (final Exception e) {
                            runOnUiThread(new Runnable() { @Override public void run() { toast("تعذّر: " + e.getMessage()); } });
                        }
                    }
                });
            }
        });
        card.addView(un2);
    }

    protected void admAppealCard(LinearLayout card, JSONObject a) {
        final long aid = a.optLong("appeal_id");
        TextView n = tv(GOLD, 15, true);
        String un = a.isNull("username") ? "" : a.optString("username", "");
        n.setText(a.optString("name", "") + (un.length() > 0 ? "  @" + un : ""));
        card.addView(n);
        TextView m = tv(MUTED, 12, false);
        m.setPadding(0, dp(6), 0, dp(6));
        m.setText(("full".equals(a.optString("kind")) ? "حظر الحساب" : "حظر من النشر") + " · " + a.optString("created_at", "").replace("T", " ").replaceAll("\\..*$", ""));
        card.addView(m);
        TextView msg = tv(0xFFE8ECFF, 15, false);
        msg.setPadding(dp(12), dp(10), dp(12), dp(10));
        msg.setBackground(box(0x0DFFFFFF, 0, 12));
        msg.setText(a.optString("message", ""));
        card.addView(msg);
        LinearLayout btns = new LinearLayout(this);
        btns.setPadding(0, dp(10), 0, 0);
        TextView ok = admBtn("قبول وفك الحظر", Color.WHITE, 0x00000000, 0x30FFFFFF);
        TextView no = admBtn("رفض", 0xFFFF9B9B, 0x2EFF4D4D, 0x80FF4D4D);
        LinearLayout.LayoutParams bl = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
        bl.setMargins(dp(3), 0, dp(3), 0);
        btns.addView(ok, bl);
        btns.addView(no, bl);
        card.addView(btns);
        ok.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { askReply(aid, "unban"); } });
        no.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { askReply(aid, "reject"); } });
    }

    protected void askReply(final long aid, final String act) {
        final Dialog d = sheetDialog(false);
        LinearLayout b = new LinearLayout(this);
        b.setOrientation(LinearLayout.VERTICAL);
        b.setPadding(dp(16), dp(16), dp(16), navH() + dp(8));
        b.setBackground(box(0xFF0F1A5C, 0, 22));
        TextView t = tv(Color.WHITE, 16, true);
        t.setText("unban".equals(act) ? "قبول الطعن — رسالة للمستخدم" : "رفض الطعن — رسالة للمستخدم");
        b.addView(t);
        final EditText et = new EditText(this);
        et.setText("unban".equals(act) ? "تمت مراجعة طعنك وتم رفع الحظر. التزم بشروط الاستخدام." : "تمت مراجعة طعنك وتم رفضه. الحظر باقٍ.");
        et.setTextColor(Color.WHITE);
        et.setMinLines(4);
        et.setGravity(Gravity.TOP | Gravity.START);
        et.setBackground(box(NAVY, 0x59F5C35A, 14));
        et.setPadding(dp(12), dp(12), dp(12), dp(12));
        LinearLayout.LayoutParams el = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        el.setMargins(0, dp(10), 0, dp(10));
        b.addView(et, el);
        LinearLayout row = new LinearLayout(this);
        TextView c = admBtn("إلغاء", Color.WHITE, 0x00000000, 0x30FFFFFF);
        TextView s = admBtn("إرسال", NAVY, GOLD, 0);
        LinearLayout.LayoutParams bl = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
        bl.setMargins(dp(4), 0, dp(4), 0);
        row.addView(c, bl);
        row.addView(s, bl);
        b.addView(row);
        c.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { d.dismiss(); } });
        s.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) {
                final String reply = et.getText().toString().trim();
                d.dismiss();
                pool.execute(new Runnable() {
                    @Override public void run() {
                        try {
                            JSONObject jb = new JSONObject();
                            jb.put("p_appeal_id", aid);
                            jb.put("p_action", act);
                            jb.put("p_reply", reply);
                            rpc("admin_resolve_appeal", jb.toString());
                            runOnUiThread(new Runnable() { @Override public void run() { admLoad(); } });
                        } catch (final Exception e) {
                            runOnUiThread(new Runnable() { @Override public void run() { toast("تعذّر: " + e.getMessage()); } });
                        }
                    }
                });
            }
        });
        d.setContentView(b);
        d.show();
    }

    // ---------------- حالة الحظر للمستخدم ----------------
    protected String appealStatusText() {
        if (myAppeal == null) return "";
        String st = myAppeal.optString("status", "");
        if ("open".equals(st)) return "⏳ طعنك قيد المراجعة.";
        if ("rejected".equals(st)) {
            String rp = myAppeal.isNull("reply") ? "" : myAppeal.optString("reply", "");
            return "ردّ الإدارة: " + (rp.length() > 0 ? rp : "تم رفض الطعن.");
        }
        return "";
    }

    protected void checkMyBan() {
        if (uid == null) return;
        pool.execute(new Runnable() {
            @Override public void run() {
                JSONObject ban = null;
                JSONObject ap = null;
                try {
                    JSONArray a = new JSONArray(get("user_bans?select=banned_until,kind&user_id=eq." + uid + "&limit=1"));
                    if (a.length() > 0) {
                        JSONObject b = a.getJSONObject(0);
                        String until = b.isNull("banned_until") ? "" : b.optString("banned_until", "");
                        if (until.length() == 0 || isFuture(until)) ban = b;
                    }
                } catch (Exception ignore) {}
                if (ban != null) {
                    try {
                        JSONArray x = new JSONArray(rpc("get_my_appeal", "{}"));
                        if (x.length() > 0) ap = x.getJSONObject(0);
                    } catch (Exception ignore) {}
                }
                final JSONObject fb = ban, fa = ap;
                runOnUiThread(new Runnable() {
                    @Override public void run() {
                        myBan = fb;
                        myAppeal = fa;
                        if (fb != null && "full".equals(fb.optString("kind")) && !banShown) { banShown = true; showFullBan(); }
                    }
                });
            }
        });
    }

    protected void showFullBan() {
        final Dialog d = sheetDialog(true);
        d.setCancelable(false);
        d.getWindow().setBackgroundDrawable(new ColorDrawable(NAVY));
        LinearLayout b = new LinearLayout(this);
        b.setOrientation(LinearLayout.VERTICAL);
        b.setGravity(Gravity.CENTER);
        b.setPadding(dp(30), dp(30), dp(30), dp(30));
        TextView ic = tv(Color.WHITE, 60, false);
        ic.setText("🚫");
        ic.setGravity(Gravity.CENTER);
        b.addView(ic);
        TextView t = tv(GOLD, 22, true);
        t.setText("تم إيقاف حسابك");
        t.setGravity(Gravity.CENTER);
        t.setPadding(0, dp(12), 0, dp(8));
        b.addView(t);
        TextView p = tv(0xFFC9D1F5, 15, false);
        p.setText("لمخالفة شروط الاستخدام.\nللاستفسار راسلنا على support@zelosport.net");
        p.setGravity(Gravity.CENTER);
        b.addView(p);
        final TextView st = tv(0xFFC9D1F5, 14, false);
        st.setGravity(Gravity.CENTER);
        st.setPadding(0, dp(12), 0, 0);
        st.setText(appealStatusText());
        b.addView(st);
        TextView ap = admBtn("طعن", NAVY, GOLD, 0);
        ap.setTextSize(16);
        ap.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { appealSheet(); } });
        LinearLayout.LayoutParams al = new LinearLayout.LayoutParams(dp(220), ViewGroup.LayoutParams.WRAP_CONTENT);
        al.setMargins(0, dp(20), 0, 0);
        b.addView(ap, al);
        TextView lo = admBtn("تسجيل الخروج", Color.WHITE, 0x00000000, 0x40FFFFFF);
        lo.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { d.dismiss(); doLogout(); } });
        LinearLayout.LayoutParams ll = new LinearLayout.LayoutParams(dp(220), ViewGroup.LayoutParams.WRAP_CONTENT);
        ll.setMargins(0, dp(12), 0, 0);
        b.addView(lo, ll);
        d.setContentView(b);
        d.show();
    }

    protected void appealSheet() {
        final Dialog d = sheetDialog(false);
        LinearLayout b = new LinearLayout(this);
        b.setOrientation(LinearLayout.VERTICAL);
        b.setPadding(dp(16), dp(16), dp(16), navH() + dp(8));
        b.setBackground(box(0xFF0F1A5C, 0, 22));
        TextView t = tv(Color.WHITE, 16, true);
        t.setText("اكتب رسالة الطعن");
        b.addView(t);
        final EditText et = new EditText(this);
        et.setHint("اشرح لماذا تعتقد أن الحظر خاطئ…");
        et.setHintTextColor(MUTED);
        et.setTextColor(Color.WHITE);
        et.setMinLines(5);
        et.setGravity(Gravity.TOP | Gravity.START);
        et.setBackground(box(NAVY, 0x59F5C35A, 14));
        et.setPadding(dp(12), dp(12), dp(12), dp(12));
        LinearLayout.LayoutParams el = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        el.setMargins(0, dp(10), 0, dp(6));
        b.addView(et, el);
        final TextView msg = tv(0xFFFF9B9B, 13, false);
        b.addView(msg);
        LinearLayout row = new LinearLayout(this);
        TextView c = admBtn("إلغاء", Color.WHITE, 0x00000000, 0x30FFFFFF);
        TextView s = admBtn("إرسال", NAVY, GOLD, 0);
        LinearLayout.LayoutParams bl = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
        bl.setMargins(dp(4), dp(6), dp(4), 0);
        row.addView(c, bl);
        row.addView(s, bl);
        b.addView(row);
        c.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { d.dismiss(); } });
        s.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) {
                final String txt = et.getText().toString().trim();
                if (txt.length() < 5) { msg.setText("اكتب 5 أحرف على الأقل"); return; }
                pool.execute(new Runnable() {
                    @Override public void run() {
                        try {
                            rpc("submit_ban_appeal", new JSONObject().put("p_message", txt).toString());
                            try { sendUrl("POST", url + "/functions/v1/notify-appeal", "{}"); } catch (Exception ignore) {}
                            runOnUiThread(new Runnable() {
                                @Override public void run() { d.dismiss(); toast("تم إرسال طعنك ✅ سنراجعه ونرد عليك"); checkMyBan(); }
                            });
                        } catch (final Exception e) {
                            final String em = String.valueOf(e.getMessage());
                            runOnUiThread(new Runnable() {
                                @Override public void run() { msg.setText(em.indexOf("one appeal") >= 0 ? "أرسلت طعنًا اليوم، حاول غدًا" : em); }
                            });
                        }
                    }
                });
            }
        });
        d.setContentView(b);
        d.show();
    }

    // بطاقة تظهر في الملف الشخصي للمحظور من النشر (فقط)
    protected View banNoteView() {
        if (myBan == null || "full".equals(myBan.optString("kind"))) return null;
        String until = myBan.isNull("banned_until") ? "" : myBan.optString("banned_until", "");
        if (until.length() > 0 && !isFuture(until)) return null;
        LinearLayout c = new LinearLayout(this);
        c.setOrientation(LinearLayout.VERTICAL);
        c.setPadding(dp(14), dp(14), dp(14), dp(14));
        c.setBackground(box(0x59781F1F, 0x73FF6B6B, 16));
        TextView t = tv(0xFFFF9B9B, 15, true);
        t.setText("⛔ حسابك موقوف عن النشر والتفاعل");
        c.addView(t);
        TextView m = tv(Color.WHITE, 13, false);
        m.setPadding(0, dp(6), 0, dp(6));
        m.setText((until.length() >= 10 ? "حتى: " + until.substring(0, 10) + " — " : "") + "يمكنك التصفح فقط.");
        c.addView(m);
        TextView ap = admBtn("طعن", Color.WHITE, 0x00000000, 0x59FFFFFF);
        ap.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { appealSheet(); } });
        c.addView(ap, new LinearLayout.LayoutParams(dp(110), ViewGroup.LayoutParams.WRAP_CONTENT));
        String as = appealStatusText();
        if (as.length() > 0) {
            TextView s = tv(0xFFC9D1F5, 13, false);
            s.setPadding(0, dp(8), 0, 0);
            s.setText(as);
            c.addView(s);
        }
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        lp.setMargins(dp(14), dp(10), dp(14), 0);
        c.setLayoutParams(lp);
        return c;
    }
}
