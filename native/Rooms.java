package PKG;

import android.media.MediaPlayer;
import android.media.MediaRecorder;
import android.os.Handler;
import android.text.Editable;
import android.text.InputFilter;
import android.text.InputType;
import android.text.TextWatcher;
import android.widget.ProgressBar;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.pm.PackageManager;
import java.io.File;
import java.io.FileInputStream;
import java.net.URLEncoder;
import java.util.LinkedHashMap;
import java.util.Collections;
import java.util.Comparator;
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


// ============================================================
// Rooms.java — محوَّل من rooms.js (غرف الدردشة: مباريات / أندية / مخصّصة)
// الغرف الفورية Realtime صارت استطلاعاً كل 3 ثوانٍ، وPresence صار عدد الأعضاء.
// لوحة الاقتراحات الجانبية وتبويب مركز الغرف كانا معطَّلين في الويب (أُلغيا) فلم يُحوَّلا.
// ============================================================
abstract class Rooms extends Settings {
    protected static final int RM_OPEN_BEFORE = 60, RM_CLOSE_AFTER = 300, RM_MAX_LEN = 500, RM_GAP = 2000, RM_PAGE = 60, RM_MAX_DOM = 200, RM_MAX_VOICE = 60, RM_MIN_VOICE = 700;
    protected static final String RM_COLS = "id,name,code,owner_id,emoji,expires_at,is_public,requires_code,match_id";
    protected static final String RM_MSG = "id,user_id,username,body,created_at,kind,audio_path,audio_ms,expires_at";
    protected static final String[] RM_ICONS = { "ball", "trophy", "fire", "headphones", "chat", "shield" };
    protected static final String[] RM_ICON_EMO = { "⚽", "🏆", "🔥", "🎧", "💬", "🛡️" };
    protected static final String[] RM_QUICK = { "😀", "😂", "🤣", "😍", "😎", "🤔", "😮", "😢", "😡", "👏", "🙏", "👍", "🔥", "❤️", "⚽", "🥅", "🏆", "🎉", "💪", "🐐" };

    protected interface RmTask { void run() throws Exception; }
    protected interface RmStr { void on(String s); }
    protected interface RmPick { void on(String name, String emoji, boolean pub); }

    // ---------- حالة الغرفة الحالية ----------
    protected final Handler rmH = new Handler();
    protected Dialog rmDlg, rmHub;
    protected String rmRoomId;
    protected JSONObject rmCustom, rmMatchCtx;
    protected String rmTitleTxt = "";
    protected LinearLayout rmList, rmHubMine, rmHubPub, rmBarNormal, rmBarRec, rmQuickBar, rmAiBar;
    protected ScrollView rmScroll;
    protected EditText rmInput, rmAiInput;
    protected TextView rmSubTv, rmCountTv, rmRecTime, rmSendBtn;
    protected final LinkedHashMap<Long, View> rmViews = new LinkedHashMap<Long, View>();
    protected final Map<Long, JSONObject> rmData = new HashMap<Long, JSONObject>();
    protected final Map<Long, TextView> rmExpTv = new HashMap<Long, TextView>();
    protected final Set<String> rmBlocked = new HashSet<String>();
    protected final Map<String, String> rmAv = new HashMap<String, String>();
    protected long rmLastSend = 0, rmLastAi = 0, rmRecStart = 0;
    protected boolean rmAiBusy = false;
    protected MediaPlayer rmPlayer;
    protected String rmPlayPath = "";
    protected TextView rmPlayBtn;
    protected ProgressBar rmPlayBar;
    protected MediaRecorder rmRec;
    protected File rmRecFile;
    protected int rmTickN = 0;

    protected final Runnable rmPoll = new Runnable() {
        @Override public void run() {
            if (rmDlg == null || rmRoomId == null) return;
            final String rid = rmRoomId;
            pool.execute(new Runnable() {
                @Override public void run() {
                    try {
                        final JSONArray a = new JSONArray(get("room_messages?select=" + RM_MSG + "&room_id=eq." + rmEnc(rid) + "&order=id.desc&limit=" + RM_PAGE));
                        runOnUiThread(new Runnable() { @Override public void run() { if (rmDlg != null && rid.equals(rmRoomId)) rmApply(a, false); } });
                    } catch (Exception ignore) {}
                }
            });
            rmH.postDelayed(this, 3000);
        }
    };
    protected final Runnable rmTick = new Runnable() {
        @Override public void run() {
            if (rmDlg == null) return;
            rmTickN++;
            rmExpireTick();
            rmH.postDelayed(this, 30000);
        }
    };
    protected final Runnable rmProg = new Runnable() {
        @Override public void run() {
            try {
                if (rmPlayer != null && rmPlayBar != null && rmPlayer.isPlaying()) {
                    int d = Math.max(1, rmPlayer.getDuration());
                    rmPlayBar.setProgress(Math.min(1000, rmPlayer.getCurrentPosition() * 1000 / d));
                    rmH.postDelayed(this, 200);
                }
            } catch (Exception ignore) {}
        }
    };
    protected final Runnable rmRecTick = new Runnable() {
        @Override public void run() {
            if (rmRec == null) return;
            long ms = System.currentTimeMillis() - rmRecStart;
            if (rmRecTime != null) rmRecTime.setText(rmDur(ms));
            if (ms >= RM_MAX_VOICE * 1000L) { rmFinishRec(true); return; }
            rmH.postDelayed(this, 250);
        }
    };

