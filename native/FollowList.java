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

// ===== من profile-main.js (profile/follow list): قوائم المتابِعون / المتابَعون / المدعوون =====
abstract class FollowList extends EditProfile {
    private Dialog flDlg;
    private String flTab = "followers";
    private LinearLayout flList;
    private TextView flSub;
    private final List<String> flFollowers = new ArrayList<String>(), flFollowing = new ArrayList<String>();
    private final Set<String> flMyFollowing = new HashSet<String>(), flMyFollowers = new HashSet<String>();
    private final List<JSONObject> flInvitees = new ArrayList<JSONObject>();
    private final Map<String, JSONObject> flProf = new HashMap<String, JSONObject>();
    private String flError = "";
    private final List<TextView> flTabs = new ArrayList<TextView>();

    protected void openFollowList(String tab) {
        if (uid == null) return;
        if (flDlg != null && flDlg.isShowing()) return;
        flTab = "following".equals(tab) || "invitees".equals(tab) ? tab : "followers";
        flDlg = sheetDialog(true);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(NAVY);

        LinearLayout top = new LinearLayout(this);
        top.setGravity(Gravity.CENTER_VERTICAL);
        top.setPadding(dp(12), statusH() + dp(6), dp(12), dp(8));
        top.addView(backBtn(new Runnable() { @Override public void run() { flDlg.dismiss(); } }));
        LinearLayout nm = new LinearLayout(this);
        nm.setOrientation(LinearLayout.VERTICAL);
        nm.setPadding(dp(8), 0, 0, 0);
        TextView n1 = tv(Color.WHITE, 17, true);
        n1.setText(uname == null ? "" : uname);
        flSub = tv(MUTED, 12, false);
        nm.addView(n1);
        nm.addView(flSub);
        top.addView(nm);
        root.addView(top);

        LinearLayout tabs = new LinearLayout(this);
        flTabs.clear();
        String[][] tt = { { "followers", L("متابعون", "Followers") }, { "following", L("متابَعة", "Following") }, { "invitees", L("المدعوون", "Invitees") } };
        for (final String[] t : tt) {
            TextView b = tv(MUTED, 14, true);
            b.setText(t[1]);
            b.setTag(t[0]);
            b.setGravity(Gravity.CENTER);
            b.setPadding(0, dp(12), 0, dp(12));
            b.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { flTab = t[0]; flPaintTabs(); flRender(); } });
            flTabs.add(b);
            tabs.addView(b, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        }
        root.addView(tabs);
        ScrollView sc = new ScrollView(this);
        flList = new LinearLayout(this);
        flList.setOrientation(LinearLayout.VERTICAL);
        flList.setPadding(dp(12), dp(8), dp(12), dp(24));
        sc.addView(flList);
        root.addView(sc, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));
        flPaintTabs();
        TextView ld = tv(MUTED, 14, false);
        ld.setText("");
        ld.setGravity(Gravity.CENTER);
        ld.setPadding(0, dp(30), 0, 0);
        flList.addView(ld);
        flDlg.setContentView(root);
        flDlg.show();
        pool.execute(new Runnable() {
            @Override public void run() {
                flLoad();
                runOnUiThread(new Runnable() { @Override public void run() { flRender(); } });
            }
        });
    }

    private void flPaintTabs() {
        for (TextView b : flTabs) {
            boolean on = flTab.equals(b.getTag());
            b.setTextColor(on ? GOLD : MUTED);
            b.setBackground(on ? rbg(0x1AF5C35A, 0, 0) : null);
        }
    }

    private void flLoad() {
        flError = "";
        flFollowers.clear(); flFollowing.clear(); flMyFollowing.clear(); flMyFollowers.clear(); flInvitees.clear();
        try {
            JSONArray a = new JSONArray(get("user_follows?select=follower_id,created_at&following_id=eq." + uid + "&order=created_at.desc&limit=200"));
            for (int i = 0; i < a.length(); i++) flFollowers.add(a.getJSONObject(i).optString("follower_id"));
            JSONArray b = new JSONArray(get("user_follows?select=following_id,created_at&follower_id=eq." + uid + "&order=created_at.desc&limit=200"));
            for (int i = 0; i < b.length(); i++) flFollowing.add(b.getJSONObject(i).optString("following_id"));
        } catch (Exception e) { flError = String.valueOf(e.getMessage()); return; }
        flMyFollowers.addAll(flFollowers);
        flMyFollowing.addAll(flFollowing);
        try {
            JSONArray r = new JSONArray(get("referrals?select=*&referrer_id=eq." + uid + "&order=created_at.desc&limit=200"));
            for (int i = 0; i < r.length(); i++) flInvitees.add(r.getJSONObject(i));
        } catch (Exception ignore) {}
        Set<String> ids = new HashSet<String>();
        ids.addAll(flFollowers); ids.addAll(flFollowing);
        for (JSONObject o : flInvitees) ids.add(o.optString("referred_id"));
        ids.remove("");
        if (ids.size() > 0) {
            try {
                JSONArray p = new JSONArray(get("public_profiles?select=*&user_id=in.(" + android.text.TextUtils.join(",", ids) + ")"));
                for (int i = 0; i < p.length(); i++) flProf.put(p.getJSONObject(i).optString("user_id"), p.getJSONObject(i));
            } catch (Exception ignore) {}
        }
    }

    private void flRender() {
        if (flList == null) return;
        flList.removeAllViews();
        if (flError.length() > 0) { flList.addView(flEmpty(L("تعذّر التحميل", "Could not load") + "\n" + flError)); return; }
        if ("invitees".equals(flTab)) {
            int done = 0;
            for (JSONObject o : flInvitees) if ("rewarded".equals(o.optString("status"))) done++;
            flSub.setText(flInvitees.size() + L(" مدعواً · ", " invited · ") + done + L(" مكتملة", " completed"));
            LinearLayout head = new LinearLayout(this);
            head.setOrientation(LinearLayout.VERTICAL);
            head.setGravity(Gravity.CENTER);
            head.setPadding(dp(12), dp(12), dp(12), dp(12));
            head.setBackground(rbg(0x14F5C35A, 0x4DF5C35A, 14));
            TextView info = tv(Color.WHITE, 13, true);
            info.setText(L("🎁 لكل صديق يشارك في التطبيق: 10 كورة", "🎁 For each active friend you invite: 10 Kora"));
            info.setGravity(Gravity.CENTER);
            head.addView(info);
            TextView cp = pill(L("نسخ رابط الدعوة 🔗", "Copy invite link 🔗"), NAVY, GOLD, 0);
            cp.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { drInvite(); } });
            LinearLayout.LayoutParams cl = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            cl.setMargins(0, dp(8), 0, 0);
            head.addView(cp, cl);
            LinearLayout.LayoutParams hl = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            hl.setMargins(0, 0, 0, dp(10));
            flList.addView(head, hl);
            if (flInvitees.isEmpty()) flList.addView(flEmpty(L("لم تدعُ أحداً بعد", "You haven't invited anyone yet")));
            for (JSONObject o : flInvitees) flList.addView(flRow(o.optString("referred_id"), o));
            return;
        }
        List<String> arr = "followers".equals(flTab) ? flFollowers : flFollowing;
        flSub.setText("followers".equals(flTab) ? flFollowers.size() + L(" متابِعًا", " followers") : flMyFollowing.size() + L(" متابَعًا", " following"));
        if (arr.isEmpty()) { flList.addView(flEmpty("followers".equals(flTab) ? L("لا يوجد متابعون بعد", "No followers yet") : L("لا تتابع أحداً بعد", "Not following anyone yet"))); return; }
        for (String u : arr) flList.addView(flRow(u, null));
    }

    private TextView flEmpty(String t) {
        TextView e = tv(MUTED, 14, false);
        e.setText(t);
        e.setGravity(Gravity.CENTER);
        e.setPadding(0, dp(30), 0, dp(30));
        return e;
    }

    private View flRow(final String u, JSONObject inv) {
        JSONObject p = flProf.get(u);
        if (p == null) p = new JSONObject();
        String name = pickName(p);
        if (name.length() == 0) name = p.isNull("username") ? "" : p.optString("username");
        if (name.length() == 0) name = L("لاعب", "Player");
        LinearLayout row = new LinearLayout(this);
        row.setGravity(Gravity.CENTER_VERTICAL);
        row.setPadding(dp(8), dp(10), dp(8), dp(10));
        row.setBackground(rbg(CARD, 0, 14));
        row.addView(lbAvatar(pickPhoto(p), name.substring(0, 1).toUpperCase(), 46, 0x33FFFFFF, false, 1));
        LinearLayout mid = new LinearLayout(this);
        mid.setOrientation(LinearLayout.VERTICAL);
        mid.setPadding(dp(10), 0, dp(10), 0);
        boolean followsMe = flMyFollowers.contains(u);
        if (inv == null && followsMe) { TextView tg = tv(MUTED, 11, true); tg.setText("👤 " + L("يتابعك", "Follows you")); mid.addView(tg); }
        TextView nm = tv(Color.WHITE, 15, true);
        nm.setText(name);
        mid.addView(nm);
        String un = p.isNull("username") ? "" : p.optString("username");
        if (un.length() > 0) { TextView ut = tv(MUTED, 12, false); ut.setText("@" + un); mid.addView(ut); }
        String bio = p.isNull("bio") ? "" : p.optString("bio");
        if (inv == null && bio.length() > 0) { TextView bt = tv(0xFFCBD5F5, 12, false); bt.setText(bio.length() > 120 ? bio.substring(0, 120) : bio); mid.addView(bt); }
        row.addView(mid, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        row.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { flDlg.dismiss(); openProfile(u); } });
        if (inv != null) {
            boolean done = "rewarded".equals(inv.optString("status"));
            double total = inv.optDouble("reward_fixed", 0) + inv.optDouble("reward_pct", 0);
            TextView bd = tv(GOLD, done ? 13 : 11, true);
            bd.setText(done ? "+" + ((long) total) + " ✅" : L("بانتظار أول كسب ⏳", "Awaiting first earning ⏳"));
            bd.setGravity(Gravity.CENTER);
            row.addView(bd);
        } else if (!u.equals(uid)) {
            final TextView fb = tv(NAVY, 13, true);
            flStyleBtn(fb, u);
            fb.setGravity(Gravity.CENTER);
            fb.setPadding(dp(14), dp(7), dp(14), dp(7));
            fb.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { flToggle(u); } });
            row.addView(fb);
        }
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        lp.setMargins(0, 0, 0, dp(8));
        row.setLayoutParams(lp);
        return row;
    }

    private void flStyleBtn(TextView b, String u) {
        boolean f = flMyFollowing.contains(u);
        b.setText(f ? L("مُتابَع", "Following") : (flMyFollowers.contains(u) ? L("ردّ المتابعة", "Follow back") : L("تابِع", "Follow")));
        b.setTextColor(f ? GOLD : NAVY);
        b.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);
        b.setBackground(rbg(f ? 0x00000000 : GOLD, f ? GOLD : 0, 18));
    }

    private void flToggle(final String u) {
        final boolean was = flMyFollowing.contains(u);
        if (was) flMyFollowing.remove(u); else flMyFollowing.add(u);
        flRender();
        pool.execute(new Runnable() {
            @Override public void run() {
                boolean ok = true;
                try {
                    if (was) send("DELETE", "user_follows?follower_id=eq." + uid + "&following_id=eq." + u, null);
                    else { send("POST", "user_follows", "{\"follower_id\":\"" + uid + "\",\"following_id\":\"" + u + "\"}"); queueNotify("follow", u, null, null, null); }
                } catch (Exception e) { ok = !(String.valueOf(e.getMessage()).indexOf("23505") < 0); }
                if (ok) { if (was) followSet.remove(u); else followSet.add(u); return; }
                runOnUiThread(new Runnable() { @Override public void run() {
                    if (was) flMyFollowing.add(u); else flMyFollowing.remove(u);
                    toast(L("تعذّر التنفيذ", "Action failed"));
                    flRender();
                } });
            }
        });
    }
}
