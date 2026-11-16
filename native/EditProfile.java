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

// ===== من profile-main.js (profile/edit.js): صفحة تعديل الملف الشخصي + شارة التوثيق =====
abstract class EditProfile extends Compose {
    private Dialog epDlg;
    private EditText epNick, epBio;
    private String epDob = "", epPhoto = "", epBadge = "", epOrigNick = "";
    private boolean epDobVis = false;
    private JSONArray epClubs = new JSONArray();
    private LinearLayout epBox;

    protected void openEditProfile() {
        pool.execute(new Runnable() {
            @Override public void run() {
                final JSONObject r = loadUserRow(uid);
                runOnUiThread(new Runnable() { @Override public void run() { epShow(r == null ? new JSONObject() : r); } });
            }
        });
    }

    private String epS(JSONObject r, String k) { return r.isNull(k) ? "" : r.optString(k, ""); }

    private void epShow(JSONObject r) {
        String na = epS(r, "nickname_ar"), ne = epS(r, "nickname_en");
        epOrigNick = na.length() > 0 ? na : ne;
        epDob = epS(r, "dob");
        epDobVis = r.optBoolean("dob_visible", false);
        epPhoto = epS(r, "photo_url");
        epBadge = epS(r, "badge_club");
        epClubs = r.optJSONArray("selected_clubs") == null ? new JSONArray() : r.optJSONArray("selected_clubs");

        epDlg = sheetDialog(true);
        epDlg.getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(NAVY);

        LinearLayout top = new LinearLayout(this);
        top.setGravity(Gravity.CENTER_VERTICAL);
        top.setPadding(dp(12), statusH() + dp(6), dp(12), dp(10));
        top.addView(backBtn(new Runnable() { @Override public void run() { epDlg.dismiss(); } }));
        TextView title = tv(Color.WHITE, 17, true);
        title.setText(L("تعديل الملف الشخصي", "Edit profile"));
        title.setPadding(dp(8), 0, 0, 0);
        top.addView(title, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        final TextView save = pill(L("حفظ", "Save"), NAVY, GOLD, 0);
        save.setPadding(dp(22), dp(8), dp(22), dp(8));
        save.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { epSave(save); } });
        top.addView(save);
        root.addView(top);