    // ---------- أدوات صغيرة ----------
    protected String rmEnc(String s) { try { return URLEncoder.encode(s, "UTF-8"); } catch (Exception e) { return s; } }
    protected String rmEmoji(String v) {
        if (v == null || v.length() == 0 || v.equals("null")) return "💬";
        if (v.startsWith("icon:")) {
            String n = v.substring(5);
            for (int i = 0; i < RM_ICONS.length; i++) if (RM_ICONS[i].equals(n)) return RM_ICON_EMO[i];
            return "💬";
        }
        return v;
    }
    protected String rmDur(long ms) {
        long s = Math.max(0, Math.round(ms / 1000.0));
        return (s / 60) + ":" + (s % 60 < 10 ? "0" : "") + (s % 60);
    }
    protected String rmExpLabel(String iso) {
        if (iso == null || iso.length() == 0 || iso.equals("null")) return "";
        long ms = isoMs(iso) - System.currentTimeMillis();
        if (ms <= 0) return "";
        long tot = (ms + 59999) / 60000, h = tot / 60, m = tot % 60;
        String t = h > 0 ? (isAr() ? h + "س " + m + "د" : h + "h " + m + "m") : (isAr() ? m + "د" : m + "m");
        return L("⏳ تُحذف خلال " + t, "⏳ Deleted in " + t);
    }
    protected String rmState(String iso) {
        long t = isoMs(iso);
        if (t <= 0) return "ended";
        long now = System.currentTimeMillis();
        if (now < t - RM_OPEN_BEFORE * 60000L) return "soon";
        if (now > t + RM_CLOSE_AFTER * 60000L) return "ended";
        return "open";
    }
    protected String rmErr(Exception e) {
        String m = String.valueOf(e == null ? "" : e.getMessage());
        String[][] map = {
            { "wrong_code", L("الرمز غير صحيح", "Wrong code") },
            { "banned", L("تم حظرك من هذه الغرفة", "You are banned from this room") },
            { "room_expired", L("انتهت مدة هذه الغرفة", "This room has expired") },
            { "room_not_yet", L("لم يحن وقت إنشاء الغرفة بعد", "It is too early to create a room") },
            { "room_limit_public", L("لديك غرفة عامة نشطة بالفعل. انتظر انتهاءها", "You already have an active public room. Wait until it ends") },
            { "room_limit_private", L("لديك غرفة خاصة نشطة بالفعل. انتظر انتهاءها", "You already have an active private room. Wait until it ends") },
            { "links_not_allowed", L("الروابط ممنوعة داخل الغرف", "Links are not allowed in rooms") },
            { "room_limit", L("وصلت للحد الأقصى: 5 غرف", "You reached the limit: 5 rooms") },
            { "bad_name", L("اسم الغرفة يجب أن يكون بين 2 و40 حرفاً", "Room name must be 2–40 characters") },
            { "room_not_found", L("لا توجد غرفة بهذا الرمز", "No room with this code") },
            { "room_full", L("الغرفة ممتلئة", "The room is full") },
            { "user_not_found", L("المستخدم غير موجود", "User not found") },
            { "not_member", L("لست عضواً في هذه الغرفة", "You are not a member of this room") },
            { "slow_down", L("مهلاً، أرسل ببطء قليلاً", "Slow down a little") },
            { "room_closed", L("هذه الغرفة مغلقة حالياً", "This room is closed right now") },
            { "premium_required", L("الرسائل الصوتية للمشتركين فقط", "Voice messages are for subscribers only") },
            { "bad_voice", L("تعذر إرسال الرسالة الصوتية", "Could not send the voice message") }
        };
        for (String[] kv : map) if (m.contains(kv[0])) return kv[1];
        return L("تعذر تنفيذ الإجراء", "Action failed");
    }
    // تنفيذ في الخلفية؛ أي خطأ يظهر كرسالة مفهومة
    protected void rmAsync(final RmTask t) {
        pool.execute(new Runnable() {
            @Override public void run() {
                try { t.run(); }
                catch (final Exception e) { runOnUiThread(new Runnable() { @Override public void run() { toast(rmErr(e)); } }); }
            }
        });
    }
    protected void rmUi(Runnable r) { runOnUiThread(r); }
    protected JSONObject rmRow(String s) {
        try {
            s = s == null ? "" : s.trim();
            if (s.startsWith("[")) { JSONArray a = new JSONArray(s); return a.length() > 0 ? a.getJSONObject(0) : null; }
            if (s.startsWith("{")) return new JSONObject(s);
        } catch (Exception ignore) {}
        return null;
    }
    // POST ويعيد الصف المُدرَج
    protected String rmInsert(String table, String body) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(url + "/rest/v1/" + table).openConnection();
        c.setRequestMethod("POST");
        c.setRequestProperty("apikey", key);
        c.setRequestProperty("Authorization", "Bearer " + token);
        c.setRequestProperty("Content-Type", "application/json");
        c.setRequestProperty("Prefer", "return=representation");
        c.setConnectTimeout(15000);
        c.setReadTimeout(20000);
        c.setDoOutput(true);
        c.getOutputStream().write(body.getBytes("UTF-8"));
        int code = c.getResponseCode();
        BufferedReader r = new BufferedReader(new InputStreamReader(code >= 400 ? c.getErrorStream() : c.getInputStream(), "UTF-8"));
        StringBuilder sb = new StringBuilder();
        String ln;
        while ((ln = r.readLine()) != null) sb.append(ln);
        r.close();
        if (code >= 400) { banCheck(sb.toString()); throw new Exception(sb.length() > 0 ? sb.toString() : ("HTTP " + code)); }
        return sb.toString();
    }
    protected boolean rmIsOwner() { return rmCustom != null && uid != null && uid.equals(rmCustom.optString("owner_id")); }

    // ---------- نوافذ صغيرة ----------
    protected AlertDialog.Builder rmBuilder() { return new AlertDialog.Builder(this, android.R.style.Theme_Material_Dialog_Alert); }

    protected void rmAsk(String title, String hint, String okLabel, int max, boolean upper, final RmStr cb) {
        final EditText e = new EditText(this);
        e.setHint(hint);
        e.setSingleLine(true);
        e.setTextColor(Color.WHITE);
        e.setHintTextColor(0xFF7A7F9A);
        e.setFilters(new InputFilter[] { new InputFilter.LengthFilter(max) });
        if (upper) { e.setAllCaps(true); e.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_CHARACTERS); e.setGravity(Gravity.CENTER); }
        LinearLayout w = new LinearLayout(this);
        w.setPadding(dp(20), dp(8), dp(20), 0);
        w.addView(e, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        final AlertDialog d = rmBuilder().setTitle(title).setView(w)
            .setPositiveButton(okLabel, new DialogInterface.OnClickListener() { @Override public void onClick(DialogInterface di, int i) { String s = e.getText().toString().trim(); if (s.length() > 0) cb.on(s); } })
            .setNegativeButton(L("إلغاء", "Cancel"), null).create();
        d.show();
    }

    protected void rmConfirm(String text, String okLabel, final Runnable yes) {
        rmBuilder().setMessage(text)
            .setPositiveButton(okLabel, new DialogInterface.OnClickListener() { @Override public void onClick(DialogInterface di, int i) { yes.run(); } })
            .setNegativeButton(L("إلغاء", "Cancel"), null).show();
    }

    // قائمة إجراءات سفلية
    protected void rmSheet(String[] labels, boolean[] danger, final Runnable[] runs) {
        final Dialog d = sheetDialog(false);
        lbDirection(d);
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setPadding(dp(14), dp(14), dp(14), navH() + dp(8));
        box.setBackground(rbg(0xFF1C1C22, 0x40F5C35A, 20));
        for (int i = 0; i < labels.length; i++) {
            final int idx = i;
            TextView b = txt(labels[i], danger[i] ? 0xFFFF6B6B : Color.WHITE, 15, true);
            b.setGravity(Gravity.CENTER);
            b.setPadding(dp(12), dp(14), dp(12), dp(14));
            b.setBackground(rbg(0x12FFFFFF, 0x1AFFFFFF, 14));
            b.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { d.dismiss(); if (runs[idx] != null) runs[idx].run(); } });
            box.addView(b, lpm(0, 0, 0, 8));
        }
        TextView cancel = txt(L("إلغاء", "Cancel"), Color.WHITE, 15, true);
        cancel.setGravity(Gravity.CENTER);
        cancel.setPadding(dp(12), dp(14), dp(12), dp(14));
        cancel.setBackground(rbg(0x12FFFFFF, 0x1AFFFFFF, 14));
        cancel.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { d.dismiss(); } });
        box.addView(cancel, lpm(0, 0, 0, 0));
        d.setContentView(box);
        d.show();
    }

    protected void rmCopy(String text) {
        try { ((ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE)).setPrimaryClip(ClipData.newPlainText("zelo", text)); } catch (Exception ignore) {}
        toast(L("تم النسخ ✅", "Copied ✅"));
    }

    // نافذة إنشاء غرفة: أيقونة + اسم + عامة/خاصة
    protected void rmAskRoom(String preName, boolean lockName, final RmPick cb) {
        final String[] icon = { RM_ICONS[0] };
        final boolean[] pub = { true };
        final LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setPadding(dp(18), dp(8), dp(18), 0);
        box.addView(txt(L("أيقونة الغرفة", "Room icon"), MUTED, 12, true));
        final LinearLayout icons = new LinearLayout(this);
        final TextView[] ib = new TextView[RM_ICONS.length];
        for (int i = 0; i < RM_ICONS.length; i++) {
            final int k = i;
            TextView t = txt(RM_ICON_EMO[i], Color.WHITE, 22, false);
            t.setGravity(Gravity.CENTER);
            t.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) {
                icon[0] = RM_ICONS[k];
                for (int j = 0; j < ib.length; j++) ib[j].setBackground(rbg(j == k ? 0x26F5C35A : 0x12FFFFFF, j == k ? GOLD : 0x1AFFFFFF, 12));
            } });
            ib[i] = t;
            icons.addView(t, new LinearLayout.LayoutParams(0, dp(46), 1f));
            ((LinearLayout.LayoutParams) t.getLayoutParams()).setMargins(dp(2), dp(6), dp(2), dp(6));
        }
        ib[0].setBackground(rbg(0x26F5C35A, GOLD, 12));
        for (int j = 1; j < ib.length; j++) ib[j].setBackground(rbg(0x12FFFFFF, 0x1AFFFFFF, 12));
        box.addView(icons);
        final EditText name = new EditText(this);
        name.setHint(L("اسم الغرفة", "Room name"));
        name.setText(preName == null ? "" : preName);
        name.setSingleLine(true);
        name.setTextColor(Color.WHITE);
        name.setHintTextColor(0xFF7A7F9A);
        name.setFilters(new InputFilter[] { new InputFilter.LengthFilter(40) });
        if (lockName) name.setEnabled(false);
        box.addView(name);
        box.addView(txt(L("نوع الغرفة", "Room type"), MUTED, 12, true), lpm(0, 10, 0, 6));
        LinearLayout seg = new LinearLayout(this);
        final TextView pb = txt("🌐 " + L("عامة (مفتوحة)", "Public (open)"), Color.WHITE, 13, true);
        final TextView vb = txt("🔒 " + L("خاصة (برمز)", "Private (code)"), Color.WHITE, 13, true);
        pb.setGravity(Gravity.CENTER); vb.setGravity(Gravity.CENTER);
        pb.setPadding(dp(6), dp(10), dp(6), dp(10)); vb.setPadding(dp(6), dp(10), dp(6), dp(10));
        seg.addView(pb, lpw(1f)); seg.addView(vb, lpw(1f));
        box.addView(seg);
        final TextView hint = txt("", MUTED, 12, false);
        hint.setPadding(0, dp(8), 0, 0);
        box.addView(hint);
        TextView ttl = txt("⏱ " + L("تُحذف الغرفة تلقائياً بعد 6 ساعات من إنشائها", "The room is deleted automatically 6 hours after it is created"), MUTED, 12, false);
        ttl.setPadding(0, dp(6), 0, 0);
        box.addView(ttl);
        final Runnable draw = new Runnable() { @Override public void run() {
            pb.setBackground(rbg(pub[0] ? 0x33FFFFFF : 0x00000000, pub[0] ? GOLD : 0x1AFFFFFF, 11));
            vb.setBackground(rbg(!pub[0] ? 0x33FFFFFF : 0x00000000, !pub[0] ? GOLD : 0x1AFFFFFF, 11));
            hint.setText(pub[0] ? L("مفتوحة: تظهر للجميع ويدخلها أي شخص مباشرة بدون رمز", "Open: listed for everyone, anyone can join with no code")
                                : L("مقفلة: لا تظهر في القائمة، ويُطلب رمز الغرفة للدخول", "Locked: not listed, a code is required to join"));
        } };
        pb.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { pub[0] = true; draw.run(); } });
        vb.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { pub[0] = false; draw.run(); } });
        draw.run();
        ScrollView sv = new ScrollView(this);
        sv.addView(box);
        rmBuilder().setTitle(L("إنشاء غرفة", "Create a room")).setView(sv)
            .setPositiveButton(L("إنشاء", "Create"), new DialogInterface.OnClickListener() { @Override public void onClick(DialogInterface di, int i) {
                String n = name.getText().toString().trim();
                if (n.length() == 0) return;
                cb.on(n, "icon:" + icon[0], pub[0]);
            } })
            .setNegativeButton(L("إلغاء", "Cancel"), null).show();
    }

    // ---------- الصور (من public_profiles) ----------
    protected void rmFillAv(final FrameLayout holder, final String u, final String name) {
        final String init = initial(name);
        holder.removeAllViews();
        holder.addView(lbAvatar("", init, 34, 0x00000000, false, 1));
        if (rmAv.containsKey(u)) {
            String url0 = rmAv.get(u);
            if (url0.length() > 0) { holder.removeAllViews(); holder.addView(lbAvatar(url0, init, 34, 0x00000000, false, 1)); }
            return;
        }
        pool.execute(new Runnable() {
            @Override public void run() {
                String found = "";
                try {
                    JSONArray a = new JSONArray(get("public_profiles?select=avatar_url&user_id=eq." + rmEnc(u)));
                    if (a.length() > 0 && !a.getJSONObject(0).isNull("avatar_url")) found = a.getJSONObject(0).optString("avatar_url");
                } catch (Exception ignore) {}
                final String fu = found;
                rmAv.put(u, fu);
                if (fu.length() == 0) return;
                runOnUiThread(new Runnable() { @Override public void run() { holder.removeAllViews(); holder.addView(lbAvatar(fu, init, 34, 0x00000000, false, 1)); } });
            }
        });
    }

    // ---------- عرض الرسائل ----------
    protected View rmMsgView(final JSONObject m) {
        final long id = m.optLong("id");
        final String muid = m.optString("user_id");
        final boolean mine = muid.equals(uid);
        String nm = m.optString("username", "");
        final String name = nm.length() == 0 || nm.equals("null") ? "fan" : nm;
        final boolean voice = "voice".equals(m.optString("kind")) && m.optString("audio_path").length() > 0 && !m.optString("audio_path").equals("null");
        LinearLayout row = new LinearLayout(this);
        row.setLayoutDirection(View.LAYOUT_DIRECTION_LTR);
        row.setGravity(mine ? Gravity.END : Gravity.START);
        row.setPadding(0, 0, 0, dp(10));
        FrameLayout av = new FrameLayout(this);
        rmFillAv(av, muid, name);
        LinearLayout bub = new LinearLayout(this);
        bub.setOrientation(LinearLayout.VERTICAL);
        bub.setPadding(dp(12), dp(8), dp(12), dp(8));
        bub.setBackground(rbg(mine ? 0x403B5BD9 : 0xF21C1C28, mine ? 0x664A6CFF : 0x14FFFFFF, 16));
        bub.setMinimumWidth(dp(150));
        LinearLayout meta = new LinearLayout(this);
        meta.setGravity(Gravity.CENTER_VERTICAL);
        TextView un = txt("@" + name, 0xFFFFD98A, 12, true);
        un.setOnLongClickListener(new View.OnLongClickListener() { @Override public boolean onLongClick(View v) {
            if (rmIsOwner() && !muid.equals(uid)) rmKickSheet(muid, name);
            return true;
        } });
        meta.addView(un);
        TextView tm = txt(fmtTime(isoMs(m.optString("created_at"))), MUTED, 11, true);
        tm.setPadding(dp(8), 0, 0, 0);
        meta.addView(tm);
        View sp = new View(this);
        meta.addView(sp, new LinearLayout.LayoutParams(0, 1, 1f));
        TextView more = txt("⋮", 0xFF94A3B8, 17, true);
        more.setPadding(dp(10), 0, 0, 0);
        more.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { rmMsgMenu(id, muid); } });
        meta.addView(more);
        bub.addView(meta);
        if (voice) {
            final String path = m.optString("audio_path");
            final long ms = m.optLong("audio_ms", 0);
            LinearLayout vr = new LinearLayout(this);
            vr.setGravity(Gravity.CENTER_VERTICAL);
            vr.setPadding(0, dp(4), 0, dp(2));
            final TextView play = txt("▶", Color.WHITE, 15, true);
            play.setGravity(Gravity.CENTER);
            play.setBackground(oval(0xFF2C4BB5, 0));
            final ProgressBar pbar = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
            pbar.setMax(1000);
            pbar.setProgress(0);
            play.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { rmPlay(path, ms, play, pbar); } });
            vr.addView(play, new LinearLayout.LayoutParams(dp(38), dp(38)));
            LinearLayout.LayoutParams pl = new LinearLayout.LayoutParams(0, dp(8), 1f);
            pl.setMargins(dp(10), 0, dp(10), 0);
            vr.addView(pbar, pl);
            vr.addView(txt(rmDur(ms), 0xFFB6BDD0, 12, true));
            bub.addView(vr);
            TextView ex = txt(rmExpLabel(m.optString("expires_at")), MUTED, 10, true);
            bub.addView(ex);
            rmExpTv.put(id, ex);
        } else {
            TextView t = txt(m.optString("body"), Color.WHITE, 15, false);
            t.setMaxWidth(getResources().getDisplayMetrics().widthPixels * 62 / 100);
            t.setTextIsSelectable(true);
            bub.addView(t);
        }
        LinearLayout.LayoutParams al = new LinearLayout.LayoutParams(dp(34), dp(34));
        al.setMargins(dp(6), 0, dp(6), 0);
        if (mine) { row.addView(bub); row.addView(av, al); } else { row.addView(av, al); row.addView(bub); }
        return row;
    }

    protected void rmAddMsg(JSONObject m, boolean force) {
        if (m == null || rmList == null) return;
        long id = m.optLong("id");
        if (rmViews.containsKey(id)) return;
        if (rmBlocked.contains(m.optString("user_id"))) return;
        if (!m.isNull("expires_at") && m.optString("expires_at").length() > 0 && isoMs(m.optString("expires_at")) <= System.currentTimeMillis()) return;
        boolean near = rmScroll == null || rmScroll.getChildAt(0) == null
            || (rmScroll.getChildAt(0).getHeight() - rmScroll.getScrollY() - rmScroll.getHeight()) < dp(120);
        View v = rmMsgView(m);
        rmViews.put(id, v);
        rmData.put(id, m);
        rmList.addView(v);
        while (rmViews.size() > RM_MAX_DOM) {
            Long first = rmViews.keySet().iterator().next();
            rmRemove(first);
        }
        if (near || force || m.optString("user_id").equals(uid)) rmScrollEnd();
    }

    protected void rmRemove(Long id) {
        View v = rmViews.remove(id);
        rmData.remove(id);
        rmExpTv.remove(id);
        if (v != null && rmList != null) rmList.removeView(v);
    }

    protected void rmScrollEnd() {
        if (rmScroll == null) return;
        rmScroll.post(new Runnable() { @Override public void run() { if (rmScroll != null) rmScroll.fullScroll(View.FOCUS_DOWN); } });
    }

    // يدمج نتيجة الاستطلاع (الأحدث أولاً): إضافة الجديد وإزالة المحذوف ضمن النافذة
    protected void rmApply(JSONArray desc, boolean first) {
        try {
            List<JSONObject> asc = new ArrayList<JSONObject>();
            Set<Long> got = new HashSet<Long>();
            long minId = 0;
            for (int i = desc.length() - 1; i >= 0; i--) { JSONObject o = desc.getJSONObject(i); asc.add(o); got.add(o.optLong("id")); }
            if (desc.length() >= RM_PAGE && asc.size() > 0) minId = asc.get(0).optLong("id");
            List<Long> gone = new ArrayList<Long>();
            for (Long id : rmViews.keySet()) if (id >= minId && !got.contains(id) && id > 0) gone.add(id);
            for (Long id : gone) rmRemove(id);
            for (JSONObject o : asc) rmAddMsg(o, first);
            if (first) rmScrollEnd();
            if (rmCustom == null) {
                Set<String> users = new HashSet<String>();
                for (JSONObject o : rmData.values()) users.add(o.optString("user_id"));
                if (rmCountTv != null) rmCountTv.setText("👥 " + Math.max(1, users.size()));
            }
        } catch (Exception ignore) {}
    }

    // كل 30 ثانية: إزالة الرسائل الصوتية المنتهية، وتحديث عدّاد الغرفة، وفحص حذفها
    protected void rmExpireTick() {
        List<Long> dead = new ArrayList<Long>();
        for (Map.Entry<Long, JSONObject> e : rmData.entrySet()) {
            String ex = e.getValue().optString("expires_at");
            if (e.getValue().isNull("expires_at") || ex.length() == 0) continue;
            long left = isoMs(ex) - System.currentTimeMillis();
            if (left <= 0) dead.add(e.getKey());
            else { TextView t = rmExpTv.get(e.getKey()); if (t != null) t.setText(rmExpLabel(ex)); }
        }
        for (Long id : dead) { if (rmPlayBar != null && rmViews.get(id) != null) rmStopAudio(); rmRemove(id); }
        if (rmCustom == null) return;
        String exp = rmCustom.optString("expires_at");
        if (exp.length() > 0 && !exp.equals("null") && isoMs(exp) <= System.currentTimeMillis()) {
            toast(L("انتهت مدة الغرفة وتم حذفها", "The room time is over and it was deleted"));
            closeRoom();
            return;
        }
        if (rmSubTv != null) rmSubTv.setText((rmIsOwner() ? L("غرفتك", "Your room") : L("عضو في الغرفة", "Member")) + " · " + rmExpLabel(exp));
        final String rid = rmCustom.optString("id");
        pool.execute(new Runnable() {
            @Override public void run() {
                try {
                    JSONArray a = new JSONArray(get("custom_rooms?select=id&id=eq." + rmEnc(rid)));
                    if (a.length() == 0) {
                        runOnUiThread(new Runnable() { @Override public void run() {
                            if (rmCustom != null && rid.equals(rmCustom.optString("id"))) { toast(L("قام المالك بحذف هذه الغرفة", "The owner deleted this room")); closeRoom(); }
                        } });
                        return;
                    }
                } catch (Exception ignore) {}
                try {
                    String cnt = rpc("room_member_counts", new JSONObject().put("p_ids", new JSONArray().put(rid)).toString());
                    JSONArray ca = new JSONArray(cnt);
                    final int n = ca.length() > 0 ? ca.getJSONObject(0).optInt("members", 1) : 1;
                    runOnUiThread(new Runnable() { @Override public void run() { if (rmCountTv != null) rmCountTv.setText("👥 " + Math.max(1, n)); } });
                } catch (Exception ignore) {}
            }
        });
    }

    // ---------- تشغيل الصوت ----------
    protected void rmStopAudio() {
        try { if (rmPlayer != null) { rmPlayer.release(); } } catch (Exception ignore) {}
        rmPlayer = null;
        if (rmPlayBtn != null) rmPlayBtn.setText("▶");
        if (rmPlayBar != null) rmPlayBar.setProgress(0);
        rmPlayBtn = null; rmPlayBar = null; rmPlayPath = "";
        rmH.removeCallbacks(rmProg);
    }

    protected void rmPlay(final String path, long ms, final TextView btn, final ProgressBar bar) {
        if (rmPlayer != null && path.equals(rmPlayPath)) {
            try {
                if (rmPlayer.isPlaying()) { rmPlayer.pause(); btn.setText("▶"); }
                else { rmPlayer.start(); btn.setText("⏸"); rmH.post(rmProg); }
            } catch (Exception ignore) {}
            return;
        }
        rmStopAudio();
        btn.setText("⏳");
        rmPlayBtn = btn; rmPlayBar = bar; rmPlayPath = path;
        pool.execute(new Runnable() {
            @Override public void run() {
                try {
                    HttpURLConnection c = (HttpURLConnection) new URL(url + "/storage/v1/object/sign/room-audio/" + path).openConnection();
                    c.setRequestMethod("POST");
                    c.setRequestProperty("apikey", key);
                    c.setRequestProperty("Authorization", "Bearer " + token);
                    c.setRequestProperty("Content-Type", "application/json");
                    c.setDoOutput(true);
                    c.getOutputStream().write("{\"expiresIn\":600}".getBytes("UTF-8"));
                    int code = c.getResponseCode();
                    BufferedReader r = new BufferedReader(new InputStreamReader(code >= 400 ? c.getErrorStream() : c.getInputStream(), "UTF-8"));
                    StringBuilder sb = new StringBuilder(); String ln;
                    while ((ln = r.readLine()) != null) sb.append(ln);
                    r.close();
                    if (code >= 400) throw new Exception("sign " + code);
                    String sg = new JSONObject(sb.toString()).optString("signedURL");
                    if (sg.length() == 0) throw new Exception("no url");
                    final String full = sg.startsWith("http") ? sg : url + "/storage/v1" + sg;
                    runOnUiThread(new Runnable() { @Override public void run() {
                        if (!path.equals(rmPlayPath)) return;
                        try {
                            final MediaPlayer mp = new MediaPlayer();
                            rmPlayer = mp;
                            mp.setDataSource(full);
                            mp.setOnPreparedListener(new MediaPlayer.OnPreparedListener() { @Override public void onPrepared(MediaPlayer p) { p.start(); btn.setText("⏸"); rmH.post(rmProg); } });
                            mp.setOnCompletionListener(new MediaPlayer.OnCompletionListener() { @Override public void onCompletion(MediaPlayer p) { rmStopAudio(); } });
                            mp.setOnErrorListener(new MediaPlayer.OnErrorListener() { @Override public boolean onError(MediaPlayer p, int w, int e) { toast(L("تعذر تشغيل الصوت", "Could not play audio")); rmStopAudio(); return true; } });
                            mp.prepareAsync();
                        } catch (Exception e) { toast(L("تعذر تشغيل الصوت", "Could not play audio")); rmStopAudio(); }
                    } });
                } catch (Exception e) {
                    runOnUiThread(new Runnable() { @Override public void run() { toast(L("تعذر تشغيل الصوت", "Could not play audio")); rmStopAudio(); } });
                }
            }
        });
    }

    // ---------- تسجيل الصوت وإرساله ----------
    protected void rmStartRec() {
        rmStopAudio();
        if (checkSelfPermission("android.permission.RECORD_AUDIO") != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[] { "android.permission.RECORD_AUDIO" }, 7002);
            return;
        }
        try {
            rmRecFile = new File(getCacheDir(), "rm-rec.m4a");
            if (rmRecFile.exists()) rmRecFile.delete();
            MediaRecorder r = new MediaRecorder();
            r.setAudioSource(MediaRecorder.AudioSource.MIC);
            r.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4);
            r.setAudioEncoder(MediaRecorder.AudioEncoder.AAC);
            r.setAudioSamplingRate(44100);
            r.setAudioEncodingBitRate(64000);
            r.setOutputFile(rmRecFile.getAbsolutePath());
            r.prepare();
            r.start();
            rmRec = r;
            rmRecStart = System.currentTimeMillis();
            if (rmBarNormal != null) rmBarNormal.setVisibility(View.GONE);
            if (rmBarRec != null) rmBarRec.setVisibility(View.VISIBLE);
            if (rmRecTime != null) rmRecTime.setText("0:00");
            rmH.postDelayed(rmRecTick, 250);
        } catch (Exception e) {
            try { if (rmRec != null) rmRec.release(); } catch (Exception ignore) {}
            rmRec = null;
            toast(L("تعذر بدء التسجيل الصوتي", "Could not start recording"));
        }
    }

    @Override public void onRequestPermissionsResult(int code, String[] perms, int[] res) {
        super.onRequestPermissionsResult(code, perms, res);
        if (code == 7002) {
            if (res.length > 0 && res[0] == PackageManager.PERMISSION_GRANTED) rmStartRec();
            else toast(L("اسمح للتطبيق باستخدام الميكروفون", "Allow the app to use the microphone"));
        }
    }

    protected void rmCleanupRec() {
        rmH.removeCallbacks(rmRecTick);
        try { if (rmRec != null) { try { rmRec.stop(); } catch (Exception ignore) {} rmRec.release(); } } catch (Exception ignore) {}
        rmRec = null;
        if (rmBarNormal != null) rmBarNormal.setVisibility(View.VISIBLE);
        if (rmBarRec != null) rmBarRec.setVisibility(View.GONE);
    }

    protected void rmFinishRec(boolean send) {
        if (rmRec == null) return;
        long ms = System.currentTimeMillis() - rmRecStart;
        rmCleanupRec();
        if (!send) { if (rmRecFile != null) rmRecFile.delete(); return; }
        if (ms < RM_MIN_VOICE) { toast(L("التسجيل قصير جداً", "Recording is too short")); return; }
        rmSendVoice(ms);
    }

    protected void rmSendVoice(final long ms) {
        final File f = rmRecFile;
        if (f == null || !f.exists() || rmCustom == null || rmRoomId == null) return;
        long now = System.currentTimeMillis();
        if (now - rmLastSend < RM_GAP) { toast(L("مهلاً، أرسل ببطء قليلاً", "Slow down a little")); return; }
        rmLastSend = now;
        final String rid = rmRoomId;
        final String path = rmCustom.optString("id") + "/" + uid + "/" + System.currentTimeMillis() + ".m4a";
        toast(L("⏳ جاري إرسال الرسالة الصوتية...", "⏳ Sending voice message..."));
        rmAsync(new RmTask() { @Override public void run() throws Exception {
            byte[] bytes = new byte[(int) f.length()];
            FileInputStream in = new FileInputStream(f);
            int off = 0, n;
            while (off < bytes.length && (n = in.read(bytes, off, bytes.length - off)) > 0) off += n;
            in.close();
            HttpURLConnection c = (HttpURLConnection) new URL(url + "/storage/v1/object/room-audio/" + path).openConnection();
            c.setRequestMethod("POST");
            c.setRequestProperty("apikey", key);
            c.setRequestProperty("Authorization", "Bearer " + token);
            c.setRequestProperty("Content-Type", "audio/mp4");
            c.setRequestProperty("x-upsert", "false");
            c.setConnectTimeout(15000);
            c.setReadTimeout(30000);
            c.setDoOutput(true);
            c.getOutputStream().write(bytes);
            int code = c.getResponseCode();
            if (code >= 400) throw new Exception("bad_voice");
            JSONObject b = new JSONObject();
            b.put("room_id", rid); b.put("user_id", uid); b.put("kind", "voice"); b.put("body", "🎤"); b.put("audio_path", path); b.put("audio_ms", ms);
            String out;
            try { out = rmInsert("room_messages", new JSONArray().put(b).toString()); }
            catch (Exception e) {
                try { sendUrl("DELETE", url + "/storage/v1/object/room-audio/" + path, null); } catch (Exception ignore) {}
                throw e;
            }
            final JSONObject row = rmRow(out);
            f.delete();
            if (row != null) runOnUiThread(new Runnable() { @Override public void run() { if (rid.equals(rmRoomId)) rmAddMsg(row, true); } });
        } });
    }

    // ---------- قائمة إجراءات الرسالة ----------
    protected void rmMsgMenu(final long id, final String muid) {
        final boolean mine = muid.equals(uid);
        boolean owner = rmIsOwner();
        List<String> labels = new ArrayList<String>();
        List<Boolean> dg = new ArrayList<Boolean>();
        List<Runnable> runs = new ArrayList<Runnable>();
        if (mine || owner) {
            labels.add(mine ? L("حذف رسالتي", "Delete my message") : L("حذف الرسالة (المالك)", "Delete message (owner)")); dg.add(true);
            runs.add(new Runnable() { @Override public void run() {
                rmAsync(new RmTask() { @Override public void run() throws Exception {
                    send("DELETE", "room_messages?id=eq." + id, null);
                    runOnUiThread(new Runnable() { @Override public void run() { rmRemove(Long.valueOf(id)); } });
                } });
            } });
        }
        if (!mine) {
            labels.add("🚩 " + L("إبلاغ عن الرسالة", "Report message")); dg.add(false);
            runs.add(new Runnable() { @Override public void run() {
                rmAsync(new RmTask() { @Override public void run() throws Exception {
                    try {
                        JSONObject b = new JSONObject();
                        b.put("reporter_id", uid); b.put("message_id", id); b.put("reason", "abuse");
                        send("POST", "room_reports", new JSONArray().put(b).toString());
                    } catch (Exception e) { if (String.valueOf(e.getMessage()).indexOf("duplicate") < 0) throw e; }
                    runOnUiThread(new Runnable() { @Override public void run() { toast(L("تم إرسال البلاغ، شكراً لك", "Report sent, thank you")); } });
                } });
            } });
            labels.add("⛔ " + L("حظر هذا المستخدم", "Block this user")); dg.add(true);
            runs.add(new Runnable() { @Override public void run() {
                rmAsync(new RmTask() { @Override public void run() throws Exception {
                    try {
                        JSONObject b = new JSONObject();
                        b.put("user_id", uid); b.put("blocked_id", muid);
                        send("POST", "user_blocks", new JSONArray().put(b).toString());
                    } catch (Exception e) { if (String.valueOf(e.getMessage()).indexOf("duplicate") < 0) throw e; }
                    runOnUiThread(new Runnable() { @Override public void run() {
                        rmBlocked.add(muid); blockSet.add(muid);
                        rmDropUser(muid);
                        toast(L("تم حظر المستخدم", "User blocked"));
                    } });
                } });
            } });
        }
        if (labels.isEmpty()) return;
        boolean[] d = new boolean[dg.size()];
        for (int i = 0; i < d.length; i++) d[i] = dg.get(i);
        rmSheet(labels.toArray(new String[0]), d, runs.toArray(new Runnable[0]));
    }

    protected void rmDropUser(String muid) {
        List<Long> del = new ArrayList<Long>();
        for (Map.Entry<Long, JSONObject> e : rmData.entrySet()) if (muid.equals(e.getValue().optString("user_id"))) del.add(e.getKey());
        for (Long id : del) rmRemove(id);
    }

    protected void rmKickSheet(final String muid, final String name) {
        rmSheet(new String[] { "🚫 " + L("حظر وطرد", "Ban & kick") }, new boolean[] { true }, new Runnable[] { new Runnable() { @Override public void run() { rmBanKick(muid, name); } } });
    }

    protected void rmBanKick(final String muid, final String name) {
        if (!rmIsOwner()) return;
        final String rid = rmCustom.optString("id");
        rmConfirm(L(name + T(" سيُطرد من الغرفة ولن يستطيع الدخول إليها مرة أخرى. متأكد؟"), name + " will be removed and cannot join this room again. Sure?"), L("حظر وطرد", "Ban & kick"), new Runnable() { @Override public void run() {
            rmAsync(new RmTask() { @Override public void run() throws Exception {
                rpc("ban_room_member", new JSONObject().put("p_room", rid).put("p_user", muid).put("p_actor", uid).toString());
                runOnUiThread(new Runnable() { @Override public void run() {
                    rmBlocked.add(muid);
                    rmDropUser(muid);
                    toast(L("تم حظر " + name + T(" وطرده"), name + " was banned and removed"));
                } });
            } });
        } });
    }

    // ---------- فتح / إغلاق الغرفة ----------
    protected void closeRoom() {
        rmH.removeCallbacks(rmPoll);
        rmH.removeCallbacks(rmTick);
        rmStopAudio();
        if (rmRec != null) { rmCleanupRec(); }
        Dialog d = rmDlg;
        rmDlg = null;
        rmRoomId = null; rmCustom = null; rmMatchCtx = null;
        rmViews.clear(); rmData.clear(); rmExpTv.clear();
        rmList = null; rmScroll = null; rmInput = null; rmSubTv = null; rmCountTv = null; rmBarNormal = null; rmBarRec = null;
        if (d != null) { try { d.dismiss(); } catch (Exception ignore) {} }
        rmHubLoad();
    }

    protected void rmOpen(final String roomId, String title, String sub, JSONObject custom, JSONObject matchCtx) {
        if (uid == null || token == null) { toast(L("سجّل الدخول أولاً", "Please sign in first")); return; }
        if (rmDlg != null) closeRoom();
        rmRoomId = roomId;
        rmCustom = custom;
        rmMatchCtx = matchCtx;
        rmTitleTxt = title;
        rmBlocked.clear();
        rmBlocked.addAll(blockSet);
        final boolean isCustom = custom != null;
        final boolean owner = isCustom && rmIsOwner();
        final Dialog d = sheetDialog(true);
        rmDlg = d;
        d.getWindow().setBackgroundDrawable(new ColorDrawable(NAVY));
        d.getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
        lbDirection(d);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(0, statusH() + dp(6), 0, 0);
        // --- الرأس ---
        LinearLayout head = new LinearLayout(this);
        head.setGravity(Gravity.CENTER_VERTICAL);
        head.setPadding(dp(12), dp(10), dp(12), dp(10));
        head.setBackgroundColor(0xF20A1033);
        head.addView(backBtn(new Runnable() { @Override public void run() { closeRoom(); } }));
        LinearLayout tb = new LinearLayout(this);
        tb.setOrientation(LinearLayout.VERTICAL);
        tb.setPadding(dp(8), 0, dp(8), 0);
        TextView tt = txt(title, Color.WHITE, 16, true);
        tt.setSingleLine(true);
        tt.setEllipsize(android.text.TextUtils.TruncateAt.END);
        tb.addView(tt);
        rmSubTv = txt(sub == null ? "" : sub, GOLD, 12, true);
        tb.addView(rmSubTv);
        head.addView(tb, lpw(1f));
        rmCountTv = txt("👥 1", GOLD, 12, true);
        rmCountTv.setPadding(dp(9), dp(4), dp(9), dp(4));
        rmCountTv.setBackground(rbg(0x1AF5C35A, 0x59F5C35A, 12));
        head.addView(rmCountTv);
        if (isCustom) {
            if (owner) {
                TextView sh = txt("⤴", Color.WHITE, 19, true);
                sh.setGravity(Gravity.CENTER);
                sh.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { if (rmCustom != null) shareRoom(rmCustom); } });
                head.addView(sh, new LinearLayout.LayoutParams(dp(38), dp(38)));
            }
            TextView mn = txt("⋮", Color.WHITE, 22, true);
            mn.setGravity(Gravity.CENTER);
            mn.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { rmRoomMenu(); } });
            head.addView(mn, new LinearLayout.LayoutParams(dp(38), dp(38)));
        }
        root.addView(head);
        View line = new View(this);
        line.setBackgroundColor(0x40F5C35A);
        root.addView(line, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(1)));
        // --- شريط الرمز للمالك ---
        if (owner && custom.optBoolean("requires_code")) {
            LinearLayout cb = new LinearLayout(this);
            cb.setGravity(Gravity.CENTER_VERTICAL);
            cb.setPadding(dp(12), dp(10), dp(12), dp(10));
            cb.setBackground(rbg(0x1AF5C35A, 0x59F5C35A, 16));
            TextView lbl = txt("🔑 " + L("رمز الغرفة", "Room code") + "  ", GOLD, 12, true);
            TextView cd = txt(custom.optString("code"), Color.WHITE, 17, true);
            cd.setLetterSpacing(0.15f);
            LinearLayout lw = new LinearLayout(this);
            lw.setGravity(Gravity.CENTER_VERTICAL);
            lw.addView(lbl); lw.addView(cd);
            cb.addView(lw, lpw(1f));
            TextView cp = txt(L("نسخ", "Copy"), GOLD, 12, true);
            cp.setPadding(dp(12), dp(8), dp(12), dp(8));
            cp.setBackground(rbg(0x1AF5C35A, 0x66F5C35A, 12));
            cp.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { if (rmCustom != null) rmCopy(rmCustom.optString("code")); } });
            cb.addView(cp);
            TextView iv = txt("👥 " + L("دعوة", "Invite"), Color.WHITE, 12, true);
            iv.setPadding(dp(12), dp(8), dp(12), dp(8));
            iv.setBackground(rbg(0x14FFFFFF, 0x24FFFFFF, 12));
            iv.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { rmInvite(); } });
            LinearLayout.LayoutParams il = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            il.setMargins(dp(8), 0, 0, 0);
            cb.addView(iv, il);
            root.addView(cb, lpm(12, 10, 12, 0));
        }
        // --- قائمة الرسائل ---
        rmList = new LinearLayout(this);
        rmList.setOrientation(LinearLayout.VERTICAL);
        rmList.setLayoutDirection(View.LAYOUT_DIRECTION_LTR);
        rmList.setPadding(dp(12), dp(12), dp(12), dp(6));
        TextView note = txt(L("كن محترماً. الإساءة والروابط المشبوهة تؤدي للحظر.", "Be respectful. Abuse and suspicious links get you blocked."), 0xFF9AA6D6, 12, true);
        note.setGravity(Gravity.CENTER);
        note.setPadding(0, dp(4), 0, dp(12));
        rmList.addView(note);
        rmScroll = new ScrollView(this);
        rmScroll.addView(rmList);
        root.addView(rmScroll, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));
        // --- شريط الإيموجي السريع ---
        if (isCustom) {
            rmQuickBar = new LinearLayout(this);
            rmQuickBar.setVisibility(View.GONE);
            HorizontalScrollView hs = new HorizontalScrollView(this);
            LinearLayout qr = new LinearLayout(this);
            qr.setPadding(dp(10), dp(6), dp(10), dp(0));
            for (final String em : RM_QUICK) {
                TextView e = txt(em, Color.WHITE, 22, false);
                e.setPadding(dp(10), dp(4), dp(10), dp(4));
                e.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) {
                    if (rmInput == null) return;
                    int pos = Math.max(0, rmInput.getSelectionStart());
                    String cur = rmInput.getText().toString();
                    String n = cur.substring(0, pos) + em + cur.substring(pos);
                    rmInput.setText(n.length() > RM_MAX_LEN ? n.substring(0, RM_MAX_LEN) : n);
                    rmInput.setSelection(Math.min(rmInput.getText().length(), pos + em.length()));
                } });
                qr.addView(e);
            }
            hs.addView(qr);
            rmQuickBar.addView(hs, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
            root.addView(rmQuickBar);
        }
        // --- شريط المساعد الذكي ---
        final boolean hasAi = !isCustom || custom.optString("match_id").length() > 0 && !custom.optString("match_id").equals("null");
        if (hasAi) {
            rmAiBar = new LinearLayout(this);
            rmAiBar.setOrientation(LinearLayout.VERTICAL);
            rmAiBar.setPadding(dp(12), dp(8), dp(12), dp(8));
            rmAiBar.setBackgroundColor(0x142C4BB5);
            rmAiBar.setVisibility(View.GONE);
            LinearLayout ar = new LinearLayout(this);
            ar.setGravity(Gravity.CENTER_VERTICAL);
            rmAiInput = new EditText(this);
            rmAiInput.setHint(L("اسأل المساعد أي شيء عن كرة القدم...", "Ask the assistant about football..."));
            rmAiInput.setHintTextColor(0xFF7A7F9A);
            rmAiInput.setTextColor(Color.WHITE);
            rmAiInput.setTextSize(14);
            rmAiInput.setSingleLine(true);
            rmAiInput.setFilters(new InputFilter[] { new InputFilter.LengthFilter(300) });
            rmAiInput.setBackground(rbg(0xFF0A1033, 0x732C4BB5, 12));
            rmAiInput.setPadding(dp(12), dp(8), dp(12), dp(8));
            ar.addView(rmAiInput, lpw(1f));
            TextView as = txt("➤", Color.WHITE, 18, false);
            as.setGravity(Gravity.CENTER);
            as.setBackground(oval(0xFF2C4BB5, 0));
            as.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) {
                String q = rmAiInput.getText().toString().trim();
                if (q.length() == 0) return;
                rmAiInput.setText("");
                rmAskAi("ask", q);
            } });
            LinearLayout.LayoutParams asl = new LinearLayout.LayoutParams(dp(42), dp(42));
            asl.setMargins(dp(8), 0, 0, 0);
            ar.addView(as, asl);
            rmAiBar.addView(ar);
            LinearLayout chips = new LinearLayout(this);
            String[][] cm = { { "explain", L("اشرح لي", "Explain") }, { "recap", L("ما فاتني", "Catch me up") }, { "why", L("لماذا هذا التوقع؟", "Why this pick?") } };
            for (final String[] c0 : cm) {
                TextView c1 = txt(c0[1], 0xFFFFD98A, 12, true);
                c1.setGravity(Gravity.CENTER);
                c1.setPadding(dp(4), dp(8), dp(4), dp(8));
                c1.setBackground(rbg(0x242C4BB5, 0x662C4BB5, 12));
                c1.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { rmAskAi(c0[0], ""); } });
                LinearLayout.LayoutParams cl = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
                cl.setMargins(dp(3), dp(8), dp(3), 0);
                chips.addView(c1, cl);
            }
            rmAiBar.addView(chips);
            root.addView(rmAiBar);
        }
        // --- شريط الكتابة ---
        FrameLayout composeWrap = new FrameLayout(this);
        composeWrap.setBackgroundColor(0xF20A1033);
        rmBarNormal = new LinearLayout(this);
        rmBarNormal.setGravity(Gravity.CENTER_VERTICAL);
        rmBarNormal.setPadding(dp(10), dp(10), dp(10), navH() + dp(4));
        if (isCustom) rmBarNormal.addView(rmRoundBtn("🎙", new View.OnClickListener() { @Override public void onClick(View v) { rmMicClick(); } }), rmBtnLp());
        if (hasAi) rmBarNormal.addView(rmRoundBtn("✨", new View.OnClickListener() { @Override public void onClick(View v) { rmAiClick(); } }), rmBtnLp());
        if (isCustom) rmBarNormal.addView(rmRoundBtn("😀", new View.OnClickListener() { @Override public void onClick(View v) { if (rmQuickBar != null) rmQuickBar.setVisibility(rmQuickBar.getVisibility() == View.GONE ? View.VISIBLE : View.GONE); } }), rmBtnLp());
        rmInput = new EditText(this);
        rmInput.setHint(L("اكتب رسالة...", "Write a message..."));
        rmInput.setHintTextColor(0xFF7A7F9A);
        rmInput.setTextColor(Color.WHITE);
        rmInput.setTextSize(15);
        rmInput.setMaxLines(4);
        rmInput.setFilters(new InputFilter[] { new InputFilter.LengthFilter(RM_MAX_LEN) });
        rmInput.setBackground(rbg(0xFF0A1033, 0x24FFFFFF, 30));
        rmInput.setPadding(dp(16), dp(10), dp(16), dp(10));
        rmBarNormal.addView(rmInput, lpw(1f));
        rmSendBtn = txt("➤", Color.WHITE, 18, false);
        rmSendBtn.setGravity(Gravity.CENTER);
        rmSendBtn.setBackground(oval(0xFF2C4BB5, 0));
        rmSendBtn.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { rmSend(); } });
        LinearLayout.LayoutParams sl = new LinearLayout.LayoutParams(dp(44), dp(44));
        sl.setMargins(dp(8), 0, 0, 0);
        rmBarNormal.addView(rmSendBtn, sl);
        composeWrap.addView(rmBarNormal);
        rmBarRec = new LinearLayout(this);
        rmBarRec.setGravity(Gravity.CENTER_VERTICAL);
        rmBarRec.setPadding(dp(10), dp(10), dp(10), navH() + dp(4));
        rmBarRec.setVisibility(View.GONE);
        TextView rc = txt("🗑", Color.WHITE, 18, false);
        rc.setGravity(Gravity.CENTER);
        rc.setBackground(oval(0x26FF4D4D, 0x66FF4D4D));
        rc.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { rmFinishRec(false); } });
        rmBarRec.addView(rc, new LinearLayout.LayoutParams(dp(44), dp(44)));
        LinearLayout ri = new LinearLayout(this);
        ri.setGravity(Gravity.CENTER);
        ri.addView(txt("● ", 0xFFFF4D4D, 14, true));
        rmRecTime = txt("0:00", Color.WHITE, 16, true);
        ri.addView(rmRecTime);
        rmBarRec.addView(ri, lpw(1f));
        TextView rs = txt("➤", Color.WHITE, 18, false);
        rs.setGravity(Gravity.CENTER);
        rs.setBackground(oval(0xFF2C4BB5, 0));
        rs.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { rmFinishRec(true); } });
        rmBarRec.addView(rs, new LinearLayout.LayoutParams(dp(44), dp(44)));
        composeWrap.addView(rmBarRec);
        root.addView(composeWrap);
        d.setContentView(root);
        d.setOnDismissListener(new DialogInterface.OnDismissListener() { @Override public void onDismiss(DialogInterface di) { if (rmDlg == d) closeRoom(); } });
        d.show();
        // --- تحميل أولي ---
        final String rid = roomId;
        rmAsync(new RmTask() { @Override public void run() throws Exception {
            try {
                JSONArray bl = new JSONArray(get("user_blocks?select=blocked_id&user_id=eq." + uid));
                for (int i = 0; i < bl.length(); i++) rmBlocked.add(bl.getJSONObject(i).optString("blocked_id"));
            } catch (Exception ignore) {}
            if (isCustom) {
                try {
                    JSONArray bn = new JSONArray(get("room_bans?select=user_id&room_key=eq." + rmEnc(rid)));
                    for (int i = 0; i < bn.length(); i++) rmBlocked.add(bn.getJSONObject(i).optString("user_id"));
                } catch (Exception ignore) {}
            }
            final JSONArray a = new JSONArray(get("room_messages?select=" + RM_MSG + "&room_id=eq." + rmEnc(rid) + "&order=id.desc&limit=" + RM_PAGE));
            runOnUiThread(new Runnable() { @Override public void run() {
                if (rmDlg == null || !rid.equals(rmRoomId)) return;
                rmApply(a, true);
                rmH.postDelayed(rmPoll, 3000);
                rmH.postDelayed(rmTick, 30000);
                if (isCustom) rmExpireTick();
            } });
        } });
        if (isCustom) rmExpireTick();
    }

    protected TextView rmRoundBtn(String ic, View.OnClickListener l) {
        TextView t = txt(ic, Color.WHITE, 17, false);
        t.setGravity(Gravity.CENTER);
        t.setBackground(oval(0x1AFFFFFF, 0x26FFFFFF));
        t.setOnClickListener(l);
        return t;
    }
    protected LinearLayout.LayoutParams rmBtnLp() {
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(dp(42), dp(42));
        p.setMargins(0, 0, dp(6), 0);
        return p;
    }

    protected void rmMicClick() {
        fetchTier(new TierCb() { @Override public void on(int tier) {
            if (tier < 1) { toast(L("الرسائل الصوتية للمشتركين فقط", "Voice messages are for subscribers only")); openSubscriptions(); return; }
            rmStartRec();
        } });
    }
    protected void rmAiClick() {
        fetchTier(new TierCb() { @Override public void on(int tier) {
            if (tier < 2) { toast(L("مساعد المباراة في الباقة المميّزة فما فوق", "Match assistant needs the Plus plan or higher")); openSubscriptions(); return; }
            if (rmAiBar == null) return;
            boolean open = rmAiBar.getVisibility() == View.GONE;
            rmAiBar.setVisibility(open ? View.VISIBLE : View.GONE);
            if (open && rmAiInput != null) rmAiInput.requestFocus();
        } });
    }

    protected void rmSend() {
        if (rmInput == null || rmRoomId == null) return;
        final String text = rmInput.getText().toString().trim();
        if (text.length() == 0) return;
        long now = System.currentTimeMillis();
        if (now - rmLastSend < RM_GAP) { toast(L("مهلاً، أرسل ببطء قليلاً", "Slow down a little")); return; }
        rmLastSend = now;
        rmSendBtn.setEnabled(false);
        final String rid = rmRoomId;
        rmAsync(new RmTask() { @Override public void run() throws Exception {
            try {
                JSONObject b = new JSONObject();
                b.put("room_id", rid); b.put("user_id", uid); b.put("body", text.length() > RM_MAX_LEN ? text.substring(0, RM_MAX_LEN) : text);
                final JSONObject row = rmRow(rmInsert("room_messages", new JSONArray().put(b).toString()));
                runOnUiThread(new Runnable() { @Override public void run() {
                    if (rmInput != null) rmInput.setText("");
                    if (row != null && rid.equals(rmRoomId)) rmAddMsg(row, true);
                } });
            } finally {
                runOnUiThread(new Runnable() { @Override public void run() { if (rmSendBtn != null) rmSendBtn.setEnabled(true); } });
            }
        } });
    }

    // ---------- مساعد المباراة ----------
    protected void rmAskAi(final String mode, final String question) {
        if (rmAiBusy || rmList == null) return;
        if (System.currentTimeMillis() - rmLastAi < 6000) { toast(L("مهلاً، أرسل ببطء قليلاً", "Slow down a little")); return; }
        rmAiBusy = true;
        rmLastAi = System.currentTimeMillis();
        final JSONArray chat = new JSONArray();
        List<Long> ids = new ArrayList<Long>(rmViews.keySet());
        for (int i = Math.max(0, ids.size() - 40); i < ids.size(); i++) {
            JSONObject o = rmData.get(ids.get(i));
            if (o == null || "voice".equals(o.optString("kind"))) continue;
            chat.put(o.optString("username") + ": " + o.optString("body").trim());
        }
        final TextView box = txt("…", 0xFFE9E5FF, 14, false);
        box.setPadding(dp(12), dp(10), dp(12), dp(10));
        box.setBackground(rbg(0x1F2C4BB5, 0x592C4BB5, 14));
        box.setLineSpacing(0, 1.2f);
        rmList.addView(box, lpm(0, 4, 0, 12));
        rmScrollEnd();
        final JSONObject ctx = rmMatchCtx != null ? rmMatchCtx : new JSONObject();
        final String title = rmTitleTxt;
        pool.execute(new Runnable() {
            @Override public void run() {
                String out = null;
                try {
                    JSONObject body = new JSONObject();
                    body.put("mode", mode);
                    body.put("match", rmMatchCtx != null ? ctx : new JSONObject().put("room_name", title));
                    body.put("question", question);
                    body.put("chat", chat);
                    HttpURLConnection c = (HttpURLConnection) new URL(url + "/functions/v1/match-assistant").openConnection();
                    c.setRequestMethod("POST");
                    c.setRequestProperty("apikey", key);
                    c.setRequestProperty("Authorization", "Bearer " + token);
                    c.setRequestProperty("Content-Type", "application/json");
                    c.setConnectTimeout(15000);
                    c.setReadTimeout(60000);
                    c.setDoOutput(true);
                    c.getOutputStream().write(body.toString().getBytes("UTF-8"));
                    int code = c.getResponseCode();
                    BufferedReader r = new BufferedReader(new InputStreamReader(code >= 400 ? c.getErrorStream() : c.getInputStream(), "UTF-8"));
                    StringBuilder sb = new StringBuilder(); String ln;
                    while ((ln = r.readLine()) != null) sb.append(ln);
                    r.close();
                    if (code >= 400) throw new Exception("ai " + code);
                    out = new JSONObject(sb.toString()).optString("text", "").replace("**", "");
                } catch (Exception ignore) {}
                final String fo = out;
                runOnUiThread(new Runnable() { @Override public void run() {
                    rmAiBusy = false;
                    if (fo == null || fo.length() == 0) {
                        if (rmList != null) rmList.removeView(box);
                        toast(L("تعذر الحصول على إجابة المساعد", "Assistant unavailable"));
                    } else {
                        box.setText("✨ " + L("مساعد المباراة", "Match assistant") + "\n" + (question.length() > 0 ? question + "\n" : "") + fo);
                    }
                    rmScrollEnd();
                } });
            }
        });
    }

    // ---------- قائمة الغرفة / المشاركة / الدعوة ----------
    protected String rmRoomLink(String code) { return roomLink(code); }

    protected void shareRoom(JSONObject room) {
        String code = room.optString("code");
        String text = L("انضم إلى غرفتي «" + room.optString("name") + "» في ZELO FC\nالرمز: " + code, "Join my room \"" + room.optString("name") + "\" on ZELO FC\nCode: " + code) + "\n" + rmRoomLink(code);
        try {
            Intent i = new Intent(Intent.ACTION_SEND);
            i.setType("text/plain");
            i.putExtra(Intent.EXTRA_TEXT, text);
            startActivity(Intent.createChooser(i, L("مشاركة", "Share")));
        } catch (Exception e) { rmCopy(text); }
    }

    protected void rmRoomMenu() {
        final JSONObject room = rmCustom;
        if (room == null) return;
        List<String> labels = new ArrayList<String>();
        List<Boolean> dg = new ArrayList<Boolean>();
        List<Runnable> runs = new ArrayList<Runnable>();
        final String rid = room.optString("id");
        if (rmIsOwner()) {
            labels.add("⤴ " + L("مشاركة الرمز والرابط", "Share code & link")); dg.add(false);
            runs.add(new Runnable() { @Override public void run() { shareRoom(room); } });
            labels.add("👥 " + L("دعوة مستخدمين", "Invite users")); dg.add(false);
            runs.add(new Runnable() { @Override public void run() { rmInvite(); } });
            if (room.optBoolean("requires_code")) {
                labels.add("📋 " + L("نسخ الرمز", "Copy code") + " (" + room.optString("code") + ")"); dg.add(false);
                runs.add(new Runnable() { @Override public void run() { rmCopy(room.optString("code")); } });
            }
            labels.add("🗑 " + L("حذف الغرفة", "Delete room")); dg.add(true);
            runs.add(new Runnable() { @Override public void run() {
                rmConfirm(L("سيتم حذف الغرفة وكل رسائلها نهائياً. متأكد؟", "The room and all its messages will be deleted permanently. Sure?"), L("حذف الغرفة", "Delete room"), new Runnable() { @Override public void run() {
                    rmAsync(new RmTask() { @Override public void run() throws Exception {
                        send("DELETE", "custom_rooms?id=eq." + rmEnc(rid), null);
                        runOnUiThread(new Runnable() { @Override public void run() { toast(L("تم حذف الغرفة", "Room deleted")); closeRoom(); } });
                    } });
                } });
            } });
        } else {
            labels.add("🚪 " + L("مغادرة الغرفة", "Leave room")); dg.add(true);
            runs.add(new Runnable() { @Override public void run() {
                rmConfirm(L("هل تريد مغادرة هذه الغرفة؟", "Leave this room?"), L("مغادرة الغرفة", "Leave room"), new Runnable() { @Override public void run() {
                    rmAsync(new RmTask() { @Override public void run() throws Exception {
                        send("DELETE", "custom_room_members?room_id=eq." + rmEnc(rid) + "&user_id=eq." + uid, null);
                        runOnUiThread(new Runnable() { @Override public void run() { closeRoom(); } });
                    } });
                } });
            } });
        }
        boolean[] d = new boolean[dg.size()];
        for (int i = 0; i < d.length; i++) d[i] = dg.get(i);
        rmSheet(labels.toArray(new String[0]), d, runs.toArray(new Runnable[0]));
    }

    protected void rmInvite() {
        final JSONObject room = rmCustom;
        if (room == null) return;
        final Dialog d = sheetDialog(false);
        d.getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
        lbDirection(d);
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setPadding(dp(14), dp(14), dp(14), navH() + dp(8));
        box.setBackground(rbg(0xFF1C1C22, 0x40F5C35A, 20));
        TextView t = txt(L("دعوة مستخدمين", "Invite users"), GOLD, 16, true);
        t.setGravity(Gravity.CENTER);
        box.addView(t, lpm(0, 0, 0, 10));
        final EditText q = new EditText(this);
        q.setHint(L("ابحث باسم المستخدم...", "Search by username..."));
        q.setHintTextColor(0xFF7A7F9A);
        q.setTextColor(Color.WHITE);
        q.setSingleLine(true);
        q.setFilters(new InputFilter[] { new InputFilter.LengthFilter(30) });
        q.setBackground(rbg(0xFF0A1033, 0x1FFFFFFF, 14));
        q.setPadding(dp(14), dp(10), dp(14), dp(10));
        box.addView(q, lpm(0, 0, 0, 8));
        final LinearLayout res = new LinearLayout(this);
        res.setOrientation(LinearLayout.VERTICAL);
        box.addView(res);
        TextView close = txt(L("إغلاق", "Close"), Color.WHITE, 15, true);
        close.setGravity(Gravity.CENTER);
        close.setPadding(dp(12), dp(14), dp(12), dp(14));
        close.setBackground(rbg(0x12FFFFFF, 0x1AFFFFFF, 14));
        close.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { d.dismiss(); } });
        box.addView(close, lpm(0, 8, 0, 0));
        d.setContentView(box);
        final Runnable[] pending = new Runnable[1];
        q.addTextChangedListener(new TextWatcher() {
            @Override public void beforeTextChanged(CharSequence s, int a, int b, int c) {}
            @Override public void onTextChanged(CharSequence s, int a, int b, int c) {}
            @Override public void afterTextChanged(Editable s) {
                if (pending[0] != null) rmH.removeCallbacks(pending[0]);
                final String term = s.toString().replaceAll("[%_\\\\,()*]", "").trim();
                if (term.length() < 2) { res.removeAllViews(); return; }
                pending[0] = new Runnable() { @Override public void run() {
                    pool.execute(new Runnable() { @Override public void run() {
                        try {
                            final JSONArray a = new JSONArray(get("public_profiles?select=user_id,username&username=ilike." + rmEnc(term) + "*&limit=8"));
                            runOnUiThread(new Runnable() { @Override public void run() {
                                res.removeAllViews();
                                int shown = 0;
                                for (int i = 0; i < a.length(); i++) {
                                    JSONObject u = a.optJSONObject(i);
                                    if (u == null || u.optString("user_id").equals(uid) || u.optString("username").length() == 0) continue;
                                    shown++;
                                    res.addView(rmInviteRow(room, u));
                                }
                                if (shown == 0) { TextView e = txt(L("لا نتائج", "No results"), MUTED, 13, true); e.setGravity(Gravity.CENTER); e.setPadding(0, dp(12), 0, dp(12)); res.addView(e); }
                            } });
                        } catch (Exception e) {
                            runOnUiThread(new Runnable() { @Override public void run() { res.removeAllViews(); res.addView(txt(L("تعذر التحميل", "Could not load"), MUTED, 13, true)); } });
                        }
                    } });
                } };
                rmH.postDelayed(pending[0], 300);
            }
        });
        d.show();
        q.requestFocus();
    }

    protected View rmInviteRow(final JSONObject room, final JSONObject u) {
        LinearLayout r = new LinearLayout(this);
        r.setGravity(Gravity.CENTER_VERTICAL);
        r.setPadding(dp(4), dp(8), dp(4), dp(8));
        TextView n = txt("@" + u.optString("username"), Color.WHITE, 15, true);
        r.addView(n, lpw(1f));
        final TextView b = txt(L("دعوة", "Invite"), Color.WHITE, 13, true);
        b.setPadding(dp(14), dp(7), dp(14), dp(7));
        b.setBackground(rbg(0x12FFFFFF, 0x1AFFFFFF, 12));
        b.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) {
            b.setEnabled(false);
            rmAsync(new RmTask() { @Override public void run() throws Exception {
                try {
                    rpc("invite_to_room", new JSONObject().put("p_room", room.optString("id")).put("p_to", u.optString("user_id")).toString());
                } catch (final Exception e) {
                    runOnUiThread(new Runnable() { @Override public void run() { b.setEnabled(true); } });
                    throw e;
                }
                runOnUiThread(new Runnable() { @Override public void run() { b.setText("✓"); toast(L("تم إرسال الدعوة", "Invitation sent")); } });
            } });
        } });
        r.addView(b);
        return r;
    }

    // ---------- غرف المباريات والأندية والمخصّصة ----------
    @Override protected void openMatchRoom(final String matchId) {
        if (uid == null) return;
        rmAsync(new RmTask() { @Override public void run() throws Exception {
            JSONArray a = new JSONArray(get("matches?select=id,team_a,team_b,match_date&id=eq." + rmEnc(matchId)));
            if (a.length() == 0) throw new Exception("match not found");
            final JSONObject m = a.getJSONObject(0);
            final String st = rmState(m.optString("match_date"));
            if (st.equals("soon")) {
                final long opens = isoMs(m.optString("match_date")) - RM_OPEN_BEFORE * 60000L;
                runOnUiThread(new Runnable() { @Override public void run() { toast(L("تفتح الغرفة الساعة " + fmtTime(opens), "Room opens at " + fmtTime(opens))); } });
                return;
            }
            if (st.equals("ended")) { runOnUiThread(new Runnable() { @Override public void run() { toast(L("انتهت غرفة هذه المباراة", "This match room has ended")); } }); return; }
            final JSONObject ctx = new JSONObject();
            ctx.put("team_a", m.optString("team_a")); ctx.put("team_b", m.optString("team_b")); ctx.put("match_date", m.optString("match_date"));
            runOnUiThread(new Runnable() { @Override public void run() {
                rmOpen("match_" + String.valueOf(m.optString("id")).replaceAll("[^A-Za-z0-9_-]", "_"), m.optString("team_a") + " 🆚 " + m.optString("team_b"), "🟢 " + L("غرفة المباراة", "Match room"), null, ctx);
            } });
        } });
    }

    // إنشاء غرفة مرتبطة بمباراة (من بطاقة المباراة)
    @Override protected void createMatchRoom(final String matchId) {
        if (uid == null) { toast(L("سجّل الدخول أولاً", "Please sign in first")); return; }
        rmAsync(new RmTask() { @Override public void run() throws Exception {
            JSONArray a = new JSONArray(get("matches?select=id,team_a,team_b,match_date&id=eq." + rmEnc(matchId)));
            if (a.length() == 0) throw new Exception("match not found");
            final JSONObject m = a.getJSONObject(0);
            final String st = rmState(m.optString("match_date"));
            if (st.equals("soon")) {
                final long opens = isoMs(m.optString("match_date")) - RM_OPEN_BEFORE * 60000L;
                runOnUiThread(new Runnable() { @Override public void run() { toast(L("يمكنك إنشاء غرفة الساعة " + fmtTime(opens), "You can create a room at " + fmtTime(opens))); } });
                return;
            }
            if (st.equals("ended")) { runOnUiThread(new Runnable() { @Override public void run() { toast(L("انتهت غرفة هذه المباراة", "This match room has ended")); } }); return; }
            String nm = (m.optString("team_a") + " 🆚 " + m.optString("team_b"));
            final String name = nm.length() > 40 ? nm.substring(0, 40) : nm;
            final long mid = m.optLong("id");
            runOnUiThread(new Runnable() { @Override public void run() {
                rmAskRoom(name, true, new RmPick() { @Override public void on(String n0, final String emoji, final boolean pub) {
                    rmAsync(new RmTask() { @Override public void run() throws Exception {
                        JSONObject row = rmRow(rpc("create_match_room", new JSONObject().put("p_match", mid).put("p_public", pub).put("p_emoji", emoji).toString()));
                        if (row == null) throw new Exception("no row");
                        final JSONObject room = new JSONObject();
                        room.put("id", row.optString("out_id")); room.put("code", row.optString("out_code")); room.put("name", name); room.put("owner_id", uid);
                        room.put("emoji", emoji); room.put("expires_at", row.optString("out_expires")); room.put("is_public", pub); room.put("requires_code", !pub); room.put("match_id", mid);
                        runOnUiThread(new Runnable() { @Override public void run() { toast(L("تم إنشاء الغرفة ✅", "Room created ✅")); openCustomRoom(room); } });
                    } });
                } });
            } });
        } });
    }

    protected void openClubRoom(String clubId) {
        String[] c = ClubsData.byId(clubId);
        if (c == null) return;
        rmOpen("club_" + clubId.replaceAll("[^A-Za-z0-9_-]", "_"), isAr() ? c[2] : c[3], "👥 " + L("غرفة النادي", "Club room"), null, null);
    }

    protected void openCustomRoom(JSONObject room) {
        JSONObject c = new JSONObject();
        try {
            c.put("id", room.optString("id")); c.put("code", room.optString("code")); c.put("name", room.optString("name")); c.put("owner_id", room.optString("owner_id"));
            c.put("emoji", room.optString("emoji")); c.put("expires_at", room.optString("expires_at")); c.put("requires_code", room.optBoolean("requires_code"));
            c.put("match_id", room.isNull("match_id") ? "" : room.optString("match_id"));
        } catch (Exception ignore) {}
        boolean mine = uid != null && uid.equals(c.optString("owner_id"));
        JSONObject ctx = null;
        rmOpen("custom_" + c.optString("id"), c.optString("name"), mine ? L("غرفتك", "Your room") : L("عضو في الغرفة", "Member"), c, ctx);
    }

    // إنشاء غرفة عادية
    protected void createRoomFlow() {
        if (uid == null) { toast(L("سجّل الدخول أولاً", "Please sign in first")); return; }
        rmAskRoom("", false, new RmPick() { @Override public void on(final String name, final String emoji, final boolean pub) {
            rmAsync(new RmTask() { @Override public void run() throws Exception {
                JSONObject row = rmRow(rpc("create_room_v2", new JSONObject().put("p_name", name).put("p_emoji", emoji).put("p_public", pub).put("p_requires_code", !pub).toString()));
                if (row == null) throw new Exception("no row");
                final JSONObject room = new JSONObject();
                room.put("id", row.optString("out_id")); room.put("code", row.optString("out_code")); room.put("name", name); room.put("owner_id", uid);
                room.put("emoji", emoji); room.put("expires_at", row.optString("out_expires")); room.put("requires_code", !pub);
                runOnUiThread(new Runnable() { @Override public void run() { toast(L("تم إنشاء الغرفة ✅", "Room created ✅")); openCustomRoom(room); } });
            } });
        } });
    }

    protected void createRoomForMatch(String name0, final String emoji0) {
        if (uid == null) { toast(L("سجّل الدخول أولاً", "Please sign in first")); return; }
        String n = name0 == null ? "" : name0.trim();
        final String name = n.length() > 40 ? n.substring(0, 40) : n;
        rmAsync(new RmTask() { @Override public void run() throws Exception {
            for (JSONObject r : rmLoadMine()) {
                if (uid.equals(r.optString("owner_id")) && name.equals(r.optString("name"))) { final JSONObject ex = r; runOnUiThread(new Runnable() { @Override public void run() { openCustomRoom(ex); } }); return; }
            }
            final String emoji = emoji0 == null || emoji0.length() == 0 ? "icon:ball" : emoji0;
            JSONObject row = rmRow(rpc("create_room", new JSONObject().put("p_name", name).put("p_emoji", emoji).toString()));
            if (row == null) throw new Exception("no row");
            final JSONObject room = new JSONObject();
            room.put("id", row.optString("out_id")); room.put("code", row.optString("out_code")); room.put("name", name); room.put("owner_id", uid);
            room.put("emoji", emoji); room.put("expires_at", row.optString("out_expires")); room.put("requires_code", true);
            runOnUiThread(new Runnable() { @Override public void run() { toast(L("تم إنشاء الغرفة ✅", "Room created ✅")); openCustomRoom(room); } });
        } });
    }

    // زر «غرفتي» في الملف: يفتح غرفتك النشطة إن وُجدت وإلا يبدأ إنشاء غرفة
    protected void openMyRoomOrCreate() {
        if (uid == null) { toast(L("سجّل الدخول أولاً", "Please sign in first")); return; }
        rmAsync(new RmTask() { @Override public void run() throws Exception {
            JSONObject mine = null;
            try { for (JSONObject r : rmLoadMine()) if (uid.equals(r.optString("owner_id"))) { mine = r; break; } } catch (Exception ignore) {}
            final JSONObject fm = mine;
            runOnUiThread(new Runnable() { @Override public void run() { if (fm != null) openCustomRoom(fm); else createRoomFlow(); } });
        } });
    }

    @Override protected void joinRoomByCode(String code0) {
        if (uid == null) { toast(L("سجّل الدخول أولاً", "Please sign in first")); return; }
        final String code = code0 == null ? "" : code0.trim().toUpperCase();
        if (code.length() == 0) return;
        rmAsync(new RmTask() { @Override public void run() throws Exception {
            String id = rpc("join_room_checked", new JSONObject().put("p_code", code).put("p_actor", uid).toString()).trim().replace("\"", "");
            rmOpenById(id);
        } });
    }

    @Override protected void acceptRoomInvite(final String roomId) {
        if (uid == null) return;
        rmAsync(new RmTask() { @Override public void run() throws Exception {
            rpc("accept_room_invite", new JSONObject().put("p_room", String.valueOf(roomId)).put("p_actor", uid).toString());
            rmOpenById(String.valueOf(roomId));
        } });
    }

    // يجلب الغرفة ثم يفتحها (يُستدعى من خيط الخلفية)
    protected void rmOpenById(String id) throws Exception {
        JSONArray a = new JSONArray(get("custom_rooms?select=" + RM_COLS + "&id=eq." + rmEnc(id)));
        if (a.length() == 0) throw new Exception("room not found");
        final JSONObject room = a.getJSONObject(0);
        runOnUiThread(new Runnable() { @Override public void run() { openCustomRoom(room); } });
    }

    protected void rmJoinFlow() {
        rmAsk(L("الانضمام إلى غرفة", "Join a room"), L("أدخل رمز الغرفة", "Enter the room code"), L("انضمام", "Join"), 12, true, new RmStr() { @Override public void on(String s) { joinRoomByCode(s); } });
    }

    // ---------- الغرف العامة وغرفي ----------
    protected List<JSONObject> rmLoadMine() throws Exception {
        final Map<String, JSONObject> map = new LinkedHashMap<String, JSONObject>();
        try {
            JSONArray own = new JSONArray(get("custom_rooms?select=" + RM_COLS + "&owner_id=eq." + uid));
            for (int i = 0; i < own.length(); i++) { JSONObject r = own.getJSONObject(i); map.put(r.optString("id"), r); }
        } catch (Exception ignore) {}
        JSONArray mem = new JSONArray(get("custom_room_members?select=custom_rooms(" + RM_COLS + ")&user_id=eq." + uid));
        for (int i = 0; i < mem.length(); i++) {
            JSONObject r = mem.getJSONObject(i).optJSONObject("custom_rooms");
            if (r != null) map.put(r.optString("id"), r);
        }
        List<JSONObject> list = new ArrayList<JSONObject>();
        long now = System.currentTimeMillis();
        for (JSONObject r : map.values()) {
            String ex = r.optString("expires_at");
            if (r.isNull("expires_at") || ex.length() == 0 || isoMs(ex) > now) list.add(r);
        }
        Collections.sort(list, new Comparator<JSONObject>() {
            @Override public int compare(JSONObject a, JSONObject b) {
                int x = uid.equals(a.optString("owner_id")) ? 0 : 1, y = uid.equals(b.optString("owner_id")) ? 0 : 1;
                return x - y;
            }
        });
        try {
            JSONArray ids = new JSONArray();
            for (JSONObject r : list) ids.put(r.optString("id"));
            JSONArray cnt = new JSONArray(rpc("room_member_counts", new JSONObject().put("p_ids", ids).toString()));
            Map<String, Integer> cm = new HashMap<String, Integer>();
            for (int i = 0; i < cnt.length(); i++) cm.put(cnt.getJSONObject(i).optString("room_id"), cnt.getJSONObject(i).optInt("members", 0));
            for (JSONObject r : list) { Integer n = cm.get(r.optString("id")); r.put("members", n == null ? 1 : n); }
        } catch (Exception ignore) {}
        return list;
    }

    protected List<JSONObject> rmLoadPublic() throws Exception {
        JSONArray a = new JSONArray(get("public_rooms?select=id,name,emoji,owner_id,expires_at,requires_code,members&order=members.desc&limit=100"));
        List<JSONObject> list = new ArrayList<JSONObject>();
        for (int i = 0; i < a.length(); i++) list.add(a.getJSONObject(i));
        return list;
    }

    protected View rmRoomCard(final JSONObject r, final boolean pub) {
        final boolean owner = uid != null && uid.equals(r.optString("owner_id"));
        final boolean member = owner || !pub;
        final boolean locked = r.optBoolean("requires_code");
        LinearLayout c = new LinearLayout(this);
        c.setGravity(Gravity.CENTER_VERTICAL);
        c.setPadding(dp(10), dp(8), dp(10), dp(8));
        c.setBackground(rbg(owner ? 0xF2281E14 : 0xF2141630, owner ? 0x66F5C35A : 0x4D2C4BB5, 15));
        TextView av = txt(rmEmoji(r.optString("emoji")), Color.WHITE, 20, false);
        av.setGravity(Gravity.CENTER);
        av.setBackground(rbg(0x1F4A6CFF, 0x4D2C4BB5, 12));
        c.addView(av, new LinearLayout.LayoutParams(dp(38), dp(38)));
        LinearLayout info = new LinearLayout(this);
        info.setOrientation(LinearLayout.VERTICAL);
        info.setPadding(dp(10), 0, dp(10), 0);
        TextView nm = txt(r.optString("name"), Color.WHITE, 14, true);
        nm.setSingleLine(true);
        nm.setEllipsize(android.text.TextUtils.TruncateAt.END);
        info.addView(nm);
        String exp = rmExpLabel(r.optString("expires_at"));
        info.addView(txt("👥 " + r.optInt("members", 0) + "   " + (locked ? "🔒 " + L("مقفل", "Locked") : "🟢 " + L("مفتوح", "Open")) + (exp.length() > 0 ? "   " + exp : ""), MUTED, 11, true));
        c.addView(info, lpw(1f));
        String chip = owner ? "👑 " + L("مالك", "Owner") : !pub ? "✓ " + L("عضو", "Joined") : locked ? "🔑 " + L("برمز", "Code") : "➜ " + L("انضمام", "Join");
        TextView ch = txt(chip, owner ? GOLD : pub ? 0xFF4A6CFF : GOLD, 11, true);
        ch.setPadding(dp(8), dp(2), dp(8), dp(2));
        ch.setBackground(rbg(0x1AF5C35A, 0x66F5C35A, 9));
        c.addView(ch);
        c.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) {
            if (member || !pub) { rmCloseHub(); openCustomRoom(r); } else rmEnterPublic(r);
        } });
        return c;
    }

    protected void rmEnterPublic(final JSONObject room) {
        if (room.optBoolean("requires_code")) {
            rmCodeSheet(room);
            return;
        }
        rmAsync(new RmTask() { @Override public void run() throws Exception {
            rpc("join_public_room", new JSONObject().put("p_room", room.optString("id")).put("p_code", "").put("p_actor", uid).toString());
            runOnUiThread(new Runnable() { @Override public void run() { rmCloseHub(); openCustomRoom(room); } });
        } });
    }

    // رمز الغرفة العامة المقفلة: الخطأ يظهر داخل النافذة ولا تُغلق إلا عند النجاح
    protected void rmCodeSheet(final JSONObject room) {
        final EditText e = new EditText(this);
        e.setHint(L("أدخل رمز الغرفة", "Enter the room code"));
        e.setHintTextColor(0xFF7A7F9A);
        e.setTextColor(Color.WHITE);
        e.setSingleLine(true);
        e.setGravity(Gravity.CENTER);
        e.setAllCaps(true);
        e.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_CHARACTERS);
        e.setFilters(new InputFilter[] { new InputFilter.LengthFilter(12) });
        final TextView err = txt("", 0xFFFF6B6B, 13, true);
        err.setGravity(Gravity.CENTER);
        err.setVisibility(View.GONE);
        LinearLayout w = new LinearLayout(this);
        w.setOrientation(LinearLayout.VERTICAL);
        w.setPadding(dp(20), dp(8), dp(20), 0);
        w.addView(txt("🔒 " + L("أدخل رمز الغرفة للانضمام", "Enter the room code to join"), 0xFFCBD5E1, 13, false));
        w.addView(e);
        w.addView(err);
        final AlertDialog d = rmBuilder().setTitle(room.optString("name")).setView(w)
            .setPositiveButton(L("دخول", "Enter"), null).setNegativeButton(L("إلغاء", "Cancel"), null).create();
        d.show();
        d.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) {
            final String code = e.getText().toString().trim().toUpperCase();
            if (code.length() == 0) { err.setText(L("أدخل الرمز أولاً", "Enter the code first")); err.setVisibility(View.VISIBLE); return; }
            pool.execute(new Runnable() { @Override public void run() {
                try {
                    rpc("join_public_room", new JSONObject().put("p_room", room.optString("id")).put("p_code", code).put("p_actor", uid).toString());
                    runOnUiThread(new Runnable() { @Override public void run() { d.dismiss(); rmCloseHub(); openCustomRoom(room); } });
                } catch (final Exception ex) {
                    runOnUiThread(new Runnable() { @Override public void run() { err.setText(rmErr(ex)); err.setVisibility(View.VISIBLE); } });
                }
            } });
        } });
    }

    // مركز الغرف: غرفي + الغرف العامة + إنشاء/انضمام
    @Override protected void openRoomsHub() {
        if (uid == null) { toast(L("سجّل الدخول أولاً", "Please sign in first")); return; }
        if (rmHub != null) return;
        final Dialog d = sheetDialog(true);
        rmHub = d;
        d.getWindow().setBackgroundDrawable(new ColorDrawable(NAVY));
        lbDirection(d);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(0, statusH() + dp(6), 0, 0);
        LinearLayout head = new LinearLayout(this);
        head.setGravity(Gravity.CENTER_VERTICAL);
        head.setPadding(dp(12), dp(10), dp(12), dp(10));
        head.addView(backBtn(new Runnable() { @Override public void run() { d.dismiss(); } }));
        TextView t = txt("💬 " + L("الغرف", "Rooms"), Color.WHITE, 18, true);
        t.setPadding(dp(10), 0, dp(10), 0);
        head.addView(t, lpw(1f));
        root.addView(head);
        LinearLayout body = new LinearLayout(this);
        body.setOrientation(LinearLayout.VERTICAL);
        body.setPadding(dp(14), dp(4), dp(14), navH() + dp(20));
        LinearLayout acts = new LinearLayout(this);
        TextView cr = txt("＋ " + L("إنشاء غرفة", "Create room"), Color.WHITE, 14, true);
        cr.setGravity(Gravity.CENTER);
        cr.setPadding(dp(8), dp(12), dp(8), dp(12));
        cr.setBackground(rbg(0xFF2C4BB5, 0, 13));
        cr.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { createRoomFlow(); } });
        TextView jn = txt("🔑 " + L("الانضمام بالرمز", "Join with code"), GOLD, 14, true);
        jn.setGravity(Gravity.CENTER);
        jn.setPadding(dp(8), dp(12), dp(8), dp(12));
        jn.setBackground(rbg(0x14F5C35A, 0x73F5C35A, 13));
        jn.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { rmJoinFlow(); } });
        LinearLayout.LayoutParams l1 = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f); l1.setMargins(0, 0, dp(4), 0);
        LinearLayout.LayoutParams l2 = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f); l2.setMargins(dp(4), 0, 0, 0);
        acts.addView(cr, l1); acts.addView(jn, l2);
        body.addView(acts, lpm(0, 4, 0, 6));
        body.addView(txt("📋 " + L("غرفي", "My rooms"), 0xFF94A3B8, 13, true), lpm(4, 14, 4, 8));
        rmHubMine = new LinearLayout(this);
        rmHubMine.setOrientation(LinearLayout.VERTICAL);
        body.addView(rmHubMine);
        body.addView(txt("🌐 " + L("الغرف العامة", "Public rooms"), 0xFF94A3B8, 13, true), lpm(4, 14, 4, 8));
        rmHubPub = new LinearLayout(this);
        rmHubPub.setOrientation(LinearLayout.VERTICAL);
        body.addView(rmHubPub);
        ScrollView sv = new ScrollView(this);
        sv.addView(body);
        root.addView(sv, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));
        d.setContentView(root);
        d.setOnDismissListener(new DialogInterface.OnDismissListener() { @Override public void onDismiss(DialogInterface di) { if (rmHub == d) { rmHub = null; rmHubMine = null; rmHubPub = null; } } });
        d.show();
        rmHubLoad();
    }

    protected void rmCloseHub() {
        Dialog d = rmHub;
        rmHub = null; rmHubMine = null; rmHubPub = null;
        if (d != null) { try { d.dismiss(); } catch (Exception ignore) {} }
    }

    protected void rmHubLoad() {
        if (rmHub == null || rmHubMine == null || rmHubPub == null) return;
        final LinearLayout mineEl = rmHubMine, pubEl = rmHubPub;
        mineEl.removeAllViews(); pubEl.removeAllViews();
        mineEl.addView(uEmpty(""));
        pubEl.addView(uEmpty(""));
        pool.execute(new Runnable() { @Override public void run() {
            List<JSONObject> mine = null, pub = null;
            try { mine = rmLoadMine(); } catch (Exception ignore) {}
            final Set<String> mineIds = new HashSet<String>();
            if (mine != null) for (JSONObject r : mine) mineIds.add(r.optString("id"));
            try {
                pub = new ArrayList<JSONObject>();
                for (JSONObject r : rmLoadPublic()) if (!mineIds.contains(r.optString("id"))) pub.add(r);
            } catch (Exception ignore) { pub = null; }
            final List<JSONObject> fm = mine, fp = pub;
            runOnUiThread(new Runnable() { @Override public void run() {
                if (rmHub == null || rmHubMine != mineEl) return;
                mineEl.removeAllViews(); pubEl.removeAllViews();
                if (fm == null) mineEl.addView(uEmpty(L("تعذر التحميل", "Could not load")));
                else if (fm.isEmpty()) mineEl.addView(uEmpty(L("ليس لديك غرف بعد. أنشئ غرفة أو انضم برمز.", "No rooms yet. Create one or join with a code.")));
                else for (JSONObject r : fm) mineEl.addView(rmRoomCard(r, false), lpm(0, 0, 0, 7));
                if (fp == null) pubEl.addView(uEmpty(L("تعذر التحميل", "Could not load")));
                else if (fp.isEmpty()) pubEl.addView(uEmpty(L("لا توجد غرف عامة الآن", "No public rooms right now")));
                else for (JSONObject r : fp) pubEl.addView(rmRoomCard(r, true), lpm(0, 0, 0, 7));
            } });
        } });
    }
}
