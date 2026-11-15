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
                        if (l.isEmpty()) { toast("لا توجد فيديوهات بعد"); return; }
                        openViewer(l, 0);
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
        vIc[1].setImageDrawable(new Ic(2, lk ? 0xFFFF4D6D : Color.WHITE, lk, d));
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
            @Override public boolean onError(android.media.MediaPlayer mp, int w, int e) { toast("تعذّر تشغيل الفيديو"); return true; }
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
        names.addView(h.name);
        names.addView(h.time);
        head.addView(names);
        head.addView(new View(this), new LinearLayout.LayoutParams(0, 1, 1f));
        h.supBtn = tv(NAVY, 13, true);
        h.supBtn.setText("ادعم");
        h.supBtn.setGravity(Gravity.CENTER);
        GradientDrawable sbBg = new GradientDrawable();
        sbBg.setColor(GOLD);
        sbBg.setCornerRadius(dp(18));
        h.supBtn.setBackground(sbBg);
        h.supBtn.setPadding(dp(16), dp(6), dp(16), dp(6));
        h.supBtn.setVisibility(View.GONE);
        head.addView(h.supBtn);
        h.more = tv(MUTED, 22, true);
        h.more.setText("⋮");
        h.more.setPadding(dp(14), dp(4), dp(6), dp(4));
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
            all[q].setPadding(dp(2), dp(10), dp(2), dp(10));
            all[q].setGravity(Gravity.CENTER);
            acts.addView(all[q], new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
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
            if (idx >= 0) { labels.add("تعديل النص"); icons.add(14); danger.add(false); acts.add(new Runnable() { public void run() { editPost(idx); } }); }
            labels.add("تعزيز المنشور"); icons.add(17); danger.add(false); acts.add(new Runnable() { public void run() { openBoost(pid); } });
            labels.add("التفاعلات"); icons.add(3); danger.add(false); acts.add(new Runnable() { public void run() { showEngagements(o); } });
            labels.add(sv ? "إزالة من المحفوظات" : "حفظ المنشور"); icons.add(4); danger.add(false); acts.add(new Runnable() { public void run() { toggleSave(o); } });
            labels.add("مشاركة الرابط"); icons.add(5); danger.add(false); acts.add(new Runnable() { public void run() { shareLink(o); } });
            if (idx >= 0) { labels.add("حذف المنشور"); icons.add(15); danger.add(true); acts.add(new Runnable() { public void run() { deletePost(idx); } }); }
        } else {
            final boolean fl = followSet.contains(author);
            labels.add("لا أريد رؤية هذا"); icons.add(22); danger.add(false); acts.add(new Runnable() { public void run() { hidePost(o); } });
            labels.add(fl ? "إلغاء متابعة " + tag : "متابعة " + tag); icons.add(fl ? 19 : 18); danger.add(false); acts.add(new Runnable() { public void run() { toggleFollowUser(author); } });
            labels.add("كتم " + tag); icons.add(20); danger.add(false); acts.add(new Runnable() { public void run() { muteUser(author); } });
            labels.add("حظر " + tag); icons.add(21); danger.add(true); acts.add(new Runnable() { public void run() { blockUser(author, tag); } });
            labels.add("إبلاغ"); icons.add(16); danger.add(true); acts.add(new Runnable() { public void run() { openReport("post", String.valueOf(pid)); } });
            labels.add("التفاعلات"); icons.add(3); danger.add(false); acts.add(new Runnable() { public void run() { showEngagements(o); } });
            labels.add(sv ? "إزالة من المحفوظات" : "حفظ المنشور"); icons.add(4); danger.add(false); acts.add(new Runnable() { public void run() { toggleSave(o); } });
            labels.add("مشاركة الرابط"); icons.add(5); danger.add(false); acts.add(new Runnable() { public void run() { shareLink(o); } });
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
        String link = (linkTpl == null || linkTpl.length() == 0) ? "" : linkTpl.replace("__ID__", String.valueOf(o.optLong("id")));
        String text = link.length() > 0 ? link : o.optString("content", "");
        Intent i = new Intent(Intent.ACTION_SEND);
        i.setType("text/plain");
        i.putExtra(Intent.EXTRA_TEXT, text);
        startActivity(Intent.createChooser(i, "مشاركة"));
    }

    protected void editPost(final int idx) {
        final JSONObject o = items.get(idx);
        final EditText et = new EditText(this);
        et.setText(o.optString("content", ""));
        et.setMinLines(3);
        et.setGravity(Gravity.TOP | Gravity.START);
        new AlertDialog.Builder(this)
            .setTitle("تعديل المنشور")
            .setView(et)
            .setNegativeButton("إلغاء", null)
            .setPositiveButton("حفظ", new DialogInterface.OnClickListener() {
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
                                    if (fe != null) toast("تعذّر التعديل: " + fe);
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
            .setMessage("هل تريد حذف هذا المنشور؟")
            .setNegativeButton("إلغاء", null)
            .setPositiveButton("حذف", new DialogInterface.OnClickListener() {
                @Override public void onClick(DialogInterface d, int w) {
                    final String id = String.valueOf(o.optLong("id"));
                    final String vp = o.isNull("video_path") ? "" : o.optString("video_path", "");
                    pool.execute(new Runnable() {
                        @Override public void run() {
                            String err = null;
                            try {
                                send("DELETE", "posts?id=eq." + id + "&user_id=eq." + uid, null);
                                if (vp.length() > 3) {
                                    try { sendUrl("DELETE", url + "/storage/v1/object/post-videos/" + vp, null); } catch (Exception ignore) {}
                                }
                            } catch (Exception e) { err = String.valueOf(e.getMessage()); }
                            final String fe = err;
                            runOnUiThread(new Runnable() {
                                @Override public void run() {
                                    if (fe != null) { toast("تعذّر الحذف: " + fe); return; }
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
            tv2.setText(tot + " صوت");
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
                            toast("تعذّر تسجيل صوتك");
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
        pill.setText(fin ? (outcome == pick ? "صحّ ✓" : "خطأ ✗") : "توقّع");
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
        na.setText(ta);
        na.setGravity(Gravity.CENTER);
        na.setSingleLine(true);
        colA.addView(na);
        LinearLayout colB = new LinearLayout(this);
        colB.setOrientation(LinearLayout.VERTICAL);
        colB.setGravity(Gravity.CENTER_HORIZONTAL);
        colB.addView(crest(tb), new LinearLayout.LayoutParams(dp(44), dp(44)));
        TextView nb = tv(0xFFE8ECFF, 12, true);
        nb.setText(tb);
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
        if (fin) { d1.setText("انتهت"); d2 = tv(GOLD, 24, true); d2.setText(score); }
        else if (started) { d1.setText("جارية"); d2 = tv(GOLD, 24, true); d2.setText(hasScore ? score : "—"); }
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

        final String[] lab = new String[] { ta, "تعادل", tb };
        TextView mine = tv(0xFFCDD6FF, 13, true);
        mine.setGravity(Gravity.CENTER);
        mine.setPadding(0, dp(9), 0, 0);
        mine.setText("📌 توقّع صاحب المنشور: " + (pick == 1 ? lab[1] : ("فوز " + lab[Math.max(0, Math.min(2, pick))])));
        box.addView(mine);

        boolean open = !fin && !started;
        boolean owner = r.optBoolean("is_owner", false);
        if (r.isNull("n0")) {
            LinearLayout bt = new LinearLayout(this);
            bt.setPadding(0, dp(10), 0, 0);
            for (int i = 0; i < 3; i++) {
                final int pi = i;
                TextView b = tv(0xFFE8ECFF, 12, true);
                b.setText(i == 1 ? lab[1] : ("فوز " + lab[i]));
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
            note.setText("صوّت لترى نسب الجمهور");
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
                t1.setText((i == 1 ? lab[1] : lab[i]) + (pick == i ? " 📌" : "") + (mineSel == i ? " · صوتك" : ""));
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
            note.setText(tot + " صوت");
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
                            toast("تعذّرت إعادة النشر");
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
        toast(was ? "أُزيل من المحفوظات" : "تم حفظ المنشور 🔖");
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
                            toast("تعذّر الحفظ");
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
            .setTitle("التفاعلات مع المنشور")
            .setMessage("المشاهدات: " + s[3] + "\nالأهداف: " + s[0] + "\nالتمريرات: " + s[2] + "\nالردود: " + s[1])
            .setPositiveButton("حسنًا", null)
            .show();
    }

    protected void toggleFollowUser(final String target) {
        if (uid == null || target.equals(uid)) return;
        final boolean was = followSet.contains(target);
        if (was) followSet.remove(target); else followSet.add(target);
        toast(was ? "تم إلغاء المتابعة" : "تمت المتابعة ✅");
        pool.execute(new Runnable() {
            @Override public void run() {
                try {
                    if (was) send("DELETE", "user_follows?follower_id=eq." + uid + "&following_id=eq." + target, null);
                    else { send("POST", "user_follows", "{\"follower_id\":\"" + uid + "\",\"following_id\":\"" + target + "\"}"); queueNotify("follow", target, null, null, null); }
                } catch (Exception e) {
                    runOnUiThread(new Runnable() {
                        @Override public void run() {
                            if (was) followSet.add(target); else followSet.remove(target);
                            toast("تعذّر التنفيذ");
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
        toast("تم الكتم");
        pool.execute(new Runnable() {
            @Override public void run() {
                try { send("POST", "user_mutes", "{\"user_id\":\"" + uid + "\",\"muted_id\":\"" + target + "\"}"); } catch (Exception ignore) {}
            }
        });
    }

    protected void blockUser(final String target, String tag) {
        if (uid == null || target.equals(uid)) return;
        new AlertDialog.Builder(this)
            .setMessage("هل تريد حظر " + tag + "؟ لن ترى منشوراته وردوده.")
            .setNegativeButton("إلغاء", null)
            .setPositiveButton("حظر", new DialogInterface.OnClickListener() {
                @Override public void onClick(DialogInterface d, int w) {
                    blockSet.add(target);
                    followSet.remove(target);
                    dropUser(target);
                    toast("تم الحظر");
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
        toast("تم إخفاء المنشور");
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
                            toast("تعذّر حفظ الإعجاب");
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
        setIc(h.heart, 2, lk ? 0xFFFF4D6D : MUTED, lk);
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
        h.sv.setText(" ");
        setIc(h.sv, 4, svd ? GOLD : MUTED, svd);
        h.sv.setTag(ti);
        h.sh.setText(" ");
        setIc(h.sh, 5, MUTED, false);
        h.sh.setTag(ti);
        bindRope(h, o);
        bindPred(h, o);
        bindSupport(h, o);
        recordView(o, s);
        final String au0 = o.optString("user_id", "");
        View.OnClickListener pc = new View.OnClickListener() { @Override public void onClick(View v) { if (au0.length() > 0) openProfileOf(au0); } };
        h.avatar.setOnClickListener(pc); h.avImg.setOnClickListener(pc); h.name.setOnClickListener(pc);
    }

    // ---------------- التعليقات ----------------
    protected void openComments(int idx) { openComments(items.get(idx)); }

    protected void openComments(JSONObject post) {
        final long pid = post.optLong("id");
        final String pk = String.valueOf(pid);
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
        bar.setPadding(dp(16), dp(12), dp(16), dp(8));
        TextView title = tv(GOLD, 18, true);
        title.setText("التعليقات");
        bar.addView(title, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        TextView x = tv(Color.WHITE, 22, false);
        x.setText("✕");
        x.setPadding(dp(12), 0, dp(4), 0);
        x.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) { d.dismiss(); }
        });
        bar.addView(x);
        box.addView(bar);

        final TextView empty = tv(MUTED, 14, false);
        empty.setText("");
        empty.setPadding(dp(16), dp(8), dp(16), dp(8));
        box.addView(empty);

        ListView lv = new ListView(this);
        lv.setDivider(null);
        lv.setSelector(new ColorDrawable(Color.TRANSPARENT));
        final BaseAdapter ca = new BaseAdapter() {
            @Override public int getCount() { return cm.size(); }
            @Override public Object getItem(int i) { return cm.get(i); }
            @Override public long getItemId(int i) { return i; }
            @Override public View getView(int i, View cv, ViewGroup p) {
                LinearLayout r;
                if (cv == null) {
                    r = new LinearLayout(Home.this);
                    r.setOrientation(LinearLayout.VERTICAL);
                    TextView n = tv(Color.WHITE, 14, true);
                    TextView t = tv(0xFFE6E9FF, 15, false);
                    TextView m = tv(MUTED, 11, false);
                    r.addView(n); r.addView(t); r.addView(m);
                    r.setTag(new TextView[] { n, t, m });
                    cv = r;
                }
                r = (LinearLayout) cv;
                TextView[] tt = (TextView[]) r.getTag();
                JSONObject o = cm.get(i);
                boolean reply = !o.isNull("parent_id");
                r.setPadding(dp(reply ? 44 : 16), dp(10), dp(16), dp(10));
                tt[0].setText(o.optString("author_name", ""));
                String c = o.optString("content", "");
                tt[1].setText(c.startsWith("::sticker::") ? c.substring(11) : c);
                tt[2].setText(ago(o.optString("created_at", "")));
                return cv;
            }
        };
        lv.setAdapter(ca);
        box.addView(lv, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));

        LinearLayout in = new LinearLayout(this);
        in.setGravity(Gravity.CENTER_VERTICAL);
        in.setPadding(dp(12), dp(8), dp(12), dp(8));
        final EditText et = new EditText(this);
        et.setHint("اكتب تعليقًا...");
        et.setHintTextColor(MUTED);
        et.setTextColor(Color.WHITE);
        et.setMaxLines(4);
        in.addView(et, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        final TextView sendBtn = tv(NAVY, 15, true);
        sendBtn.setText("إرسال");
        sendBtn.setGravity(Gravity.CENTER);
        GradientDrawable sg = new GradientDrawable();
        sg.setColor(GOLD);
        sg.setCornerRadius(dp(18));
        sendBtn.setBackground(sg);
        sendBtn.setPadding(dp(18), dp(10), dp(18), dp(10));
        in.addView(sendBtn);
        box.addView(in);

        final Runnable reload = new Runnable() {
            @Override public void run() {
                pool.execute(new Runnable() {
                    @Override public void run() {
                        String err = null;
                        final List<JSONObject> got = new ArrayList<JSONObject>();
                        try {
                            JSONArray a = new JSONArray(get("post_comments?select=id,parent_id,user_id,author_name,content,created_at,hidden&post_id=eq." + pid + "&order=created_at.asc&limit=200"));
                            for (int k = 0; k < a.length(); k++) {
                                JSONObject o = a.getJSONObject(k);
                                if (!o.optBoolean("hidden", false)) got.add(o);
                            }
                        } catch (Exception e) { err = String.valueOf(e.getMessage()); }
                        final String fe = err;
                        runOnUiThread(new Runnable() {
                            @Override public void run() {
                                if (fe != null) { empty.setText("تعذّر التحميل: " + fe); return; }
                                cm.clear();
                                cm.addAll(got);
                                ca.notifyDataSetChanged();
                                empty.setVisibility(got.isEmpty() ? View.VISIBLE : View.GONE);
                                empty.setText("لا توجد تعليقات بعد");
                                int[] s = stats.get(pk);
                                if (s != null) { s[1] = got.size(); refreshUi(); }
                            }
                        });
                    }
                });
            }
        };
        sendBtn.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) {
                final String txt = et.getText().toString().trim();
                if (txt.length() == 0 || uid == null) return;
                sendBtn.setEnabled(false);
                pool.execute(new Runnable() {
                    @Override public void run() {
                        String err = null;
                        try {
                            JSONObject b = new JSONObject();
                            b.put("post_id", pid);
                            b.put("user_id", uid);
                            b.put("author_name", uname == null ? "" : uname);
                            b.put("author_avatar", uavatar == null ? "" : uavatar);
                            b.put("content", txt);
                            send("POST", "post_comments", b.toString());
                            queueNotify("comment", ownerOf(pk), pk, txt, null);
                        } catch (Exception e) { err = String.valueOf(e.getMessage()); }
                        final String fe = err;
                        runOnUiThread(new Runnable() {
                            @Override public void run() {
                                sendBtn.setEnabled(true);
                                if (fe != null) { if (fe.contains("premium_required")) { toast("هذه الميزة للمشتركين فقط"); openSubscriptions(); } else toast("تعذّر الإرسال"); return; }
                                et.setText("");
                                reload.run();
                            }
                        });
                    }
                });
            }
        });
        d.setContentView(box);
        d.show();
        reload.run();
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
                            @Override public void run() { balance.setText(String.format(java.util.Locale.US, "%,d", p)); }
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
                        if (fe != null) { if (items.isEmpty()) status.setText("خطأ: " + fe); return; }
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
        top.addView(iconBtn("🔔", "notifications"));
        root.addView(top);

        // دوائر الاختصارات
        HorizontalScrollView hs = new HorizontalScrollView(this);
        hs.setHorizontalScrollBarEnabled(false);
        LinearLayout shortcuts = new LinearLayout(this);
        shortcuts.setPadding(dp(8), dp(4), dp(8), dp(4));
        shortcuts.addView(circleBtn("🕐", "الليلة", "tonight", false));
        shortcuts.addView(circleBtn("LIVE", "مباشر", "live", true));
        shortcuts.addView(circleBtn("⬆", "كيف تكسب", "earn", false));
        shortcuts.addView(circleBtn("🏆", "الترتيب", "ranking", false));
        shortcuts.addView(circleBtn("🎯", "الرادار", "radar", false));
        shortcuts.addView(circleBtn("⭐", "الاشتراكات", "subs", false));
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
        nav.addView(navItem(6, "الرئيسية", null, true), new LinearLayout.LayoutParams(0, dp(64), 1f));
        nav.addView(navItem(7, "المباريات", "nav:matches", false), new LinearLayout.LayoutParams(0, dp(64), 1f));
        nav.addView(navItem(8, "فيديو", "nav:videos", false), new LinearLayout.LayoutParams(0, dp(64), 1f));
        nav.addView(navItem(9, "الرسائل", "nav:messages", false), new LinearLayout.LayoutParams(0, dp(64), 1f));
        nav.addView(navItem(10, "الملف الشخصي", "nav:profile", false), new LinearLayout.LayoutParams(0, dp(64), 1f));
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
    protected void openReport(final String type, final String id) {
        final String[][] rs = {
            { "spam", "📢 محتوى مزعج أو إعلاني", "📢 Spam" }, { "abuse", "😡 إساءة أو تحرّش", "😡 Abuse or harassment" },
            { "hate", "⚠️ خطاب كراهية", "⚠️ Hateful content" }, { "violence", "🩸 عنف أو محتوى صادم", "🩸 Violent or graphic content" },
            { "adult", "🔞 محتوى للبالغين", "🔞 Adult content" }, { "misinfo", "❓ معلومات مضللة", "❓ Misinformation" },
            { "other", "… سبب آخر", "… Something else" }
        };
        String[] labels = new String[rs.length];
        for (int i = 0; i < rs.length; i++) labels[i] = L(rs[i][1], rs[i][2]);
        new AlertDialog.Builder(this).setTitle(L("ما سبب البلاغ؟", "Why are you reporting this?")).setItems(labels, new DialogInterface.OnClickListener() {
            @Override public void onClick(DialogInterface d, int w) {
                if ("other".equals(rs[w][0])) openReportText(type, id); else submitReport(type, id, rs[w][0]);
            }
        }).show();
    }

    private void openReportText(final String type, final String id) {
        final EditText t = new EditText(this);
        t.setHint(L("اشرح المشكلة باختصار…", "Briefly explain…"));
        t.setFilters(new android.text.InputFilter[] { new android.text.InputFilter.LengthFilter(300) });
        t.setMinLines(3);
        new AlertDialog.Builder(this).setTitle(L("اكتب سبب البلاغ", "Describe the problem")).setView(t)
            .setPositiveButton(L("إرسال", "Send"), new DialogInterface.OnClickListener() {
                @Override public void onClick(DialogInterface d, int w) {
                    String x = t.getText().toString().trim();
                    if (x.length() < 3) { toast(L("اكتب 3 أحرف على الأقل", "Write at least 3 characters")); return; }
                    submitReport(type, id, "other: " + x);
                }
            }).setNegativeButton(L("إلغاء", "Cancel"), null).show();
    }

    private void submitReport(final String type, final String id, final String reason) {
        pool.execute(new Runnable() {
            @Override public void run() {
                boolean ok = true; String err = "";
                try {
                    JSONObject o = new JSONObject();
                    o.put("reporter_id", uid); o.put("target_type", type); o.put("target_id", id); o.put("reason", reason);
                    send("POST", "post_reports", "[" + o.toString() + "]");
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