        ScrollView sc = new ScrollView(this);
        epBox = new LinearLayout(this);
        epBox.setOrientation(LinearLayout.VERTICAL);
        epBox.setPadding(dp(14), dp(4), dp(14), dp(30));
        sc.addView(epBox);
        root.addView(sc, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));

        epHero = new LinearLayout(this);
        epHero.setOrientation(LinearLayout.VERTICAL);
        epBox.addView(epHero);
        epNick = epField(L("الاسم المستعار", "Nickname"), epOrigNick, 30, false);
        epBio = epField(L("النبذة التعريفية", "Bio"), epS(r, "bio"), 160, true);
        epBio.setHint(L("اكتب نبذة قصيرة عنك...", "Write something about yourself..."));
        epNick.setHint(L("اسمك الذي يظهر للآخرين", "Your display name"));
        epDraw();
        epDlg.setContentView(root);
        epDlg.show();
    }

    // يعيد رسم الأجزاء المتغيرة (الصورة / التاريخ / الشارة) دون فقدان النص المكتوب
    private LinearLayout epDyn, epHero;

    private LinearLayout epCard() {
        LinearLayout c = new LinearLayout(this);
        c.setOrientation(LinearLayout.VERTICAL);
        c.setPadding(dp(16), dp(12), dp(16), dp(12));
        c.setBackground(rbg(CARD, 0x33FFFFFF, 18));
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        lp.setMargins(0, 0, 0, dp(12));
        c.setLayoutParams(lp);
        return c;
    }

    private void epDraw() {
        if (epDyn != null) epBox.removeView(epDyn);
        epHero.removeAllViews();
        epDyn = new LinearLayout(this);
        epDyn.setOrientation(LinearLayout.VERTICAL);

        // ---- الصورة (أعلى الصفحة) ----
        LinearLayout avRow = new LinearLayout(this);
        avRow.setGravity(Gravity.CENTER_HORIZONTAL);
        avRow.setOrientation(LinearLayout.VERTICAL);
        avRow.setPadding(0, dp(4), 0, dp(14));
        FrameLayout avf = new FrameLayout(this);
        ImageView av = new ImageView(this);
        av.setScaleType(ImageView.ScaleType.CENTER_CROP);
        av.setBackground(oval(CARD, GOLD));
        av.setClipToOutline(true);
        av.setOutlineProvider(new ViewOutlineProvider() { @Override public void getOutline(View v, Outline o) { o.setOval(0, 0, v.getWidth(), v.getHeight()); } });
        avf.addView(av, new FrameLayout.LayoutParams(dp(104), dp(104)));
        if (epPhoto.length() > 0) loadImage(epPhoto, av);
        else {
            String nn = epNick == null ? epOrigNick : epNick.getText().toString();
            TextView letter = tv(GOLD, 42, true);
            letter.setText(nn.length() > 0 ? nn.substring(0, 1).toUpperCase() : "؟");
            letter.setGravity(Gravity.CENTER);
            avf.addView(letter, new FrameLayout.LayoutParams(dp(104), dp(104)));
        }
        TextView cam = tv(Color.WHITE, 16, false);
        cam.setText("📷");
        cam.setGravity(Gravity.CENTER);
        cam.setBackground(oval(0xFF2C4BB5, 0));
        cam.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { epDlg.dismiss(); openNftMarket(); } });
        avf.addView(cam, new FrameLayout.LayoutParams(dp(34), dp(34), Gravity.BOTTOM | Gravity.END));
        avRow.addView(avf, new LinearLayout.LayoutParams(dp(104), dp(104)));
        if (epPhoto.length() > 0) {
            TextView rm = tv(0xFFFF8A8A, 13, true);
            rm.setText(L("إزالة الصورة", "Remove photo"));
            rm.setPadding(dp(10), dp(10), dp(10), dp(2));
            rm.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { epPhoto = ""; epDraw(); } });
            avRow.addView(rm);
        }
        TextView note = tv(MUTED, 12, false);
        note.setGravity(Gravity.CENTER);
        note.setText(L("الصورة تأتي من بطاقة NFT: اضغط 📷 لفتح السوق.", "Your photo comes from an NFT card: tap 📷 to open the market."));
        note.setPadding(0, dp(6), 0, 0);
        avRow.addView(note);
        epHero.addView(avRow);

        // ---- تاريخ الميلاد + مفتاح الإظهار ----
        LinearLayout dc = epCard();
        TextView dl = tv(MUTED, 12, true);
        dl.setText(L("تاريخ الميلاد", "Date of Birth"));
        dc.addView(dl);
        TextView dv = tv(Color.WHITE, 17, true);
        dv.setText(epDob.length() > 0 ? epDob : L("اختر التاريخ", "Pick a date"));
        dv.setPadding(0, dp(6), 0, dp(10));
        dv.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { epPickDate(); } });
        dc.addView(dv);
        View line = new View(this);
        line.setBackgroundColor(0x33FFFFFF);
        dc.addView(line, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 1));
        LinearLayout vr = new LinearLayout(this);
        vr.setGravity(Gravity.CENTER_VERTICAL);
        vr.setPadding(0, dp(10), 0, 0);
        TextView vt = tv(Color.WHITE, 14, false);
        vt.setText(L("إظهار تاريخ الميلاد للآخرين", "Show my birth date to others"));
        vr.addView(vt, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        FrameLayout sw = new FrameLayout(this);
        sw.setBackground(rbg(epDobVis ? 0xFF2C4BB5 : 0xFF2A3470, 0, 13));
        View th = new View(this);
        th.setBackground(oval(epDobVis ? GOLD : MUTED, 0));
        FrameLayout.LayoutParams tlp = new FrameLayout.LayoutParams(dp(20), dp(20), (epDobVis ? Gravity.END : Gravity.START) | Gravity.CENTER_VERTICAL);
        tlp.setMargins(dp(3), 0, dp(3), 0);
        sw.addView(th, tlp);
        sw.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { epDobVis = !epDobVis; epDraw(); } });
        vr.addView(sw, new LinearLayout.LayoutParams(dp(46), dp(26)));
        dc.addView(vr);
        epDyn.addView(dc);

        // ---- شارة التوثيق ----
        LinearLayout bc = epCard();
        TextView bl = tv(MUTED, 12, true);
        bl.setText(L("شارة التوثيق", "Verified badge"));
        bc.addView(bl);
        LinearLayout br = new LinearLayout(this);
        br.setGravity(Gravity.CENTER_VERTICAL);
        br.setPadding(0, dp(8), 0, dp(4));
        String blogo = epBadge.length() > 0 ? ClubsData.logo(epBadge) : "";
        if (blogo.startsWith("http")) {
            ImageView bi = new ImageView(this);
            bi.setScaleType(ImageView.ScaleType.FIT_CENTER);
            loadImage(blogo, bi);
            LinearLayout.LayoutParams bil = new LinearLayout.LayoutParams(dp(30), dp(30));
            bil.setMargins(0, 0, dp(10), 0);
            br.addView(bi, bil);
        }
        TextView bt = tv(Color.WHITE, 16, true);
        bt.setText(epBadge.length() > 0 ? ClubsData.name(epBadge, isAr()) : L("بدون شارة", "No badge"));
        br.addView(bt, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        TextView ch = tv(GOLD, 22, true);
        ch.setText("\u2039");
        br.addView(ch);
        bc.addView(br);
        TextView bh = tv(MUTED, 11, false);
        bh.setText(L("تظهر بجانب اسمك وعلى حائط ملفك للمشتركين فقط", "Shown next to your name and on your profile cover (subscribers only)"));
        bc.addView(bh);
        bc.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { epBadgePicker(); } });
        epDyn.addView(bc);
        epBox.addView(epDyn);
    }

    private EditText epField(String label, String val, int max, final boolean multi) {
        LinearLayout card = epCard();
        LinearLayout head = new LinearLayout(this);
        head.setGravity(Gravity.CENTER_VERTICAL);
        TextView l = tv(MUTED, 12, true);
        l.setText(label);
        head.addView(l, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        final TextView cnt = tv(MUTED, 12, false);
        head.addView(cnt);
        card.addView(head);
        EditText e = new EditText(this);
        e.setText(val);
        e.setTextColor(Color.WHITE);
        e.setHintTextColor(MUTED);
        e.setTextSize(17);
        e.setBackground(null);
        e.setFilters(new android.text.InputFilter[] { new android.text.InputFilter.LengthFilter(max) });
        if (multi) { e.setMinLines(3); e.setGravity(Gravity.TOP | Gravity.START); } else e.setSingleLine(true);
        e.setPadding(0, dp(6), 0, dp(4));
        final int fmax = max;
        cnt.setText(val.length() + "/" + fmax);
        e.addTextChangedListener(new android.text.TextWatcher() {
            @Override public void beforeTextChanged(CharSequence c, int a, int b, int d) {}
            @Override public void onTextChanged(CharSequence c, int a, int b, int d) { cnt.setText(c.length() + "/" + fmax); }
            @Override public void afterTextChanged(android.text.Editable ed) {}
        });
        card.addView(e, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        epBox.addView(card);
        return e;
    }

    private void epPickDate() {
        int y = 2000, m = 0, d = 1;
        try { if (epDob.length() >= 10) { y = Integer.parseInt(epDob.substring(0, 4)); m = Integer.parseInt(epDob.substring(5, 7)) - 1; d = Integer.parseInt(epDob.substring(8, 10)); } } catch (Exception ignore) {}
        android.app.DatePickerDialog dp = new android.app.DatePickerDialog(this, new android.app.DatePickerDialog.OnDateSetListener() {
            @Override public void onDateSet(android.widget.DatePicker p, int yy, int mm, int dd) {
                epDob = String.format(java.util.Locale.US, "%04d-%02d-%02d", yy, mm + 1, dd);
                epDraw();
            }
        }, y, m, d);
        dp.getDatePicker().setMaxDate(System.currentTimeMillis());
        dp.show();
    }

    // ---------- شارة التوثيق (للمشتركين فقط) ----------
    private void epBadgePicker() {
        fetchTier(new TierCb() {
            @Override public void on(int t) {
                if (t < 1) { openSubscriptions(); return; }
                if (epClubs.length() == 0) { toast(L("اختر نادياً أولاً من شاشة اختيار الأندية", "Select a club first")); return; }
                if (epClubs.length() == 1) { epApplyBadge(epClubs.optString(0)); return; }
                final Dialog d = sheetDialog(false);
                LinearLayout b = new LinearLayout(EditProfile.this);
                b.setOrientation(LinearLayout.VERTICAL);
                b.setPadding(dp(16), dp(18), dp(16), dp(24));
                b.setBackground(rbg(NAVY, 0x4DF5C35A, 20));
                TextView h = tv(Color.WHITE, 16, true);
                h.setText("✔️ " + L("وثّق حسابك بشارة ناديك", "Verify with your club badge"));
                b.addView(h);
                TextView s = tv(MUTED, 12, true);
                s.setText(L("اختر الشارة التي تظهر بجانب اسمك في المنشورات", "Choose the badge shown next to your name on posts"));
                s.setPadding(0, dp(4), 0, dp(12));
                b.addView(s);
                for (int i = 0; i < epClubs.length(); i++) {
                    final String id = epClubs.optString(i);
                    LinearLayout row = new LinearLayout(EditProfile.this);
                    row.setGravity(Gravity.CENTER_VERTICAL);
                    row.setPadding(dp(12), dp(10), dp(12), dp(10));
                    row.setBackground(rbg(0x66000000, id.equals(epBadge) ? GOLD : 0x802C4BB5, 14));
                    ImageView lg = new ImageView(EditProfile.this);
                    lg.setScaleType(ImageView.ScaleType.FIT_CENTER);
                    loadImage(ClubsData.logo(id), lg);
                    row.addView(lg, new LinearLayout.LayoutParams(dp(36), dp(36)));
                    TextView nm = tv(Color.WHITE, 14, true);
                    nm.setText(ClubsData.name(id, isAr()));
                    nm.setPadding(dp(12), 0, 0, 0);
                    row.addView(nm);
                    row.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { d.dismiss(); epApplyBadge(id); } });
                    LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
                    p.setMargins(0, 0, 0, dp(8));
                    b.addView(row, p);
                }
                TextView none = tv(MUTED, 13, true);
                none.setText("🚫 " + L("بدون شارة", "No badge"));
                none.setGravity(Gravity.CENTER);
                none.setPadding(0, dp(10), 0, 0);
                none.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { d.dismiss(); epApplyBadge(""); } });
                b.addView(none);
                d.setContentView(b);
                d.show();
            }
        });
    }

    private void epApplyBadge(final String id) {
        pool.execute(new Runnable() {
            @Override public void run() {
                String err = null;
                try { rpc("set_badge_club", new JSONObject().put("p_club", id).toString()); }
                catch (Exception e) { String m = String.valueOf(e.getMessage()); err = m.indexOf("premium_required") >= 0 ? L("الشارة متاحة للمشتركين فقط", "Badge is for subscribers only") : m; }
                final String fe = err;
                runOnUiThread(new Runnable() { @Override public void run() {
                    if (fe != null) { toast(fe); return; }
                    epBadge = id;
                    stPut("badgeClub", id); stPut("badge_club", id);
                    epDraw();
                } });
            }
        });
    }

    // ---------- الحفظ ----------
    private void epSave(final TextView btn) {
        final String nick = epNick.getText().toString().trim();
        final String bio = epBio.getText().toString().trim();
        final String dob = epDob, photo = epPhoto;
        final boolean vis = epDobVis;
        if (nick.length() > 0 && nick.length() < 2) { toast(L("الاسم قصير جدًا", "Name is too short")); return; }
        btn.setEnabled(false);
        btn.setAlpha(0.5f);
        pool.execute(new Runnable() {
            @Override public void run() {
                String err = null;
                boolean ar = nick.matches(".*[؀-ۿ].*");
                try {
                    if (nick.length() > 0 && !nick.equals(epOrigNick)) {
                        Boolean taken = stTaken("is_nickname_available", "p_nick", nick);
                        if (taken == null) throw new Exception(L("تعذر فحص الاسم", "Could not check the name"));
                        if (taken) throw new Exception(L("الاسم مأخوذ", "Name is taken"));
                    }
                    JSONObject row = new JSONObject();
                    row.put("user_id", uid);
                    row.put("nickname_ar", nick.length() > 0 && ar ? nick : JSONObject.NULL);
                    row.put("nickname_en", nick.length() > 0 && !ar ? nick : JSONObject.NULL);
                    row.put("bio", bio.length() > 0 ? bio : JSONObject.NULL);
                    row.put("dob", dob.length() > 0 ? dob : JSONObject.NULL);
                    row.put("photo_url", photo.length() > 0 ? photo : JSONObject.NULL);
                    row.put("dob_visible", vis);
                    try { upsertUser(row); }
                    catch (Exception e) {
                        if (String.valueOf(e.getMessage()).indexOf("dob_visible") >= 0) { row.remove("dob_visible"); upsertUser(row); }
                        else throw e;
                    }
                } catch (Exception e) {
                    err = String.valueOf(e.getMessage());
                    if (err.contains("23505")) err = L("الاسم مأخوذ", "Name is taken");
                }
                final String fe = err;
                final boolean far = ar;
                runOnUiThread(new Runnable() { @Override public void run() {
                    btn.setEnabled(true);
                    btn.setAlpha(1f);
                    if (fe != null) { toast(L("تعذّر الحفظ: ", "Could not save: ") + fe); return; }
                    stPut("nickname_ar", nick.length() > 0 && far ? nick : ""); stPut("nickname_en", nick.length() > 0 && !far ? nick : "");
                    stPut("nickname", nick); stPut("bio", bio); stPut("dob", dob); stPut("dobVisible", vis); stPut("dob_visible", vis);
                    stPut("photoUrl", photo); stPut("photo_url", photo);
                    toast(L("تم حفظ الملف الشخصي بنجاح ✅", "Profile saved successfully ✅"));
                    epDlg.dismiss();
                    openProfile(null);
                } });
            }
        });
    }
}
