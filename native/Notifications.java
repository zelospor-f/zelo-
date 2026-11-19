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

abstract class Notifications extends NftMarket {
    // ===== من notifications.js: صفحة الإشعارات + عدّاد الشريط =====
    // ملاحظة: إشعارات localStorage المحلية في الويب لا تُقرأ هنا؛ المصدر جدول notifications في Supabase فقط.
    protected Dialog ntDlg;
    protected LinearLayout ntList;
    protected boolean ntTimerOn = false;

    protected String[] ntType(String t) {   // {أيقونة، لون}
        if ("reward".equals(t)) return new String[] { "🪙", "#f5c35a" };
        if ("match".equals(t)) return new String[] { "⚽", "#14F195" };
        if ("task".equals(t)) return new String[] { "⚡", "#ffd98a" };
        if ("social".equals(t)) return new String[] { "👥", "#5a7de8" };
        if ("rank".equals(t)) return new String[] { "🏆", "#7f9bff" };
        if ("wallet".equals(t)) return new String[] { "🔖", "#14F195" };
        if ("verified".equals(t)) return new String[] { "✔", "#1DA1F2" };
        return new String[] { "📢", "#9aa6d6" };
    }

    // عدّاد غير المقروء (يغذّي عدّاد زر الرسائل في الشريط)
    protected void refreshNotifBadge() {
        if (uid == null || token == null) return;
        pool.execute(new Runnable() {
            @Override public void run() {
                try {
                    notifUnread = (int) countRows("notifications?select=id&user_id=eq." + uid + "&is_read=eq.false");
                    runOnUiThread(new Runnable() { @Override public void run() { updateNavBadge(); } });
                } catch (Exception ignore) {}
            }
        });
    }
    protected final Runnable ntBadgeTick = new Runnable() {
        @Override public void run() { refreshNotifBadge(); timerH.postDelayed(this, 60000); }
    };
    protected void startNotifBadge() {
        if (ntTimerOn) return;
        ntTimerOn = true;
        timerH.postDelayed(ntBadgeTick, 1500);
    }

