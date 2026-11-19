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


abstract class Profile extends WeeklyMatchRankings {
    protected abstract void openEditProfile();
    // ---------------- الملف الشخصي ----------------

    @Override protected void onAvatarChanged(String photo) {
        try { JSONObject o = pjson.length() > 0 ? new JSONObject(pjson) : new JSONObject(); o.put("photo_url", photo); pjson = o.toString(); } catch (Exception ignore) {}
    }

    protected void loadMetaFor(String fids, Set<String> users, List<JSONObject> got) {
        if (fids.length() == 0) return;
        try {
            StringBuilder us = new StringBuilder();
            for (String u : users) { if (u.length() > 0 && !photos.containsKey(u)) { if (us.length() > 0) us.append(","); us.append(u); } }
            if (us.length() > 0) {
                JSONArray pa = new JSONArray(get("public_profiles?select=user_id,photo_url,username&user_id=in.(" + us + ")"));
                for (int q = 0; q < pa.length(); q++) {
                    JSONObject po = pa.getJSONObject(q);
                    String ph = po.isNull("photo_url") ? "" : po.optString("photo_url", "");
                    { String un9 = po.isNull("username") ? "" : po.optString("username", ""); if (un9.length() > 0) unames.put(po.optString("user_id"), un9); }
                    if (isImg(ph)) photos.put(po.optString("user_id"), ph);
                }
            }
        } catch (Exception ignore) {}
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

    protected void profLoadTab(final String target, final int t, final List<JSONObject> plist, final Runnable done) {
        pool.execute(new Runnable() {
            @Override public void run() {
                final List<JSONObject> got = new ArrayList<JSONObject>();
                final String cols = "id,user_id,author_name,content,created_at,image_url,video_url,video_path,topic_type,topic_name,topic_name_b";
                try {
                    JSONArray a;
                    if (t == 0) a = new JSONArray(get("posts?select=" + cols + "&user_id=eq." + target + "&order=created_at.desc&limit=40"));
                    else if (t == 3) a = new JSONArray(get("posts?select=" + cols + "&user_id=eq." + target + "&video_url=not.is.null&order=created_at.desc&limit=40"));
                    else if (t == 2) {
                        JSONArray r = new JSONArray(get("post_reposts?select=post_id&user_id=eq." + target + "&order=created_at.desc&limit=40"));
                        StringBuilder ib = new StringBuilder();
                        for (int i = 0; i < r.length(); i++) { if (ib.length() > 0) ib.append(","); ib.append(r.getJSONObject(i).optLong("post_id")); }
                        a = ib.length() == 0 ? new JSONArray() : new JSONArray(get("posts?select=" + cols + "&id=in.(" + ib + ")&order=created_at.desc"));
                    } else {
                        a = new JSONArray(get("post_comments?select=id,post_id,content,created_at&user_id=eq." + target + "&order=created_at.desc&limit=40"));
                    }
                    StringBuilder ids = new StringBuilder();
                    Set<String> users = new HashSet<String>();
                    for (int i = 0; i < a.length(); i++) {
                        JSONObject p = a.getJSONObject(i);
                        if (t == 1) { p.put("_reply", true); got.add(p); continue; }
                        if (p.optString("video_url", "").length() < 5 && t == 3) continue;
                        got.add(p);
                        stats.put(String.valueOf(p.optLong("id")), new int[] { 0, 0, 0, 0 });
                        if (ids.length() > 0) ids.append(",");
                        ids.append(p.optLong("id"));
                        users.add(p.optString("user_id", ""));
                    }
                    runOnUiThread(new Runnable() {
                        @Override public void run() { plist.clear(); plist.addAll(got); done.run(); }
                    });
                    loadMetaFor(ids.toString(), users, got);
                } catch (Exception e) {
                    runOnUiThread(new Runnable() {
                        @Override public void run() { plist.clear(); done.run(); toast(T("تعذّر التحميل")); }
                    });
                    return;
                }
                runOnUiThread(new Runnable() {
                    @Override public void run() { done.run(); }
                });
            }
        });
    }

    protected void shareProfile(String uname2) {
        Intent i = new Intent(Intent.ACTION_SEND);
        i.setType("text/plain");
        String lk = referralLink();
        i.putExtra(Intent.EXTRA_TEXT, "ZELO Sport — @" + uname2 + (lk.length() > 0 ? "\n" + lk : ""));
        startActivity(Intent.createChooser(i, T("مشاركة")));
    }

    protected View profStat(final TextView[] numRef, int idx, String label, final String action) {
        LinearLayout c = new LinearLayout(this);
        c.setOrientation(LinearLayout.VERTICAL);
        c.setGravity(Gravity.CENTER);
        c.setPadding(dp(4), dp(12), dp(4), dp(12));
        numRef[idx] = tv(Color.WHITE, 19, true);
        numRef[idx].setText("–");
        numRef[idx].setGravity(Gravity.CENTER);
        c.addView(numRef[idx]);
        TextView l = tv(MUTED, 12, false);
        l.setText(label);
        l.setGravity(Gravity.CENTER);
        c.addView(l);
        if (action != null) c.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) { openFollowList(action.startsWith("follow:") ? action.substring(7) : "followers"); }
        });
        return c;
    }

    protected View profTile(int icon, String label, final String action) {
        LinearLayout c = new LinearLayout(this);
        c.setOrientation(LinearLayout.VERTICAL);
        c.setGravity(Gravity.CENTER);
        c.setPadding(dp(2), dp(12), dp(2), dp(10));
        GradientDrawable g = new GradientDrawable();
        g.setColor(CARD);
        g.setCornerRadius(dp(16));
        g.setStroke(dp(1), 0x33F5C35A);
        c.setBackground(g);
        ImageView iv = new ImageView(this);
        iv.setImageDrawable(new Ic(icon, GOLD, false, dp(26)));
        c.addView(iv, new LinearLayout.LayoutParams(dp(26), dp(26)));
        TextView l = tv(0xFFE6E9FF, 12, true);
        l.setText(label);
        l.setGravity(Gravity.CENTER);
        l.setPadding(0, dp(6), 0, 0);
        c.addView(l);
        c.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) { if ("store".equals(action)) openStorePage(); else if ("wallet".equals(action)) openWithdrawWallet(); else if ("subs".equals(action)) openSubscriptions(); else if ("nft".equals(action)) openNftMarket(); else goWeb(action); }
        });
        return c;
    }

    protected ImageView circImg(int size) {
        ImageView iv = new ImageView(this);
        iv.setScaleType(ImageView.ScaleType.CENTER_CROP);
        iv.setOutlineProvider(new ViewOutlineProvider() {
            @Override public void getOutline(View v, Outline o) { o.setOval(0, 0, v.getWidth(), v.getHeight()); }
        });
        iv.setClipToOutline(true);
        return iv;
    }

    protected void openProfileOf(String t) {
        if (t != null && t.equals(profShown)) return;
        openProfile(t);
    }

    protected void openProfile(String targetIn) {
        final String target = (targetIn == null || targetIn.length() == 0) ? uid : targetIn;
        if (target == null) return;
        final boolean mine = target.equals(uid);
        profShown = target;
        JSONObject pj = new JSONObject();
        try { if (mine && pjson.length() > 0) pj = new JSONObject(pjson); } catch (Exception ignore) {}
        final JSONObject P = pj;
        final Dialog d = sheetDialog(true);
        final List<JSONObject> savedItems = items;
        final BaseAdapter savedAdapter = adapter;
        final List<JSONObject> plist = new ArrayList<JSONObject>();
        items = plist;
        final int[] tab = { 0 };
        final TextView[] nums = new TextView[4];
        final TextView[] lbs = new TextView[4];
        final View[] uls = new View[4];
        final TextView emptyV = tv(MUTED, 14, false);

        LinearLayout hdr = new LinearLayout(this);
        hdr.setOrientation(LinearLayout.VERTICAL);
        if (mine) { View bn = banNoteView(); if (bn != null) hdr.addView(bn); }

        // الغلاف
        FrameLayout cov = new FrameLayout(this);
        View covBg = new View(this);
        GradientDrawable cg = new GradientDrawable(GradientDrawable.Orientation.TL_BR, new int[] { 0xFF24348F, 0xFF0F1850, NAVY });
        covBg.setBackground(cg);
        cov.addView(covBg, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(150) + statusH()));
        final ImageView wm = new ImageView(this);
        wm.setAlpha(0.16f);
        wm.setScaleType(ImageView.ScaleType.FIT_CENTER);
        FrameLayout.LayoutParams wlp = new FrameLayout.LayoutParams(dp(150), dp(150), Gravity.TOP | Gravity.END);
        wlp.setMargins(dp(14), statusH(), dp(14), 0);
        cov.addView(wm, wlp);
        try {
            int lgId = getResources().getIdentifier("ic_launcher", "mipmap", getPackageName());
            if (lgId > 0) wm.setImageResource(lgId);
        } catch (Exception ignore) {}
        TextView cLeft = tv(Color.WHITE, 24, true);
        cLeft.setText(mine ? "☰" : "‹");
        cLeft.setGravity(Gravity.CENTER);
        cLeft.setBackground(oval(0x66000000, 0));
        cLeft.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) { d.dismiss(); }
        });
        FrameLayout.LayoutParams l1 = new FrameLayout.LayoutParams(dp(42), dp(42), Gravity.TOP | Gravity.START);
        l1.setMargins(dp(12), statusH() + dp(8), dp(12), 0);
        if (mine) {
            // أيقونات عمودية على اليسار: مشاركة ثم إحصائيات ثم إعدادات (المشاركة تُضاف أدناه)
            cLeft.setVisibility(View.GONE);
            TextView st = tv(0xFF14F195, 20, true);
            st.setText("\uD83D\uDCCA");
            st.setGravity(Gravity.CENTER);
            st.setBackground(oval(0x99000000, 0xFF14F195));
            st.setContentDescription(T("إحصائياتي"));
            st.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { openStats(); } });
            FrameLayout.LayoutParams sl = new FrameLayout.LayoutParams(dp(42), dp(42), Gravity.TOP | Gravity.END);
            sl.setMargins(0, statusH() + dp(8) + dp(46), 0, 0);
            sl.setMarginEnd(dp(12));
            cov.addView(st, sl);
            TextView cr = tv(GOLD, 20, true);
            cr.setText("\uD83D\uDCB0");
            cr.setGravity(Gravity.CENTER);
            cr.setBackground(oval(0x99000000, GOLD));
            cr.setContentDescription(T("مكافآت المحتوى الأصلي"));
            cr.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { openCreator(); } });
            FrameLayout.LayoutParams crl = new FrameLayout.LayoutParams(dp(42), dp(42), Gravity.TOP | Gravity.END);
            crl.setMargins(0, statusH() + dp(8) + dp(92), 0, 0);
            crl.setMarginEnd(dp(12));
            cov.addView(cr, crl);
            TextView gear = tv(Color.WHITE, 22, true);
            gear.setText("\u2699");
            gear.setGravity(Gravity.CENTER);
            gear.setBackground(oval(0x66000000, 0));
            gear.setContentDescription(T("الإعدادات"));
            gear.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { openSettings(); } });
            FrameLayout.LayoutParams gl = new FrameLayout.LayoutParams(dp(42), dp(42), Gravity.TOP | Gravity.END);
            gl.setMargins(0, statusH() + dp(8) + dp(138), 0, 0);
            gl.setMarginEnd(dp(12));
            cov.addView(gear, gl);
            if (everBoosted) {
                TextView bx = tv(GOLD, 20, true);
                bx.setText("\u26A1");
                bx.setGravity(Gravity.CENTER);
                bx.setBackground(oval(0x99000000, GOLD));
                bx.setContentDescription(T("إحصائيات التعزيز"));
                bx.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { openBoostStats(); } });
                FrameLayout.LayoutParams bxl = new FrameLayout.LayoutParams(dp(42), dp(42), Gravity.TOP | Gravity.END);
                bxl.setMargins(0, statusH() + dp(8) + dp(184), 0, 0);
                bxl.setMarginEnd(dp(12));
                cov.addView(bx, bxl);
            }
        }
        cov.addView(cLeft, l1);
        final String[] shareName = { P.optString("username", "") };
        TextView cRight = new TextView(this);
        cRight.setBackground(oval(0x66000000, 0));
        cRight.setCompoundDrawablesWithIntrinsicBounds(new Ic(5, Color.WHITE, false, dp(20)), null, null, null);
        cRight.setPadding(dp(11), dp(11), dp(11), dp(11));
        cRight.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) { shareProfile(shareName[0]); }
        });
        FrameLayout.LayoutParams l2 = new FrameLayout.LayoutParams(dp(42), dp(42), Gravity.TOP | Gravity.END);
        l2.setMargins(dp(12), statusH() + dp(8), dp(12), 0);
        cov.addView(cRight, l2);
        FrameLayout avBox = new FrameLayout(this);
        avBox.setBackground(oval(NAVY, GOLD));
        final TextView avLetter = tv(GOLD, 34, true);
        avLetter.setGravity(Gravity.CENTER);
        avBox.addView(avLetter, new FrameLayout.LayoutParams(dp(92), dp(92)));
        final ImageView avImg = circImg(88);
        FrameLayout.LayoutParams ail = new FrameLayout.LayoutParams(dp(88), dp(88));
        ail.setMargins(dp(2), dp(2), dp(2), dp(2));
        avBox.addView(avImg, ail);
        FrameLayout.LayoutParams alp = new FrameLayout.LayoutParams(dp(92), dp(92), Gravity.BOTTOM | Gravity.START);
        alp.setMargins(dp(18), 0, dp(18), 0);
        cov.addView(avBox, alp);
        hdr.addView(cov, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(196) + statusH()));

        // الاسم + الشارة + اليوزر + الأندية
        LinearLayout idb = new LinearLayout(this);
        idb.setOrientation(LinearLayout.VERTICAL);
        idb.setPadding(dp(18), dp(4), dp(18), dp(6));
        LinearLayout nameRow = new LinearLayout(this);
        nameRow.setGravity(Gravity.CENTER_VERTICAL);
        final TextView nameV = tv(Color.WHITE, 22, true);
        nameRow.addView(nameV);
        final ImageView badgeV = new ImageView(this);
        badgeV.setVisibility(View.GONE);
        LinearLayout.LayoutParams blp2 = new LinearLayout.LayoutParams(dp(22), dp(22));
        blp2.setMargins(dp(6), 0, dp(6), 0);
        nameRow.addView(badgeV, blp2);
        final TextView verV = tv(0xFF14B8FF, 18, true);
        verV.setText("\u2714");
        verV.setVisibility(View.GONE);
        nameRow.addView(verV);
        final int[] tierV = { 0 };
        final boolean[] bset = { false };
        final Runnable refreshVer = new Runnable() { @Override public void run() {
            verV.setVisibility(tierV[0] >= 1 && !bset[0] ? View.VISIBLE : View.GONE);
            badgeV.setVisibility(tierV[0] >= 1 && bset[0] ? View.VISIBLE : View.GONE);
        } };
        idb.addView(nameRow);
        final TextView userV = tv(MUTED, 14, false);
        userV.setTextAlignment(View.TEXT_ALIGNMENT_VIEW_START);
        userV.setGravity(Gravity.START);
        idb.addView(userV, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        final LinearLayout chipsBox = new LinearLayout(this);
        chipsBox.setPadding(0, dp(8), 0, 0);
        idb.addView(chipsBox);
        hdr.addView(idb);

        // الإحصائيات
        LinearLayout stats4 = new LinearLayout(this);
        GradientDrawable sg = new GradientDrawable();
        sg.setColor(CARD);
        sg.setCornerRadius(dp(18));
        sg.setStroke(dp(1), 0x33F5C35A);
        stats4.setBackground(sg);
        stats4.addView(profStat(nums, 0, L("يتابِع", "Following"), mine ? "follow:following" : null), new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        stats4.addView(profStat(nums, 1, L("متابِعون", "Followers"), mine ? "follow:followers" : null), new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        stats4.addView(profStat(nums, 2, mine ? L("هدايا", "Gifts") : L("منشور", "Post"), null), new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        stats4.addView(profStat(nums, 3, L("أهداف", "Goals"), null), new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        LinearLayout.LayoutParams slp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        slp.setMargins(dp(14), dp(8), dp(14), dp(4));
        hdr.addView(stats4, slp);

        final TextView bioV = tv(0xFFE6E9FF, 14, false);
        bioV.setPadding(dp(18), dp(8), dp(18), 0);
        bioV.setVisibility(View.GONE);
        hdr.addView(bioV);
        final TextView dobV = tv(MUTED, 13, false);
        dobV.setPadding(dp(18), dp(6), dp(18), 0);
        dobV.setVisibility(View.GONE);
        hdr.addView(dobV);

        // الأزرار
        LinearLayout btns = new LinearLayout(this);
        btns.setPadding(dp(14), dp(12), dp(14), dp(4));
        if (mine) {
            TextView edit = tv(NAVY, 15, true);
            edit.setText(L("✎  تعديل الملف", "✎  Edit profile"));
            edit.setGravity(Gravity.CENTER);
            GradientDrawable eg = new GradientDrawable();
            eg.setColor(GOLD);
            eg.setCornerRadius(dp(14));
            edit.setBackground(eg);
            edit.setOnClickListener(new View.OnClickListener() {
                @Override public void onClick(View v) { openEditProfile(); }
            });
            btns.addView(edit, new LinearLayout.LayoutParams(0, dp(46), 1f));
            TextView mb = new TextView(this);
            mb.setCompoundDrawablesWithIntrinsicBounds(new Ic(9, GOLD, false, dp(22)), null, null, null);
            mb.setGravity(Gravity.CENTER);
            mb.setPadding(dp(12), 0, dp(12), 0);
            GradientDrawable mg = new GradientDrawable();
            mg.setColor(CARD); mg.setCornerRadius(dp(14)); mg.setStroke(dp(1), 0x55F5C35A);
            mb.setBackground(mg);
            mb.setOnClickListener(new View.OnClickListener() {
                @Override public void onClick(View v) { openMessagesPage(); }
            });
            LinearLayout.LayoutParams mlp = new LinearLayout.LayoutParams(dp(54), dp(46));
            mlp.setMargins(dp(8), 0, 0, 0);
            btns.addView(mb, mlp);
            TextView sb = new TextView(this);
            sb.setCompoundDrawablesWithIntrinsicBounds(new Ic(5, GOLD, false, dp(22)), null, null, null);
            sb.setGravity(Gravity.CENTER);
            sb.setPadding(dp(12), 0, dp(12), 0);
            sb.setBackground(mg.getConstantState().newDrawable());
            sb.setOnClickListener(new View.OnClickListener() {
                @Override public void onClick(View v) { shareProfile(shareName[0]); }
            });
            LinearLayout.LayoutParams sbl = new LinearLayout.LayoutParams(dp(54), dp(46));
            sbl.setMargins(dp(8), 0, 0, 0);
            btns.addView(sb, sbl);
        } else {
            final TextView fb = tv(NAVY, 15, true);
            fb.setGravity(Gravity.CENTER);
            final Runnable paintFollow = new Runnable() {
                @Override public void run() {
                    boolean f = followSet.contains(target);
                    fb.setText(f ? L("إلغاء المتابعة", "Unfollow") : L("متابعة", "Follow"));
                    fb.setTextColor(f ? GOLD : NAVY);
                    GradientDrawable fg = new GradientDrawable();
                    fg.setColor(f ? CARD : GOLD);
                    fg.setCornerRadius(dp(14));
                    if (f) fg.setStroke(dp(1), GOLD);
                    fb.setBackground(fg);
                }
            };
            paintFollow.run();
            fb.setOnClickListener(new View.OnClickListener() {
                @Override public void onClick(View v) { toggleFollowUser(target); paintFollow.run(); }
            });
            TextView msg = tv(GOLD, 15, true);
            msg.setText(T("رسالة"));
            msg.setGravity(Gravity.CENTER);
            GradientDrawable mg2 = new GradientDrawable();
            mg2.setColor(CARD); mg2.setCornerRadius(dp(14)); mg2.setStroke(dp(1), 0x55F5C35A);
            msg.setBackground(mg2);
            msg.setOnClickListener(new View.OnClickListener() {
                @Override public void onClick(View v) { openChat(target); }
            });
            btns.addView(msg, new LinearLayout.LayoutParams(0, dp(46), 1f));
            LinearLayout.LayoutParams fl2 = new LinearLayout.LayoutParams(0, dp(46), 1f);
            fl2.setMargins(dp(8), 0, 0, 0);
            btns.addView(fb, fl2);
        }
        hdr.addView(btns);

        if (mine) {
            LinearLayout tiles = new LinearLayout(this);
            tiles.setPadding(dp(14), dp(8), dp(14), dp(4));
            String[] tl = { T("المتجر"), T("محفظتي"), T("الاشتراك"), L("بطاقات NFT", "NFT cards") };
            int[] ti = { 23, 24, 25, 26 };
            String[] ta = { "store", "wallet", "subs", "nft" };
            for (int q = 0; q < 4; q++) {
                LinearLayout.LayoutParams tlp = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
                if (q > 0) tlp.setMargins(dp(8), 0, 0, 0);
                tiles.addView(profTile(ti[q], tl[q], ta[q]), tlp);
            }
            hdr.addView(tiles);
            final LinearLayout vfCard = new LinearLayout(this);
            vfCard.setGravity(Gravity.CENTER_VERTICAL);
            vfCard.setBackground(box(0x2614B8FF, 0x8014B8FF, 14));
            vfCard.setPadding(dp(14), dp(12), dp(14), dp(12));
            TextView vfIc = tv(0xFF14B8FF, 22, true);
            vfIc.setText("\u2714");
            vfCard.addView(vfIc);
            LinearLayout vfTx = new LinearLayout(this);
            vfTx.setOrientation(LinearLayout.VERTICAL);
            vfTx.setPadding(dp(12), 0, dp(8), 0);
            TextView vfT = tv(Color.WHITE, 14, true);
            vfT.setText(L("وثّق حسابك", "Verify your account"));
            TextView vfS = tv(MUTED, 12, false);
            vfS.setText(L("اشترك لتحصل على علامة التوثيق بجانب اسمك", "Subscribe to get the verified badge next to your name"));
            vfTx.addView(vfT); vfTx.addView(vfS);
            vfCard.addView(vfTx, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
            vfCard.setVisibility(View.GONE);
            vfCard.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { openSubscriptions(); } });
            LinearLayout.LayoutParams vfLp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            vfLp.setMargins(dp(14), dp(8), dp(14), 0);
            hdr.addView(vfCard, vfLp);
            fetchTier(new TierCb() { @Override public void on(int tier) {
                tierV[0] = tier; refreshVer.run(); if (tier < 1) vfCard.setVisibility(View.VISIBLE);
            } });
            tierHook = new Runnable() { @Override public void run() {
                fetchTier(new TierCb() { @Override public void on(int tier) {
                    tierV[0] = tier; refreshVer.run(); vfCard.setVisibility(tier < 1 ? View.VISIBLE : View.GONE);
                } });
            } };
        }

        // التبويبات
        LinearLayout tabs = new LinearLayout(this);
        tabs.setPadding(0, dp(10), 0, 0);
        String[] tn = { L("المنشورات", "Posts"), L("الردود", "Replies"), L("التمريرات", "Passes"), "" };
        final BaseAdapter[] padRef = new BaseAdapter[1];
        final Runnable[] reload = new Runnable[1];
        reload[0] = new Runnable() {
            @Override public void run() {
                for (int q = 0; q < 4; q++) {
                    boolean on = q == tab[0];
                    if (lbs[q] != null) lbs[q].setTextColor(on ? GOLD : MUTED);
                    uls[q].setBackgroundColor(on ? GOLD : 0x00000000);
                }
                plist.clear();
                if (padRef[0] != null) padRef[0].notifyDataSetChanged();
                emptyV.setText("");
                emptyV.setVisibility(View.VISIBLE);
                profLoadTab(target, tab[0], plist, new Runnable() {
                    @Override public void run() {
                        if (padRef[0] != null) padRef[0].notifyDataSetChanged();
                        emptyV.setText(L("لا يوجد شيء هنا بعد", "Nothing here yet"));
                        emptyV.setVisibility(plist.isEmpty() ? View.VISIBLE : View.GONE);
                    }
                });
            }
        };
        for (int q = 0; q < 4; q++) {
            LinearLayout cell = new LinearLayout(this);
            cell.setOrientation(LinearLayout.VERTICAL);
            cell.setGravity(Gravity.CENTER);
            if (q == 3) {
                ImageView vi = new ImageView(this);
                vi.setImageDrawable(new Ic(8, MUTED, false, dp(22)));
                cell.addView(vi, new LinearLayout.LayoutParams(dp(22), dp(22)));
                cell.setPadding(0, dp(10), 0, 0);
                lbs[q] = null;
            } else {
                lbs[q] = tv(MUTED, 14, true);
                lbs[q].setText(tn[q]);
                lbs[q].setGravity(Gravity.CENTER);
                lbs[q].setPadding(0, dp(10), 0, dp(8));
                cell.addView(lbs[q]);
            }
            uls[q] = new View(this);
            cell.addView(uls[q], new LinearLayout.LayoutParams(dp(34), dp(3)));
            final int qi = q;
            cell.setOnClickListener(new View.OnClickListener() {
                @Override public void onClick(View v) {
                    if (tab[0] == qi) return;
                    tab[0] = qi;
                    reload[0].run();
                }
            });
            tabs.addView(cell, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        }
        hdr.addView(tabs);
        View tl2 = new View(this);
        tl2.setBackgroundColor(0x2EF5C35A);
        hdr.addView(tl2, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(1)));
        emptyV.setGravity(Gravity.CENTER);
        emptyV.setPadding(dp(16), dp(30), dp(16), dp(30));
        hdr.addView(emptyV);

        // القائمة
        final ListView lv = new ListView(this);
        lv.setDivider(null);
        lv.setSelector(new ColorDrawable(Color.TRANSPARENT));
        lv.setClipToPadding(false);
        lv.setPadding(0, 0, 0, dp(20));
        lv.addHeaderView(hdr, null, false);
        final BaseAdapter pad = new BaseAdapter() {
            @Override public int getCount() { return plist.size(); }
            @Override public Object getItem(int i) { return plist.get(i); }
            @Override public long getItemId(int i) { return i; }
            @Override public int getViewTypeCount() { return 2; }
            @Override public int getItemViewType(int i) { return plist.get(i).has("_reply") ? 1 : 0; }
            @Override public View getView(int i, View cv, ViewGroup parent) {
                JSONObject o = plist.get(i);
                if (o.has("_reply")) {
                    if (cv == null || !(cv instanceof LinearLayout) || cv instanceof Wrap) cv = new LinearLayout(Profile.this);
                    return replyRow(cv, o);
                }
                if (cv == null) cv = makeRow();
                bindPost(cv, i);
                return cv;
            }
        };
        padRef[0] = pad;
        adapter = pad;
        lv.setAdapter(pad);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.addView(lv, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));
        if (mine) {
            View line = new View(this);
            line.setBackgroundColor(0x2EF5C35A);
            root.addView(line, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(1)));
            LinearLayout nav = new LinearLayout(this);
            nav.setBackgroundColor(NAVY);
            nav.setPadding(0, 0, 0, navH() - dp(8));
            View hm = navItem(6, L("الرئيسية", "Home"), null, false);
            hm.setOnClickListener(new View.OnClickListener() {
                @Override public void onClick(View v) { d.dismiss(); }
            });
            nav.addView(hm, new LinearLayout.LayoutParams(0, dp(64), 1f));
            nav.addView(navItem(7, L("المباريات", "Matches"), "nav:matches", false), new LinearLayout.LayoutParams(0, dp(64), 1f));
            View vd = navItem(8, L("فيديو", "Video"), null, false);
            vd.setOnClickListener(new View.OnClickListener() {
                @Override public void onClick(View v) { openVideosTab(); }
            });
            nav.addView(vd, new LinearLayout.LayoutParams(0, dp(64), 1f));
            nav.addView(navItem(9, L("الرسائل", "Messages"), "nav:messages", false), new LinearLayout.LayoutParams(0, dp(64), 1f));
            nav.addView(navItem(10, L("الملف الشخصي", "Profile"), null, true), new LinearLayout.LayoutParams(0, dp(64), 1f));
            root.addView(nav);
        }
        d.setContentView(root);
        d.setOnDismissListener(new DialogInterface.OnDismissListener() {
            @Override public void onDismiss(DialogInterface di) {
                items = savedItems;
                adapter = savedAdapter;
                profShown = null;
                refreshUi();
            }
        });
        d.show();

        // الهوية: من بيانات الويب (ملفي) أو من public_profiles (غيري)
        final String nn0 = P.optString("nickname", "");
        if (mine) {
            nameV.setText(nn0.length() > 0 ? nn0 : (uname == null ? "" : uname));
            String un = P.optString("username", "");
            userV.setText(un.length() > 0 && nn0.length() > 0 ? "@" + un : "");
        }
        avLetter.setText(nameV.getText().length() > 0 ? nameV.getText().toString().substring(0, 1).toUpperCase() : "؟");
        String bio0 = P.optString("bio", "");
        if (bio0.length() > 0) { bioV.setText(bio0); bioV.setVisibility(View.VISIBLE); }
        String dob0 = P.optString("dob", "");
        if (mine && dob0.length() > 0) {
            dobV.setText("🎂 " + dob0 + (P.optBoolean("dobVisible", false) ? "" : L("  ·  🔒 مخفي عن الآخرين", "  ·  🔒 Hidden from others")));
            dobV.setVisibility(View.VISIBLE);
        }
        String ph0 = P.optString("photoUrl", "");
        if (mine && isImg(ph0)) { loadImage(ph0, avImg); avLetter.setVisibility(View.GONE); }
        else if (mine && isImg(uavatar)) { loadImage(uavatar, avImg); avLetter.setVisibility(View.GONE); }
        String bl = mine ? ClubsData.logo(P.optString("badgeClub", "")) : "";
        if (bl.startsWith("http")) { bset[0] = true; loadImage(bl, badgeV); wm.setAlpha(0.38f); fillCover(wm); loadImage(bl, wm); refreshVer.run(); }
        if (mine && !bset[0]) {
            try {
                JSONArray sc0 = P.optJSONArray("selected_clubs");
                String l0 = sc0 != null && sc0.length() > 0 ? ClubsData.logo(sc0.optString(0, "")) : "";
                if (l0.startsWith("http")) { bset[0] = true; loadImage(l0, badgeV); refreshVer.run(); wm.setAlpha(0.38f); fillCover(wm); wm.setVisibility(View.VISIBLE); loadImage(l0, wm); }
            } catch (Exception ignore) {}
        }
        try {
            JSONArray cl = P.optJSONArray("clubs");
            if (cl != null) {
                for (int q = 0; q < cl.length() && q < 2; q++) {
                    JSONObject co = cl.getJSONObject(q);
                    LinearLayout chip = new LinearLayout(this);
                    chip.setGravity(Gravity.CENTER_VERTICAL);
                    chip.setPadding(dp(10), dp(5), dp(12), dp(5));
                    GradientDrawable cgd = new GradientDrawable();
                    cgd.setColor(0xFF101A55); cgd.setCornerRadius(dp(16)); cgd.setStroke(dp(1), 0x55F5C35A);
                    chip.setBackground(cgd);
                    String lg = co.optString("logo", "");
                    if (lg.startsWith("http")) {
                        ImageView ci = new ImageView(this);
                        ci.setScaleType(ImageView.ScaleType.FIT_CENTER);
                        loadImage(lg, ci);
                        LinearLayout.LayoutParams cil = new LinearLayout.LayoutParams(dp(18), dp(18));
                        cil.setMargins(0, 0, dp(6), 0);
                        chip.addView(ci, cil);
                        if (q == 0 && !bset[0]) { wm.setAlpha(0.38f); fillCover(wm); wm.setVisibility(View.VISIBLE); loadImage(lg, wm); }
                    }
                    TextView ct = tv(0xFFE6E9FF, 12, true);
                    ct.setText(co.optString("name", ""));
                    chip.addView(ct);
                    LinearLayout.LayoutParams chl = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
                    chl.setMargins(0, 0, dp(8), 0);
                    chipsBox.addView(chip, chl);
                }
            }
        } catch (Exception ignore) {}

        final TextView topSupV = tv(GOLD, 13, true);
        topSupV.setVisibility(View.GONE);
        topSupV.setPadding(0, dp(8), 0, 0);
        idb.addView(topSupV);
        pool.execute(new Runnable() { @Override public void run() {
            try {
                String r = rpc("top_supporter", new JSONObject().put("p_user", target).toString()).trim();
                if (r.startsWith("\"")) r = r.substring(1, r.length() - 1);
                final String nm = r;
                if (nm.length() > 0 && !nm.equals("null"))
                    runOnUiThread(new Runnable() { @Override public void run() { topSupV.setText("\uD83D\uDC51 " + L("داعمه الأول: ", "Top supporter: ") + nm); topSupV.setVisibility(View.VISIBLE); } });
            } catch (Exception ignore) {}
        } });
        if (!mine) fetchTierOf(target, new TierCb() { @Override public void on(int tier) { tierV[0] = tier; refreshVer.run(); } });
        reload[0].run();
        pool.execute(new Runnable() {
            @Override public void run() {
                final String[] v = { "–", "–", "–", "–" };
                final String[] ex = { "", "", "", "", "", "" }; // name, username, photo, bio, badge_club, first selected club
                try {
                    if (!mine) {
                        JSONArray pa = new JSONArray(get("public_profiles?select=*&user_id=eq." + target + "&limit=1"));
                        if (pa.length() > 0) {
                            JSONObject po = pa.getJSONObject(0);
                            String n1 = po.optString("nickname_ar", "");
                            if (n1.length() == 0 || "null".equals(n1)) n1 = po.optString("nickname_en", "");
                            if (n1.length() == 0 || "null".equals(n1)) n1 = po.optString("username", "");
                            ex[0] = "null".equals(n1) ? "" : n1;
                            String us = po.optString("username", "");
                            ex[1] = "null".equals(us) ? "" : us;
                            String ph = po.isNull("photo_url") ? "" : po.optString("photo_url", "");
                            ex[2] = ph;
                            String bi = po.isNull("bio") ? "" : po.optString("bio", "");
                            ex[3] = bi;
                            ex[4] = po.isNull("badge_club") ? "" : po.optString("badge_club", "");
                            try { JSONArray sc1 = po.optJSONArray("selected_clubs"); if (sc1 != null && sc1.length() > 0) ex[5] = sc1.optString(0, ""); } catch (Exception ignore2) {}
                        }
                    }
                } catch (Exception ignore) {}
                try { v[0] = String.valueOf(new JSONArray(get("user_follows?select=following_id&follower_id=eq." + target + "&limit=10000")).length()); } catch (Exception ignore) {}
                try { v[1] = String.valueOf(new JSONArray(get("user_follows?select=follower_id&following_id=eq." + target + "&limit=10000")).length()); } catch (Exception ignore) {}
                if (mine) {
                    try {
                        String g = rpc("get_gifts_received", "{\"p_uid\":\"" + target + "\"}").trim();
                        v[2] = g.replace("\"", "");
                    } catch (Exception ignore) {}
                } else {
                    try { v[2] = String.valueOf(new JSONArray(get("posts?select=id&user_id=eq." + target + "&limit=10000")).length()); } catch (Exception ignore) {}
                }
                try {
                    JSONArray mp = new JSONArray(get("posts?select=id&user_id=eq." + target + "&order=created_at.desc&limit=300"));
                    StringBuilder ib = new StringBuilder();
                    for (int i = 0; i < mp.length(); i++) { if (ib.length() > 0) ib.append(","); ib.append(mp.getJSONObject(i).optLong("id")); }
                    if (ib.length() > 0) {
                        JSONArray lk = new JSONArray(get("post_likes?select=post_id&post_id=in.(" + ib + ")&user_id=neq." + target + "&limit=100000"));
                        v[3] = String.valueOf(lk.length());
                    } else v[3] = "0";
                } catch (Exception ignore) {}
                runOnUiThread(new Runnable() {
                    @Override public void run() {
                        for (int q = 0; q < 4; q++) nums[q].setText(v[q]);
                        if (!mine) {
                            if (ex[0].length() > 0) { nameV.setText(ex[0]); avLetter.setText(ex[0].substring(0, 1).toUpperCase()); }
                            if (ex[1].length() > 0) { userV.setText("@" + ex[1]); shareName[0] = ex[1]; }
                            if (isImg(ex[2])) { loadImage(ex[2], avImg); avLetter.setVisibility(View.GONE); }
                            if (ex[3].length() > 0 && !"null".equals(ex[3])) { bioV.setText(ex[3]); bioV.setVisibility(View.VISIBLE); }
                            String bl2 = ClubsData.logo(ex[4]);
                            if (!bl2.startsWith("http") && ex[5].length() > 0) bl2 = ClubsData.logo(ex[5]);
                            if (bl2.startsWith("http")) { bset[0] = true; loadImage(bl2, badgeV); wm.setAlpha(0.38f); fillCover(wm); wm.setVisibility(View.VISIBLE); loadImage(bl2, wm); refreshVer.run(); }
                        }
                    }
                });
            }
        });
    }

    // شعار النادي يملأ الحائط كاملًا
    private void fillCover(ImageView wm) {
        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(150) + statusH(), Gravity.TOP);
        lp.setMargins(0, 0, 0, 0);
        wm.setLayoutParams(lp);
        wm.setPadding(dp(16), statusH() + dp(8), dp(16), dp(8));
        wm.setScaleType(ImageView.ScaleType.FIT_CENTER);
    }

    protected View replyRow(View cv, JSONObject o) {
        LinearLayout w;
        TextView body, time;
        if (cv.getTag() == null) {
            w = (LinearLayout) cv;
            w.setOrientation(LinearLayout.VERTICAL);
            w.setPadding(dp(14), dp(6), dp(14), dp(6));
            LinearLayout in = new LinearLayout(this);
            in.setOrientation(LinearLayout.VERTICAL);
            in.setPadding(dp(14), dp(12), dp(14), dp(12));
            GradientDrawable g = new GradientDrawable();
            g.setColor(CARD); g.setCornerRadius(dp(18)); g.setStroke(dp(1), 0x33F5C35A);
            in.setBackground(g);
            TextView t1 = tv(MUTED, 11, false);
            t1.setText(L("↩ رد على منشور", "↩ Reply to a post"));
            in.addView(t1);
            TextView b1 = tv(Color.WHITE, 15, false);
            b1.setPadding(0, dp(4), 0, dp(4));
            in.addView(b1);
            TextView tm = tv(MUTED, 11, false);
            in.addView(tm);
            w.addView(in);
            w.setTag(new TextView[] { b1, tm });
        }
        TextView[] tt = (TextView[]) cv.getTag();
        tt[0].setText(o.optString("content", ""));
        tt[1].setText(ago(o.optString("created_at", "")));
        return cv;
    }
}
