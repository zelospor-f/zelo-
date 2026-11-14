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

abstract class Messages extends Login {
    // ===== من messages.js: صفحة الرسائل (الدردشة) على طريقة X =====
    protected static class Conv { String uid; JSONObject last; int unread; }
    protected static class SheetItem {
        String icon, label; boolean danger; Runnable act;
        SheetItem(String i, String l, boolean d, Runnable a) { icon = i; label = l; danger = d; act = a; }
    }
    protected final Map<String, String[]> profCache = new HashMap<String, String[]>();   // uid → {name, avatar, username, badge}
    protected Map<String, JSONObject> dmPrefs = new HashMap<String, JSONObject>();
    protected Set<String> blockedByMe = new HashSet<String>();
    protected List<Conv> convs = new ArrayList<Conv>();
    protected String dmTab = "msgs", dmFilter = "";
    protected LinearLayout dmListBox, dmMsgsPane, dmRoomsPane;
    protected EditText dmSearch;
    protected View dmFab;
    protected Dialog chatDlg;
    protected String chatUid = null, chatSig = "";
    protected LinearLayout chatMsgsBox, chatNotice;
    protected View chatInputBar;
    protected ScrollView chatScroll;
    protected EditText chatInput;
    protected List<JSONObject> chatMsgs = new ArrayList<JSONObject>();
    protected final List<Object[]> chatFailed = new ArrayList<Object[]>();   // {text, at}

    protected String nowIso() {
        SimpleDateFormat f = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", java.util.Locale.US);
        f.setTimeZone(TimeZone.getTimeZone("UTC"));
        return f.format(new Date());
    }
    protected String dmAvatarUrl(String name, String url) {
        if (url != null && url.startsWith("http")) return url;
        try { return "https://ui-avatars.com/api/?name=" + java.net.URLEncoder.encode(name == null || name.length() == 0 ? "P" : name, "UTF-8") + "&background=0c0e20&color=00FF87&size=96&bold=true"; }
        catch (Exception e) { return ""; }
    }
    protected String dmNameOf(String u) {
        String[] p = profCache.get(u);
        if (p != null && p[0].length() > 0) return p[0];
        if (p != null && p[2].length() > 0) return p[2];
        return L("مستخدم", "User");
    }
    protected String pickName(JSONObject r) {
        String[] ks = { "display_name", "nickname", "name", "full_name" };
        for (String k : ks) if (!r.isNull(k) && r.optString(k).length() > 0) return r.optString(k);
        String a = r.isNull("nickname_ar") ? "" : r.optString("nickname_ar"), e = r.isNull("nickname_en") ? "" : r.optString("nickname_en");
        String n = isAr() ? (a.length() > 0 ? a : e) : (e.length() > 0 ? e : a);
        return n;
    }
    protected String pickPhoto(JSONObject r) {
        String[] ks = { "photo_url", "photoUrl", "avatar_url", "avatar", "photo" };
        for (String k : ks) if (!r.isNull(k) && r.optString(k).length() > 0) return r.optString(k);
        return "";
    }

    // يحمّل الملفات الشخصية الناقصة (خارج خيط الواجهة)
    protected void loadProfiles(List<String> idsIn) {
        List<String> ids = new ArrayList<String>();
        for (String id : idsIn) if (id != null && id.length() > 0 && !profCache.containsKey(id) && !ids.contains(id)) ids.add(id);
        if (ids.isEmpty()) return;
        for (String id : ids) profCache.put(id, new String[] { "", "", "", "" });
        try {
            JSONArray a = new JSONArray(get("public_profiles?select=*&user_id=in.(" + android.text.TextUtils.join(",", ids) + ")"));
            for (int i = 0; i < a.length(); i++) {
                JSONObject r = a.getJSONObject(i);
                profCache.put(r.optString("user_id"), new String[] { pickName(r), pickPhoto(r), r.isNull("username") ? "" : r.optString("username"), r.isNull("badge_club") ? "" : r.optString("badge_club") });
            }
            List<String> missing = new ArrayList<String>();
            for (String id : ids) { String[] p = profCache.get(id); if (p[0].length() == 0 || p[1].length() == 0) missing.add(id); }
            if (!missing.isEmpty()) {
                JSONArray ps = new JSONArray(get("posts?select=user_id,author_name,author_avatar&user_id=in.(" + android.text.TextUtils.join(",", missing) + ")&order=created_at.desc&limit=200"));
                for (int i = 0; i < ps.length(); i++) {
                    JSONObject p = ps.getJSONObject(i);
                    String[] o = profCache.get(p.optString("user_id"));
                    if (o == null) continue;
                    if (o[0].length() == 0 && !p.isNull("author_name")) o[0] = p.optString("author_name");
                    if (o[1].length() == 0 && !p.isNull("author_avatar")) o[1] = p.optString("author_avatar");
                }
            }
        } catch (Exception ignore) {}
    }

    // الاسم مع شارة النادي الموثّقة
    protected View dmNameView(String u, int sizeSp, int color) {
        LinearLayout r = new LinearLayout(this);
        r.setGravity(Gravity.CENTER_VERTICAL);
        TextView n = txt(dmNameOf(u), color, sizeSp, true);
        n.setSingleLine(true);
        n.setEllipsize(android.text.TextUtils.TruncateAt.END);
        r.addView(n);
        String[] p = profCache.get(u);
        if (p != null && p[3].length() > 0) {
            String lg = ClubsData.logo(p[3]);
            if (lg != null && lg.length() > 0) {
                ImageView b = new ImageView(this);
                LinearLayout.LayoutParams bl = new LinearLayout.LayoutParams(dp(15), dp(15));
                bl.setMargins(dp(4), 0, 0, 0);
                r.addView(b, bl);
                loadImage(lg, b);
            }
        }
        return r;
    }

