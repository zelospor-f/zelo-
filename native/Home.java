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


public class Home extends FollowList {
    // ---------------- شاشة الفيديو الواحدة ----------------
    protected Dialog vDlg;
    protected List<JSONObject> vList = new ArrayList<JSONObject>();
    protected int vPos = 0;
    protected VideoView vVv;
    protected android.media.MediaPlayer vMp;
    protected boolean vMuted = false, vPaused = false;
    protected final android.os.Handler vH = new android.os.Handler();
    protected Runnable vTick;
    protected ImageView vAvImg;
    protected TextView vAvLetter, vName, vUser, vCap, vTime, vPlay, vMute;
    protected View vFill;
    protected FrameLayout vTrack;
    protected ImageView[] vIc = new ImageView[6];
    protected TextView[] vCt = new TextView[6];
    protected int vTrackW = 0;

    protected void openViewerFromFeed(int idx) {
        List<JSONObject> l = new ArrayList<JSONObject>();
        int start = 0;
        JSONObject cur = items.get(idx);
        for (JSONObject p : items) {
            String vu = p.isNull("video_url") ? "" : p.optString("video_url", "");
            if (vu.length() > 4) { if (p == cur) start = l.size(); l.add(p); }
        }
        openViewer(l, start);
    }

    protected void openVideosTab() {
        pool.execute(new Runnable() {
            @Override public void run() {
                final List<JSONObject> l = new ArrayList<JSONObject>();
                try {
                    if (!metaLoaded) { /* القوائم تُحمَّل عند أول تحميل للمنشورات */ }
                    JSONArray a = new JSONArray(get("posts?select=id,user_id,author_name,content,created_at,image_url,video_url,video_path,topic_type,topic_name,topic_name_b&video_url=not.is.null&order=created_at.desc&limit=30"));
                    StringBuilder ids = new StringBuilder();
                    for (int i = 0; i < a.length(); i++) {
                        JSONObject p = a.getJSONObject(i);
                        String au = p.optString("user_id", "");
                        if (muteSet.contains(au) || blockSet.contains(au)) continue;
                        if (p.optString("video_url", "").length() < 5) continue;
                        String k = String.valueOf(p.optLong("id"));
                        l.add(p);
                        if (!stats.containsKey(k)) stats.put(k, new int[] { 0, 0, 0, 0 });
                        if (ids.length() > 0) ids.append(",");
                        ids.append(k);
                    }
                    String fids = ids.toString();
                    if (l.isEmpty()) { runOnUiThread(new Runnable() { @Override public void run() { toast(L("لا توجد فيديوهات بعد", "No videos yet")); } }); return; }
                    runOnUiThread(new Runnable() { @Override public void run() { openViewer(l, 0); } });
                    if (fids.length() > 0) {
                        count("post_likes", fids, 0); count("post_comments", fids, 1); count("post_reposts", fids, 2); count("post_views", fids, 3);
                        try {
                            JSONArray x = new JSONArray(get("post_likes?select=post_id&user_id=eq." + uid + "&post_id=in.(" + fids + ")"));
                            for (int q = 0; q < x.length(); q++) liked.add(String.valueOf(x.getJSONObject(q).optLong("post_id")));
                        } catch (Exception ignore) {}
                        try {
                            JSONArray x = new JSONArray(get("post_reposts?select=post_id&user_id=eq." + uid + "&post_id=in.(" + fids + ")"));
                            for (int q = 0; q < x.length(); q++) reposted.add(String.valueOf(x.getJSONObject(q).optLong("post_id")));
                        } catch (Exception ignore) {}
                        try {
                            JSONArray x = new JSONArray(get("post_bookmarks?select=post_id&user_id=eq." + uid + "&post_id=in.(" + fids + ")"));
                            for (int q = 0; q < x.length(); q++) saved.add(String.valueOf(x.getJSONObject(q).optLong("post_id")));
                        } catch (Exception ignore) {}
                        loadSupportStats(fids);
                        try {
                            Set<String> us = new HashSet<String>();
                            for (JSONObject p : l) us.add(p.optString("user_id", ""));
                            StringBuilder u2 = new StringBuilder();
                            for (String u : us) { if (u.length() > 0 && !photos.containsKey(u)) { if (u2.length() > 0) u2.append(","); u2.append(u); } }
                            if (u2.length() > 0) {
                                JSONArray pa = new JSONArray(get("public_profiles?select=user_id,photo_url,username&user_id=in.(" + u2 + ")"));
                                for (int q = 0; q < pa.length(); q++) {
                                    JSONObject po = pa.getJSONObject(q);
                                    String ph = po.isNull("photo_url") ? "" : po.optString("photo_url", "");
                                    { String un9 = po.isNull("username") ? "" : po.optString("username", ""); if (un9.length() > 0) unames.put(po.optString("user_id"), un9); }
                    if (isImg(ph)) photos.put(po.optString("user_id"), ph);
                                }
                            }
                        } catch (Exception ignore) {}
                    }
                } catch (Exception e) {}
                runOnUiThread(new Runnable() {
                    @Override public void run() {
                        if (vDlg == null || vPos < 0 || vPos >= vList.size()) return;
                        vBindCounts();
                        JSONObject o = vList.get(vPos);
                        String vun = unames.get(o.optString("user_id", ""));
                        vUser.setText(vun != null && vun.length() > 0 ? "@" + vun : "");
                        String ph = photos.get(o.optString("user_id", ""));
                        if (ph != null) { vAvImg.setVisibility(View.VISIBLE); loadImage(ph, vAvImg); }
                    }
                });
            }
        });
    }