    protected void openNotificationsPage() {
        if (ntDlg != null) { try { ntDlg.dismiss(); } catch (Exception ignore) {} }
        final Dialog d = sheetDialog(true);
        ntDlg = d;
        d.getWindow().setBackgroundDrawable(new ColorDrawable(NAVY));
        lbDirection(d);
        final LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(14), statusH() + dp(6), dp(14), 0);
        final LinearLayout head = new LinearLayout(this);
        head.setGravity(Gravity.CENTER_VERTICAL);
        head.addView(backBtn(new Runnable() { @Override public void run() { d.dismiss(); } }));
        TextView ti = txt("🔔 " + L("الإشعارات", "Notifications"), GOLD, 20, true);
        head.addView(ti, lpw(1f));
        final TextView readAll = ntBtn(L("قراءة الكل", "Mark all read"), false);
        final TextView clear = ntBtn(L("مسح", "Clear"), true);
        head.addView(readAll);
        LinearLayout.LayoutParams cl = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        cl.setMargins(dp(8), 0, 0, 0);
        head.addView(clear, cl);
        TextView cog = ntBtn("⚙", false);
        cog.setTextSize(16);
        cog.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { ntOpenPrefs(); } });
        LinearLayout.LayoutParams cgl = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        cgl.setMargins(dp(8), 0, 0, 0);
        head.addView(cog, cgl);
        root.addView(head, lpm(0, 0, 0, 14));
        ntList = new LinearLayout(this);
        ntList.setOrientation(LinearLayout.VERTICAL);
        ntList.setPadding(0, 0, 0, navH() + dp(30));
        ntList.addView(uEmpty(""));
        ScrollView sc = new ScrollView(this);
        sc.addView(ntList);
        root.addView(sc, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));
        d.setContentView(root);
        d.setOnDismissListener(new DialogInterface.OnDismissListener() { @Override public void onDismiss(DialogInterface di) { ntDlg = null; ntList = null; refreshNotifBadge(); } });
        d.show();
        readAll.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { ntMarkAll(); } });
        clear.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) {
                new AlertDialog.Builder(Notifications.this).setMessage(L("مسح كل الإشعارات؟", "Clear all notifications?"))
                    .setPositiveButton(L("مسح", "Clear"), new DialogInterface.OnClickListener() {
                        @Override public void onClick(DialogInterface x, int w) {
                            pool.execute(new Runnable() { @Override public void run() {
                                try { send("DELETE", "notifications?user_id=eq." + uid, null); } catch (Exception ignore) {}
                                runOnUiThread(new Runnable() { @Override public void run() { ntLoad(); } });
                            } });
                        }
                    }).setNegativeButton(L("إلغاء", "Cancel"), null).show();
            }
        });
        ntLoad();
    }
    // إعدادات الإشعارات: تُنفَّذ في Settings
    protected void ntOpenPrefs() {}

    protected TextView ntBtn(String s, boolean danger) {
        TextView b = txt(s, danger ? 0xFFFF6B6B : GOLD, 12, true);
        b.setPadding(dp(12), dp(7), dp(12), dp(7));
        b.setBackground(rbg(0x402C4BB5, danger ? 0x4DFF4D4D : 0x59F5C35A, 16));
        return b;
    }

    protected void ntMarkAll() {
        pool.execute(new Runnable() { @Override public void run() {
            try { send("PATCH", "notifications?user_id=eq." + uid + "&is_read=eq.false", new JSONObject().put("is_read", true).toString()); } catch (Exception ignore) {}
            runOnUiThread(new Runnable() { @Override public void run() { notifUnread = 0; updateNavBadge(); ntLoad(); } });
        } });
    }

    protected final Map<String, String> ntNames = new HashMap<String, String>();
    protected boolean validPhoto(String u) { return u != null && (u.startsWith("http://") || u.startsWith("https://") || u.startsWith("data:image/svg+xml")); }

    protected void ntLoad() {
        pool.execute(new Runnable() {
            @Override public void run() {
                final List<JSONObject> list = new ArrayList<JSONObject>();
                final Map<String, String> photos = new HashMap<String, String>();
                try {
                    JSONArray a = new JSONArray(get("notifications?select=id,type,title_ar,title_en,body_ar,body_en,is_read,created_at,action,actor_id,actor_avatar&user_id=eq." + uid + "&order=created_at.desc&limit=100"));
                    List<String> need = new ArrayList<String>();
                    for (int i = 0; i < a.length(); i++) {
                        JSONObject n = a.getJSONObject(i);
                        list.add(n);
                        String av = n.isNull("actor_avatar") ? "" : n.optString("actor_avatar").trim();
                        String ac = n.isNull("actor_id") ? "" : n.optString("actor_id");
                        if (validPhoto(av)) photos.put(n.optString("id"), av);
                        else if (ac.length() > 0 && !need.contains(ac)) need.add(ac);
                    }
                    if (!need.isEmpty()) {
                        Map<String, String> byUser = new HashMap<String, String>();
                        try {
                            JSONArray ps = new JSONArray(get("posts?select=user_id,author_avatar&user_id=in.(" + android.text.TextUtils.join(",", need) + ")&order=created_at.desc&limit=300"));
                            for (int i = 0; i < ps.length(); i++) { JSONObject p = ps.getJSONObject(i); String k = p.optString("user_id"); String v = p.isNull("author_avatar") ? "" : p.optString("author_avatar").trim(); if (!byUser.containsKey(k) && validPhoto(v)) byUser.put(k, v); }
                        } catch (Exception ignore) {}
                        try {
                            JSONArray us = new JSONArray(get("users?select=user_id,photo_url&user_id=in.(" + android.text.TextUtils.join(",", need) + ")"));
                            for (int i = 0; i < us.length(); i++) { JSONObject u = us.getJSONObject(i); String v = u.isNull("photo_url") ? "" : u.optString("photo_url").trim(); if (!byUser.containsKey(u.optString("user_id")) && validPhoto(v)) byUser.put(u.optString("user_id"), v); }
                        } catch (Exception ignore) {}
                        for (JSONObject n : list) { String ac = n.isNull("actor_id") ? "" : n.optString("actor_id"); if (!photos.containsKey(n.optString("id")) && byUser.containsKey(ac)) photos.put(n.optString("id"), byUser.get(ac)); }
                    }
                } catch (Exception ignore) {}
                try {
                    List<String> all = new ArrayList<String>();
                    for (JSONObject n : list) { String ac = n.isNull("actor_id") ? "" : n.optString("actor_id"); if (ac.length() > 0 && !all.contains(ac)) all.add(ac); }
                    ntNames.clear();
                    if (!all.isEmpty()) {
                        Map<String, String> un = new HashMap<String, String>();
                        JSONArray us = new JSONArray(get("users?select=user_id,username&user_id=in.(" + android.text.TextUtils.join(",", all) + ")"));
                        for (int i = 0; i < us.length(); i++) { JSONObject u = us.getJSONObject(i); if (!u.isNull("username")) un.put(u.optString("user_id"), u.optString("username")); }
                        for (JSONObject n : list) { String ac = n.isNull("actor_id") ? "" : n.optString("actor_id"); if (un.containsKey(ac)) ntNames.put(n.optString("id"), un.get(ac)); }
                    }
                } catch (Exception ignore) {}
                runOnUiThread(new Runnable() { @Override public void run() { ntRender(list, photos); } });
            }
        });
    }

    protected void ntRender(List<JSONObject> list, Map<String, String> photos) {
        if (ntList == null) return;
        ntList.removeAllViews();
        int unread = 0;
        if (list.isEmpty()) {
            LinearLayout e = new LinearLayout(this);
            e.setOrientation(LinearLayout.VERTICAL);
            e.setGravity(Gravity.CENTER);
            e.setPadding(dp(20), dp(40), dp(20), dp(40));
            e.setBackground(rbg(0xCC111A4A, 0x26F5C35A, 18));
            TextView big = txt("🔕", Color.WHITE, 38, false); big.setGravity(Gravity.CENTER);
            e.addView(big);
            TextView t = txt(L("لا توجد إشعارات حالياً", "No notifications yet"), MUTED, 14, true); t.setGravity(Gravity.CENTER);
            e.addView(t);
            ntList.addView(e);
            return;
        }
        for (final JSONObject n : list) {
            final boolean read = n.optBoolean("is_read");
            if (!read) unread++;
            String[] ty = ntType(n.optString("type"));
            String title = isAr() ? (n.optString("title_ar").length() > 0 && !n.isNull("title_ar") ? n.optString("title_ar") : n.optString("title_en")) : (n.optString("title_en").length() > 0 && !n.isNull("title_en") ? n.optString("title_en") : n.optString("title_ar"));
            String body = isAr() ? (n.isNull("body_ar") || n.optString("body_ar").length() == 0 ? (n.isNull("body_en") ? "" : n.optString("body_en")) : n.optString("body_ar")) : (n.isNull("body_en") || n.optString("body_en").length() == 0 ? (n.isNull("body_ar") ? "" : n.optString("body_ar")) : n.optString("body_en"));
            LinearLayout row = new LinearLayout(this);
            row.setPadding(dp(14), dp(12), dp(14), dp(12));
            row.setBackground(read ? rbg(0xF20A1033, 0x1FF5C35A, 18) : rbg(0x4D2C4BB5, 0x8CF5C35A, 18));
            String ph = photos.get(n.optString("id"));
            if (ph != null) row.addView(lbAvatar(ph, "?", 42, 0x00000000, false, 1), new LinearLayout.LayoutParams(dp(42), dp(42)));
            else if (ntNames.containsKey(n.optString("id")) && ntNames.get(n.optString("id")).length() > 0) {
                String nm = ntNames.get(n.optString("id"));
                row.addView(lbAvatar("", nm.substring(0, 1).toUpperCase(), 42, 0x00000000, false, 1), new LinearLayout.LayoutParams(dp(42), dp(42)));
            } else {
                TextView ic = txt(ty[0], "verified".equals(n.optString("type")) ? 0xFF1DA1F2 : Color.WHITE, 21, "verified".equals(n.optString("type")));
                ic.setGravity(Gravity.CENTER);
                ic.setBackground(rbg(0x0FFFFFFF, 0x1AFFFFFF, 14));
                row.addView(ic, new LinearLayout.LayoutParams(dp(42), dp(42)));
            }
            LinearLayout col = new LinearLayout(this);
            col.setOrientation(LinearLayout.VERTICAL);
            col.setPadding(dp(12), 0, 0, 0);
            LinearLayout r1 = new LinearLayout(this);
            r1.setGravity(Gravity.CENTER_VERTICAL);
            r1.addView(txt(title, Color.WHITE, 14, true), lpw(1f));
            if (!read) { View dot = new View(this); dot.setBackground(oval(0xFFFD1D1D, 0)); r1.addView(dot, new LinearLayout.LayoutParams(dp(9), dp(9))); }
            col.addView(r1);
            if (body.length() > 0) col.addView(txt(body, MUTED, 12, false));
            col.addView(txt(ago(n.optString("created_at")), 0xFF7782B0, 11, true), lpm(0, 5, 0, 0));
            row.addView(col, lpw(1f));
            row.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { ntTap(n); } });
            ntList.addView(row, lpm(0, 0, 0, 10));
        }
    }

    protected void ntTap(final JSONObject n) {
        final String act = n.isNull("action") ? "" : n.optString("action");
        if (act.startsWith("invite:")) { ntInvite(n, act.substring(7)); return; }
        if (!n.optBoolean("is_read")) ntRead(n.optString("id"));
        ntRun(act);
    }
    protected void ntRead(final String id) {
        pool.execute(new Runnable() { @Override public void run() {
            try { send("PATCH", "notifications?id=eq." + id + "&user_id=eq." + uid, new JSONObject().put("is_read", true).toString()); } catch (Exception ignore) {}
            refreshNotifBadge();
        } });
    }
    protected void ntInvite(final JSONObject n, final String roomId) {
        new AlertDialog.Builder(this).setMessage(L("هل تريد قبول الدعوة؟", "Accept this invitation?"))
            .setPositiveButton(L("قبول", "Accept"), new DialogInterface.OnClickListener() { @Override public void onClick(DialogInterface d, int w) { ntRead(n.optString("id")); acceptRoomInvite(roomId); } })
            .setNegativeButton(L("رفض", "Decline"), new DialogInterface.OnClickListener() { @Override public void onClick(DialogInterface d, int w) { ntRead(n.optString("id")); if (ntDlg != null) ntLoad(); } })
            .show();
    }
    // تنفيذ إجراء الإشعار (room:CODE / match:ID / user / post / challenge / followers / admin_reports)
    protected void ntRun(String act) {
        if (act == null || act.length() == 0) return;
        int i = act.indexOf(':');
        String kind = i < 0 ? act : act.substring(0, i), arg = i < 0 ? "" : act.substring(i + 1);
        if (ntDlg != null) { try { ntDlg.dismiss(); } catch (Exception ignore) {} }
        if (kind.equals("room")) joinRoomByCode(arg);
        else if (kind.equals("match")) openMatchRoom(arg);
        else if (kind.equals("user")) openProfile(arg);
        else if (kind.equals("post")) openPostById(arg);
        else if (kind.equals("challenge")) openFriendChallenges(arg);
        else if (kind.equals("followers")) openFollowList("followers");
        else if (kind.equals("admin_reports")) openReportsPanel();
    }
}