    protected void dmSheet(String title, List<SheetItem> items) {
        final Dialog d = sheetDialog(false);
        lbDirection(d);
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setPadding(0, dp(8), 0, navH() + dp(10));
        GradientDrawable bg = rbg(0xFF1A1D2E, 0, 0);
        bg.setCornerRadii(new float[] { dp(18), dp(18), dp(18), dp(18), 0, 0, 0, 0 });
        box.setBackground(bg);
        if (title != null) { TextView t = txt(title, 0xFF7A7F9A, 14, true); t.setGravity(Gravity.CENTER); t.setPadding(dp(8), dp(8), dp(8), dp(8)); box.addView(t); }
        for (final SheetItem it : items) {
            LinearLayout r = new LinearLayout(this);
            r.setGravity(Gravity.CENTER_VERTICAL);
            r.setPadding(dp(20), dp(14), dp(20), dp(14));
            r.addView(txt(it.icon, Color.WHITE, 18, false));
            TextView l = txt(it.label, it.danger ? 0xFFF4212E : Color.WHITE, 15, true);
            l.setPadding(dp(14), 0, 0, 0);
            r.addView(l);
            r.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { d.dismiss(); it.act.run(); } });
            box.addView(r);
        }
        ScrollView sc = new ScrollView(this);
        sc.addView(box);
        d.setContentView(sc);
        d.show();
    }

    // ---------- التفضيلات: تثبيت / كتم / غير مقروءة / حذف ----------
    protected void setPref(final String other, final JSONObject patch) {
        JSONObject row = dmPrefs.get(other);
        try {
            JSONObject n = new JSONObject();
            n.put("user_id", uid).put("other_id", other);
            if (row != null) { java.util.Iterator<String> k = row.keys(); while (k.hasNext()) { String key = k.next(); n.put(key, row.get(key)); } }
            java.util.Iterator<String> k2 = patch.keys();
            while (k2.hasNext()) { String key = k2.next(); n.put(key, patch.get(key)); }
            dmPrefs.put(other, n);
            final JSONObject fn = n;
            pool.execute(new Runnable() {
                @Override public void run() {
                    try { sendUrl("POST", url + "/rest/v1/dm_prefs?on_conflict=user_id,other_id", new JSONArray().put(fn).toString(), "resolution=merge-duplicates,return=minimal"); } catch (Exception ignore) {}
                }
            });
        } catch (Exception ignore) {}
        renderDmList();
    }
    protected JSONObject jo(String k, Object v) { try { return new JSONObject().put(k, v); } catch (Exception e) { return new JSONObject(); } }

    protected void convMenu(final String u) {
        final JSONObject p = dmPrefs.get(u) == null ? new JSONObject() : dmPrefs.get(u);
        Conv cv = null;
        for (Conv c : convs) if (c.uid.equals(u)) cv = c;
        final boolean isUnread = p.optBoolean("unread_mark") || (cv != null && cv.unread > 0);
        List<SheetItem> it = new ArrayList<SheetItem>();
        it.add(new SheetItem("💬", isUnread ? L("تحديد كمقروءة", "Mark as read") : L("تحديد كغير مقروءة", "Mark as unread"), false, new Runnable() {
            @Override public void run() {
                if (isUnread) {
                    pool.execute(new Runnable() {
                        @Override public void run() {
                            try { send("PATCH", "dm_messages?receiver_id=eq." + uid + "&sender_id=eq." + u + "&read_at=is.null", new JSONObject().put("read_at", nowIso()).toString()); } catch (Exception ignore) {}
                            runOnUiThread(new Runnable() { @Override public void run() { setPref(u, jo("unread_mark", false)); loadDmList(); updateMsgBadge(); } });
                        }
                    });
                } else setPref(u, jo("unread_mark", true));
            }
        }));
        final boolean muted = p.optBoolean("muted"), pinned = p.optBoolean("pinned");
        it.add(new SheetItem(muted ? "🔔" : "🔕", muted ? L("إلغاء كتم المحادثة", "Unmute conversation") : L("كتم المحادثة", "Mute conversation"), false, new Runnable() { @Override public void run() { setPref(u, jo("muted", !muted)); } }));
        it.add(new SheetItem("📌", pinned ? L("إلغاء تثبيت المحادثة", "Unpin conversation") : L("تثبيت المحادثة", "Pin conversation"), false, new Runnable() { @Override public void run() { setPref(u, jo("pinned", !pinned)); } }));
        it.add(new SheetItem("🗑️", L("حذف المحادثة", "Delete conversation"), true, new Runnable() {
            @Override public void run() {
                new AlertDialog.Builder(Messages.this).setMessage(L("حذف هذه المحادثة؟", "Delete this conversation?"))
                    .setPositiveButton(L("حذف", "Delete"), new DialogInterface.OnClickListener() {
                        @Override public void onClick(DialogInterface d, int w) { try { setPref(u, new JSONObject().put("deleted_at", nowIso()).put("pinned", false)); } catch (Exception ignore) {} }
                    }).setNegativeButton(L("إلغاء", "Cancel"), null).show();
            }
        }));
        dmSheet(dmNameOf(u), it);
    }

    // ---------- صفحة الرسائل ----------
    protected void openMessagesPage() {
        final LinearLayout wrap = new LinearLayout(this);
        wrap.setOrientation(LinearLayout.VERTICAL);
        wrap.setPadding(dp(12), dp(24), dp(12), dp(90));
        wrap.addView(txt(L("الرسائل", "Messages"), Color.WHITE, 26, true), lpm(0, 6, 0, 12));
        LinearLayout pills = new LinearLayout(this);
        final TextView p1 = txt(L("رسائل", "Messages"), Color.WHITE, 14, true), p2 = txt(L("غرف", "Rooms"), Color.WHITE, 14, true);
        for (TextView p : new TextView[] { p1, p2 }) { p.setPadding(dp(20), dp(7), dp(20), dp(7)); }
        pills.addView(p1);
        LinearLayout.LayoutParams l2 = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        l2.setMargins(dp(8), 0, 0, 0);
        pills.addView(p2, l2);
        wrap.addView(pills, lpm(0, 0, 0, 6));
        dmMsgsPane = new LinearLayout(this);
        dmMsgsPane.setOrientation(LinearLayout.VERTICAL);
        dmSearch = new EditText(this);
        dmSearch.setHint(L("بحث", "Search"));
        dmSearch.setHintTextColor(MUTED);
        dmSearch.setTextColor(Color.WHITE);
        dmSearch.setTextSize(14);
        dmSearch.setSingleLine(true);
        dmSearch.setBackground(rbg(0x12FFFFFF, 0x1AFFFFFF, 30));
        dmSearch.setPadding(dp(16), dp(10), dp(16), dp(10));
        dmFilter = "";
        dmSearch.addTextChangedListener(new android.text.TextWatcher() {
            @Override public void beforeTextChanged(CharSequence s, int a, int b, int c) {}
            @Override public void onTextChanged(CharSequence s, int a, int b, int c) { dmFilter = s.toString(); renderDmList(); }
            @Override public void afterTextChanged(android.text.Editable s) {}
        });
        dmMsgsPane.addView(dmSearch, lpm(0, 6, 0, 8));
        // صف الإشعارات
        LinearLayout nr = new LinearLayout(this);
        nr.setGravity(Gravity.CENTER_VERTICAL);
        nr.setPadding(dp(4), dp(12), dp(4), dp(12));
        TextView bell = txt("🔔", NAVY, 22, false);
        bell.setGravity(Gravity.CENTER);
        GradientDrawable bg = new GradientDrawable(GradientDrawable.Orientation.TL_BR, new int[] { 0xFFF5C35A, 0xFFE08A2C });
        bg.setShape(GradientDrawable.OVAL);
        bell.setBackground(bg);
        nr.addView(bell, new LinearLayout.LayoutParams(dp(52), dp(52)));
        LinearLayout nt = new LinearLayout(this);
        nt.setOrientation(LinearLayout.VERTICAL);
        nt.setPadding(dp(12), 0, dp(12), 0);
        nt.addView(txt(L("الإشعارات", "Notifications"), Color.WHITE, 15, true));
        nt.addView(txt(L("اضغط لعرض إشعاراتك", "Tap to see your notifications"), 0xFF94A3B8, 13, false));
        nr.addView(nt, lpw(1f));
        nr.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { showPage("notifications"); } });
        dmMsgsPane.addView(nr);
        dmListBox = new LinearLayout(this);
        dmListBox.setOrientation(LinearLayout.VERTICAL);
        dmListBox.addView(uEmpty(L("جارٍ التحميل...", "Loading...")));
        dmMsgsPane.addView(dmListBox);
        wrap.addView(dmMsgsPane);
        dmRoomsPane = new LinearLayout(this);
        dmRoomsPane.setOrientation(LinearLayout.VERTICAL);
        dmRoomsPane.setVisibility(View.GONE);
        TextView rt = txt(L("غرف الدردشة والمباريات", "Chat & match rooms"), Color.WHITE, 15, true);
        rt.setGravity(Gravity.CENTER); rt.setPadding(0, dp(30), 0, dp(10));
        dmRoomsPane.addView(rt);
        TextView ro = gpBtn(L("فتح الغرف", "Open rooms"), false, true);
        ro.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { goWeb("rooms"); } });
        dmRoomsPane.addView(ro, lpm(30, 0, 30, 0));
        wrap.addView(dmRoomsPane);

        final Runnable styleTabs = new Runnable() {
            @Override public void run() {
                boolean m = dmTab.equals("msgs");
                p1.setTextColor(m ? NAVY : 0xFFCFD8FF); p2.setTextColor(!m ? NAVY : 0xFFCFD8FF);
                GradientDrawable on = new GradientDrawable(GradientDrawable.Orientation.LEFT_RIGHT, new int[] { 0xFFFFE7AD, 0xFFF5C35A });
                on.setCornerRadius(dp(30));
                p1.setBackground(m ? on : rbg(0x12FFFFFF, 0x1AFFFFFF, 30));
                p2.setBackground(!m ? on : rbg(0x12FFFFFF, 0x1AFFFFFF, 30));
                dmMsgsPane.setVisibility(m ? View.VISIBLE : View.GONE);
                dmRoomsPane.setVisibility(m ? View.GONE : View.VISIBLE);
                if (dmFab != null) dmFab.setVisibility(m ? View.VISIBLE : View.GONE);
            }
        };
        p1.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { dmTab = "msgs"; styleTabs.run(); } });
        p2.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { dmTab = "rooms"; styleTabs.run(); } });

        ScrollView sc = new ScrollView(this);
        sc.addView(wrap);
        FrameLayout fr = new FrameLayout(this);
        fr.addView(sc, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        TextView fab = txt("✉️", NAVY, 24, false);
        fab.setGravity(Gravity.CENTER);
        GradientDrawable fg = new GradientDrawable(GradientDrawable.Orientation.TL_BR, new int[] { 0xFFFFE7AD, 0xFFF5C35A });
        fg.setShape(GradientDrawable.OVAL);
        fab.setBackground(fg);
        fab.setElevation(dp(6));
        fab.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { newChatSheet(); } });
        FrameLayout.LayoutParams fl = new FrameLayout.LayoutParams(dp(56), dp(56), Gravity.BOTTOM | Gravity.LEFT);
        fl.setMargins(dp(18), 0, 0, dp(18));
        fr.addView(fab, fl);
        dmFab = fab;
        pgOpen(fr, 9);
        styleTabs.run();
        loadDmList();
        timerH.removeCallbacks(dmTick);
        timerH.postDelayed(dmTick, 10000);
    }

    protected final Runnable dmTick = new Runnable() {
        @Override public void run() {
            if (dmListBox == null) return;
            if (chatDlg == null) loadDmList();
            timerH.postDelayed(this, 10000);
        }
    };

    @Override protected void onPageClosed() {
        super.onPageClosed();
        dmListBox = null; dmMsgsPane = null; dmRoomsPane = null; dmSearch = null; dmFab = null;
        timerH.removeCallbacks(dmTick);
    }

    protected void loadDmList() {
        if (uid == null) return;
        pool.execute(new Runnable() {
            @Override public void run() {
                try {
                    JSONArray m = new JSONArray(get("dm_messages?select=*&or=(sender_id.eq." + uid + ",receiver_id.eq." + uid + ")&order=created_at.desc&limit=500"));
                    JSONArray p = new JSONArray(get("dm_prefs?select=*&user_id=eq." + uid));
                    JSONArray b = new JSONArray(get("user_blocks?select=blocked_id&user_id=eq." + uid));
                    Map<String, JSONObject> pm = new HashMap<String, JSONObject>();
                    for (int i = 0; i < p.length(); i++) pm.put(p.getJSONObject(i).optString("other_id"), p.getJSONObject(i));
                    Set<String> bl = new HashSet<String>();
                    for (int i = 0; i < b.length(); i++) bl.add(b.getJSONObject(i).optString("blocked_id"));
                    Map<String, Conv> map = new HashMap<String, Conv>();
                    for (int i = 0; i < m.length(); i++) {
                        JSONObject x = m.getJSONObject(i);
                        String other = uid.equals(x.optString("sender_id")) ? x.optString("receiver_id") : x.optString("sender_id");
                        JSONObject pr = pm.get(other);
                        if (pr != null && !pr.isNull("deleted_at") && isoMs(x.optString("created_at")) <= isoMs(pr.optString("deleted_at"))) continue;
                        Conv c = map.get(other);
                        if (c == null) { c = new Conv(); c.uid = other; c.last = x; map.put(other, c); }
                        if (uid.equals(x.optString("receiver_id")) && x.isNull("read_at")) c.unread++;
                    }
                    final List<Conv> list = new ArrayList<Conv>(map.values());
                    final Map<String, JSONObject> fpm = pm;
                    java.util.Collections.sort(list, new java.util.Comparator<Conv>() {
                        @Override public int compare(Conv a, Conv c2) {
                            int pa = fpm.get(a.uid) != null && fpm.get(a.uid).optBoolean("pinned") ? 1 : 0;
                            int pb = fpm.get(c2.uid) != null && fpm.get(c2.uid).optBoolean("pinned") ? 1 : 0;
                            if (pa != pb) return pb - pa;
                            long ta = isoMs(a.last.optString("created_at")), tb = isoMs(c2.last.optString("created_at"));
                            return ta == tb ? 0 : (tb > ta ? 1 : -1);
                        }
                    });
                    List<String> ids = new ArrayList<String>();
                    for (Conv c : list) ids.add(c.uid);
                    loadProfiles(ids);
                    final Set<String> fbl = bl;
                    runOnUiThread(new Runnable() {
                        @Override public void run() { dmPrefs = fpm; blockedByMe = fbl; convs = list; renderDmList(); }
                    });
                } catch (Exception ignore) {}
            }
        });
    }

    protected void renderDmList() {
        if (dmListBox == null) return;
        dmListBox.removeAllViews();
        String q = dmFilter.trim().toLowerCase();
        int shown = 0;
        for (final Conv cv : convs) {
            String[] pr = profCache.get(cv.uid);
            if (q.length() > 0 && !(dmNameOf(cv.uid).toLowerCase().contains(q) || (pr != null && pr[2].toLowerCase().contains(q)))) continue;
            shown++;
            JSONObject pf = dmPrefs.get(cv.uid) == null ? new JSONObject() : dmPrefs.get(cv.uid);
            boolean unread = cv.unread > 0 || pf.optBoolean("unread_mark");
            boolean mineLast = uid.equals(cv.last.optString("sender_id"));
            LinearLayout row = new LinearLayout(this);
            row.setGravity(Gravity.CENTER_VERTICAL);
            row.setPadding(dp(4), dp(12), dp(4), dp(12));
            View av = lbAvatar(dmAvatarUrl(pr == null ? "" : pr[0], pr == null ? "" : pr[1]), initial(dmNameOf(cv.uid)), 52, 0x00000000, false, 1);
            av.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { openProfile(cv.uid); } });
            row.addView(av, new LinearLayout.LayoutParams(dp(52), dp(52)));
            LinearLayout body = new LinearLayout(this);
            body.setOrientation(LinearLayout.VERTICAL);
            body.setPadding(dp(12), 0, 0, 0);
            LinearLayout r1 = new LinearLayout(this);
            r1.setGravity(Gravity.CENTER_VERTICAL);
            r1.addView(dmNameView(cv.uid, 15, Color.WHITE), lpw(1f));
            if (pf.optBoolean("pinned")) r1.addView(txt("📌", Color.WHITE, 11, false));
            if (pf.optBoolean("muted")) r1.addView(txt("🔕", Color.WHITE, 11, false));
            TextView tm = txt(ago(cv.last.optString("created_at")), 0xFF7A7F9A, 12, false);
            tm.setPadding(dp(6), 0, 0, 0);
            r1.addView(tm);
            body.addView(r1);
            LinearLayout r2 = new LinearLayout(this);
            r2.setGravity(Gravity.CENTER_VERTICAL);
            TextView last = txt((mineLast ? L("أنت: ", "You: ") : "") + cv.last.optString("content"), unread ? Color.WHITE : 0xFF94A3B8, 14, unread);
            last.setSingleLine(true); last.setEllipsize(android.text.TextUtils.TruncateAt.END);
            r2.addView(last, lpw(1f));
            if (unread) {
                TextView dot = txt(cv.unread > 0 ? String.valueOf(cv.unread) : "", NAVY, 11, true);
                dot.setGravity(Gravity.CENTER);
                dot.setBackground(rbg(GOLD, 0, 10));
                dot.setPadding(dp(5), dp(1), dp(5), dp(1));
                dot.setMinWidth(dp(cv.unread > 0 ? 18 : 10));
                dot.setMinHeight(dp(10));
                r2.addView(dot);
            }
            body.addView(r2);
            row.addView(body, lpw(1f));
            row.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { openChat(cv.uid); } });
            row.setOnLongClickListener(new View.OnLongClickListener() { @Override public boolean onLongClick(View v) { convMenu(cv.uid); return true; } });
            dmListBox.addView(row);
        }
        if (shown == 0) dmListBox.addView(uEmpty(L("لا توجد محادثات بعد", "No conversations yet")));
    }

    // ---------- محادثة جديدة (قائمة المتابَعين) ----------
    protected void newChatSheet() {
        final Dialog d = sheetDialog(true);
        d.getWindow().setBackgroundDrawable(new ColorDrawable(0xFF121215));
        lbDirection(d);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(14), dp(24), dp(14), navH() + dp(10));
        LinearLayout hd = new LinearLayout(this);
        hd.setGravity(Gravity.CENTER_VERTICAL);
        TextView cancel = txt(L("إلغاء", "Cancel"), Color.WHITE, 15, true);
        cancel.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { d.dismiss(); } });
        hd.addView(cancel, new LinearLayout.LayoutParams(dp(70), ViewGroup.LayoutParams.WRAP_CONTENT));
        TextView ti = txt(L("رسالة جديدة", "New message"), Color.WHITE, 17, true);
        ti.setGravity(Gravity.CENTER);
        hd.addView(ti, lpw(1f));
        View sp = new View(this);
        hd.addView(sp, new LinearLayout.LayoutParams(dp(70), 1));
        root.addView(hd, lpm(0, 0, 0, 10));
        final EditText q = new EditText(this);
        q.setHint(L("بحث", "Search"));
        q.setHintTextColor(0xFF7A7F9A);
        q.setTextColor(Color.WHITE);
        q.setSingleLine(true);
        q.setBackground(rbg(0x14FFFFFF, 0, 30));
        q.setPadding(dp(18), dp(12), dp(18), dp(12));
        root.addView(q, lpm(0, 0, 0, 8));
        final LinearLayout res = new LinearLayout(this);
        res.setOrientation(LinearLayout.VERTICAL);
        res.addView(uEmpty(L("جارٍ التحميل...", "Loading...")));
        ScrollView sc = new ScrollView(this);
        sc.addView(res);
        root.addView(sc, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));
        d.setContentView(root);
        d.show();
        final List<String> ids = new ArrayList<String>();
        final Runnable draw = new Runnable() {
            @Override public void run() {
                String f = q.getText().toString().trim().replaceFirst("^@", "").toLowerCase();
                res.removeAllViews();
                int n = 0;
                for (final String id : ids) {
                    String[] p = profCache.get(id);
                    if (f.length() > 0 && !(dmNameOf(id).toLowerCase().contains(f) || (p != null && p[2].toLowerCase().contains(f)))) continue;
                    n++;
                    LinearLayout r = new LinearLayout(this_());
                    r.setGravity(Gravity.CENTER_VERTICAL);
                    r.setPadding(0, dp(10), 0, dp(10));
                    r.addView(lbAvatar(dmAvatarUrl(p == null ? "" : p[0], p == null ? "" : p[1]), initial(dmNameOf(id)), 54, 0x00000000, false, 1), new LinearLayout.LayoutParams(dp(54), dp(54)));
                    LinearLayout t = new LinearLayout(this_());
                    t.setOrientation(LinearLayout.VERTICAL);
                    t.setPadding(dp(14), 0, 0, 0);
                    t.addView(dmNameView(id, 16, Color.WHITE));
                    t.addView(txt("@" + (p == null ? "" : p[2]), 0xFF7A7F9A, 14, false));
                    r.addView(t);
                    r.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { d.dismiss(); openChat(id); } });
                    res.addView(r);
                }
                if (n == 0) res.addView(uEmpty(L("لا يوجد متابَعون", "No one to show")));
            }
        };
        q.addTextChangedListener(new android.text.TextWatcher() {
            @Override public void beforeTextChanged(CharSequence s, int a, int b, int c) {}
            @Override public void onTextChanged(CharSequence s, int a, int b, int c) { draw.run(); }
            @Override public void afterTextChanged(android.text.Editable s) {}
        });
        pool.execute(new Runnable() {
            @Override public void run() {
                try {
                    JSONArray f = new JSONArray(get("user_follows?select=following_id&follower_id=eq." + uid + "&limit=500"));
                    JSONArray b = new JSONArray(get("user_blocks?select=blocked_id&user_id=eq." + uid));
                    Set<String> bl = new HashSet<String>();
                    for (int i = 0; i < b.length(); i++) bl.add(b.getJSONObject(i).optString("blocked_id"));
                    for (int i = 0; i < f.length(); i++) { String id = f.getJSONObject(i).optString("following_id"); if (!id.equals(uid) && !bl.contains(id) && !ids.contains(id)) ids.add(id); }
                    loadProfiles(ids);
                    java.util.Collections.sort(ids, new java.util.Comparator<String>() {
                        @Override public int compare(String a, String c) { return dmNameOf(a).compareToIgnoreCase(dmNameOf(c)); }
                    });
                } catch (Exception ignore) {}
                runOnUiThread(draw);
            }
        });
    }

    // ---------- شاشة المحادثة ----------
    protected void openChat(final String other) {
        if (other == null || other.length() == 0 || other.equals(uid)) return;
        closeChat(false);
        chatUid = other;
        chatSig = "";
        chatFailed.clear();
        chatMsgs = new ArrayList<JSONObject>();
        chatDlg = sheetDialog(true);
        chatDlg.getWindow().setBackgroundDrawable(new ColorDrawable(0xFF121215));
        chatDlg.getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
        lbDirection(chatDlg);
        final LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(0, dp(20), 0, 0);
        final LinearLayout head = new LinearLayout(this);
        head.setGravity(Gravity.CENTER_VERTICAL);
        head.setPadding(dp(12), dp(10), dp(12), dp(10));
        TextView back = txt(isRtlLang() ? "→" : "←", Color.WHITE, 22, false);
        back.setGravity(Gravity.CENTER);
        back.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { closeChat(true); } });
        head.addView(back, new LinearLayout.LayoutParams(dp(38), dp(38)));
        root.addView(head);
        View line = new View(this);
        line.setBackgroundColor(0x14FFFFFF);
        root.addView(line, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(1)));
        chatMsgsBox = new LinearLayout(this);
        chatMsgsBox.setOrientation(LinearLayout.VERTICAL);
        chatMsgsBox.setLayoutDirection(View.LAYOUT_DIRECTION_LTR);
        chatMsgsBox.setPadding(dp(12), dp(12), dp(12), dp(12));
        chatScroll = new ScrollView(this);
        chatScroll.addView(chatMsgsBox);
        root.addView(chatScroll, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));
        chatNotice = new LinearLayout(this);
        chatNotice.setVisibility(View.GONE);
        TextView nt = txt(L("لقد حظرت هذا المستخدم. ألغِ الحظر لإرسال الرسائل.", "You blocked this user. Unblock to send messages."), 0xFF94A3B8, 14, true);
        nt.setGravity(Gravity.CENTER); nt.setPadding(dp(12), dp(12), dp(12), dp(12));
        chatNotice.addView(nt, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        root.addView(chatNotice);
        LinearLayout bar = new LinearLayout(this);
        bar.setGravity(Gravity.CENTER_VERTICAL);
        bar.setPadding(dp(12), dp(10), dp(12), navH() + dp(6));
        chatInput = new EditText(this);
        chatInput.setHint(L("رسالة", "Message"));
        chatInput.setHintTextColor(0xFF7A7F9A);
        chatInput.setTextColor(Color.WHITE);
        chatInput.setTextSize(15);
        chatInput.setMaxLines(4);
        chatInput.setBackground(rbg(0x12FFFFFF, 0x1AFFFFFF, 30));
        chatInput.setPadding(dp(16), dp(10), dp(16), dp(10));
        bar.addView(chatInput, lpw(1f));
        TextView send = txt("➤", Color.WHITE, 18, false);
        send.setGravity(Gravity.CENTER);
        send.setBackground(oval(0xFF1D9BF0, 0));
        send.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { chatSend(); } });
        LinearLayout.LayoutParams sl = new LinearLayout.LayoutParams(dp(44), dp(44));
        sl.setMargins(dp(8), 0, 0, 0);
        bar.addView(send, sl);
        chatInputBar = bar;
        root.addView(bar);
        chatDlg.setContentView(root);
        chatDlg.setOnDismissListener(new DialogInterface.OnDismissListener() {
            @Override public void onDismiss(DialogInterface di) { chatDlg = null; chatUid = null; timerH.removeCallbacks(chatTick); loadDmList(); updateMsgBadge(); }
        });
        chatDlg.show();
        pool.execute(new Runnable() {
            @Override public void run() {
                List<String> one = new ArrayList<String>(); one.add(other);
                loadProfiles(one);
                runOnUiThread(new Runnable() {
                    @Override public void run() {
                        if (chatDlg == null) return;
                        String[] p = profCache.get(other);
                        View av = lbAvatar(dmAvatarUrl(p == null ? "" : p[0], p == null ? "" : p[1]), initial(dmNameOf(other)), 38, 0x00000000, false, 1);
                        LinearLayout.LayoutParams al = new LinearLayout.LayoutParams(dp(38), dp(38));
                        al.setMargins(dp(10), 0, dp(10), 0);
                        View nm = dmNameView(other, 16, Color.WHITE);
                        View.OnClickListener op = new View.OnClickListener() { @Override public void onClick(View v) { openProfile(other); } };
                        av.setOnClickListener(op); nm.setOnClickListener(op);
                        head.addView(av, al);
                        head.addView(nm, lpw(1f));
                        TextView more = txt("⋮", Color.WHITE, 22, true);
                        more.setGravity(Gravity.CENTER);
                        more.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { chatMenu(other); } });
                        head.addView(more, new LinearLayout.LayoutParams(dp(38), dp(38)));
                        chatRefresh(true);
                    }
                });
            }
        });
        timerH.removeCallbacks(chatTick);
        timerH.postDelayed(chatTick, 3000);
    }

    protected final Runnable chatTick = new Runnable() {
        @Override public void run() { if (chatDlg == null) return; chatRefresh(false); timerH.postDelayed(this, 3000); }
    };

    protected void closeChat(boolean dismiss) {
        timerH.removeCallbacks(chatTick);
        if (chatDlg != null) { Dialog d = chatDlg; chatDlg = null; try { d.dismiss(); } catch (Exception ignore) {} }
        chatUid = null;
    }

    protected void chatMenu(final String other) {
        final boolean blocked = blockedByMe.contains(other);
        List<SheetItem> it = new ArrayList<SheetItem>();
        it.add(new SheetItem("👤", L("عرض الملف الشخصي", "View profile"), false, new Runnable() { @Override public void run() { openProfile(other); } }));
        it.add(new SheetItem("🚫", blocked ? L("إلغاء الحظر", "Unblock") : L("حظر", "Block"), !blocked, new Runnable() {
            @Override public void run() {
                if (!blocked) {
                    new AlertDialog.Builder(Messages.this).setMessage(L("حظر هذا المستخدم؟ لن يستطيع مراسلتك ولن تستطيع مراسلته.", "Block this user?"))
                        .setPositiveButton(L("حظر", "Block"), new DialogInterface.OnClickListener() { @Override public void onClick(DialogInterface d, int w) { chatBlock(other, true); } })
                        .setNegativeButton(L("إلغاء", "Cancel"), null).show();
                } else chatBlock(other, false);
            }
        }));
        dmSheet(dmNameOf(other), it);
    }

    protected void chatBlock(final String other, final boolean block) {
        pool.execute(new Runnable() {
            @Override public void run() {
                String err = null;
                try {
                    if (block) {
                        try { send("POST", "user_blocks", new JSONArray().put(new JSONObject().put("user_id", uid).put("blocked_id", other)).toString()); }
                        catch (Exception e) { if (String.valueOf(e.getMessage()).indexOf("23505") < 0) throw e; }
                        try { send("DELETE", "user_follows?follower_id=eq." + uid + "&following_id=eq." + other, null); } catch (Exception ignore) {}
                        blockedByMe.add(other);
                    } else {
                        send("DELETE", "user_blocks?user_id=eq." + uid + "&blocked_id=eq." + other, null);
                        blockedByMe.remove(other);
                    }
                } catch (Exception e) { err = String.valueOf(e.getMessage()); }
                final String fe = err;
                runOnUiThread(new Runnable() { @Override public void run() { if (fe != null) toast(fe); chatApplyBlock(); } });
            }
        });
    }

    protected void chatApplyBlock() {
        if (chatUid == null || chatNotice == null) return;
        boolean b = blockedByMe.contains(chatUid);
        chatNotice.setVisibility(b ? View.VISIBLE : View.GONE);
        chatInputBar.setVisibility(b ? View.GONE : View.VISIBLE);
    }

    protected void chatRefresh(final boolean first) {
        final String other = chatUid;
        if (other == null) return;
        pool.execute(new Runnable() {
            @Override public void run() {
                try {
                    if (first) {
                        JSONArray b = new JSONArray(get("user_blocks?select=blocked_id&user_id=eq." + uid));
                        Set<String> bl = new HashSet<String>();
                        for (int i = 0; i < b.length(); i++) bl.add(b.getJSONObject(i).optString("blocked_id"));
                        blockedByMe = bl;
                        runOnUiThread(new Runnable() { @Override public void run() { chatApplyBlock(); } });
                    }
                    JSONArray a = new JSONArray(get("dm_messages?select=*&or=(and(sender_id.eq." + uid + ",receiver_id.eq." + other + "),and(sender_id.eq." + other + ",receiver_id.eq." + uid + "))&order=created_at.asc&limit=300"));
                    JSONObject pr = dmPrefs.get(other);
                    long del = pr != null && !pr.isNull("deleted_at") ? isoMs(pr.optString("deleted_at")) : 0;
                    final List<JSONObject> msgs = new ArrayList<JSONObject>();
                    StringBuilder sig = new StringBuilder();
                    boolean unreadIn = false;
                    for (int i = 0; i < a.length(); i++) {
                        JSONObject x = a.getJSONObject(i);
                        if (del > 0 && isoMs(x.optString("created_at")) <= del) continue;
                        msgs.add(x);
                        sig.append(x.optLong("id")).append(':').append(x.isNull("read_at") ? 0 : 1).append(',');
                        if (uid.equals(x.optString("receiver_id")) && x.isNull("read_at")) unreadIn = true;
                    }
                    final String fsig = sig.toString();
                    runOnUiThread(new Runnable() {
                        @Override public void run() {
                            if (chatDlg == null || !other.equals(chatUid)) return;
                            if (first || !fsig.equals(chatSig)) { chatSig = fsig; chatMsgs = msgs; chatRender(); }
                        }
                    });
                    if (unreadIn) {
                        send("PATCH", "dm_messages?receiver_id=eq." + uid + "&sender_id=eq." + other + "&read_at=is.null", new JSONObject().put("read_at", nowIso()).toString());
                        runOnUiThread(new Runnable() { @Override public void run() { updateMsgBadge(); } });
                    }
                    if (first && pr != null && pr.optBoolean("unread_mark")) runOnUiThread(new Runnable() { @Override public void run() { setPref(other, jo("unread_mark", false)); } });
                } catch (Exception ignore) {}
            }
        });
    }

    protected void chatRender() {
        if (chatMsgsBox == null) return;
        boolean near = chatScroll.getChildAt(0).getHeight() - chatScroll.getScrollY() - chatScroll.getHeight() < dp(120);
        chatMsgsBox.removeAllViews();
        JSONObject lastMine = null;
        for (int i = chatMsgs.size() - 1; i >= 0; i--) if (uid.equals(chatMsgs.get(i).optString("sender_id"))) { lastMine = chatMsgs.get(i); break; }
        // دمج الرسائل مع الفاشلة بالترتيب الزمني
        List<Object[]> all = new ArrayList<Object[]>();   // {time, msg, failed}
        for (JSONObject m : chatMsgs) all.add(new Object[] { isoMs(m.optString("created_at")), m, null });
        for (Object[] f : chatFailed) all.add(new Object[] { f[1], null, f });
        java.util.Collections.sort(all, new java.util.Comparator<Object[]>() {
            @Override public int compare(Object[] x, Object[] y) { return Long.valueOf((Long) x[0]).compareTo((Long) y[0]); }
        });
        if (all.isEmpty()) chatMsgsBox.addView(uEmpty(L("ابدأ المحادثة", "Say hi 👋")));
        int maxW = (int) (getResources().getDisplayMetrics().widthPixels * 0.78f);
        for (Object[] it : all) {
            boolean failed = it[2] != null;
            JSONObject x = (JSONObject) it[1];
            boolean mine = failed || uid.equals(x.optString("sender_id"));
            String text = failed ? (String) ((Object[]) it[2])[0] : x.optString("content");
            long t = failed ? (Long) ((Object[]) it[2])[1] : isoMs(x.optString("created_at"));
            LinearLayout b = new LinearLayout(this);
            b.setOrientation(LinearLayout.VERTICAL);
            b.setPadding(dp(13), dp(9), dp(13), dp(6));
            GradientDrawable g = new GradientDrawable();
            g.setColor(mine ? 0xFF1D9BF0 : 0xFF2A2D3D);
            float r = dp(18), s = dp(4);
            g.setCornerRadii(mine ? new float[] { r, r, r, r, s, s, r, r } : new float[] { r, r, r, r, r, r, s, s });
            b.setBackground(g);
            if (failed) b.setAlpha(0.75f);
            TextView c = txt(text, Color.WHITE, 15, false);
            c.setMaxWidth(maxW);
            c.setTextDirection(View.TEXT_DIRECTION_FIRST_STRONG);
            b.addView(c);
            TextView tm = txt(fmtTime(t), 0xA6FFFFFF, 10, false);
            tm.setGravity(Gravity.END);
            b.addView(tm);
            LinearLayout.LayoutParams bl = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            bl.gravity = mine ? Gravity.END : Gravity.START;
            bl.setMargins(0, dp(3), 0, dp(3));
            chatMsgsBox.addView(b, bl);
            if (failed) {
                TextView er = txt("⚠️ " + L("لا يمكن إرسال الرسائل لهذا الشخص", "Messages cannot be sent to this person"), 0xFFFF5D5D, 12, true);
                LinearLayout.LayoutParams el = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
                el.gravity = Gravity.END;
                chatMsgsBox.addView(er, el);
            } else if (mine && lastMine != null && lastMine.optLong("id") == x.optLong("id") && !x.isNull("read_at")) {
                TextView se = txt(L("تمت المشاهدة", "Seen"), 0xFF7A7F9A, 11, false);
                LinearLayout.LayoutParams el = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
                el.gravity = Gravity.END;
                chatMsgsBox.addView(se, el);
            }
        }
        if (near || chatMsgsBox.getTag() == null) {
            chatMsgsBox.setTag("init");
            chatScroll.post(new Runnable() { @Override public void run() { chatScroll.fullScroll(View.FOCUS_DOWN); } });
        }
    }

    protected void chatSend() {
        final String other = chatUid;
        if (other == null || chatInput == null) return;
        final String text = chatInput.getText().toString().trim();
        if (text.length() == 0 || blockedByMe.contains(other)) return;
        chatInput.setText("");
        pool.execute(new Runnable() {
            @Override public void run() {
                String err = null;
                boolean theyBlocked = false;
                try {
                    JSONArray bl = new JSONArray(get("user_blocks?select=blocked_id&user_id=eq." + other + "&blocked_id=eq." + uid + "&limit=1"));
                    if (bl.length() > 0) theyBlocked = true;
                    else send("POST", "dm_messages", new JSONArray().put(new JSONObject().put("sender_id", uid).put("receiver_id", other).put("content", text)).toString());
                } catch (Exception e) { err = String.valueOf(e.getMessage()); }
                final String fe = err;
                final boolean fb = theyBlocked;
                runOnUiThread(new Runnable() {
                    @Override public void run() {
                        if (fb) { toast(L("لا يمكنك مراسلة هذا المستخدم.", "You cannot message this user.")); return; }
                        if (fe != null) {
                            if (fe.matches("(?is).*(row-level security|violates).*")) { chatFailed.add(new Object[] { text, System.currentTimeMillis() }); chatRender(); }
                            else { toast(fe); if (chatInput != null) chatInput.setText(text); }
                            return;
                        }
                        chatRefresh(false);
                    }
                });
            }
        });
    }
}