    protected View sideBtn(final int slot, int icon, final Runnable click) {
        LinearLayout c = new LinearLayout(this);
        c.setOrientation(LinearLayout.VERTICAL);
        c.setGravity(Gravity.CENTER_HORIZONTAL);
        c.setPadding(0, dp(5), 0, dp(5));
        ImageView iv = new ImageView(this);
        iv.setScaleType(ImageView.ScaleType.CENTER);
        iv.setBackground(oval(slot == 0 ? GOLD : 0xD91E2846, 0x00000000));
        c.addView(iv, new LinearLayout.LayoutParams(dp(slot == 0 ? 52 : 46), dp(slot == 0 ? 52 : 46)));
        TextView t = tv(slot == 0 ? GOLD : Color.WHITE, 13, true);
        t.setGravity(Gravity.CENTER);
        c.addView(t);
        vIc[slot] = iv;
        vCt[slot] = t;
        c.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) { click.run(); }
        });
        return c;
    }

    protected void vBindCounts() {
        if (vDlg == null || vPos < 0 || vPos >= vList.size()) return;
        JSONObject o = vList.get(vPos);
        String k = String.valueOf(o.optLong("id"));
        int[] s = stats.get(k);
        if (s == null) s = new int[] { 0, 0, 0, 0 };
        long[] sp = sup.get(k);
        boolean lk = liked.contains(k), rp = reposted.contains(k), sv = saved.contains(k);
        int d = dp(22);
        vIc[0].setImageDrawable(new Ic(11, NAVY, false, d));
        vCt[0].setText(sp == null ? "0" : kfmt(sp[0]));
        vIc[1].setImageDrawable(new Ic(2, lk ? 0xFF14F195 : Color.WHITE, lk, d));
        vCt[1].setText(String.valueOf(s[0]));
        vIc[2].setImageDrawable(new Ic(0, Color.WHITE, false, d));
        vCt[2].setText(String.valueOf(s[1]));
        vIc[3].setImageDrawable(new Ic(1, rp ? 0xFF14F195 : Color.WHITE, false, d));
        vCt[3].setText(String.valueOf(s[2]));
        vIc[4].setImageDrawable(new Ic(4, sv ? GOLD : Color.WHITE, sv, d));
        vCt[4].setText("");
        vIc[5].setImageDrawable(new Ic(5, Color.WHITE, false, d));
        vCt[5].setText("");
    }

    protected void vLoad() {
        if (vPos < 0 || vPos >= vList.size()) return;
        JSONObject o = vList.get(vPos);
        String nm = o.optString("author_name", "");
        vName.setText(nm);
        String vun = unames.get(o.optString("user_id", ""));
        vUser.setText(vun != null && vun.length() > 0 ? "@" + vun : "");
        vAvLetter.setText(nm.length() > 0 ? nm.substring(0, 1).toUpperCase() : "?");
        String ph = photos.get(o.optString("user_id", ""));
        if (ph != null) { vAvImg.setVisibility(View.VISIBLE); loadImage(ph, vAvImg); } else { vAvImg.setTag(null); vAvImg.setVisibility(View.GONE); }
        vCap.setText(o.optString("content", ""));
        vBindCounts();
        vPaused = false;
        vPlay.setText("❚❚");
        vFill.getLayoutParams().width = 0;
        vFill.requestLayout();
        vTime.setText("");
        vMp = null;
        vVv.stopPlayback();
        vVv.setVideoURI(android.net.Uri.parse(o.optString("video_url", "")));
        vH.removeCallbacks(vTick);
        vH.postDelayed(vTick, 400);
        recordView(o, stats.get(String.valueOf(o.optLong("id"))) == null ? new int[] { 0, 0, 0, 0 } : stats.get(String.valueOf(o.optLong("id"))));
    }

    protected void openViewer(List<JSONObject> list, int start) {
        vList = list;
        vPos = start;
        vMuted = false;
        final Dialog d = new Dialog(this, android.R.style.Theme_Black_NoTitleBar_Fullscreen);
        vDlg = d;
        FrameLayout fl = new FrameLayout(this);
        fl.setBackgroundColor(Color.BLACK);
        fl.setLayoutDirection(View.LAYOUT_DIRECTION_LTR);
        vVv = new VideoView(this);
        fl.addView(vVv, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT, Gravity.CENTER));
        vVv.setOnPreparedListener(new android.media.MediaPlayer.OnPreparedListener() {
            @Override public void onPrepared(android.media.MediaPlayer mp) {
                vMp = mp;
                mp.setLooping(true);
                mp.setVolume(vMuted ? 0f : 1f, vMuted ? 0f : 1f);
                if (!vPaused) vVv.start();
            }
        });
        vVv.setOnErrorListener(new android.media.MediaPlayer.OnErrorListener() {
            @Override public boolean onError(android.media.MediaPlayer mp, int w, int e) { toast(L("تعذّر تشغيل الفيديو", "Could not play the video")); return true; }
        });

        // طبقة اللمس: نقرة = إيقاف/تشغيل، سحب = الفيديو التالي/السابق
        View touch = new View(this);
        final float[] y0 = new float[1];
        touch.setOnTouchListener(new View.OnTouchListener() {
            @Override public boolean onTouch(View v, android.view.MotionEvent e) {
                if (e.getAction() == android.view.MotionEvent.ACTION_DOWN) { y0[0] = e.getY(); return true; }
                if (e.getAction() == android.view.MotionEvent.ACTION_UP) {
                    float dy = e.getY() - y0[0];
                    if (dy < -dp(80) && vPos < vList.size() - 1) { vPos++; vLoad(); }
                    else if (dy > dp(80) && vPos > 0) { vPos--; vLoad(); }
                    else if (Math.abs(dy) < dp(12)) vTogglePause();
                    return true;
                }
                return true;
            }
        });
        fl.addView(touch, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        // الأعلى: رجوع + قائمة
        TextView back = backBtn(new Runnable() { @Override public void run() { d.dismiss(); } });
        FrameLayout.LayoutParams bl = new FrameLayout.LayoutParams(dp(40), dp(40), Gravity.TOP | Gravity.LEFT);
        bl.setMargins(dp(14), statusH() + dp(8), 0, 0);
        fl.addView(back, bl);
        TextView more = tv(Color.WHITE, 22, true);
        more.setText("⋮");
        more.setGravity(Gravity.CENTER);
        more.setBackground(oval(0xCC2A2A2A, 0x00000000));
        more.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) { if (vPos < vList.size()) showMenu(vList.get(vPos)); }
        });
        FrameLayout.LayoutParams ml = new FrameLayout.LayoutParams(dp(44), dp(44), Gravity.TOP | Gravity.RIGHT);
        ml.setMargins(0, statusH() + dp(8), dp(14), 0);
        fl.addView(more, ml);

        // الجنب: الدعم، هدف، تعليق، تمريرة، حفظ، مشاركة
        LinearLayout side = new LinearLayout(this);
        side.setOrientation(LinearLayout.VERTICAL);
        side.setGravity(Gravity.CENTER_HORIZONTAL);
        side.addView(sideBtn(0, 11, new Runnable() { public void run() {
            JSONObject o = vList.get(vPos); String pk = String.valueOf(o.optLong("id")); String ow = o.optString("user_id", "");
            if (ow.equals(uid)) { long[] sp = sup.get(pk); if (sp != null && sp[1] > 0) openSupporters(pk, ow); else toast("لا يوجد دعم بعد"); }
            else openSupportSheet(pk, ow);
        } }));
        side.addView(sideBtn(1, 2, new Runnable() { public void run() { toggleLike(vList.get(vPos)); } }));
        side.addView(sideBtn(2, 0, new Runnable() { public void run() { openComments(vList.get(vPos)); } }));
        side.addView(sideBtn(3, 1, new Runnable() { public void run() { toggleRepost(vList.get(vPos)); } }));
        side.addView(sideBtn(4, 4, new Runnable() { public void run() { toggleSave(vList.get(vPos)); } }));
        side.addView(sideBtn(5, 5, new Runnable() { public void run() { shareLink(vList.get(vPos)); } }));
        FrameLayout.LayoutParams sl = new FrameLayout.LayoutParams(dp(64), ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.LEFT | Gravity.CENTER_VERTICAL);
        sl.setMargins(dp(6), dp(30), 0, navH());
        fl.addView(side, sl);

        // الأسفل: الناشر والوصف
        LinearLayout info = new LinearLayout(this);
        info.setOrientation(LinearLayout.VERTICAL);
        info.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);
        LinearLayout who = new LinearLayout(this);
        who.setGravity(Gravity.CENTER_VERTICAL);
        FrameLayout av = new FrameLayout(this);
        vAvLetter = tv(NAVY, 16, true);
        vAvLetter.setGravity(Gravity.CENTER);
        vAvLetter.setBackground(oval(GOLD, 0xFFFFE7AD));
        av.addView(vAvLetter, new FrameLayout.LayoutParams(dp(44), dp(44)));
        vAvImg = new ImageView(this);
        vAvImg.setScaleType(ImageView.ScaleType.CENTER_CROP);
        vAvImg.setOutlineProvider(new ViewOutlineProvider() {
            @Override public void getOutline(View v, Outline o) { o.setOval(0, 0, v.getWidth(), v.getHeight()); }
        });
        vAvImg.setClipToOutline(true);
        av.addView(vAvImg, new FrameLayout.LayoutParams(dp(44), dp(44)));
        who.addView(av, new LinearLayout.LayoutParams(dp(44), dp(44)));
        LinearLayout nmCol = new LinearLayout(this);
        nmCol.setOrientation(LinearLayout.VERTICAL);
        nmCol.setPadding(dp(10), 0, 0, 0);
        vName = tv(Color.WHITE, 16, true);
        nmCol.addView(vName);
        vUser = tv(0xFFB9C2F0, 12, false);
        vUser.setTextAlignment(View.TEXT_ALIGNMENT_VIEW_START);
        vUser.setGravity(Gravity.START);
        nmCol.addView(vUser);
        who.addView(nmCol);
        info.addView(who);
        vCap = tv(0xFFE6E9FF, 14, false);
        vCap.setMaxLines(3);
        vCap.setPadding(0, dp(8), 0, 0);
        info.addView(vCap);
        FrameLayout.LayoutParams il = new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.BOTTOM);
        il.setMargins(dp(80), 0, dp(14), navH() + dp(54));
        fl.addView(info, il);

        // شريط التحكم
        LinearLayout ctl = new LinearLayout(this);
        ctl.setGravity(Gravity.CENTER_VERTICAL);
        ctl.setPadding(dp(14), 0, dp(14), 0);
        vPlay = tv(NAVY, 14, true);
        vPlay.setText("❚❚");
        vPlay.setGravity(Gravity.CENTER);
        GradientDrawable pg = new GradientDrawable();
        pg.setColor(0xFFF5A623); pg.setCornerRadius(dp(6));
        vPlay.setBackground(pg);
        vPlay.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { vTogglePause(); } });
        ctl.addView(vPlay, new LinearLayout.LayoutParams(dp(34), dp(34)));
        vMute = tv(Color.WHITE, 20, false);
        vMute.setText("🔊");
        vMute.setGravity(Gravity.CENTER);
        vMute.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) {
                vMuted = !vMuted;
                vMute.setText(vMuted ? "🔇" : "🔊");
                if (vMp != null) { try { vMp.setVolume(vMuted ? 0f : 1f, vMuted ? 0f : 1f); } catch (Exception ignore) {} }
            }
        });
        ctl.addView(vMute, new LinearLayout.LayoutParams(dp(44), dp(34)));
        vTrack = new FrameLayout(this);
        vTrack.setBackgroundColor(0x55FFFFFF);
        vFill = new View(this);
        vFill.setBackgroundColor(0xFFF5A623);
        vTrack.addView(vFill, new FrameLayout.LayoutParams(0, ViewGroup.LayoutParams.MATCH_PARENT));
        LinearLayout.LayoutParams trl = new LinearLayout.LayoutParams(0, dp(3), 1f);
        trl.setMargins(dp(8), 0, dp(8), 0);
        ctl.addView(vTrack, trl);
        vTime = tv(Color.WHITE, 12, false);
        ctl.addView(vTime);
        FrameLayout.LayoutParams cl = new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(44), Gravity.BOTTOM);
        cl.setMargins(0, 0, 0, navH());
        fl.addView(ctl, cl);
        vTrack.addOnLayoutChangeListener(new View.OnLayoutChangeListener() {
            @Override public void onLayoutChange(View v, int l, int t, int r, int b, int ol, int ot, int or2, int ob) { vTrackW = r - l; }
        });

        vTick = new Runnable() {
            @Override public void run() {
                try {
                    int dur = vVv.getDuration(), pos = vVv.getCurrentPosition();
                    if (dur > 0 && vTrackW > 0) {
                        vFill.getLayoutParams().width = (int) ((long) vTrackW * pos / dur);
                        vFill.requestLayout();
                        int rem = (dur - pos) / 1000;
                        vTime.setText("-" + (rem / 60) + ":" + (rem % 60 < 10 ? "0" : "") + (rem % 60));
                    }
                } catch (Exception ignore) {}
                if (vDlg != null && vDlg.isShowing()) vH.postDelayed(this, 400);
            }
        };
        vRefresh = new Runnable() { @Override public void run() { vBindCounts(); } };
        d.setContentView(fl);
        d.setOnDismissListener(new DialogInterface.OnDismissListener() {
            @Override public void onDismiss(DialogInterface di) {
                try { vVv.stopPlayback(); } catch (Exception ignore) {}
                vH.removeCallbacks(vTick);
                vRefresh = null;
                vDlg = null;
                refreshUi();
            }
        });
        d.show();
        vLoad();
    }

    protected void vTogglePause() {
        vPaused = !vPaused;
        try { if (vPaused) vVv.pause(); else vVv.start(); } catch (Exception ignore) {}
        vPlay.setText(vPaused ? "▶" : "❚❚");
    }

    // ---------------- الانتقال إلى صفحات الويب ----------------
    // لم يعد هناك ويب: أي إجراء غير مُحوَّل يُظهر رسالة بدل إغلاق الشاشة
    protected void goWeb(String action) {
        toast(L("هذه الميزة غير متاحة بعد", "This feature is not available yet"));
    }

    // ---------------- بطاقة المنشور ----------------
    protected View makeRow() {
        Wrap w = new Wrap(this);
        w.setPadding(dp(14), dp(6), dp(14), dp(6));
        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.VERTICAL);
        row.setPadding(dp(14), dp(14), dp(14), dp(12));
        GradientDrawable g = new GradientDrawable();
        g.setColor(CARD);
        g.setCornerRadius(dp(20));
        g.setStroke(dp(1), 0x33F5C35A);
        row.setBackground(g);
        final Holder h = w.h;
        row.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) {
                Object t0 = h.cm.getTag();
                if (t0 instanceof Integer) openComments((Integer) t0);
            }
        });

        LinearLayout head = new LinearLayout(this);
        head.setOrientation(LinearLayout.HORIZONTAL);
        head.setGravity(Gravity.CENTER_VERTICAL);
        FrameLayout avBox = new FrameLayout(this);
        h.avatar = tv(NAVY, 18, true);
        h.avatar.setGravity(Gravity.CENTER);
        h.avatar.setBackground(oval(GOLD, 0));
        avBox.addView(h.avatar, new FrameLayout.LayoutParams(dp(44), dp(44)));
        h.avImg = new ImageView(this);
        h.avImg.setScaleType(ImageView.ScaleType.CENTER_CROP);
        h.avImg.setOutlineProvider(new ViewOutlineProvider() {
            @Override public void getOutline(View v, Outline o) { o.setOval(0, 0, v.getWidth(), v.getHeight()); }
        });
        h.avImg.setClipToOutline(true);
        avBox.addView(h.avImg, new FrameLayout.LayoutParams(dp(44), dp(44)));
        head.addView(avBox, new LinearLayout.LayoutParams(dp(44), dp(44)));
        LinearLayout names = new LinearLayout(this);
        names.setOrientation(LinearLayout.VERTICAL);
        names.setPadding(dp(10), 0, dp(10), 0);
        h.name = tv(Color.WHITE, 16, true);
        h.time = tv(MUTED, 12, false);
        h.name.setGravity(Gravity.START);
        names.addView(h.name, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        LinearLayout trow = new LinearLayout(this);
        trow.setGravity(Gravity.CENTER_VERTICAL | Gravity.START);
        trow.addView(h.time);
        h.boostPill = tv(GOLD, 10, true);
        h.boostPill.setPadding(dp(7), dp(1), dp(7), dp(1));
        h.boostPill.setBackground(bxBg(0x26F5C35A, 0x66F5C35A, 8));
        h.boostPill.setVisibility(View.GONE);
        LinearLayout.LayoutParams bpl = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        bpl.setMarginStart(dp(8));
        trow.addView(h.boostPill, bpl);
        names.addView(trow, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        head.addView(names);
        head.addView(new View(this), new LinearLayout.LayoutParams(0, 1, 1f));
        h.supBtn = tv(NAVY, 13, true);
        h.supBtn.setText(L("ادعم", "Support"));
        h.supBtn.setGravity(Gravity.CENTER);
        GradientDrawable sbBg = new GradientDrawable();
        sbBg.setColor(GOLD);
        sbBg.setCornerRadius(dp(18));
        h.supBtn.setBackground(sbBg);
        h.supBtn.setPadding(dp(16), dp(6), dp(16), dp(6));
        h.supBtn.setVisibility(View.GONE);
        LinearLayout.LayoutParams sblp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        sblp.setMarginEnd(dp(34));
        head.addView(h.supBtn, sblp);
        h.more = tv(MUTED, 22, true);
        h.more.setText("⋮");
        h.more.setPadding(dp(12), dp(8), dp(6), dp(8));
        h.more.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) {
                Object t = v.getTag();
                if (t instanceof Integer) showMenu((Integer) t);
            }
        });
        head.addView(h.more);
        row.addView(head);

        h.body = tv(0xFFE6E9FF, 15, false);
        h.body.setPadding(0, dp(10), 0, dp(6));
        row.addView(h.body);

        h.img = new ImageView(this);
        h.img.setScaleType(ImageView.ScaleType.CENTER_CROP);
        h.img.setOutlineProvider(new ViewOutlineProvider() {
            @Override public void getOutline(View v, Outline o) { o.setRoundRect(0, 0, v.getWidth(), v.getHeight(), dp(14)); }
        });
        h.img.setClipToOutline(true);
        h.img.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) {
                Object t = v.getTag(R_TAG);
                if (t instanceof Integer) showImage(items.get((Integer) t).optString("image_url", ""));
            }
        });
        row.addView(h.img, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(220)));

        h.video = tv(Color.WHITE, 34, false);
        h.video.setText("▶");
        h.video.setGravity(Gravity.CENTER);
        GradientDrawable vg = new GradientDrawable();
        vg.setColor(0xFF050A26);
        vg.setCornerRadius(dp(14));
        h.video.setBackground(vg);
        h.video.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) {
                Object t = v.getTag();
                if (t instanceof Integer) openViewerFromFeed((Integer) t);
            }
        });
        row.addView(h.video, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(220)));

        h.rope = new LinearLayout(this);
        h.rope.setOrientation(LinearLayout.VERTICAL);
        h.rope.setPadding(0, dp(8), 0, 0);
        row.addView(h.rope);
        h.pred = new LinearLayout(this);
        h.pred.setOrientation(LinearLayout.VERTICAL);
        h.pred.setPadding(0, dp(8), 0, 0);
        row.addView(h.pred);

        LinearLayout acts = new LinearLayout(this);
        acts.setOrientation(LinearLayout.HORIZONTAL);
        acts.setPadding(0, dp(6), 0, 0);
        h.heart = tv(MUTED, 15, false);
        h.cm = tv(MUTED, 15, false);
        h.rp = tv(MUTED, 15, false);
        h.vw = tv(MUTED, 15, false);
        h.sv = tv(MUTED, 15, false);
        h.sh = tv(MUTED, 15, false);
        TextView[] all = new TextView[] { h.cm, h.rp, h.heart, h.vw, h.sv, h.sh };
        for (int q = 0; q < all.length; q++) {
            all[q].setPaddingRelative(q < 4 ? dp(14) : dp(2), dp(10), dp(2), dp(10));
            all[q].setGravity(Gravity.CENTER);
            acts.addView(all[q], new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, q >= 4 ? 0.7f : 1f));
        }
        h.rp.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) {
                Object t = v.getTag();
                if (t instanceof Integer) toggleRepost((Integer) t);
            }
        });
        h.sv.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) {
                Object t = v.getTag();
                if (t instanceof Integer) toggleSave((Integer) t);
            }
        });
        h.sh.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) {
                Object t = v.getTag();
                if (t instanceof Integer) shareLink(items.get((Integer) t));
            }
        });
        h.heart.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) {
                Object t = v.getTag();
                if (t instanceof Integer) toggleLike((Integer) t);
            }
        });
        h.cm.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) {
                Object t = v.getTag();
                if (t instanceof Integer) openComments((Integer) t);
            }
        });
        h.supbar = new LinearLayout(this);
        h.supbar.setGravity(Gravity.CENTER_VERTICAL);
        h.supbar.setPadding(dp(2), dp(4), dp(2), dp(2));
        h.supbar.setVisibility(View.GONE);
        row.addView(h.supbar, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        row.addView(acts);
        h.boostBox = new LinearLayout(this);
        h.boostBox.setOrientation(LinearLayout.VERTICAL);
        h.boostBox.setPadding(dp(12), dp(10), dp(12), dp(10));
        h.boostBox.setBackground(bxBg(0x12F5C35A, 0x40F5C35A, 12));
        h.boostBox.setVisibility(View.GONE);
        LinearLayout.LayoutParams bbl = new LinearLayout.LayoutParams(-1, ViewGroup.LayoutParams.WRAP_CONTENT);
        bbl.topMargin = dp(8);
        row.addView(h.boostBox, bbl);

        w.addView(row, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        return w;
    }

    protected static final int R_TAG = 0x7f0a0000 + 7; // مفتاح وسم ثانٍ للصورة

    // ---------------- القوائم والتفاعل ----------------
    protected void showMenu(final int idxIn) { showMenu(items.get(idxIn)); }

    protected void showMenu(final JSONObject o) {
        final int idx = items.indexOf(o);
        final String author = o.optString("user_id", "");
        final boolean mine = uid != null && uid.equals(author);
        final String tag = o.optString("author_name", "هذا المستخدم");
        final String pid = String.valueOf(o.optLong("id"));
        final List<String> labels = new ArrayList<String>();
        final List<Integer> icons = new ArrayList<Integer>();
        final List<Boolean> danger = new ArrayList<Boolean>();
        final List<Runnable> acts = new ArrayList<Runnable>();
        final boolean sv = saved.contains(pid);
        if (mine) {
            if (idx >= 0) { labels.add(L("تعديل النص", "Edit text")); icons.add(14); danger.add(false); acts.add(new Runnable() { public void run() { editPost(idx); } }); }
            labels.add(L("تعزيز المنشور", "Boost post")); icons.add(17); danger.add(false); acts.add(new Runnable() { public void run() { openBoost(pid); } });
            labels.add(L("التفاعلات", "Interactions")); icons.add(3); danger.add(false); acts.add(new Runnable() { public void run() { showEngagements(o); } });
            labels.add(sv ? L("إزالة من المحفوظات", "Remove from saved") : L("حفظ المنشور", "Save post")); icons.add(4); danger.add(false); acts.add(new Runnable() { public void run() { toggleSave(o); } });
            labels.add(L("مشاركة الرابط", "Share link")); icons.add(5); danger.add(false); acts.add(new Runnable() { public void run() { shareLink(o); } });
            if (idx >= 0) { labels.add(L("حذف المنشور", "Delete post")); icons.add(15); danger.add(true); acts.add(new Runnable() { public void run() { deletePost(idx); } }); }
        } else {
            final boolean fl = followSet.contains(author);
            labels.add(L("لا أريد رؤية هذا", "I don't want to see this")); icons.add(22); danger.add(false); acts.add(new Runnable() { public void run() { hidePost(o); } });
            labels.add(fl ? L("إلغاء متابعة ", "Unfollow ") + tag : L("متابعة ", "Follow ") + tag); icons.add(fl ? 19 : 18); danger.add(false); acts.add(new Runnable() { public void run() { toggleFollowUser(author); } });
            labels.add(L("كتم ", "Mute ") + tag); icons.add(20); danger.add(false); acts.add(new Runnable() { public void run() { muteUser(author); } });
            labels.add(L("حظر ", "Block ") + tag); icons.add(21); danger.add(true); acts.add(new Runnable() { public void run() { blockUser(author, tag); } });
            labels.add(L("إبلاغ", "Report")); icons.add(16); danger.add(true); acts.add(new Runnable() { public void run() { openReport("post", String.valueOf(pid), o); } });
            labels.add(L("التفاعلات", "Interactions")); icons.add(3); danger.add(false); acts.add(new Runnable() { public void run() { showEngagements(o); } });
            labels.add(sv ? L("إزالة من المحفوظات", "Remove from saved") : L("حفظ المنشور", "Save post")); icons.add(4); danger.add(false); acts.add(new Runnable() { public void run() { toggleSave(o); } });
            labels.add(L("مشاركة الرابط", "Share link")); icons.add(5); danger.add(false); acts.add(new Runnable() { public void run() { shareLink(o); } });
        }
        final Dialog d = sheetDialog(false);
        ScrollView sc = new ScrollView(this);
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setPadding(dp(8), dp(10), dp(8), navH() + dp(6));
        GradientDrawable pbg = new GradientDrawable();
        pbg.setColor(0xFF111A4A);
        pbg.setCornerRadii(new float[] { dp(24), dp(24), dp(24), dp(24), 0, 0, 0, 0 });
        pbg.setStroke(dp(1), 0x33F5C35A);
        box.setBackground(pbg);
        View gr = new View(this);
        gr.setBackground(oval(0x33FFFFFF, 0x00000000));
        GradientDrawable grg = new GradientDrawable();
        grg.setColor(0x33FFFFFF); grg.setCornerRadius(dp(3));
        gr.setBackground(grg);
        LinearLayout.LayoutParams grl = new LinearLayout.LayoutParams(dp(40), dp(5));
        grl.gravity = Gravity.CENTER_HORIZONTAL;
        grl.setMargins(0, 0, 0, dp(8));
        box.addView(gr, grl);
        for (int i = 0; i < labels.size(); i++) {
            final int fi = i;
            boolean dg = danger.get(i);
            LinearLayout rw = new LinearLayout(this);
            rw.setGravity(Gravity.CENTER_VERTICAL);
            rw.setPadding(dp(14), dp(13), dp(14), dp(13));
            ImageView ic = new ImageView(this);
            ic.setImageDrawable(new Ic(icons.get(i), dg ? 0xFFFF6B86 : GOLD, false, dp(22)));
            rw.addView(ic, new LinearLayout.LayoutParams(dp(22), dp(22)));
            TextView t = tv(dg ? 0xFFFF6B86 : Color.WHITE, 16, true);
            t.setText(labels.get(i));
            t.setPadding(dp(14), 0, 0, 0);
            rw.addView(t);
            rw.setOnClickListener(new View.OnClickListener() {
                @Override public void onClick(View v) { d.dismiss(); acts.get(fi).run(); }
            });
            box.addView(rw);
            if (i < labels.size() - 1) {
                View dv = new View(this);
                dv.setBackgroundColor(0x14FFFFFF);
                LinearLayout.LayoutParams dl = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 1);
                dl.setMargins(dp(14), 0, dp(14), 0);
                box.addView(dv, dl);
            }
        }
        sc.addView(box);
        d.setContentView(sc);
        d.show();
    }

    protected void shareLink(JSONObject o) {
        String link = postLink(String.valueOf(o.optLong("id")));
        String text = link.length() > 0 ? link : o.optString("content", "");
        Intent i = new Intent(Intent.ACTION_SEND);
        i.setType("text/plain");
        i.putExtra(Intent.EXTRA_TEXT, text);
        startActivity(Intent.createChooser(i, T("مشاركة")));
    }

    protected void editPost(final int idx) {
        final JSONObject o = items.get(idx);
        final EditText et = new EditText(this);
        et.setText(o.optString("content", ""));
        et.setMinLines(3);
        et.setGravity(Gravity.TOP | Gravity.START);
        new AlertDialog.Builder(this)
            .setTitle(L("تعديل المنشور", "Edit post"))
            .setView(et)
            .setNegativeButton(T("إلغاء"), null)
            .setPositiveButton(T("حفظ"), new DialogInterface.OnClickListener() {
                @Override public void onClick(DialogInterface d, int w) {
                    final String txt = et.getText().toString().trim();
                    final long id = o.optLong("id");
                    pool.execute(new Runnable() {
                        @Override public void run() {
                            String err = null;
                            try {
                                JSONObject b = new JSONObject();
                                b.put("p_id", id);
                                b.put("p_content", txt);
                                send("POST", "rpc/update_post_content", b.toString());
                                o.put("content", txt);
                            } catch (Exception e) { err = String.valueOf(e.getMessage()); }
                            final String fe = err;
                            runOnUiThread(new Runnable() {
                                @Override public void run() {
                                    if (fe != null) toast(L("تعذّر التعديل: ", "Could not edit: ") + fe);
                                    else refreshUi();
                                }
                            });
                        }
                    });
                }
            }).show();
    }

    protected void deletePost(final int idx) {
        final JSONObject o = items.get(idx);
        new AlertDialog.Builder(this)
            .setMessage(L("هل تريد حذف هذا المنشور؟", "Do you want to delete this post?"))
            .setNegativeButton(T("إلغاء"), null)
            .setPositiveButton(T("حذف"), new DialogInterface.OnClickListener() {
                @Override public void onClick(DialogInterface d, int w) {
                    final String id = String.valueOf(o.optLong("id"));
                    final String vp = o.isNull("video_path") ? "" : o.optString("video_path", "");
                    pool.execute(new Runnable() {
                        @Override public void run() {
                            String err = null;
                            try {
                                send("DELETE", "posts?id=eq." + id + "&user_id=eq." + uid, null);
                                if (vp.length() > 3) {
                                    cmRemove("post-videos", vp);
                                }
                                String ik = r2KeyFromUrl(o.isNull("image_url") ? "" : o.optString("image_url", ""));
                                if (ik != null) r2Delete(ik);
                            } catch (Exception e) { err = String.valueOf(e.getMessage()); }
                            final String fe = err;
                            runOnUiThread(new Runnable() {
                                @Override public void run() {
                                    if (fe != null) { toast(L("تعذّر الحذف: ", "Could not delete: ") + fe); return; }
                                    items.remove(o);
                                    refreshUi();
                                }
                            });
                        }
                    });
                }
            }).show();
    }

    protected void bindRope(Holder h, final JSONObject o) {
        h.rope.removeAllViews();
        final String tt = o.isNull("topic_type") ? "" : o.optString("topic_type", "");
        String[] T = TOPICS.get(tt);
        if (tt.length() == 0 || T == null) { h.rope.setVisibility(View.GONE); return; }
        h.rope.setVisibility(View.VISIBLE);
        final String pk = String.valueOf(o.optLong("id"));
        long[] r = ropes.get(pk);
        if (r == null) r = new long[] { 0, 0, -1 };
        boolean cmp = "compare".equals(tt);
        String la = cmp ? o.optString("topic_name", "") : T[1];
        String lb = cmp ? o.optString("topic_name_b", "") : T[2];
        String subject = cmp ? (la + " ⟷ " + lb) : o.optString("topic_name", "");
        long tot = r[0] + r[1];

        LinearLayout head = new LinearLayout(this);
        head.setGravity(Gravity.CENTER_VERTICAL);
        TextView chip = tv(GOLD, 12, true);
        chip.setText(T[0]);
        chip.setPadding(dp(10), dp(2), dp(10), dp(2));
        GradientDrawable cg = new GradientDrawable();
        cg.setColor(0x29F5C35A);
        cg.setCornerRadius(dp(12));
        chip.setBackground(cg);
        head.addView(chip);
        TextView nm = tv(Color.WHITE, 14, true);
        nm.setText(subject);
        nm.setPadding(dp(8), 0, dp(8), 0);
        head.addView(nm, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        if (tot > 0) {
            TextView tv2 = tv(MUTED, 11, false);
            tv2.setText(tot + L(" صوت", " votes"));
            head.addView(tv2);
        }
        h.rope.addView(head);

        LinearLayout btns = new LinearLayout(this);
        btns.setPadding(0, dp(8), 0, 0);
        for (int side = 0; side < 2; side++) {
            final int sd = side;
            boolean on = r[2] == side;
            TextView b = tv(on ? (side == 0 ? 0xFF062A24 : Color.WHITE) : (side == 0 ? 0xFF2DE2C4 : 0xFFFF8FA1), 13, true);
            b.setText((side == 0 ? la : lb) + " · " + r[side]);
            b.setGravity(Gravity.CENTER);
            GradientDrawable bg = new GradientDrawable();
            bg.setCornerRadius(dp(22));
            int base = side == 0 ? 0xFF2DE2C4 : 0xFFFF4D6D;
            bg.setColor(on ? base : (side == 0 ? 0x1F2DE2C4 : 0x1FFF4D6D));
            bg.setStroke(dp(1), side == 0 ? 0x802DE2C4 : 0x80FF4D6D);
            b.setBackground(bg);
            b.setOnClickListener(new View.OnClickListener() {
                @Override public void onClick(View v) { ropeVote(pk, sd); }
            });
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, dp(40), 1f);
            lp.setMargins(dp(4), 0, dp(4), 0);
            btns.addView(b, lp);
        }
        h.rope.addView(btns);
    }

    protected void ropeVote(final String pk, int side) {
        final long[] r = ropes.get(pk);
        if (r == null) return;
        final long[] old = new long[] { r[0], r[1], r[2] };
        int prev = (int) r[2];
        int next = prev == side ? -1 : side;
        if (prev == 0 || prev == 1) r[prev] = Math.max(0, r[prev] - 1);
        if (next != -1) r[next]++;
        r[2] = next;
        refreshUi();
        final int fn = next;
        pool.execute(new Runnable() {
            @Override public void run() {
                try {
                    rpc("rope_vote", "{\"p_post\":" + pk + ",\"p_side\":" + fn + "}");
                } catch (Exception e) {
                    runOnUiThread(new Runnable() {
                        @Override public void run() {
                            r[0] = old[0]; r[1] = old[1]; r[2] = old[2];
                            refreshUi();
                            toast(L("تعذّر تسجيل صوتك", "Could not record your vote"));
                        }
                    });
                }
            }
        });
    }

    protected String predWhen(String iso, boolean wantDay) {
        try {
            SimpleDateFormat f = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss");
            f.setTimeZone(TimeZone.getTimeZone("UTC"));
            Date d = f.parse(iso.substring(0, 19));
            if (!wantDay) return new SimpleDateFormat("HH:mm").format(d);
            SimpleDateFormat day = new SimpleDateFormat("yyyyMMdd");
            String a = day.format(d), b = day.format(new Date()), c2 = day.format(new Date(System.currentTimeMillis() + 86400000L));
            if (a.equals(b)) return "اليوم";
            if (a.equals(c2)) return "غدًا";
            return new SimpleDateFormat("dd/MM").format(d);
        } catch (Exception e) {
            return "";
        }
    }

    protected String initials(String n) {
        String t = n == null ? "?" : n.trim();
        String[] w = t.split("\\s+");
        String r = w.length > 1 ? (w[0].substring(0, 1) + w[1].substring(0, 1)) : t.substring(0, Math.min(2, t.length()));
        return r.toUpperCase();
    }

    protected View crest(String n) {
        TextView c = tv(Color.WHITE, 15, true);
        c.setText(initials(n));
        c.setGravity(Gravity.CENTER);
        c.setBackground(oval(0xFF1C2766, 0x24FFFFFF));
        return c;
    }

    protected void bindPred(Holder h, JSONObject o) {
        h.pred.removeAllViews();
        final String pk = String.valueOf(o.optLong("id"));
        final JSONObject r = preds.get(pk);
        if (r == null) { h.pred.setVisibility(View.GONE); return; }
        h.pred.setVisibility(View.VISIBLE);
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setPadding(dp(12), dp(12), dp(12), dp(12));
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(0xFF0D1440);
        bg.setCornerRadius(dp(14));
        bg.setStroke(dp(1), 0x1AFFFFFF);
        box.setBackground(bg);

        String status = r.optString("status", "");
        boolean hasScore = !r.isNull("home_score") && !r.isNull("away_score");
        boolean fin = "FINISHED".equals(status) && hasScore;
        boolean started = false;
        try {
            SimpleDateFormat f = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss");
            f.setTimeZone(TimeZone.getTimeZone("UTC"));
            Date md = f.parse(r.optString("match_date", "").substring(0, 19));
            started = !fin && (!"NOT_STARTED".equals(status) || md.getTime() <= System.currentTimeMillis());
        } catch (Exception ignore) {}
        int pick = r.optInt("pick", 0);
        int outcome = -1;
        if (fin) {
            int hs = r.optInt("home_score"), as = r.optInt("away_score");
            outcome = hs > as ? 0 : (hs == as ? 1 : 2);
        }

        LinearLayout top = new LinearLayout(this);
        top.setGravity(Gravity.CENTER_VERTICAL);
        TextView pill = tv(fin ? (outcome == pick ? 0xFF2DE2C4 : 0xFFFF8FA1) : GOLD, 12, true);
        pill.setText(fin ? (outcome == pick ? L("صحّ ✓", "Correct ✓") : L("خطأ ✗", "Wrong ✗")) : L("توقّع", "Predict"));
        pill.setPadding(dp(11), dp(3), dp(11), dp(3));
        GradientDrawable pg = new GradientDrawable();
        pg.setCornerRadius(dp(14));
        pg.setColor(fin ? (outcome == pick ? 0x262DE2C4 : 0x26FF4D6D) : 0x26F5C35A);
        pg.setStroke(dp(1), fin ? (outcome == pick ? 0x992DE2C4 : 0x99FF4D6D) : 0x80F5C35A);
        pill.setBackground(pg);
        top.addView(pill);
        top.addView(new View(this), new LinearLayout.LayoutParams(0, 1, 1f));
        TextView comp = tv(0xFF8F9BD1, 11, true);
        comp.setText(r.optString("comp", ""));
        top.addView(comp);
        box.addView(top);

        String ta = r.optString("team_a", ""), tb = r.optString("team_b", "");
        LinearLayout mid = new LinearLayout(this);
        mid.setGravity(Gravity.CENTER_VERTICAL);
        mid.setPadding(0, dp(10), 0, 0);
        LinearLayout colA = new LinearLayout(this);
        colA.setOrientation(LinearLayout.VERTICAL);
        colA.setGravity(Gravity.CENTER_HORIZONTAL);
        colA.addView(crest(ta), new LinearLayout.LayoutParams(dp(44), dp(44)));
        TextView na = tv(0xFFE8ECFF, 12, true);
        na.setText(teamName(ta));
        na.setGravity(Gravity.CENTER);
        na.setSingleLine(true);
        colA.addView(na);
        LinearLayout colB = new LinearLayout(this);
        colB.setOrientation(LinearLayout.VERTICAL);
        colB.setGravity(Gravity.CENTER_HORIZONTAL);
        colB.addView(crest(tb), new LinearLayout.LayoutParams(dp(44), dp(44)));
        TextView nb = tv(0xFFE8ECFF, 12, true);
        nb.setText(teamName(tb));
        nb.setGravity(Gravity.CENTER);
        nb.setSingleLine(true);
        colB.addView(nb);
        LinearLayout ctr = new LinearLayout(this);
        ctr.setOrientation(LinearLayout.VERTICAL);
        ctr.setGravity(Gravity.CENTER_HORIZONTAL);
        ctr.setMinimumWidth(dp(80));
        TextView d1 = tv(0xFF8F9BD1, 11, true);
        TextView d2;
        String score = r.optInt("away_score") + " - " + r.optInt("home_score");
        if (fin) { d1.setText(T("انتهت")); d2 = tv(GOLD, 24, true); d2.setText(score); }
        else if (started) { d1.setText(T("جارية")); d2 = tv(GOLD, 24, true); d2.setText(hasScore ? score : "—"); }
        else { d1.setText(predWhen(r.optString("match_date", ""), true)); d2 = tv(Color.WHITE, 18, true); d2.setText(predWhen(r.optString("match_date", ""), false)); }
        d1.setGravity(Gravity.CENTER);
        d2.setGravity(Gravity.CENTER);
        d2.setLayoutDirection(View.LAYOUT_DIRECTION_LTR);
        ctr.addView(d1);
        ctr.addView(d2);
        mid.addView(colA, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        mid.addView(ctr);
        mid.addView(colB, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        box.addView(mid);

        final String[] lab = new String[] { ta, T("تعادل"), tb };
        TextView mine = tv(0xFFCDD6FF, 13, true);
        mine.setGravity(Gravity.CENTER);
        mine.setPadding(0, dp(9), 0, 0);
        mine.setText(L("📌 توقّع صاحب المنشور: ", "📌 Author's prediction: ") + (pick == 1 ? lab[1] : (T("فوز ") + lab[Math.max(0, Math.min(2, pick))])));
        box.addView(mine);

        boolean open = !fin && !started;
        boolean owner = r.optBoolean("is_owner", false);
        if (r.isNull("n0")) {
            LinearLayout bt = new LinearLayout(this);
            bt.setPadding(0, dp(10), 0, 0);
            for (int i = 0; i < 3; i++) {
                final int pi = i;
                TextView b = tv(0xFFE8ECFF, 12, true);
                b.setText(i == 1 ? lab[1] : (T("فوز ") + lab[i]));
                b.setGravity(Gravity.CENTER);
                b.setSingleLine(true);
                GradientDrawable bb = new GradientDrawable();
                bb.setColor(0x0AFFFFFF);
                bb.setCornerRadius(dp(10));
                bb.setStroke(dp(1), 0x2EFFFFFF);
                b.setBackground(bb);
                b.setOnClickListener(new View.OnClickListener() {
                    @Override public void onClick(View v) { predVote(pk, pi); }
                });
                LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, dp(38), 1f);
                lp.setMargins(dp(3), 0, dp(3), 0);
                bt.addView(b, lp);
            }
            box.addView(bt);
            TextView note = tv(0xFF8F9BD1, 11, false);
            note.setGravity(Gravity.CENTER);
            note.setPadding(0, dp(7), 0, 0);
            note.setText(L("صوّت لترى نسب الجمهور", "Vote to see audience results"));
            box.addView(note);
        } else {
            long[] n = new long[] { r.optLong("n0"), r.optLong("n1"), r.optLong("n2") };
            long tot = n[0] + n[1] + n[2];
            int mineSel = r.isNull("mine") ? -1 : r.optInt("mine", -1);
            LinearLayout bars = new LinearLayout(this);
            bars.setOrientation(LinearLayout.VERTICAL);
            bars.setPadding(0, dp(10), 0, 0);
            for (int i = 0; i < 3; i++) {
                final int pi = i;
                int pc = tot > 0 ? (int) Math.round(n[i] * 100.0 / tot) : 0;
                FrameLayout bar = new FrameLayout(this);
                GradientDrawable bgb = new GradientDrawable();
                bgb.setColor(0x0FFFFFFF);
                bgb.setCornerRadius(dp(8));
                bar.setBackground(bgb);
                View fill = new View(this);
                fill.setBackgroundColor(mineSel == i ? 0x612DE2C4 : 0x47F5C35A);
                bar.addView(fill, new FrameLayout.LayoutParams(0, ViewGroup.LayoutParams.MATCH_PARENT));
                final View ff = fill;
                final int fpc = pc;
                bar.addOnLayoutChangeListener(new View.OnLayoutChangeListener() {
                    @Override public void onLayoutChange(View v, int l, int t, int r2, int b, int ol, int ot, int or2, int ob) {
                        ViewGroup.LayoutParams lp = ff.getLayoutParams();
                        int w = (r2 - l) * fpc / 100;
                        if (lp.width != w) { lp.width = w; ff.setLayoutParams(lp); }
                    }
                });
                LinearLayout line = new LinearLayout(this);
                line.setGravity(Gravity.CENTER_VERTICAL);
                line.setPadding(dp(10), 0, dp(10), 0);
                TextView t1 = tv(Color.WHITE, 12, true);
                t1.setText((i == 1 ? lab[1] : lab[i]) + (pick == i ? " 📌" : "") + (mineSel == i ? L(" · صوتك", " · your vote") : ""));
                line.addView(t1, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
                TextView t2 = tv(Color.WHITE, 12, true);
                t2.setText(pc + "%");
                line.addView(t2);
                bar.addView(line, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
                if (open && !owner) {
                    bar.setOnClickListener(new View.OnClickListener() {
                        @Override public void onClick(View v) { predVote(pk, pi); }
                    });
                }
                LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(32));
                lp.setMargins(0, dp(3), 0, dp(3));
                bars.addView(bar, lp);
            }
            box.addView(bars);
            TextView note = tv(0xFF8F9BD1, 11, false);
            note.setGravity(Gravity.CENTER);
            note.setText(tot + L(" صوت", " votes"));
            box.addView(note);
        }
        h.pred.addView(box);
    }

    protected void predVote(final String pk, final int pick) {
        final JSONObject r = preds.get(pk);
        if (r == null || r.optBoolean("is_owner", false)) return;
        pool.execute(new Runnable() {
            @Override public void run() {
                String err = null;
                try {
                    rpc("vote_prediction", "{\"p_post\":" + pk + ",\"p_pick\":" + pick + "}");
                    JSONArray a = new JSONArray(rpc("get_prediction_info", "{\"p_ids\":[" + pk + "]}"));
                    for (int i = 0; i < a.length(); i++) preds.put(String.valueOf(a.getJSONObject(i).optLong("post_id")), a.getJSONObject(i));
                } catch (Exception e) { err = String.valueOf(e.getMessage()); }
                final String fe = err;
                runOnUiThread(new Runnable() {
                    @Override public void run() {
                        if (fe != null) toast(fe.contains("voting_closed") ? "أُغلق التصويت: المباراة بدأت." : "تعذّر تسجيل صوتك");
                        refreshUi();
                    }
                });
            }
        });
    }

    protected void recordView(JSONObject o, int[] s) {
        final String pk = String.valueOf(o.optLong("id"));
        if (uid == null || viewedSession.contains(pk)) return;
        viewedSession.add(pk);
        if (viewedMine.contains(pk)) return;
        viewedMine.add(pk);
        s[3]++;
        pool.execute(new Runnable() {
            @Override public void run() {
                try {
                    sendUrl("POST", url + "/rest/v1/post_views?on_conflict=post_id,user_id", "{\"post_id\":" + pk + ",\"user_id\":\"" + uid + "\"}", "resolution=ignore-duplicates,return=minimal");
                } catch (Exception ignore) {}
            }
        });
    }

    protected void toggleRepost(int idx) { toggleRepost(items.get(idx)); }

    protected void toggleRepost(JSONObject post) {
        final String k = String.valueOf(post.optLong("id"));
        final int[] s = stats.get(k);
        if (s == null || uid == null) return;
        final boolean was = reposted.contains(k);
        if (was) { reposted.remove(k); s[2] = Math.max(0, s[2] - 1); } else { reposted.add(k); s[2]++; }
        refreshUi();
        pool.execute(new Runnable() {
            @Override public void run() {
                try {
                    if (was) send("DELETE", "post_reposts?post_id=eq." + k + "&user_id=eq." + uid, null);
                    else { send("POST", "post_reposts", "{\"post_id\":" + k + ",\"user_id\":\"" + uid + "\"}"); queueNotify("repost", ownerOf(k), k, contentOf(k), null); }
                } catch (Exception e) {
                    runOnUiThread(new Runnable() {
                        @Override public void run() {
                            if (was) { reposted.add(k); s[2]++; } else { reposted.remove(k); s[2] = Math.max(0, s[2] - 1); }
                            refreshUi();
                            toast(L("تعذّرت إعادة النشر", "Could not repost"));
                        }
                    });
                }
            }
        });
    }

    protected void toggleSave(int idx) { toggleSave(items.get(idx)); }

    protected void toggleSave(JSONObject post) {
        final String k = String.valueOf(post.optLong("id"));
        if (uid == null) return;
        final boolean was = saved.contains(k);
        if (was) saved.remove(k); else saved.add(k);
        refreshUi();
        toast(was ? L("أُزيل من المحفوظات", "Removed from saved") : L("تم حفظ المنشور 🔖", "Post saved 🔖"));
        pool.execute(new Runnable() {
            @Override public void run() {
                try {
                    if (was) send("DELETE", "post_bookmarks?post_id=eq." + k + "&user_id=eq." + uid, null);
                    else send("POST", "post_bookmarks", "{\"post_id\":" + k + ",\"user_id\":\"" + uid + "\"}");
                } catch (Exception e) {
                    runOnUiThread(new Runnable() {
                        @Override public void run() {
                            if (was) saved.add(k); else saved.remove(k);
                            refreshUi();
                            toast(L("تعذّر الحفظ", "Could not save"));
                        }
                    });
                }
            }
        });
    }

    protected void showEngagements(JSONObject o) {
        int[] s = stats.get(String.valueOf(o.optLong("id")));
        if (s == null) s = new int[] { 0, 0, 0, 0 };
        new AlertDialog.Builder(this)
            .setTitle(L("التفاعلات مع المنشور", "Post interactions"))
            .setMessage(L("المشاهدات: ", "Views: ") + s[3] + L("\nالأهداف: ", "\nGoals: ") + s[0] + L("\nالتمريرات: ", "\nPasses: ") + s[2] + L("\nالردود: ", "\nReplies: ") + s[1])
            .setPositiveButton(L("حسنًا", "OK"), null)
            .show();
    }

    protected void toggleFollowUser(final String target) {
        if (uid == null || target.equals(uid)) return;
        final boolean was = followSet.contains(target);
        if (was) followSet.remove(target); else followSet.add(target);
        toast(was ? L("تم إلغاء المتابعة", "Unfollowed") : L("تمت المتابعة ✅", "Following ✅"));
        pool.execute(new Runnable() {
            @Override public void run() {
                try {
                    if (was) send("DELETE", "user_follows?follower_id=eq." + uid + "&following_id=eq." + target, null);
                    else { send("POST", "user_follows", "{\"follower_id\":\"" + uid + "\",\"following_id\":\"" + target + "\"}"); queueNotify("follow", target, null, null, null); }
                } catch (Exception e) {
                    runOnUiThread(new Runnable() {
                        @Override public void run() {
                            if (was) followSet.add(target); else followSet.remove(target);
                            toast(T("تعذّر التنفيذ"));
                        }
                    });
                }
            }
        });
    }

    protected void dropUser(String target) {
        List<JSONObject> rm = new ArrayList<JSONObject>();
        for (JSONObject p : items) if (target.equals(p.optString("user_id", ""))) rm.add(p);
        items.removeAll(rm);
        refreshUi();
    }

    protected void muteUser(final String target) {
        if (uid == null || target.equals(uid)) return;
        muteSet.add(target);
        dropUser(target);
        toast(L("تم الكتم", "Muted"));
        pool.execute(new Runnable() {
            @Override public void run() {
                try { send("POST", "user_mutes", "{\"user_id\":\"" + uid + "\",\"muted_id\":\"" + target + "\"}"); } catch (Exception ignore) {}
            }
        });
    }

    protected void blockUser(final String target, String tag) {
        if (uid == null || target.equals(uid)) return;
        new AlertDialog.Builder(this)
            .setMessage(L("هل تريد حظر ", "Do you want to block ") + tag + L("؟ لن ترى منشوراته وردوده.", "? You won't see their posts or replies."))
            .setNegativeButton(T("إلغاء"), null)
            .setPositiveButton(T("حظر"), new DialogInterface.OnClickListener() {
                @Override public void onClick(DialogInterface d, int w) {
                    blockSet.add(target);
                    followSet.remove(target);
                    dropUser(target);
                    toast(L("تم الحظر", "Blocked"));
                    pool.execute(new Runnable() {
                        @Override public void run() {
                            try {
                                send("POST", "user_blocks", "{\"user_id\":\"" + uid + "\",\"blocked_id\":\"" + target + "\"}");
                                send("DELETE", "user_follows?follower_id=eq." + uid + "&following_id=eq." + target, null);
                            } catch (Exception ignore) {}
                        }
                    });
                }
            }).show();
    }

    protected void hidePost(JSONObject o) {
        String k = String.valueOf(o.optLong("id"));
        hiddenSet.add(k);
        SharedPreferences sp = getSharedPreferences("zn", MODE_PRIVATE);
        sp.edit().putString("hidden", android.text.TextUtils.join(",", hiddenSet)).apply();
        items.remove(o);
        refreshUi();
        toast(L("تم إخفاء المنشور", "Post hidden"));
    }

    protected String ownerOf(String pk) {
        try {
            for (JSONObject p : new ArrayList<JSONObject>(items)) if (pk.equals(String.valueOf(p.optLong("id")))) return p.optString("user_id", "");
        } catch (Exception ignore) {}
        return "";
    }
    protected String contentOf(String pk) {
        try {
            for (JSONObject p : new ArrayList<JSONObject>(items)) if (pk.equals(String.valueOf(p.optLong("id")))) return p.optString("content", "");
        } catch (Exception ignore) {}
        return "";
    }

    protected void toggleLike(int idx) { toggleLike(items.get(idx)); }

    protected void toggleLike(JSONObject post) {
        final String k = String.valueOf(post.optLong("id"));
        final int[] s = stats.get(k);
        if (s == null || uid == null) return;
        final boolean was = liked.contains(k);
        if (was) { liked.remove(k); s[0] = Math.max(0, s[0] - 1); } else { liked.add(k); s[0]++; }
        refreshUi();
        pool.execute(new Runnable() {
            @Override public void run() {
                try {
                    if (was) send("DELETE", "post_likes?post_id=eq." + k + "&user_id=eq." + uid, null);
                    else { send("POST", "post_likes", "{\"post_id\":" + k + ",\"user_id\":\"" + uid + "\"}"); queueNotify("like", ownerOf(k), k, contentOf(k), null); }
                } catch (Exception e) {
                    runOnUiThread(new Runnable() {
                        @Override public void run() {
                            if (was) { liked.add(k); s[0]++; } else { liked.remove(k); s[0] = Math.max(0, s[0] - 1); }
                            refreshUi();
                            toast(L("تعذّر حفظ الإعجاب", "Could not save the like"));
                        }
                    });
                }
            }
        });
    }


    protected void bindPost(View cv, int i) {
        Holder h = ((Wrap) cv).h;
        JSONObject o = items.get(i);
        String nm2 = o.optString("author_name", "");
        h.avatar.setText(nm2.length() > 0 ? nm2.substring(0, 1).toUpperCase() : "?");
        String ph = photos.get(o.optString("user_id", ""));
        if (ph != null) { h.avImg.setVisibility(View.VISIBLE); loadImage(ph, h.avImg); }
        else { h.avImg.setTag(null); h.avImg.setVisibility(View.GONE); }
        h.name.setText(nm2);
        String un8 = unames.get(o.optString("user_id", ""));
        h.time.setText((un8 != null ? "@" + un8 + " · " : "") + ago(o.optString("created_at", "")));
        String c = o.optString("content", "");
        h.body.setText(c);
        h.body.setVisibility(c.length() > 0 ? View.VISIBLE : View.GONE);
        String im = o.isNull("image_url") ? "" : o.optString("image_url", "");
        String vd = o.isNull("video_url") ? "" : o.optString("video_url", "");
        if (im.length() > 4) {
            h.img.setVisibility(View.VISIBLE);
            loadImage(im, h.img);
            h.img.setTag(R_TAG, Integer.valueOf(i));
        } else { h.img.setTag(null); h.img.setVisibility(View.GONE); }
        h.video.setVisibility(vd.length() > 4 ? View.VISIBLE : View.GONE);
        int[] s = stats.get(String.valueOf(o.optLong("id")));
        if (s == null) s = new int[] { 0, 0, 0, 0 };
        boolean lk = liked.contains(String.valueOf(o.optLong("id")));
        h.heart.setText(String.valueOf(s[0]));
        setIc(h.heart, 2, lk ? 0xFF14F195 : MUTED, lk);
        Integer ti = Integer.valueOf(i);
        h.heart.setTag(ti);
        h.more.setTag(ti);
        h.video.setTag(ti);
        h.cm.setTag(ti);
        h.cm.setText(String.valueOf(s[1]));
        setIc(h.cm, 0, MUTED, false);
        String pk2 = String.valueOf(o.optLong("id"));
        boolean rpd = reposted.contains(pk2);
        h.rp.setText(String.valueOf(s[2]));
        setIc(h.rp, 1, rpd ? 0xFF14F195 : MUTED, false);
        h.rp.setTag(ti);
        h.vw.setText(String.valueOf(s[3]));
        setIc(h.vw, 3, MUTED, false);
        boolean svd = saved.contains(pk2);
        h.sv.setText("");
        setIc(h.sv, 4, svd ? 0xFF14F195 : MUTED, svd);
        h.sv.setTag(ti);
        h.sh.setText("");
        setIc(h.sh, 5, MUTED, false);
        h.sh.setTag(ti);
        bindRope(h, o);
        bindPred(h, o);
        bindSupport(h, o);
        bindBoost(h, o, s);
        recordView(o, s);
        final String au0 = o.optString("user_id", "");
        View.OnClickListener pc = new View.OnClickListener() { @Override public void onClick(View v) { if (au0.length() > 0) openProfileOf(au0); } };
        h.avatar.setOnClickListener(pc); h.avImg.setOnClickListener(pc); h.name.setOnClickListener(pc);
    }

    // ---------------- شاشة المنشور والردود (على نمط X) ----------------
    protected static final int RP_IMG = 7311, RP_VID = 7312;
    protected static final long RP_VID_MAX = 100L * 1024 * 1024;
    protected static final long RP_VID_SECS = 60;
    protected Bitmap rpImage;
    protected android.net.Uri rpVideoUri;
    protected String rpVideoName;
    protected Runnable rpOnMedia;

    protected void openComments(int idx) { openComments(items.get(idx)); }

    protected View rpAvatar(String name, String photo, int sz) {
        FrameLayout f = new FrameLayout(this);
        TextView t = tv(NAVY, sz > 40 ? 18 : 14, true);
        t.setGravity(Gravity.CENTER);
        t.setBackground(oval(GOLD, 0));
        t.setText(name != null && name.length() > 0 ? name.substring(0, 1).toUpperCase() : "?");
        f.addView(t, new FrameLayout.LayoutParams(dp(sz), dp(sz)));
        if (photo != null && photo.length() > 4) {
            ImageView iv = new ImageView(this);
            iv.setScaleType(ImageView.ScaleType.CENTER_CROP);
            iv.setOutlineProvider(new ViewOutlineProvider() {
                @Override public void getOutline(View v, Outline o) { o.setOval(0, 0, v.getWidth(), v.getHeight()); }
            });
            iv.setClipToOutline(true);
            f.addView(iv, new FrameLayout.LayoutParams(dp(sz), dp(sz)));
            loadImage(photo, iv);
        }
        return f;
    }

    protected String rpDate(String iso) {
        try {
            SimpleDateFormat f = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", java.util.Locale.US);
            f.setTimeZone(TimeZone.getTimeZone("UTC"));
            Date dt = f.parse(iso.substring(0, 19));
            return "‎" + new SimpleDateFormat("h:mm a · d MMM yyyy").format(dt);
        } catch (Exception e) { return ""; }
    }

    protected ImageView rpImageView(int hDp) {
        ImageView iv = new ImageView(this);
        iv.setScaleType(ImageView.ScaleType.CENTER_CROP);
        iv.setOutlineProvider(new ViewOutlineProvider() {
            @Override public void getOutline(View v, Outline o) { o.setRoundRect(0, 0, v.getWidth(), v.getHeight(), dp(14)); }
        });
        iv.setClipToOutline(true);
        iv.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) { Object t = v.getTag(); if (t instanceof String) showImage((String) t); }
        });
        return iv;
    }

    protected TextView rpVideoBox() {
        TextView vb = tv(Color.WHITE, 30, false);
        vb.setText("▶");
        vb.setGravity(Gravity.CENTER);
        GradientDrawable vg = new GradientDrawable();
        vg.setColor(0xFF050A26);
        vg.setCornerRadius(dp(14));
        vb.setBackground(vg);
        vb.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) { Object t = v.getTag(R_TAG); if (t instanceof String) playVideo((String) t); }
        });
        return vb;
    }

    protected static class RpH {
        FrameLayout av; TextView n, m, t, more, vid, acm, alk, ash, arp, avw, asv; ImageView img;
    }

    protected void openComments(final JSONObject post) {
        final long pid = post.optLong("id");
        final String pk = String.valueOf(pid);
        final String postUser = post.optString("user_id", "");
        final List<JSONObject> cm = new ArrayList<JSONObject>();
        final Dialog d = new Dialog(this, android.R.style.Theme_Material_NoActionBar);
        d.getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setBackgroundColor(NAVY);
        box.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);
        box.setOnApplyWindowInsetsListener(new View.OnApplyWindowInsetsListener() {
            @Override public WindowInsets onApplyWindowInsets(View v, WindowInsets ins) {
                v.setPadding(0, ins.getSystemWindowInsetTop(), 0, ins.getSystemWindowInsetBottom());
                return ins;
            }
        });
        LinearLayout bar = new LinearLayout(this);
        bar.setGravity(Gravity.CENTER_VERTICAL);
        bar.setPadding(dp(8), dp(8), dp(16), dp(8));
        TextView back = tv(Color.WHITE, 30, false);
        back.setText("›");
        back.setPadding(dp(14), 0, dp(14), dp(4));
        back.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { d.dismiss(); } });
        bar.addView(back);
        TextView title = tv(GOLD, 19, true);
        title.setText(L("المنشور", "Post"));
        bar.addView(title, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        box.addView(bar);
        View sep = new View(this);
        sep.setBackgroundColor(0x1AFFFFFF);
        box.addView(sep, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(1)));

        // ----- رأس القائمة: المنشور نفسه -----
        LinearLayout hdr = new LinearLayout(this);
        hdr.setOrientation(LinearLayout.VERTICAL);
        hdr.setPadding(dp(16), dp(14), dp(16), 0);
        LinearLayout hd1 = new LinearLayout(this);
        hd1.setGravity(Gravity.CENTER_VERTICAL);
        final FrameLayout hAv = new FrameLayout(this);
        hd1.addView(hAv, new LinearLayout.LayoutParams(dp(46), dp(46)));
        LinearLayout hn = new LinearLayout(this);
        hn.setOrientation(LinearLayout.VERTICAL);
        hn.setPadding(dp(10), 0, dp(10), 0);
        final TextView hName = tv(Color.WHITE, 16, true), hUser = tv(MUTED, 13, false);
        hName.setTextAlignment(View.TEXT_ALIGNMENT_VIEW_START); hUser.setTextAlignment(View.TEXT_ALIGNMENT_VIEW_START);
        hn.addView(hName); hn.addView(hUser);
        hd1.addView(hn, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        TextView hMore = tv(MUTED, 22, true);
        hMore.setText("⋮");
        hMore.setPadding(dp(12), dp(6), dp(6), dp(6));
        hMore.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { showMenu(post); } });
        hd1.addView(hMore);
        hdr.addView(hd1);
        String pc = post.optString("content", "");
        TextView hBody = tv(Color.WHITE, 18, false);
        hBody.setTextAlignment(View.TEXT_ALIGNMENT_VIEW_START);
        hBody.setText(pc);
        hBody.setPadding(0, dp(12), 0, dp(4));
        hBody.setVisibility(pc.length() > 0 ? View.VISIBLE : View.GONE);
        hdr.addView(hBody);
        String pim = post.isNull("image_url") ? "" : post.optString("image_url", "");
        String pvd = post.isNull("video_url") ? "" : post.optString("video_url", "");
        if (pim.length() > 4) {
            ImageView hi = rpImageView(220);
            loadImage(pim, hi);
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(220));
            lp.topMargin = dp(8);
            hdr.addView(hi, lp);
        }
        if (pvd.length() > 4) {
            TextView hv = rpVideoBox();
            hv.setTag(R_TAG, pvd);
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(220));
            lp.topMargin = dp(8);
            hdr.addView(hv, lp);
        }
        TextView hDate = tv(MUTED, 13, false);
        hDate.setTextAlignment(View.TEXT_ALIGNMENT_VIEW_START);
        hDate.setText(rpDate(post.optString("created_at", "")));
        hDate.setPadding(0, dp(12), 0, dp(10));
        hdr.addView(hDate);
        View l1 = new View(this); l1.setBackgroundColor(0x1AFFFFFF);
        hdr.addView(l1, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(1)));
        final TextView hCnt = tv(MUTED, 13, false);
        hCnt.setTextAlignment(View.TEXT_ALIGNMENT_VIEW_START);
        hCnt.setPadding(0, dp(10), 0, dp(10));
        hdr.addView(hCnt);
        View l2 = new View(this); l2.setBackgroundColor(0x1AFFFFFF);
        hdr.addView(l2, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(1)));
        LinearLayout hActs = new LinearLayout(this);
        final TextView aCm = tv(MUTED, 15, false), aRp = tv(MUTED, 15, false), aLk = tv(MUTED, 15, false), aVw = tv(MUTED, 15, false), aSv = tv(MUTED, 15, false), aSh = tv(MUTED, 15, false);
        TextView[] aa = { aCm, aRp, aLk, aVw, aSv, aSh };
        for (int q = 0; q < aa.length; q++) { aa[q].setPaddingRelative(q < 4 ? dp(14) : dp(2), dp(8), dp(2), dp(8)); hActs.addView(aa[q], new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, q >= 4 ? 0.7f : 1f)); }
        hdr.addView(hActs);
        View l3 = new View(this); l3.setBackgroundColor(0x1AFFFFFF);
        hdr.addView(l3, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(1)));
        // صف "اكتب ردك"
        LinearLayout hIn = new LinearLayout(this);
        hIn.setGravity(Gravity.CENTER_VERTICAL);
        hIn.setPadding(0, dp(12), 0, dp(12));
        final FrameLayout meAv = new FrameLayout(this);
        meAv.addView(rpAvatar(uname == null ? "" : uname, uavatar != null && uavatar.startsWith("http") ? uavatar : photos.get(uid == null ? "" : uid), 38));
        hIn.addView(meAv, new LinearLayout.LayoutParams(dp(38), dp(38)));
        TextView hHint = tv(MUTED, 15, false);
        hHint.setText(L("اكتب ردّك...", "Write your reply..."));
        hHint.setTextAlignment(View.TEXT_ALIGNMENT_VIEW_START);
        hHint.setPadding(dp(12), 0, dp(12), 0);
        hIn.addView(hHint, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        TextView hSend = tv(NAVY, 13, true);
        hSend.setText(L("رد", "Reply"));
        hSend.setGravity(Gravity.CENTER);
        GradientDrawable hsg = new GradientDrawable(); hsg.setColor(GOLD); hsg.setCornerRadius(dp(16));
        hSend.setBackground(hsg);
        hSend.setPadding(dp(18), dp(7), dp(18), dp(7));
        hIn.addView(hSend);
        hdr.addView(hIn);
        View l4 = new View(this); l4.setBackgroundColor(0x1AFFFFFF);
        hdr.addView(l4, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(1)));
        final TextView empty = tv(MUTED, 14, false);
        empty.setText("");
        empty.setPadding(0, dp(12), 0, dp(8));
        hdr.addView(empty);

        final Runnable hdrBind = new Runnable() {
            @Override public void run() {
                String nm = post.optString("author_name", "");
                hAv.removeAllViews();
                hAv.addView(rpAvatar(nm, photos.get(postUser), 46));
                hName.setText(nm);
                String un = unames.get(postUser);
                hUser.setText(un != null ? "@" + un : "");
                int[] s = stats.get(pk);
                if (s == null) s = new int[] { 0, 0, 0, 0 };
                hCnt.setText("‎" + s[3] + " " + L("مشاهدة", "views") + "     ‎" + s[0] + " " + L("إعجاب", "likes") + "     ‎" + s[2] + " " + L("إعادة", "reposts") + "     ‎" + Math.max(s[1], cm.size()) + " " + L("رد", "replies"));
                boolean lk = liked.contains(pk), rpd = reposted.contains(pk), svd = saved.contains(pk);
                aCm.setText(String.valueOf(Math.max(s[1], cm.size()))); setIc(aCm, 0, MUTED, false);
                aRp.setText(String.valueOf(s[2])); setIc(aRp, 1, rpd ? 0xFF14F195 : MUTED, false);
                aLk.setText(String.valueOf(s[0])); setIc(aLk, 2, lk ? 0xFF14F195 : MUTED, lk);
                aVw.setText(String.valueOf(s[3])); setIc(aVw, 3, MUTED, false);
                aSv.setText(""); setIc(aSv, 4, svd ? 0xFF14F195 : MUTED, svd);
                aSh.setText(""); setIc(aSh, 5, MUTED, false);
            }
        };
        hdrBind.run();
        View.OnClickListener pcl = new View.OnClickListener() { @Override public void onClick(View v) { if (postUser.length() > 0) openProfileOf(postUser); } };
        hAv.setOnClickListener(pcl); hName.setOnClickListener(pcl);
        final Runnable[] toComposer = new Runnable[1];
        final Runnable[] reloadRef = new Runnable[1];
        View.OnClickListener open = new View.OnClickListener() { @Override public void onClick(View v) { toComposer[0].run(); } };
        aCm.setOnClickListener(open); hIn.setOnClickListener(open); hSend.setOnClickListener(open);
        aLk.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { toggleLike(post); v.postDelayed(hdrBind, 500); } });
        aRp.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { toggleRepost(post); v.postDelayed(hdrBind, 500); } });
        aSv.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { toggleSave(post); v.postDelayed(hdrBind, 500); } });
        aSh.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { shareLink(post); } });

        ListView lv = new ListView(this);
        lv.setDivider(null);
        lv.setSelector(new ColorDrawable(Color.TRANSPARENT));
        lv.addHeaderView(hdr, null, false);
        final boolean[] cmAds = { false };
        final HashMap<Integer, View> cmAdViews = new HashMap<Integer, View>();
        final HashMap<Long, Integer> cLikes = new HashMap<Long, Integer>(), cKids = new HashMap<Long, Integer>();
        final Set<Long> cMine = new HashSet<Long>();
        final HashMap<Long, Integer> cReps = new HashMap<Long, Integer>(), cViews = new HashMap<Long, Integer>();
        final Set<Long> cRepMine = new HashSet<Long>(), cSaveMine = new HashSet<Long>();
        final BaseAdapter ca = new BaseAdapter() {
            // إعلان أصلي بعد الرد الثالث ثم كل 8 ردود (لغير المشترك)
            private boolean isAd(int p) { return cmAds[0] && p >= 3 && (p - 3) % 9 == 0; }
            private int idx(int p) { return cmAds[0] && p >= 3 ? p - ((p - 3) / 9 + 1) : p; }
            @Override public int getCount() { int n = cm.size(); return cmAds[0] && n >= 3 ? n + 1 + (n - 3) / 8 : n; }
            @Override public Object getItem(int i) { return isAd(i) ? null : cm.get(idx(i)); }
            @Override public long getItemId(int i) { return i; }
            @Override public int getItemViewType(int i) { return isAd(i) ? -1 : 0; }
            @Override public View getView(int i, View cv, ViewGroup p) {
                if (isAd(i)) {
                    View av = cmAdViews.get(i);
                    if (av == null) { av = adNativeView(); cmAdViews.put(i, av); }
                    return av;
                }
                i = idx(i);
                LinearLayout r;
                RpH h;
                if (cv == null) {
                    r = new LinearLayout(Home.this);
                    r.setOrientation(LinearLayout.HORIZONTAL);
                    h = new RpH();
                    h.av = new FrameLayout(Home.this);
                    LinearLayout.LayoutParams alp = new LinearLayout.LayoutParams(dp(38), dp(38));
                    alp.setMarginEnd(dp(10));
                    r.addView(h.av, alp);
                    LinearLayout col = new LinearLayout(Home.this);
                    col.setOrientation(LinearLayout.VERTICAL);
                    LinearLayout line = new LinearLayout(Home.this);
                    line.setGravity(Gravity.CENTER_VERTICAL);
                    LinearLayout nn = new LinearLayout(Home.this);
                    nn.setOrientation(LinearLayout.VERTICAL);
                    h.n = tv(Color.WHITE, 14, true);
                    h.m = tv(MUTED, 12, false);
                    h.n.setTextAlignment(View.TEXT_ALIGNMENT_VIEW_START); h.m.setTextAlignment(View.TEXT_ALIGNMENT_VIEW_START);
                    nn.addView(h.n); nn.addView(h.m);
                    line.addView(nn, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
                    h.more = tv(MUTED, 20, true);
                    h.more.setText("⋮");
                    h.more.setPadding(dp(10), dp(2), dp(2), dp(2));
                    line.addView(h.more);
                    col.addView(line);
                    h.t = tv(0xFFE6E9FF, 15, false);
                    h.t.setTextAlignment(View.TEXT_ALIGNMENT_VIEW_START);
                    h.t.setPadding(0, dp(4), 0, dp(2));
                    col.addView(h.t);
                    h.img = rpImageView(180);
                    LinearLayout.LayoutParams ilp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(180));
                    ilp.topMargin = dp(6);
                    col.addView(h.img, ilp);
                    h.vid = rpVideoBox();
                    LinearLayout.LayoutParams vlp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(160));
                    vlp.topMargin = dp(6);
                    col.addView(h.vid, vlp);
                    LinearLayout acts = new LinearLayout(Home.this);
                    h.acm = tv(MUTED, 15, false); h.arp = tv(MUTED, 15, false); h.alk = tv(MUTED, 15, false); h.avw = tv(MUTED, 15, false); h.asv = tv(MUTED, 15, false); h.ash = tv(MUTED, 15, false);
                    TextView[] at = { h.acm, h.arp, h.alk, h.avw, h.asv, h.ash };
                    for (int q = 0; q < at.length; q++) { at[q].setPaddingRelative(q < 4 ? dp(14) : dp(2), dp(6), dp(2), dp(6)); acts.addView(at[q], new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, q >= 4 ? 0.7f : 1f)); }
                    LinearLayout.LayoutParams alp2 = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
                    alp2.topMargin = dp(4);
                    col.addView(acts, alp2);
                    r.addView(col, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
                    r.setTag(h);
                    cv = r;
                }
                r = (LinearLayout) cv;
                h = (RpH) r.getTag();
                final JSONObject o = cm.get(i);
                boolean reply = !o.isNull("parent_id");
                r.setPaddingRelative(dp(reply ? 44 : 16), dp(12), dp(16), dp(12));
                final String au = o.optString("user_id", "");
                String nm = o.optString("author_name", "");
                h.av.removeAllViews();
                h.av.addView(rpAvatar(nm, photos.get(au), 38));
                h.n.setText(nm);
                String un = unames.get(au);
                h.m.setText((un != null ? "@" + un + " · " : "") + ago(o.optString("created_at", "")));
                String c = o.optString("content", "");
                h.t.setText(c.startsWith("::sticker::") ? c.substring(11) : c);
                h.t.setVisibility(c.length() > 0 ? View.VISIBLE : View.GONE);
                String im = o.isNull("image_url") ? "" : o.optString("image_url", "");
                String vd = o.isNull("video_url") ? "" : o.optString("video_url", "");
                if (im.length() > 4) { h.img.setVisibility(View.VISIBLE); loadImage(im, h.img); } else { h.img.setTag(null); h.img.setVisibility(View.GONE); }
                if (vd.length() > 4) { h.vid.setVisibility(View.VISIBLE); h.vid.setTag(R_TAG, vd); } else h.vid.setVisibility(View.GONE);
                View.OnClickListener pr = new View.OnClickListener() { @Override public void onClick(View v) { if (au.length() > 0) openProfileOf(au); } };
                h.av.setOnClickListener(pr); h.n.setOnClickListener(pr);
                h.more.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { rpMenu(o, reloadRef[0]); } });
                final long cid = o.optLong("id");
                Integer kc = cKids.get(cid), lcn = cLikes.get(cid);
                boolean clk = cMine.contains(cid);
                h.acm.setText(String.valueOf(kc == null ? 0 : kc)); setIc(h.acm, 0, MUTED, false);
                h.alk.setText(String.valueOf(lcn == null ? 0 : lcn)); setIc(h.alk, 2, clk ? 0xFF14F195 : MUTED, clk);
                Integer rcn = cReps.get(cid), vcn = cViews.get(cid);
                boolean rpm = cRepMine.contains(cid), svm = cSaveMine.contains(cid);
                h.arp.setText(String.valueOf(rcn == null ? 0 : rcn)); setIc(h.arp, 1, rpm ? 0xFF14F195 : MUTED, false);
                h.avw.setText(String.valueOf(vcn == null ? 0 : vcn)); setIc(h.avw, 3, MUTED, false);
                h.asv.setText(""); setIc(h.asv, 4, svm ? 0xFF14F195 : MUTED, svm);
                h.ash.setText(""); setIc(h.ash, 5, MUTED, false);
                h.arp.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) {
                    rpToggleReact(o, "repost", cReps, cRepMine, new Runnable() { @Override public void run() { notifyDataSetChanged(); } });
                } });
                h.asv.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) {
                    rpToggleReact(o, "save", null, cSaveMine, new Runnable() { @Override public void run() { notifyDataSetChanged(); } });
                } });
                h.acm.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { openReplyComposer(post, reloadRef[0], o); } });
                h.alk.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) {
                    rpToggleLike(o, cLikes, cMine, new Runnable() { @Override public void run() { notifyDataSetChanged(); } });
                } });
                h.ash.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { shareLink(post); } });
                return cv;
            }
        };
        lv.setAdapter(ca);
        if (uid != null) fetchTier(new TierCb() { @Override public void on(int tier) {
            if (tier < 1) { cmAds[0] = true; ca.notifyDataSetChanged(); }
        } });
        d.setOnDismissListener(new DialogInterface.OnDismissListener() { @Override public void onDismiss(DialogInterface x) { adNativeDestroy(); } });
        box.addView(lv, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));

        final Runnable reload = new Runnable() {
            @Override public void run() {
                pool.execute(new Runnable() {
                    @Override public void run() {
                        String err = null;
                        final List<JSONObject> got = new ArrayList<JSONObject>();
                        final HashMap<Long, Integer> tl = new HashMap<Long, Integer>(), tk = new HashMap<Long, Integer>();
                        final Set<Long> tm = new HashSet<Long>();
                        final HashMap<Long, Integer> trp = new HashMap<Long, Integer>(), tvw = new HashMap<Long, Integer>();
                        final Set<Long> trm = new HashSet<Long>(), tsm = new HashSet<Long>();
                        try {
                            JSONArray a = new JSONArray(get("post_comments?select=id,parent_id,user_id,author_name,content,created_at,hidden,image_url,video_url,video_path&post_id=eq." + pid + "&order=created_at.asc&limit=200"));
                            StringBuilder need = new StringBuilder();
                            Set<String> seen = new HashSet<String>();
                            if (postUser.length() > 0 && !unames.containsKey(postUser)) { need.append(postUser); seen.add(postUser); }
                            for (int k = 0; k < a.length(); k++) {
                                JSONObject o = a.getJSONObject(k);
                                if (o.optBoolean("hidden", false)) continue;
                                got.add(o);
                                String au = o.optString("user_id", "");
                                if (au.length() > 0 && !unames.containsKey(au) && !photos.containsKey(au) && seen.add(au)) { if (need.length() > 0) need.append(","); need.append(au); }
                            }
                            StringBuilder cids = new StringBuilder();
                            for (JSONObject o : got) {
                                if (cids.length() > 0) cids.append(",");
                                cids.append(o.optLong("id"));
                                if (!o.isNull("parent_id")) { long pp = o.optLong("parent_id"); Integer q0 = tk.get(pp); tk.put(pp, q0 == null ? 1 : q0 + 1); }
                            }
                            if (cids.length() > 0) {
                                try {
                                    JSONArray la = new JSONArray(get("comment_likes?select=comment_id,user_id&comment_id=in.(" + cids + ")&limit=5000"));
                                    for (int q = 0; q < la.length(); q++) {
                                        JSONObject lo = la.getJSONObject(q);
                                        long ci = lo.optLong("comment_id");
                                        Integer q1 = tl.get(ci); tl.put(ci, q1 == null ? 1 : q1 + 1);
                                        if (uid != null && uid.equals(lo.optString("user_id"))) tm.add(ci);
                                    }
                                } catch (Exception ignore) {}
                            }
                            if (cids.length() > 0) {
                                Set<Long> seenMine = new HashSet<Long>();
                                try {
                                    JSONArray ra = new JSONArray(get("comment_reactions?select=comment_id,user_id,kind&comment_id=in.(" + cids + ")&limit=10000"));
                                    for (int q = 0; q < ra.length(); q++) {
                                        JSONObject ro = ra.getJSONObject(q);
                                        long ci = ro.optLong("comment_id");
                                        String kd = ro.optString("kind"), ru = ro.optString("user_id");
                                        boolean me2 = uid != null && uid.equals(ru);
                                        if ("repost".equals(kd)) { Integer q1 = trp.get(ci); trp.put(ci, q1 == null ? 1 : q1 + 1); if (me2) trm.add(ci); }
                                        else if ("save".equals(kd)) { if (me2) tsm.add(ci); }
                                        else if ("view".equals(kd)) { Integer q1 = tvw.get(ci); tvw.put(ci, q1 == null ? 1 : q1 + 1); if (me2) seenMine.add(ci); }
                                    }
                                    // سجّل مشاهدتي لردود الآخرين مرة واحدة
                                    if (uid != null) {
                                        JSONArray nv = new JSONArray();
                                        for (JSONObject o : got) {
                                            long ci = o.optLong("id");
                                            if (uid.equals(o.optString("user_id")) || seenMine.contains(ci)) continue;
                                            nv.put(new JSONObject().put("comment_id", ci).put("user_id", uid).put("kind", "view"));
                                            Integer q1 = tvw.get(ci); tvw.put(ci, q1 == null ? 1 : q1 + 1);
                                        }
                                        if (nv.length() > 0) sendUrl("POST", url + "/rest/v1/comment_reactions?on_conflict=comment_id,user_id,kind", nv.toString(), "resolution=ignore-duplicates,return=minimal");
                                    }
                                } catch (Exception ignore) {}
                            }
                            if (need.length() > 0) {
                                try {
                                    JSONArray pa = new JSONArray(get("public_profiles?select=user_id,photo_url,username&user_id=in.(" + need + ")"));
                                    for (int q = 0; q < pa.length(); q++) {
                                        JSONObject po = pa.getJSONObject(q);
                                        String ph = po.isNull("photo_url") ? "" : po.optString("photo_url", "");
                                        String un9 = po.isNull("username") ? "" : po.optString("username", "");
                                        if (un9.length() > 0) unames.put(po.optString("user_id"), un9);
                                        if (isImg(ph)) photos.put(po.optString("user_id"), ph);
                                    }
                                } catch (Exception ignore) {}
                            }
                        } catch (Exception e) { err = String.valueOf(e.getMessage()); }
                        final String fe = err;
                        runOnUiThread(new Runnable() {
                            @Override public void run() {
                                if (fe != null) { empty.setText(L("تعذّر التحميل: ", "Could not load: ") + fe); return; }
                                cm.clear();
                                cm.addAll(got);
                                cLikes.clear(); cLikes.putAll(tl); cKids.clear(); cKids.putAll(tk); cMine.clear(); cMine.addAll(tm);
                                cReps.clear(); cReps.putAll(trp); cViews.clear(); cViews.putAll(tvw); cRepMine.clear(); cRepMine.addAll(trm); cSaveMine.clear(); cSaveMine.addAll(tsm);
                                ca.notifyDataSetChanged();
                                empty.setText(got.isEmpty() ? L("لا توجد ردود بعد. كن أول من يرد!", "No replies yet. Be the first!") : "");
                                empty.setVisibility(got.isEmpty() ? View.VISIBLE : View.GONE);
                                int[] s = stats.get(pk);
                                if (s != null) { s[1] = got.size(); refreshUi(); }
                                hdrBind.run();
                            }
                        });
                    }
                });
            }
        };
        reloadRef[0] = reload;
        toComposer[0] = new Runnable() { @Override public void run() { openReplyComposer(post, reload); } };
        d.setContentView(box);
        d.show();
        reload.run();
    }

    protected void rpMenu(final JSONObject o, final Runnable reload) {
        final String id = String.valueOf(o.optLong("id"));
        final boolean mine = uid != null && uid.equals(o.optString("user_id", ""));
        String[] labels = mine ? new String[] { L("حذف الرد", "Delete reply") } : new String[] { L("إبلاغ", "Report") };
        new AlertDialog.Builder(this).setItems(labels, new DialogInterface.OnClickListener() {
            @Override public void onClick(DialogInterface dd, int w) {
                if (!mine) { openReport("comment", id, o); return; }
                new AlertDialog.Builder(Home.this).setMessage(L("حذف هذا الرد نهائياً؟", "Delete this reply permanently?"))
                    .setPositiveButton(L("حذف", "Delete"), new DialogInterface.OnClickListener() {
                        @Override public void onClick(DialogInterface d2, int w2) {
                            pool.execute(new Runnable() {
                                @Override public void run() {
                                    String err = null;
                                    try {
                                        send("DELETE", "post_comments?id=eq." + id + "&user_id=eq." + uid, null);
                                        String vp = o.isNull("video_path") ? "" : o.optString("video_path", "");
                                        if (vp.length() > 0) cmRemove("post-videos", vp);
                                        String ik = r2KeyFromUrl(o.isNull("image_url") ? "" : o.optString("image_url", ""));
                                        if (ik != null) r2Delete(ik);
                                    } catch (Exception e) { err = String.valueOf(e.getMessage()); }
                                    final String fe = err;
                                    runOnUiThread(new Runnable() { @Override public void run() {
                                        if (fe != null) toast(L("تعذّر الحذف", "Could not delete"));
                                        else { toast(L("تم حذف الرد", "Reply deleted")); if (reload != null) reload.run(); }
                                    } });
                                }
                            });
                        }
                    }).setNegativeButton(L("إلغاء", "Cancel"), null).show();
            }
        }).show();
    }

    protected void rpToggleLike(final JSONObject o, final HashMap<Long, Integer> cl, final Set<Long> mine, final Runnable redraw) {
        if (uid == null) return;
        final long cid = o.optLong("id");
        final boolean was = mine.contains(cid);
        Integer n0 = cl.get(cid);
        int n = n0 == null ? 0 : n0;
        if (was) { mine.remove(cid); cl.put(cid, Math.max(0, n - 1)); } else { mine.add(cid); cl.put(cid, n + 1); }
        redraw.run();
        pool.execute(new Runnable() {
            @Override public void run() {
                boolean fail = false;
                try {
                    if (was) send("DELETE", "comment_likes?comment_id=eq." + cid + "&user_id=eq." + uid, null);
                    else send("POST", "comment_likes", new JSONObject().put("comment_id", cid).put("user_id", uid).toString());
                } catch (Exception e) { fail = !String.valueOf(e.getMessage()).contains("23505"); }
                if (fail) runOnUiThread(new Runnable() { @Override public void run() {
                    Integer c0 = cl.get(cid); int c = c0 == null ? 0 : c0;
                    if (was) { mine.add(cid); cl.put(cid, c + 1); } else { mine.remove(cid); cl.put(cid, Math.max(0, c - 1)); }
                    redraw.run();
                    toast(L("تعذّر الحفظ، حاول لاحقاً", "Could not save, try again"));
                } });
            }
        });
    }

    protected void rpToggleReact(final JSONObject o, final String kind, final HashMap<Long, Integer> cnt, final Set<Long> mine, final Runnable redraw) {
        if (uid == null) return;
        final long cid = o.optLong("id");
        final boolean was = mine.contains(cid);
        if (was) mine.remove(cid); else mine.add(cid);
        if (cnt != null) { Integer n0 = cnt.get(cid); int n = n0 == null ? 0 : n0; cnt.put(cid, was ? Math.max(0, n - 1) : n + 1); }
        redraw.run();
        pool.execute(new Runnable() {
            @Override public void run() {
                boolean fail = false;
                try {
                    if (was) send("DELETE", "comment_reactions?comment_id=eq." + cid + "&user_id=eq." + uid + "&kind=eq." + kind, null);
                    else send("POST", "comment_reactions", new JSONObject().put("comment_id", cid).put("user_id", uid).put("kind", kind).toString());
                } catch (Exception e) { fail = !String.valueOf(e.getMessage()).contains("23505"); }
                if (fail) runOnUiThread(new Runnable() { @Override public void run() {
                    if (was) mine.add(cid); else mine.remove(cid);
                    if (cnt != null) { Integer c0 = cnt.get(cid); int c = c0 == null ? 0 : c0; cnt.put(cid, was ? c + 1 : Math.max(0, c - 1)); }
                    redraw.run();
                    toast(L("تعذّر الحفظ، حاول لاحقاً", "Could not save, try again"));
                } });
            }
        });
    }

    // ---------------- شاشة كتابة الرد ----------------
    @Override protected void onActivityResult(int code, int res, Intent data) {
        super.onActivityResult(code, res, data);
        if (res != RESULT_OK || data == null || data.getData() == null) return;
        if (code == RP_IMG) rpHandleImage(data.getData());
        else if (code == RP_VID) rpHandleVideo(data.getData());
    }

    protected void rpHandleImage(final android.net.Uri u) {
        pool.execute(new Runnable() {
            @Override public void run() {
                Bitmap b = null;
                try {
                    BitmapFactory.Options o = new BitmapFactory.Options();
                    o.inJustDecodeBounds = true;
                    InputStream in = getContentResolver().openInputStream(u);
                    BitmapFactory.decodeStream(in, null, o);
                    in.close();
                    int s = 1;
                    while (Math.max(o.outWidth, o.outHeight) / s > 1800) s *= 2;
                    o = new BitmapFactory.Options();
                    o.inSampleSize = s;
                    in = getContentResolver().openInputStream(u);
                    Bitmap full = BitmapFactory.decodeStream(in, null, o);
                    in.close();
                    if (full != null) {
                        float sc = Math.min(1f, 900f / Math.max(full.getWidth(), full.getHeight()));
                        b = sc < 1f ? Bitmap.createScaledBitmap(full, Math.round(full.getWidth() * sc), Math.round(full.getHeight() * sc), true) : full;
                        b = mpExifFix(u, b);
                    }
                } catch (Exception e) { b = null; }
                final Bitmap fb = b;
                runOnUiThread(new Runnable() { @Override public void run() {
                    if (fb == null) { toast(L("الملف ليس صورة", "Not an image")); return; }
                    rpImage = fb; rpVideoUri = null; rpVideoName = null;
                    if (rpOnMedia != null) rpOnMedia.run();
                } });
            }
        });
    }

    protected void rpHandleVideo(final android.net.Uri u) {
        pool.execute(new Runnable() {
            @Override public void run() {
                String err = null; String name = "video.mp4"; long size = 0;
                try {
                    android.database.Cursor c = getContentResolver().query(u, null, null, null, null);
                    if (c != null) {
                        if (c.moveToFirst()) {
                            int ni = c.getColumnIndex(android.provider.OpenableColumns.DISPLAY_NAME), si = c.getColumnIndex(android.provider.OpenableColumns.SIZE);
                            if (ni >= 0) name = c.getString(ni);
                            if (si >= 0) size = c.getLong(si);
                        }
                        c.close();
                    }
                    if (name == null || !name.toLowerCase().endsWith(".mp4")) err = L("الصيغة المقبولة MP4 فقط.", "Only MP4 files are allowed.");
                    else if (size > RP_VID_MAX) err = L("حجم الفيديو يتجاوز 100 ميغابايت.", "Video is larger than 100 MB.");
                    else {
                        android.media.MediaMetadataRetriever mr = new android.media.MediaMetadataRetriever();
                        mr.setDataSource(Home.this, u);
                        String dur = mr.extractMetadata(android.media.MediaMetadataRetriever.METADATA_KEY_DURATION);
                        mr.release();
                        if (dur != null && Long.parseLong(dur) > RP_VID_SECS * 1000) err = L("مدة الفيديو تتجاوز 60 ثانية.", "Video is longer than 60 seconds.");
                    }
                } catch (Exception e) { err = L("تعذّر قراءة الفيديو.", "Could not read the video."); }
                final String fe = err, fn = name;
                runOnUiThread(new Runnable() { @Override public void run() {
                    if (fe != null) { toast(fe); return; }
                    rpVideoUri = u; rpVideoName = fn; rpImage = null;
                    if (rpOnMedia != null) rpOnMedia.run();
                } });
            }
        });
    }

    // camera=false: إرفاق من المعرض، camera=true: الكاميرا
    protected void rpPickMedia(final boolean camera, int tier) {
        if (tier < 2) {
            toast(L("📎 الصور والفيديو في الردود للمشتركين (الباقة المميّزة 1.99$ فما فوق)", "📎 Image and video replies need the Plus plan or higher"));
            openSubscriptions();
            return;
        }
        MediaCb cb = new MediaCb() { @Override public void picked(android.net.Uri u, boolean video) { if (video) rpHandleVideo(u); else rpHandleImage(u); } };
        if (camera) mediaCameraShow(cb); else mediaAttachShow(cb);
    }

    protected void openReplyComposer(JSONObject post, Runnable onSent) { openReplyComposer(post, onSent, null); }

    protected void openReplyComposer(final JSONObject post, final Runnable onSent, final JSONObject parent) {
        if (uid == null) { toast(L("سجّل الدخول أولاً", "Please sign in first")); return; }
        final JSONObject src = parent != null ? parent : post;
        final String pk = String.valueOf(post.optLong("id"));
        final String pUser = src.optString("user_id", "");
        rpImage = null; rpVideoUri = null; rpVideoName = null;
        final Dialog d = sheetDialog(true);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(NAVY);
        root.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);
        final int[] tier = { 0 };
        fetchTier(new TierCb() { @Override public void on(int t) { tier[0] = t; } });

        LinearLayout top = new LinearLayout(this);
        top.setGravity(Gravity.CENTER_VERTICAL);
        top.setPadding(dp(8), statusH() + dp(8), dp(16), dp(8));
        TextView close = tv(Color.WHITE, 22, false);
        close.setText("✕");
        close.setPadding(dp(12), dp(4), dp(12), dp(4));
        close.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { d.dismiss(); } });
        top.addView(close);
        top.addView(new View(this), new LinearLayout.LayoutParams(0, 1, 1f));
        final TextView btn = tv(NAVY, 15, true);
        btn.setText(L("رد", "Reply"));
        btn.setGravity(Gravity.CENTER);
        GradientDrawable bg = new GradientDrawable(); bg.setColor(GOLD); bg.setCornerRadius(dp(20));
        btn.setBackground(bg);
        btn.setPadding(dp(26), dp(8), dp(26), dp(8));
        top.addView(btn);
        root.addView(top);

        ScrollView sv = new ScrollView(this);
        LinearLayout body = new LinearLayout(this);
        body.setOrientation(LinearLayout.VERTICAL);
        body.setPadding(dp(16), dp(6), dp(16), dp(16));
        // المنشور الأصلي مع الخط العمودي
        LinearLayout orig = new LinearLayout(this);
        LinearLayout leftCol = new LinearLayout(this);
        leftCol.setOrientation(LinearLayout.VERTICAL);
        leftCol.setGravity(Gravity.CENTER_HORIZONTAL);
        String on = src.optString("author_name", "");
        leftCol.addView(rpAvatar(on, photos.get(pUser), 44), new LinearLayout.LayoutParams(dp(44), dp(44)));
        View vline = new View(this);
        vline.setBackgroundColor(0xFF2A3258);
        LinearLayout.LayoutParams vlp = new LinearLayout.LayoutParams(dp(3), 0, 1f);
        vlp.topMargin = dp(6);
        leftCol.addView(vline, vlp);
        orig.addView(leftCol, new LinearLayout.LayoutParams(dp(44), ViewGroup.LayoutParams.MATCH_PARENT));
        LinearLayout oc = new LinearLayout(this);
        oc.setOrientation(LinearLayout.VERTICAL);
        oc.setPadding(dp(10), 0, 0, dp(14));
        String oun = unames.get(pUser);
        TextView onm = tv(Color.WHITE, 15, true);
        onm.setTextAlignment(View.TEXT_ALIGNMENT_VIEW_START);
        onm.setText(on + (oun != null ? "  @" + oun : "") + "  · " + ago(src.optString("created_at", "")));
        oc.addView(onm);
        String ot = src.optString("content", "");
        boolean hasM = (!src.isNull("image_url") && src.optString("image_url", "").length() > 4) || (!src.isNull("video_url") && src.optString("video_url", "").length() > 4);
        TextView otx = tv(0xFFE6E9FF, 15, false);
        otx.setTextAlignment(View.TEXT_ALIGNMENT_VIEW_START);
        otx.setMaxLines(5);
        otx.setEllipsize(android.text.TextUtils.TruncateAt.END);
        otx.setText(ot + (hasM ? (ot.length() > 0 ? "  " : "") + (!src.isNull("video_url") && src.optString("video_url", "").length() > 4 ? "🎬" : "🖼") : ""));
        otx.setPadding(0, dp(4), 0, 0);
        oc.addView(otx);
        orig.addView(oc, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        body.addView(orig);
        TextView to = tv(MUTED, 14, false);
        to.setTextAlignment(View.TEXT_ALIGNMENT_VIEW_START);
        to.setText(L("رداً على ", "Replying to ") + (oun != null ? "@" + oun : on));
        to.setPadding(dp(54), 0, 0, dp(6));
        body.addView(to);
        LinearLayout me = new LinearLayout(this);
        me.addView(rpAvatar(uname == null ? "" : uname, uavatar != null && uavatar.startsWith("http") ? uavatar : photos.get(uid), 44), new LinearLayout.LayoutParams(dp(44), dp(44)));
        final EditText et = new EditText(this);
        et.setHint(L("انشر ردّك", "Post your reply"));
        et.setHintTextColor(0xFF6B76B0);
        et.setTextColor(Color.WHITE);
        et.setTextSize(18);
        et.setBackground(null);
        et.setGravity(Gravity.TOP | Gravity.START);
        et.setMinLines(3);
        et.setFilters(new android.text.InputFilter[] { new android.text.InputFilter.LengthFilter(500) });
        et.setPadding(dp(10), dp(6), 0, dp(6));
        me.addView(et, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        body.addView(me);
        final FrameLayout prev = new FrameLayout(this);
        LinearLayout.LayoutParams plp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        plp.setMargins(dp(54), dp(8), 0, 0);
        body.addView(prev, plp);
        sv.addView(body);
        root.addView(sv, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));

        // شريط الأدوات
        LinearLayout tb = new LinearLayout(this);
        tb.setGravity(Gravity.CENTER_VERTICAL);
        tb.setPadding(dp(16), dp(8), dp(16), dp(8));
        View tl = new View(this); tl.setBackgroundColor(0x1AFFFFFF);
        root.addView(tl, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(1)));
        ImageView bi = mpIconBtn(30);
        bi.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { rpPickMedia(false, tier[0]); } });
        ImageView bv = mpIconBtn(31);
        bv.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { rpPickMedia(true, tier[0]); } });
        LinearLayout.LayoutParams bvl = new LinearLayout.LayoutParams(dp(46), dp(46));
        bvl.setMargins(dp(10), 0, dp(10), 0);
        tb.addView(bi); tb.addView(bv, bvl);
        tb.addView(new View(this), new LinearLayout.LayoutParams(0, 1, 1f));
        final TextView cnt = tv(MUTED, 13, false);
        cnt.setText("‎0 / 500");
        tb.addView(cnt);
        root.addView(tb);
        et.addTextChangedListener(new android.text.TextWatcher() {
            @Override public void beforeTextChanged(CharSequence s, int a, int b, int c) {}
            @Override public void onTextChanged(CharSequence s, int a, int b, int c) {}
            @Override public void afterTextChanged(android.text.Editable ed) { cnt.setText("‎" + ed.length() + " / 500"); }
        });

        rpOnMedia = new Runnable() {
            @Override public void run() {
                prev.removeAllViews();
                if (rpImage == null && rpVideoUri == null) return;
                if (rpImage != null) {
                    ImageView iv = new ImageView(Home.this);
                    iv.setImageBitmap(rpImage);
                    iv.setAdjustViewBounds(true);
                    iv.setScaleType(ImageView.ScaleType.FIT_CENTER);
                    prev.addView(iv, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
                } else {
                    TextView vt = tv(Color.WHITE, 14, true);
                    vt.setText("🎬 " + rpVideoName);
                    vt.setPadding(dp(14), dp(18), dp(14), dp(18));
                    GradientDrawable vg = new GradientDrawable(); vg.setColor(CARD); vg.setCornerRadius(dp(12)); vg.setStroke(dp(1), 0x33FFFFFF);
                    vt.setBackground(vg);
                    prev.addView(vt, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
                }
                TextView x = tv(Color.WHITE, 16, true);
                x.setText("✕");
                x.setGravity(Gravity.CENTER);
                x.setBackground(oval(0xAA000000, 0));
                x.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { rpImage = null; rpVideoUri = null; rpVideoName = null; rpOnMedia.run(); } });
                FrameLayout.LayoutParams xp = new FrameLayout.LayoutParams(dp(30), dp(30), Gravity.TOP | Gravity.END);
                xp.setMargins(dp(6), dp(6), dp(6), dp(6));
                prev.addView(x, xp);
            }
        };
        d.setOnDismissListener(new DialogInterface.OnDismissListener() { @Override public void onDismiss(DialogInterface x) { rpOnMedia = null; rpImage = null; rpVideoUri = null; } });

        final boolean[] busy = { false };
        btn.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) {
                if (busy[0]) return;
                final String txt = et.getText().toString().trim();
                final Bitmap img = rpImage;
                final android.net.Uri vid = rpVideoUri;
                if (txt.length() == 0 && img == null && vid == null) { toast(L("اكتب ردّك أو أضف صورة أو فيديو", "Write a reply or add an image or video")); return; }
                busy[0] = true;
                btn.setAlpha(0.6f);
                pool.execute(new Runnable() {
                    @Override public void run() {
                        String err = null, imgPath = null, vidPath = null, imgUrl = null, vidUrl = null;
                        try {
                            if (vid != null) {
                                Exception last = null;
                                for (int at = 1; at <= 3; at++) {
                                    try {
                                        JSONObject sg = r2UploadVideo(vid, new R2Progress() { @Override public void on(final int pct, double mb) {
                                            runOnUiThread(new Runnable() { @Override public void run() { btn.setText("\u200e" + pct + "%"); } });
                                        } });
                                        vidPath = sg.getString("key"); vidUrl = sg.getString("publicUrl");
                                        last = null; break; }
                                    catch (Exception e) {
                                        String m = String.valueOf(e.getMessage());
                                        if (m.matches("(?s).*(already exists|duplicate|409).*")) { last = null; break; }
                                        last = e;
                                        if (at < 3) Thread.sleep(1500L * at);
                                    }
                                }
                                if (last != null) throw new Exception(L("فشل رفع الفيديو: ", "Video upload failed: ") + last.getMessage());
                            }
                            if (img != null) {
                                ByteArrayOutputStream bo = new ByteArrayOutputStream();
                                img.compress(Bitmap.CompressFormat.JPEG, 75, bo);
                                JSONObject si = r2UploadBytes(bo.toByteArray(), "image", "image/jpeg");
                                imgPath = si.getString("key"); imgUrl = si.getString("publicUrl");
                            }
                            JSONObject b = new JSONObject();
                            b.put("post_id", post.optLong("id"));
                            b.put("user_id", uid);
                            b.put("author_name", uname == null ? "" : uname);
                            b.put("author_avatar", uavatar == null ? "" : uavatar);
                            b.put("content", txt);
                            if (parent != null) b.put("parent_id", parent.optLong("id"));
                            if (imgUrl != null) b.put("image_url", imgUrl);
                            if (vidUrl != null) { b.put("video_url", vidUrl); b.put("video_path", vidPath); }
                            try { send("POST", "post_comments", b.toString()); }
                            catch (Exception e) {
                                if (vidPath != null) cmRemove("post-videos", vidPath);
                                if (imgPath != null) cmRemove("post-images", imgPath);
                                throw e;
                            }
                            queueNotify("comment", pUser, pk, txt.length() > 0 ? txt : (vid != null ? "🎬" : "🖼"), null);
                        } catch (Exception e) { err = String.valueOf(e.getMessage()); }
                        final String fe = err;
                        runOnUiThread(new Runnable() {
                            @Override public void run() {
                                busy[0] = false;
                                btn.setAlpha(1f);
                                btn.setText(L("رد", "Reply"));
                                if (fe != null) {
                                    if (fe.contains("premium_required")) { toast(L("هذه الميزة للمشتركين فقط", "Subscribers only")); openSubscriptions(); }
                                    else if (fe.contains("video_daily_limit")) toast(L("وصلت إلى حد 10 فيديوهات ردود اليوم.", "You reached today's limit of 10 video replies."));
                                    else toast(L("تعذّر الإرسال", "Could not send"));
                                    return;
                                }
                                d.dismiss();
                                toast(L("تم نشر ردّك", "Reply posted"));
                                if (onSent != null) onSent.run();
                            }
                        });
                    }
                });
            }
        });
        keyboardLift(d, root);
        d.setContentView(root);
        d.show();
        et.requestFocus();
        d.getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_STATE_VISIBLE | WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
    }

    // ---------------- تحميل الصفحات ----------------
    protected void loadBalance() {
        if (uid == null) return;
        pool.execute(new Runnable() {
            @Override public void run() {
                try {
                    JSONArray a = new JSONArray(get("users?select=points&user_id=eq." + uid));
                    if (a.length() > 0) {
                        final long p = a.getJSONObject(0).optLong("points", 0);
                        runOnUiThread(new Runnable() {
                            @Override public void run() { if (balance != null) balance.setText(String.format(java.util.Locale.US, "%,d", p)); }
                        });
                    }
                } catch (Exception ignore) {}
            }
        });
    }

    protected void refresh() {
        if (loading) return;
        items.clear();
        stats.clear();
        offset = 0;
        endReached = false;
        refreshUi();
        status.setText("");
        t0 = System.currentTimeMillis();
        loadBalance();
        loadPage();
        checkMyBan();
    }

    protected void loadPage() {
        if (loading || endReached) return;
        loading = true;
        final boolean first = offset == 0;
        new Thread(new Runnable() {
            @Override public void run() {
                String err = null;
                final List<JSONObject> got = new ArrayList<JSONObject>();
                try {
                    if (!metaLoaded && uid != null) {
                        metaLoaded = true;
                        try {
                            JSONArray x = new JSONArray(get("user_follows?select=following_id&follower_id=eq." + uid + "&limit=1000"));
                            for (int q = 0; q < x.length(); q++) followSet.add(x.getJSONObject(q).optString("following_id"));
                        } catch (Exception ignore) {}
                        try {
                            JSONArray x = new JSONArray(get("user_mutes?select=muted_id&user_id=eq." + uid + "&limit=1000"));
                            for (int q = 0; q < x.length(); q++) muteSet.add(x.getJSONObject(q).optString("muted_id"));
                        } catch (Exception ignore) {}
                        try {
                            JSONArray x = new JSONArray(get("user_blocks?select=blocked_id&user_id=eq." + uid + "&limit=1000"));
                            for (int q = 0; q < x.length(); q++) blockSet.add(x.getJSONObject(q).optString("blocked_id"));
                        } catch (Exception ignore) {}
                        String hs = getSharedPreferences("zn", MODE_PRIVATE).getString("hidden", "");
                        for (String h0 : hs.split(",")) if (h0.length() > 0) hiddenSet.add(h0);
                    }
                    JSONArray a = new JSONArray(get("posts?select=id,user_id,author_name,content,created_at,image_url,video_url,video_path,topic_type,topic_name,topic_name_b&order=created_at.desc&limit=" + PAGE + "&offset=" + offset));
                    StringBuilder ids = new StringBuilder();
                    Set<String> users = new HashSet<String>();
                    final int rawN = a.length();
                    for (int k = 0; k < a.length(); k++) {
                        JSONObject p = a.getJSONObject(k);
                        String au = p.optString("user_id", "");
                        if (muteSet.contains(au) || blockSet.contains(au) || hiddenSet.contains(String.valueOf(p.optLong("id")))) continue;
                        got.add(p);
                        stats.put(String.valueOf(p.optLong("id")), new int[] { 0, 0, 0, 0 });
                        if (ids.length() > 0) ids.append(",");
                        ids.append(p.optLong("id"));
                        users.add(p.optString("user_id", ""));
                    }
                    if (first && uid != null) {
                        loadBoostMeta(null, true);
                        List<JSONObject> inj = boostedForFeed(got);
                        int at = Math.min(2, got.size());
                        for (JSONObject p : inj) {
                            got.add(at++, p);
                            stats.put(String.valueOf(p.optLong("id")), new int[] { 0, 0, 0, 0 });
                            if (ids.length() > 0) ids.append(",");
                            ids.append(p.optLong("id"));
                            users.add(p.optString("user_id", ""));
                        }
                    }
                    final String fids = ids.toString();
                    final long mid = System.currentTimeMillis() - t0;
                    final int n = rawN;
                    runOnUiThread(new Runnable() {
                        @Override public void run() {
                            homeItems.addAll(got);
                            offset += n;
                            if (n < PAGE) endReached = true;
                            refreshUi();
                            if (first) status.setVisibility(View.GONE);
                        }
                    });
                    if (fids.length() > 0) {
                        try {
                            StringBuilder us = new StringBuilder();
                            for (String u : users) { if (u.length() > 0) { if (us.length() > 0) us.append(","); us.append(u); } }
                            if (us.length() > 0) {
                                JSONArray pa = new JSONArray(get("public_profiles?select=user_id,photo_url,username&user_id=in.(" + us + ")"));
                                for (int q = 0; q < pa.length(); q++) {
                                    JSONObject po = pa.getJSONObject(q);
                                    String ph = po.isNull("photo_url") ? "" : po.optString("photo_url", "");
                                    { String un9 = po.isNull("username") ? "" : po.optString("username", ""); if (un9.length() > 0) unames.put(po.optString("user_id"), un9); }
                    if (isImg(ph)) photos.put(po.optString("user_id"), ph);
                                }
                                runOnUiThread(new Runnable() {
                                    @Override public void run() { refreshUi(); }
                                });
                            }
                        } catch (Exception ignore) {}
                        count("post_likes", fids, 0);
                        count("post_comments", fids, 1);
                        count("post_reposts", fids, 2);
                        count("post_views", fids, 3);
                        try {
                            JSONArray la = new JSONArray(get("post_likes?select=post_id&user_id=eq." + uid + "&post_id=in.(" + fids + ")"));
                            for (int q = 0; q < la.length(); q++) liked.add(String.valueOf(la.getJSONObject(q).optLong("post_id")));
                        } catch (Exception ignore) {}
                        try {
                            JSONArray x = new JSONArray(get("post_reposts?select=post_id&user_id=eq." + uid + "&post_id=in.(" + fids + ")"));
                            for (int q = 0; q < x.length(); q++) reposted.add(String.valueOf(x.getJSONObject(q).optLong("post_id")));
                        } catch (Exception ignore) {}
                        try {
                            JSONArray x = new JSONArray(get("post_bookmarks?select=post_id&user_id=eq." + uid + "&post_id=in.(" + fids + ")"));
                            for (int q = 0; q < x.length(); q++) saved.add(String.valueOf(x.getJSONObject(q).optLong("post_id")));
                        } catch (Exception ignore) {}
                        try {
                            JSONArray x = new JSONArray(get("post_views?select=post_id&user_id=eq." + uid + "&post_id=in.(" + fids + ")"));
                            for (int q = 0; q < x.length(); q++) viewedMine.add(String.valueOf(x.getJSONObject(q).optLong("post_id")));
                        } catch (Exception ignore) {}
                        try {
                            JSONArray x = new JSONArray(rpc("get_prediction_info", "{\"p_ids\":[" + fids + "]}"));
                            for (int q = 0; q < x.length(); q++) preds.put(String.valueOf(x.getJSONObject(q).optLong("post_id")), x.getJSONObject(q));
                        } catch (Exception ignore) {}
                        loadSupportStats(fids);
                        loadBoostMeta(fids, false);
                        try {
                            JSONArray x = new JSONArray(rpc("rope_summary", "{\"p_ids\":[" + fids + "]}"));
                            for (int q = 0; q < x.length(); q++) {
                                JSONObject ro = x.getJSONObject(q);
                                String pk = String.valueOf(ro.optLong("post_id"));
                                long[] r = ropes.get(pk);
                                if (r == null) { r = new long[] { 0, 0, -1 }; ropes.put(pk, r); }
                                int sd = ro.optInt("side", 0);
                                if (sd == 0 || sd == 1) r[sd] += ro.optLong("n", 0);
                            }
                            JSONArray y = new JSONArray(get("post_rope_votes?select=post_id,side&user_id=eq." + uid + "&post_id=in.(" + fids + ")"));
                            for (int q = 0; q < y.length(); q++) {
                                String pk = String.valueOf(y.getJSONObject(q).optLong("post_id"));
                                long[] r = ropes.get(pk);
                                if (r == null) { r = new long[] { 0, 0, -1 }; ropes.put(pk, r); }
                                r[2] = y.getJSONObject(q).optInt("side", -1);
                            }
                        } catch (Exception ignore) {}
                        for (JSONObject p : got) {
                            String pk = String.valueOf(p.optLong("id"));
                            if (!p.isNull("topic_type") && ropes.get(pk) == null) ropes.put(pk, new long[] { 0, 0, -1 });
                        }
                    }
                } catch (Exception e) {
                    err = String.valueOf(e.getMessage());
                }
                final String fe = err;
                runOnUiThread(new Runnable() {
                    @Override public void run() {
                        loading = false;
                        getSharedPreferences("zn", MODE_PRIVATE).edit().putInt("boot", 0).apply();
                        if (fe != null) { if (items.isEmpty()) status.setText(L("خطأ: ", "Error: ") + fe); return; }
                        refreshUi();
                    }
                });
            }
        }).start();
    }

    // ---------------- الواجهة ----------------
    protected View circleBtn(String glyph, String label, final String action, boolean live) {
        LinearLayout c = new LinearLayout(this);
        c.setOrientation(LinearLayout.VERTICAL);
        c.setGravity(Gravity.CENTER_HORIZONTAL);
        c.setPadding(dp(8), dp(4), dp(8), dp(4));
        TextView g = tv(live ? 0xFF14F195 : GOLD, live ? 14 : 24, true);
        g.setText(glyph);
        g.setGravity(Gravity.CENTER);
        g.setBackground(oval(0xFF101A55, live ? 0xFF14F195 : GOLD));
        c.addView(g, new LinearLayout.LayoutParams(dp(64), dp(64)));
        TextView l = tv(0xFFE6E9FF, 12, true);
        l.setText(label);
        l.setGravity(Gravity.CENTER);
        l.setPadding(0, dp(4), 0, 0);
        c.addView(l);
        c.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) { if ("subs".equals(action)) openSubscriptions(); else if ("ranking".equals(action)) openLeagueTable(); else if ("radar".equals(action)) openFanRadar(); else if ("earn".equals(action)) openPointsPage(); else if ("tonight".equals(action) || "live".equals(action)) openTodayMatches(action); else goWeb(action); }
        });
        return c;
    }

    protected View navItem(int icon, String label, final String action, boolean active) {
        LinearLayout c = new LinearLayout(this);
        c.setOrientation(LinearLayout.VERTICAL);
        c.setGravity(Gravity.CENTER);
        int colr = active ? GOLD : MUTED;
        ImageView g = new ImageView(this);
        g.setImageDrawable(new Ic(icon, colr, false, dp(26)));
        c.addView(g, new LinearLayout.LayoutParams(dp(26), dp(26)));
        TextView l = tv(colr, 11, active);
        l.setText(label);
        l.setGravity(Gravity.CENTER);
        l.setPadding(0, dp(3), 0, dp(3));
        c.addView(l);
        View dot = new View(this);
        dot.setBackground(oval(active ? GOLD : 0x00000000, 0x00000000));
        c.addView(dot, new LinearLayout.LayoutParams(dp(5), dp(5)));
        if (action != null) {
            c.setOnClickListener(new View.OnClickListener() {
                @Override public void onClick(View v) { if (action.startsWith("nav:")) showPage(action.substring(4)); else goWeb(action); }
            });
        }
        if ("nav:messages".equals(action)) return withMsgBadge(c);
        return c;
    }

    protected TextView bellBadgeV;
    @Override protected void updateBellBadge() {
        if (bellBadgeV == null) return;
        int n = notifUnread;
        bellBadgeV.setText(n > 99 ? "99+" : String.valueOf(n));
        bellBadgeV.setMinWidth(dp(18));
        bellBadgeV.setVisibility(n > 0 ? View.VISIBLE : View.GONE);
    }

    protected TextView iconBtn(String glyph, final String action) {
        TextView t = tv(Color.WHITE, 20, false);
        t.setText(glyph);
        t.setGravity(Gravity.CENTER);
        GradientDrawable g = new GradientDrawable();
        g.setColor(0xFF101A55);
        g.setCornerRadius(dp(14));
        g.setStroke(dp(1), 0x55F5C35A);
        t.setBackground(g);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(dp(46), dp(46));
        lp.setMargins(dp(4), 0, dp(4), 0);
        t.setLayoutParams(lp);
        if (action != null) {
            t.setOnClickListener(new View.OnClickListener() {
                @Override public void onClick(View v) { if ("notifications".equals(action)) showPage(action); else if ("search".equals(action)) openSearchScreen(); else goWeb(action); }
            });
        }
        return t;
    }

    private boolean homeBuilt = false;
    private final Runnable sessionTick = new Runnable() {
        @Override public void run() {
            pool.execute(new Runnable() { @Override public void run() { refreshSession(); } });
            timerH.postDelayed(this, 40L * 60 * 1000);
        }
    };

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        url = getIntent().getStringExtra("url");
        key = getIntent().getStringExtra("key");
        token = getIntent().getStringExtra("token");
        uid = getIntent().getStringExtra("uid");
        uname = getIntent().getStringExtra("uname");
        uavatar = getIntent().getStringExtra("uavatar");
        linkTpl = getIntent().getStringExtra("linkTpl");
        String pj0 = getIntent().getStringExtra("pjson");
        pjson = pj0 == null ? "" : pj0;
        if (url == null || key == null) { url = SB_URL; key = SB_KEY; }
        if (linkTpl == null) linkTpl = "https://zelospor-f.github.io/zelo-/?post={id}";
        getWindow().setBackgroundDrawable(new android.graphics.drawable.ColorDrawable(NAVY));
        ensureLangLoaded();
        if (uid != null && token != null) { buildHome(); return; }
        // بدون ويب: الجلسة من التخزين المحلي أو شاشة الدخول
        if (restoreSession()) {
            pool.execute(new Runnable() {
                @Override public void run() {
                    boolean ok = refreshSession();
                    final JSONObject row = ok || token != null ? loadUserRow(uid) : null;
                    runOnUiThread(new Runnable() { @Override public void run() {
                        if (token == null || (row == null && !restoreSession())) { clearSession(); startLogin(); return; }
                        applyUserRow(row);
                        buildHome();
                    } });
                }
            });
        } else startLogin();
    }

    // يملأ بيانات المستخدم من صف users (بدل ما كان يمرّره الويب)
    protected void applyUserRow(JSONObject r) {
        try {
            JSONObject p = new JSONObject();
            if (r != null) {
                String na = r.isNull("nickname_ar") ? "" : r.optString("nickname_ar"), ne = r.isNull("nickname_en") ? "" : r.optString("nickname_en");
                String un = r.isNull("username") ? "" : r.optString("username");
                String nick = isAr() ? (na.length() > 0 ? na : ne) : (ne.length() > 0 ? ne : na);
                uname = nick.length() > 0 ? nick : un;
                String ph = r.isNull("photo_url") ? "" : r.optString("photo_url");
                uavatar = ph;
                p.put("nickname", nick); p.put("nickname_ar", na); p.put("nickname_en", ne); p.put("username", un);
                p.put("bio", r.isNull("bio") ? "" : r.optString("bio"));
                p.put("dob", r.isNull("dob") ? "" : r.optString("dob"));
                p.put("dobVisible", r.optBoolean("dob_visible", false)); p.put("dob_visible", r.optBoolean("dob_visible", false));
                p.put("photoUrl", ph); p.put("photo_url", ph);
                p.put("badgeClub", r.isNull("badge_club") ? "" : r.optString("badge_club"));
                p.put("selected_clubs", r.optJSONArray("selected_clubs") == null ? new JSONArray() : r.optJSONArray("selected_clubs"));
            }
            pjson = p.toString();
        } catch (Exception ignore) {}
    }

    protected void startLogin() {
        showAuth(new Runnable() { @Override public void run() {
            pool.execute(new Runnable() { @Override public void run() {
                final JSONObject row = loadUserRow(uid);
                runOnUiThread(new Runnable() { @Override public void run() { applyUserRow(row); buildHome(); } });
            } });
        } });
        handleAuthIntent(getIntent());
    }

    // رابط عميق أثناء تشغيل التطبيق: عودة Google من المتصفح أو رابط دعوة
    @Override protected void onNewIntent(Intent in) {
        super.onNewIntent(in);
        setIntent(in);
        captureReferral(in);
        handleAuthIntent(in);
    }

    // تسجيل الخروج: يمسح الجلسة ويعيد شاشة الدخول
    protected void doLogout() {
        signOutThen(new Runnable() { @Override public void run() { getIntent().removeExtra("uid"); getIntent().removeExtra("token"); recreate(); } });
    }

    protected void buildHome() {
        if (homeBuilt) return;
        homeBuilt = true;
        timerH.postDelayed(sessionTick, 40L * 60 * 1000);
        captureReferral(getIntent());
        captureInstallReferrer();
        startNotifBadge();
        timerH.postDelayed(new Runnable() { @Override public void run() { startPush(); } }, 3000);
        timerH.postDelayed(startBanner, 4000);
        bpPreload();

        getSharedPreferences("zn", MODE_PRIVATE).edit().putInt("boot", 1).apply();

        FrameLayout outer = new FrameLayout(this);
        outer.setBackgroundColor(NAVY);
        outer.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setOnApplyWindowInsetsListener(new View.OnApplyWindowInsetsListener() {
            @Override public WindowInsets onApplyWindowInsets(View v, WindowInsets ins) {
                v.setPadding(0, ins.getSystemWindowInsetTop(), 0, ins.getSystemWindowInsetBottom());
                return ins;
            }
        });
        outer.addView(root, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        // الشريط العلوي: صورتي + الرصيد ... تحديث + بحث + إشعارات + إغلاق
        LinearLayout top = new LinearLayout(this);
        top.setGravity(Gravity.CENTER_VERTICAL);
        top.setPadding(dp(12), dp(10), dp(12), dp(6));
        TextView me = tv(NAVY, 20, true);
        String nm = uname == null ? "" : uname;
        me.setText(nm.length() > 0 ? nm.substring(0, 1).toUpperCase() : "؟");
        me.setGravity(Gravity.CENTER);
        me.setBackground(oval(GOLD, 0xFFFFE7AD));
        me.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) { openProfile(null); }
        });
        FrameLayout meBox = new FrameLayout(this);
        meBox.addView(me, new FrameLayout.LayoutParams(dp(46), dp(46)));
        final ImageView meImg = circImg(46);
        meImg.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) { openProfile(null); }
        });
        meBox.addView(meImg, new FrameLayout.LayoutParams(dp(46), dp(46)));
        String mePh = "";
        try { if (pjson.length() > 0) mePh = new JSONObject(pjson).optString("photoUrl", ""); } catch (Exception ignore) {}
        if (!isImg(mePh) && isImg(uavatar)) mePh = uavatar;
        if (isImg(mePh)) { loadImage(mePh, meImg); } else { meImg.setVisibility(View.GONE); }
        top.addView(meBox, new LinearLayout.LayoutParams(dp(46), dp(46)));
        balance = tv(GOLD, 20, true);
        balance.setText("…");
        withCoin(balance, dp(26));
        balance.setGravity(Gravity.CENTER);
        balance.setPadding(dp(16), 0, dp(16), 0);
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(0xFF0D1440);
        bg.setCornerRadius(dp(23));
        bg.setStroke(dp(1), 0x55F5C35A);
        balance.setBackground(bg);
        balance.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) { openPointsPage(); }
        });
        LinearLayout.LayoutParams blp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, dp(46));
        blp.setMargins(0, 0, dp(10), 0);
        top.addView(balance, blp);
        top.addView(new View(this), new LinearLayout.LayoutParams(0, 1, 1f));
        TextView rf = iconBtn("↻", null);
        rf.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) { refresh(); }
        });
        top.addView(rf);
        top.addView(iconBtn("🔍", "search"));
        TextView bell = iconBtn("\uD83D\uDD14", "notifications");
        FrameLayout bellBox = new FrameLayout(this);
        LinearLayout.LayoutParams bbl = (LinearLayout.LayoutParams) bell.getLayoutParams();
        bell.setLayoutParams(new FrameLayout.LayoutParams(dp(46), dp(46)));
        bellBox.addView(bell);
        bellBadgeV = tv(Color.WHITE, 10, true);
        bellBadgeV.setGravity(Gravity.CENTER);
        GradientDrawable bg2 = new GradientDrawable();
        bg2.setColor(0xFF2C4BB5);
        bg2.setCornerRadius(dp(9));
        bg2.setStroke(dp(2), NAVY);
        bellBadgeV.setBackground(bg2);
        bellBadgeV.setPadding(dp(4), 0, dp(4), 0);
        bellBadgeV.setVisibility(View.GONE);
        FrameLayout.LayoutParams bdl = new FrameLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, dp(18), Gravity.TOP | Gravity.END);
        bdl.setMargins(0, -dp(2), -dp(2), 0);
        bellBox.addView(bellBadgeV, bdl);
        top.addView(bellBox, new LinearLayout.LayoutParams(dp(54), dp(46)));
        updateBellBadge();
        root.addView(top);

        // دوائر الاختصارات
        HorizontalScrollView hs = new HorizontalScrollView(this);
        hs.setHorizontalScrollBarEnabled(false);
        LinearLayout shortcuts = new LinearLayout(this);
        shortcuts.setPadding(dp(8), dp(4), dp(8), dp(4));
        shortcuts.addView(circleBtn("🕐", L("الليلة", "Tonight"), "tonight", false));
        shortcuts.addView(circleBtn("LIVE", L("مباشر", "Live"), "live", true));
        shortcuts.addView(circleBtn("⬆", L("كيف تكسب", "How to earn"), "earn", false));
        shortcuts.addView(circleBtn("🏆", L("الترتيب", "Ranking"), "ranking", false));
        shortcuts.addView(circleBtn("🎯", L("الرادار", "Radar"), "radar", false));
        shortcuts.addView(circleBtn("⭐", L("الاشتراكات", "Plans"), "subs", false));
        hs.addView(shortcuts);
        root.addView(hs);

        status = tv(MUTED, 12, false);
        status.setPadding(dp(16), dp(4), dp(16), dp(6));
        status.setText("");
        root.addView(status);

        ListView lv = new ListView(this);
        lv.setDivider(null);
        lv.setSelector(new ColorDrawable(Color.TRANSPARENT));
        lv.setClipToPadding(false);
        lv.setPadding(0, 0, 0, dp(90));
        // إعلان بانر بعد كل 7 منشورات (للمستخدم غير المشترك فقط)
        final boolean[] feedAds = { false };
        final HashMap<Integer, View> feedAdViews = new HashMap<Integer, View>();
        adapter = new BaseAdapter() {
            private boolean isAd(int p) { return feedAds[0] && p % 8 == 7; }
            private int idx(int p) { return feedAds[0] ? p - p / 8 : p; }
            @Override public int getCount() { int n = items.size(); return feedAds[0] ? n + n / 7 : n; }
            @Override public Object getItem(int i) { return isAd(i) ? null : items.get(idx(i)); }
            @Override public long getItemId(int i) { return i; }
            @Override public int getItemViewType(int i) { return isAd(i) ? -1 : 0; }
            @Override public View getView(int i, View cv, ViewGroup parent) {
                if (isAd(i)) {
                    View av = feedAdViews.get(i);
                    if (av == null) { av = adFeedView(); feedAdViews.put(i, av); }
                    return av;
                }
                if (cv == null) cv = makeRow();
                bindPost(cv, idx(i));
                return cv;
            }
        };
        if (uid != null) fetchTier(new TierCb() { @Override public void on(int tier) {
            if (tier < 1) { feedAds[0] = true; adapter.notifyDataSetChanged(); }
        } });
        lv.setAdapter(adapter);
        lv.setOnScrollListener(new AbsListView.OnScrollListener() {
            @Override public void onScrollStateChanged(AbsListView v, int st) {}
            @Override public void onScroll(AbsListView v, int first, int visible, int total) {
                if (total > 0 && first + visible >= total - 4) loadPage();
            }
        });
        FrameLayout listBox = new FrameLayout(this);
        listBox.addView(lv, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        // زر "+" لكتابة منشور (يفتح نافذة الكتابة)
        TextView fab = tv(Color.WHITE, 30, false);
        fab.setText("+");
        fab.setGravity(Gravity.CENTER);
        fab.setBackground(oval(0xFF2C4BB5, 0));
        fab.setElevation(dp(6));
        fab.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) { openCompose(); }
        });
        FrameLayout.LayoutParams flp = new FrameLayout.LayoutParams(dp(58), dp(58), Gravity.BOTTOM | Gravity.LEFT);
        flp.setMargins(dp(18), 0, 0, dp(18));
        listBox.addView(fab, flp);
        adFab = fab;
        adFabShift();
        root.addView(listBox, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));

        // الشريط السفلي الأصلي
        View line = new View(this);
        line.setBackgroundColor(0x2EF5C35A);
        root.addView(line, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(1)));
        LinearLayout nav = new LinearLayout(this);
        nav.setBackgroundColor(NAVY);
        nav.addView(navItem(6, L("الرئيسية", "Home"), null, true), new LinearLayout.LayoutParams(0, dp(64), 1f));
        nav.addView(navItem(7, L("المباريات", "Matches"), "nav:matches", false), new LinearLayout.LayoutParams(0, dp(64), 1f));
        nav.addView(navItem(8, L("فيديو", "Video"), "nav:videos", false), new LinearLayout.LayoutParams(0, dp(64), 1f));
        nav.addView(navItem(9, L("الرسائل", "Messages"), "nav:messages", false), new LinearLayout.LayoutParams(0, dp(64), 1f));
        nav.addView(navItem(10, L("الملف الشخصي", "Profile"), "nav:profile", false), new LinearLayout.LayoutParams(0, dp(64), 1f));
        root.addView(nav);

        setContentView(outer);
        t0 = System.currentTimeMillis();
        loadBalance();
        loadPage();
    }

    @Override
    public void onBackPressed() {
        moveTaskToBack(true);
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        pool.shutdownNow();
    }

    // ===== من home.js: الإبلاغ عن منشور/رد + فتح منشور من إشعار =====
    protected void openReport(String type, String id) { openReport(type, id, null); }

    protected void openReport(final String type, final String id, final JSONObject target) {
        final String[][] rs = {
            { "spam", L("📢 محتوى مزعج أو إعلاني", "📢 Spam or advertising") }, { "abuse", L("😡 إساءة أو تحرّش", "😡 Abuse or harassment") },
            { "hate", L("⚠️ خطاب كراهية", "⚠️ Hate speech") }, { "violence", L("🩸 عنف أو محتوى صادم", "🩸 Violence or graphic content") },
            { "adult", L("🔞 محتوى للبالغين", "🔞 Adult content") }, { "misinfo", L("❓ معلومات مضللة", "❓ Misinformation") },
            { "other", L("… سبب آخر", "… Another reason") }
        };
        final Dialog d = sheetDialog(false);
        final ScrollView sc = new ScrollView(this);
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setPadding(dp(18), dp(10), dp(18), navH() + dp(8));
        GradientDrawable pbg = new GradientDrawable();
        pbg.setColor(0xFF111A4A);
        pbg.setCornerRadii(new float[] { dp(28), dp(28), dp(28), dp(28), 0, 0, 0, 0 });
        pbg.setStroke(dp(1), 0x33F5C35A);
        box.setBackground(pbg);
        View gr = new View(this);
        GradientDrawable grg = new GradientDrawable();
        grg.setColor(0x33FFFFFF); grg.setCornerRadius(dp(3));
        gr.setBackground(grg);
        LinearLayout.LayoutParams grl = new LinearLayout.LayoutParams(dp(40), dp(5));
        grl.gravity = Gravity.CENTER_HORIZONTAL;
        grl.setMargins(0, 0, 0, dp(12));
        box.addView(gr, grl);
        LinearLayout th = new LinearLayout(this);
        th.setGravity(Gravity.CENTER_VERTICAL);
        ImageView fi = new ImageView(this);
        fi.setImageDrawable(new Ic(16, GOLD, false, dp(22)));
        th.addView(fi, new LinearLayout.LayoutParams(dp(22), dp(22)));
        TextView ttl = tv(GOLD, 20, true);
        ttl.setText(L("الإبلاغ", "Report"));
        ttl.setPadding(dp(10), 0, 0, 0);
        th.addView(ttl);
        box.addView(th);
        TextView sub = tv(MUTED, 12, false);
        sub.setTextAlignment(View.TEXT_ALIGNMENT_VIEW_START);
        sub.setText(L("اختر السبب وسنراجع البلاغ", "Choose a reason and we will review it"));
        sub.setPadding(0, dp(4), 0, dp(12));
        box.addView(sub);
        if (target != null) {
            LinearLayout pv = new LinearLayout(this);
            pv.setPadding(dp(12), dp(10), dp(12), dp(10));
            GradientDrawable pg = new GradientDrawable();
            pg.setColor(0xFF0D1540); pg.setCornerRadius(dp(16)); pg.setStroke(dp(1), 0x14FFFFFF);
            pv.setBackground(pg);
            String au = target.optString("user_id", ""), an = target.optString("author_name", "");
            pv.addView(rpAvatar(an, photos.get(au), 34), new LinearLayout.LayoutParams(dp(34), dp(34)));
            LinearLayout pc = new LinearLayout(this);
            pc.setOrientation(LinearLayout.VERTICAL);
            pc.setPadding(dp(10), 0, 0, 0);
            String un = unames.get(au);
            TextView pn = tv(Color.WHITE, 13, true);
            pn.setTextAlignment(View.TEXT_ALIGNMENT_VIEW_START);
            pn.setText(an + (un != null ? "  @" + un : ""));
            pc.addView(pn);
            String ct = target.optString("content", "");
            boolean hv = (!target.isNull("video_url") && target.optString("video_url", "").length() > 4);
            boolean hi = (!target.isNull("image_url") && target.optString("image_url", "").length() > 4);
            TextView pt = tv(0xFFDFE4FF, 13, false);
            pt.setTextAlignment(View.TEXT_ALIGNMENT_VIEW_START);
            pt.setMaxLines(2);
            pt.setEllipsize(android.text.TextUtils.TruncateAt.END);
            pt.setText(ct + (hv ? (ct.length() > 0 ? "  " : "") + "🎬" : hi ? (ct.length() > 0 ? "  " : "") + "🖼" : ""));
            pc.addView(pt);
            pv.addView(pc, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
            LinearLayout.LayoutParams pvl = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            pvl.bottomMargin = dp(8);
            box.addView(pv, pvl);
        }
        final int[] sel = { -1 };
        final View[] dots = new View[rs.length];
        final TextView[] lbs = new TextView[rs.length];
        final TextView send = tv(NAVY, 16, true);
        final EditText note = new EditText(this);
        final Runnable paint = new Runnable() {
            @Override public void run() {
                for (int i = 0; i < rs.length; i++) {
                    boolean on = sel[0] == i;
                    GradientDrawable dg = new GradientDrawable();
                    dg.setShape(GradientDrawable.OVAL);
                    dg.setColor(on ? GOLD : 0x00000000);
                    dg.setStroke(dp(2), on ? GOLD : 0xFF4A5AA8);
                    dots[i].setBackground(dg);
                    lbs[i].setTextColor(on ? GOLD : Color.WHITE);
                    lbs[i].setTypeface(null, on ? android.graphics.Typeface.BOLD : android.graphics.Typeface.NORMAL);
                }
                send.setAlpha(sel[0] >= 0 ? 1f : 0.45f);
                note.setHint(sel[0] == rs.length - 1 ? L("اشرح المشكلة (مطلوب)…", "Explain the problem (required)…") : L("أضف تفاصيل (اختياري)…", "Add details (optional)…"));
            }
        };
        for (int i = 0; i < rs.length; i++) {
            final int fi2 = i;
            LinearLayout rw = new LinearLayout(this);
            rw.setGravity(Gravity.CENTER_VERTICAL);
            rw.setPadding(dp(4), dp(12), dp(4), dp(12));
            dots[i] = new View(this);
            rw.addView(dots[i], new LinearLayout.LayoutParams(dp(22), dp(22)));
            lbs[i] = tv(Color.WHITE, 15, false);
            lbs[i].setText(rs[i][1]);
            lbs[i].setPadding(dp(12), 0, 0, 0);
            rw.addView(lbs[i]);
            rw.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { sel[0] = fi2; paint.run(); } });
            box.addView(rw);
            if (i < rs.length - 1) {
                View dv = new View(this);
                dv.setBackgroundColor(0x14FFFFFF);
                box.addView(dv, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 1));
            }
        }
        note.setTextColor(Color.WHITE);
        note.setHintTextColor(0xFF6B76B0);
        note.setTextSize(14);
        note.setMinLines(2);
        note.setGravity(Gravity.TOP | Gravity.START);
        note.setFilters(new android.text.InputFilter[] { new android.text.InputFilter.LengthFilter(300) });
        GradientDrawable ng = new GradientDrawable();
        ng.setColor(0xFF0D1540); ng.setCornerRadius(dp(14)); ng.setStroke(dp(1), 0x1CFFFFFF);
        note.setBackground(ng);
        note.setPadding(dp(12), dp(10), dp(12), dp(10));
        LinearLayout.LayoutParams nl = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        nl.topMargin = dp(10);
        box.addView(note, nl);
        send.setText(L("إرسال البلاغ", "Send report"));
        send.setGravity(Gravity.CENTER);
        GradientDrawable sg = new GradientDrawable();
        sg.setColor(GOLD); sg.setCornerRadius(dp(24));
        send.setBackground(sg);
        send.setPadding(0, dp(13), 0, dp(13));
        LinearLayout.LayoutParams sl = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        sl.topMargin = dp(12);
        box.addView(send, sl);
        TextView fn = tv(MUTED, 11, false);
        fn.setGravity(Gravity.CENTER);
        fn.setText(L("نحتفظ بنسخة من المحتوى المُبلَّغ عنه للمراجعة، حتى لو حُذف لاحقاً", "We keep a copy of the reported content for review, even if it is deleted later"));
        fn.setPadding(0, dp(8), 0, 0);
        box.addView(fn);
        send.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) {
                if (sel[0] < 0) { toast(L("اختر سبب البلاغ", "Choose a reason")); return; }
                String x = note.getText().toString().trim();
                boolean other = sel[0] == rs.length - 1;
                if (other && x.length() < 3) { toast(L("اكتب 3 أحرف على الأقل", "Write at least 3 characters")); return; }
                d.dismiss();
                submitReport(type, id, other ? "other: " + x : rs[sel[0]][0], other ? "" : x, target);
            }
        });
        paint.run();
        sc.addView(box);
        keyboardLift(d, sc);
        d.setContentView(sc);
        d.show();
    }

    private void submitReport(final String type, final String id, final String reason, final String details, final JSONObject target) {
        pool.execute(new Runnable() {
            @Override public void run() {
                boolean ok = true; String err = "";
                try {
                    JSONObject o = new JSONObject();
                    o.put("reporter_id", uid); o.put("target_type", type); o.put("target_id", id); o.put("reason", reason);
                    JSONObject full = new JSONObject(o.toString());
                    if (details != null && details.length() > 0) full.put("details", details);
                    if (target != null) {
                        JSONObject sn = new JSONObject();
                        String[] ks = { "content", "author_name", "user_id", "image_url", "video_url", "created_at" };
                        for (String k : ks) if (!target.isNull(k)) sn.put(k, target.optString(k, ""));
                        String un = unames.get(target.optString("user_id", ""));
                        if (un != null) sn.put("username", un);
                        full.put("snapshot", sn);
                    }
                    try { send("POST", "post_reports", "[" + full.toString() + "]"); }
                    catch (Exception e1) {
                        String m = String.valueOf(e1.getMessage());
                        if (m.indexOf("23505") >= 0) throw e1;
                        // قاعدة قديمة بلا أعمدة النسخة: أرسل البلاغ الأساسي
                        send("POST", "post_reports", "[" + o.toString() + "]");
                    }
                } catch (Exception e) { err = String.valueOf(e.getMessage()); ok = err.indexOf("23505") >= 0; }
                final boolean fok = ok; final String ferr = err;
                runOnUiThread(new Runnable() { @Override public void run() { toast(fok ? L("تم استلام بلاغك، شكرًا لك", "Report received. Thank you") : ferr); } });
            }
        });
    }

    // arg = pid أو pid:cid
    protected void openPostById(final String arg) {
        final String pid = arg.indexOf(':') > 0 ? arg.substring(0, arg.indexOf(':')) : arg;
        pool.execute(new Runnable() {
            @Override public void run() {
                JSONObject p = null;
                try {
                    JSONArray a = new JSONArray(get("posts?select=id,user_id,author_name,content,created_at,image_url,video_url,video_path,topic_type,topic_name,topic_name_b&id=eq." + pid + "&limit=1"));
                    if (a.length() > 0) p = a.getJSONObject(0);
                } catch (Exception ignore) {}
                final JSONObject fp = p;
                runOnUiThread(new Runnable() { @Override public void run() {
                    if (fp == null) toast(L("المنشور غير متاح", "Post not available")); else openComments(fp);
                } });
            }
        });
    }
}
