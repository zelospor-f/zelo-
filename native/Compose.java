package PKG;

import android.net.Uri;
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

// ===== من home.js: شاشة كتابة منشور جديد (النص/الصورة/الفيديو/نوع المنشور/توقّع مباراة) =====
abstract class Compose extends Profile {
    protected abstract void refresh();

    private static final int CM_IMG = 7101, CM_VID = 7102;
    private static final int CM_FREE = 280, CM_PRO = 1000;
    private static final long CM_VID_MAX = 100L * 1024 * 1024;
    private static final long CM_VID_SECS = 60;
    // {id, عربي, إنجليزي, أ-عربي, أ-إنجليزي, ب-عربي, ب-إنجليزي, placeholder-ar, placeholder-en}
    private static final String[][] CM_TOPICS = {
        { "player", "لاعب", "Player", "يستحق", "Deserves it", "لا يستحق", "Doesn't", "اسم اللاعب", "Player name" },
        { "coach", "مدرب", "Coach", "أبقوه", "Keep him", "أقيلوه", "Sack him", "اسم المدرب", "Coach name" },
        { "referee", "حكم", "Referee", "قرار صحيح", "Correct call", "قرار خاطئ", "Wrong call", "الحكم أو المباراة", "Referee or match" },
        { "club", "نادٍ", "Club", "أفخر به", "Proud", "أنتقده", "Critical", "اسم النادي", "Club name" },
        { "league", "دوري", "League", "قوي", "Strong", "مبالغ فيه", "Overrated", "اسم الدوري", "League name" },
        { "national", "منتخب", "National team", "جاهز", "Ready", "غير جاهز", "Not ready", "اسم المنتخب", "Team name" },
        { "match", "مباراة", "Match", "عادلة", "Fair", "ظالمة", "Unfair", "المباراة", "The match" },
        { "transfer", "صفقة", "Transfer", "ناجحة", "Success", "فاشلة", "Flop", "اللاعب أو الصفقة", "Player or deal" },
        { "compare", "مقارنة", "Compare", "", "", "", "", "الطرف الأول", "First side" },
        { "prediction", "توقع", "Prediction", "سيحدث", "Will happen", "لن يحدث", "Won't happen", "المباراة أو الحدث", "Match or event" }
    };
    private static final String[] CM_BAD = { "مرتشي", "مرتشين", "رشوة", "رشاوي", "مأجور", "فاسد", "سارق", "لص", "حقير", "قذر", "كلب", "حمار", "bribed", "corrupt", "thief", "idiot" };

    private Dialog cmDlg;
    private EditText cmText;
    private TextView cmCount, cmNotice, cmPost;
    private LinearLayout cmPreview, cmTopicFields, cmChips;
    private int cmTier = 0;
    private Bitmap cmImage = null;
    private Uri cmVideoUri = null;
    private String cmVideoName = null;
    private String cmTopicType = null;
    private String cmTopicName = "", cmTopicNameB = "";
    private boolean cmPred = false;
    private JSONObject cmPredMatch = null;
    private int cmPredPick = -1;
    private String cmLeague = "";
    private JSONArray cmMatches = null;
    private String cmMatchQuery = "";
    private boolean cmPosting = false;

    private int cmMax() { return cmTier >= 1 ? CM_PRO : CM_FREE; }

    protected void openCompose() {
        if (cmDlg != null && cmDlg.isShowing()) return;
        cmImage = null; cmVideoUri = null; cmVideoName = null;
        cmTopicType = null; cmTopicName = ""; cmTopicNameB = ""; cmPred = false; cmPredMatch = null; cmPredPick = -1;
        cmPosting = false;
        cmDlg = sheetDialog(true);
        cmDlg.getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(NAVY);

        LinearLayout top = new LinearLayout(this);
        top.setGravity(Gravity.CENTER_VERTICAL);
        top.setPadding(dp(12), statusH() + dp(6), dp(12), dp(10));
        TextView close = tv(Color.WHITE, 22, false);
        close.setText("✕");
        close.setPadding(dp(8), dp(4), dp(8), dp(4));
        close.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { cmDlg.dismiss(); } });
        top.addView(close);
        View sp = new View(this);
        top.addView(sp, new LinearLayout.LayoutParams(0, 1, 1f));
        cmPost = pill(L("نشر", "Post"), NAVY, GOLD, 0);
        cmPost.setPadding(dp(22), dp(8), dp(22), dp(8));
        cmPost.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { cmSubmit(); } });
        top.addView(cmPost);
        root.addView(top);

        ScrollView sc = new ScrollView(this);
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setPadding(dp(14), dp(4), dp(14), dp(14));

        LinearLayout row = new LinearLayout(this);
        row.setGravity(Gravity.TOP);
        ImageView av = new ImageView(this);
        av.setScaleType(ImageView.ScaleType.CENTER_CROP);
        av.setBackground(oval(CARD, 0));
        av.setClipToOutline(true);
        av.setOutlineProvider(new ViewOutlineProvider() { @Override public void getOutline(View v, Outline o) { o.setOval(0, 0, v.getWidth(), v.getHeight()); } });
        if (uavatar != null && uavatar.length() > 0) loadImage(uavatar, av);
        row.addView(av, new LinearLayout.LayoutParams(dp(44), dp(44)));
        cmText = new EditText(this);
        cmText.setTextColor(Color.WHITE);
        cmText.setHintTextColor(MUTED);
        cmText.setHint(L("ماذا يحدث؟", "What's happening?"));
        cmText.setTextSize(17);
        cmText.setBackgroundColor(Color.TRANSPARENT);
        cmText.setMinLines(5);
        cmText.setGravity(Gravity.TOP | Gravity.START);
        cmText.setFilters(new android.text.InputFilter[] { new android.text.InputFilter.LengthFilter(CM_PRO) });
        cmText.addTextChangedListener(new android.text.TextWatcher() {
            @Override public void beforeTextChanged(CharSequence s, int a, int b, int c) {}
            @Override public void onTextChanged(CharSequence s, int a, int b, int c) {}
            @Override public void afterTextChanged(android.text.Editable e) { cmUpdateCount(); }
        });
        LinearLayout.LayoutParams tl = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
        tl.setMarginStart(dp(12));
        row.addView(cmText, tl);
        box.addView(row);

        cmPreview = new LinearLayout(this);
        cmPreview.setOrientation(LinearLayout.VERTICAL);
        box.addView(cmPreview);

        TextView tt = tv(MUTED, 13, true);
        tt.setText(L("نوع المنشور", "Post type"));
        tt.setPadding(0, dp(14), 0, dp(6));
        box.addView(tt);
        HorizontalScrollView hs = new HorizontalScrollView(this);
        hs.setHorizontalScrollBarEnabled(false);
        cmChips = new LinearLayout(this);
        hs.addView(cmChips);
        box.addView(hs);
        cmTopicFields = new LinearLayout(this);
        cmTopicFields.setOrientation(LinearLayout.VERTICAL);
        box.addView(cmTopicFields);
        cmRenderChips();

        cmNotice = tv(Color.WHITE, 13, true);
        cmNotice.setVisibility(View.GONE);
        cmNotice.setPadding(dp(12), dp(8), dp(12), dp(8));
        cmNotice.setBackground(rbg(0xF2111A4A, 0x4DF5C35A, 14));
        LinearLayout.LayoutParams nl = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        nl.setMargins(0, dp(12), 0, 0);
        cmNotice.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { openSubscriptions(); } });
        box.addView(cmNotice, nl);

        LinearLayout tools = new LinearLayout(this);
        tools.setGravity(Gravity.CENTER_VERTICAL);
        tools.setPadding(0, dp(14), 0, 0);
        ImageView bi = mpIconBtn(30);
        bi.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { cmPickMedia(false); } });
        ImageView bv = mpIconBtn(31);
        bv.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { cmPickMedia(true); } });
        tools.addView(bi);
        LinearLayout.LayoutParams bl = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        bl.setMargins(dp(10), 0, dp(10), 0);
        tools.addView(bv, bl);
        View sp2 = new View(this);
        tools.addView(sp2, new LinearLayout.LayoutParams(0, 1, 1f));
        cmCount = tv(MUTED, 14, true);
        tools.addView(cmCount);
        box.addView(tools);

        sc.addView(box);
        root.addView(sc, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));
        cmDlg.setContentView(root);
        cmDlg.show();
        cmUpdateCount();
        fetchTier(new TierCb() { @Override public void on(int t) { cmTier = t; cmUpdateCount(); } });
        cmText.requestFocus();
    }

    private void cmUpdateCount() {
        if (cmCount == null || cmText == null) return;
        int left = cmMax() - cmText.getText().length();
        cmCount.setText(String.valueOf(left));
        cmCount.setTextColor(left < 0 ? 0xFFF4212E : (left <= 20 ? GOLD : MUTED));
        if (cmPost != null) cmPost.setAlpha(left < 0 ? 0.5f : 1f);
        if (left < 0) cmNote(L("✍️ تجاوزت الحد. اشترك لتكتب حتى 1000 حرف (اضغط)", "✍️ Over the limit. Subscribe to write up to 1000 characters (tap)"));
        else if (cmNotice != null && "over".equals(cmNotice.getTag())) cmNotice.setVisibility(View.GONE);
    }

    private void cmNote(String t) { cmNote(t, t.indexOf("✍️") == 0 ? "over" : "x"); }
    private void cmNote(String t, String kind) {
        if (cmNotice == null) return;
        cmNotice.setText(t);
        cmNotice.setTag(kind);
        cmNotice.setVisibility(View.VISIBLE);
    }

    // ---------- أنواع المنشور ----------
    private String cmTopicTitle(String[] t) { return isAr() ? t[1] : t[2]; }

    private void cmRenderChips() {
        cmChips.removeAllViews();
        cmChips.addView(cmChip(L("رأي عام", "General"), cmTopicType == null && !cmPred, new View.OnClickListener() {
            @Override public void onClick(View v) { cmPickTopic(null); }
        }));
        for (final String[] t : CM_TOPICS) {
            if ("prediction".equals(t[0])) continue;
            cmChips.addView(cmChip(cmTopicTitle(t), t[0].equals(cmTopicType), new View.OnClickListener() {
                @Override public void onClick(View v) { cmPickTopic(t[0]); }
            }));
        }
        cmChips.addView(cmChip("⚽ " + L("توقع", "Prediction"), cmPred, new View.OnClickListener() {
            @Override public void onClick(View v) { cmPickPred(); }
        }));
    }

    private View cmChip(String label, boolean on, View.OnClickListener l) {
        TextView c = tv(on ? NAVY : Color.WHITE, 13, true);
        c.setText(label);
        c.setPadding(dp(14), dp(7), dp(14), dp(7));
        c.setBackground(rbg(on ? GOLD : CARD, on ? GOLD : 0x33FFFFFF, 20));
        c.setOnClickListener(l);
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        p.setMargins(0, 0, dp(6), 0);
        c.setLayoutParams(p);
        return c;
    }

    private boolean cmTier3() {
        if (cmTier >= 3) return true;
        cmNote(L("🧩 أنواع المنشور والتوقّع في الباقة الكاملة (4.99$) (اضغط)", "🧩 Post types and predictions need the Pro plan (tap)"), "topic");
        return false;
    }

    private void cmPickTopic(String t) {
        if (t != null && !cmTier3()) return;
        cmTopicType = t; cmTopicName = ""; cmTopicNameB = "";
        cmPred = false; cmPredMatch = null; cmPredPick = -1;
        cmRenderChips();
        cmTopicFields.removeAllViews();
        if (t == null) return;
        String[] T = null;
        for (String[] x : CM_TOPICS) if (x[0].equals(t)) T = x;
        boolean person = t.equals("player") || t.equals("coach") || t.equals("referee") || t.equals("compare");
        cmTopicFields.addView(cmInput(isAr() ? T[7] : T[8], new TextW() { @Override public void on(String s) { cmTopicName = s; } }));
        if (t.equals("compare")) cmTopicFields.addView(cmInput(L("الطرف الثاني", "Second side"), new TextW() { @Override public void on(String s) { cmTopicNameB = s; } }));
        if (person) cmTopicFields.addView(cmHint(L("النقد للأداء والقرارات فقط. السب والاتهامات غير مسموحة.", "Criticism of performance and decisions only. No insults or accusations.")));
        if (t.equals("prediction")) cmTopicFields.addView(cmHint(L("التوقع مجاني دائماً، ويعطيك شارة فقط ولا يرتبط بأي مال.", "Predictions are always free: badges only, never money.")));
    }

    private interface TextW { void on(String s); }

    private EditText cmInput(String hint, final TextW w) {
        EditText e = new EditText(this);
        e.setHint(hint);
        e.setTextColor(Color.WHITE);
        e.setHintTextColor(MUTED);
        e.setTextSize(15);
        e.setSingleLine(true);
        e.setFilters(new android.text.InputFilter[] { new android.text.InputFilter.LengthFilter(60) });
        e.setPadding(dp(12), dp(10), dp(12), dp(10));
        e.setBackground(rbg(CARD, 0x33FFFFFF, 12));
        e.addTextChangedListener(new android.text.TextWatcher() {
            @Override public void beforeTextChanged(CharSequence s, int a, int b, int c) {}
            @Override public void onTextChanged(CharSequence s, int a, int b, int c) {}
            @Override public void afterTextChanged(android.text.Editable ed) { w.on(ed.toString()); }
        });
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        p.setMargins(0, dp(8), 0, 0);
        e.setLayoutParams(p);
        return e;
    }

    private TextView cmHint(String t) {
        TextView h = tv(MUTED, 12, false);
        h.setText(t);
        h.setPadding(0, dp(6), 0, 0);
        return h;
    }

    // ---------- توقّع مباراة ----------
    private void cmPickPred() {
        if (!cmTier3()) return;
        cmTopicType = null; cmTopicName = ""; cmTopicNameB = "";
        cmPred = true; cmPredMatch = null; cmPredPick = -1; cmMatchQuery = ""; cmLeague = "";
        cmRenderChips();
        cmRenderPred();
        if (cmMatches == null) {
            pool.execute(new Runnable() {
                @Override public void run() {
                    JSONArray a;
                    try {
                        SimpleDateFormat nf = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", java.util.Locale.US);
                        nf.setTimeZone(java.util.TimeZone.getTimeZone("UTC"));
                        String now = nf.format(new Date());
                        a = new JSONArray(get("matches?select=id,team_a,team_b,match_date,status,competition_name&status=eq.NOT_STARTED&match_date=gt." + java.net.URLEncoder.encode(now, "UTF-8") + "&order=match_date.asc&limit=300"));
                    } catch (Exception e) { a = new JSONArray(); }
                    final JSONArray fa = a;
                    runOnUiThread(new Runnable() { @Override public void run() { cmMatches = fa; if (cmPred) cmRenderPred(); } });
                }
            });
        }
    }

    private void cmRenderPred() {
        cmTopicFields.removeAllViews();
        if (!cmPred) return;
        if (cmPredMatch != null) {
            final String a = teamName(cmPredMatch.optString("team_a")), b = teamName(cmPredMatch.optString("team_b"));
            TextView sel = tv(Color.WHITE, 15, true);
            sel.setText(a + " × " + b + "   (" + L("تغيير", "Change") + ")");
            sel.setPadding(dp(12), dp(12), dp(12), dp(12));
            sel.setBackground(rbg(CARD, GOLD, 12));
            sel.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { cmPredMatch = null; cmPredPick = -1; cmRenderPred(); } });
            LinearLayout.LayoutParams sp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            sp.setMargins(0, dp(8), 0, 0);
            cmTopicFields.addView(sel, sp);
            cmTopicFields.addView(cmHint(L("ما توقّعك للنتيجة؟", "Your prediction?")));
            LinearLayout btns = new LinearLayout(this);
            String[] lab = { L("فوز ", "Win ") + a, L("تعادل", "Draw"), L("فوز ", "Win ") + b };
            for (int i = 0; i < 3; i++) {
                final int pi = i;
                TextView pb = tv(cmPredPick == i ? NAVY : Color.WHITE, 13, true);
                pb.setText(lab[i]);
                pb.setGravity(Gravity.CENTER);
                pb.setPadding(dp(6), dp(10), dp(6), dp(10));
                pb.setBackground(rbg(cmPredPick == i ? GOLD : CARD, cmPredPick == i ? GOLD : 0x33FFFFFF, 12));
                pb.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { cmPredPick = pi; cmRenderPred(); } });
                LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
                p.setMargins(dp(3), dp(6), dp(3), 0);
                btns.addView(pb, p);
            }
            cmTopicFields.addView(btns);
            cmTopicFields.addView(cmHint(L("التوقّع مجاني دائمًا، بلا مال ولا جوائز نقدية.", "Free forever: no money involved.")));
            return;
        }
        if (cmMatches != null && cmMatches.length() > 0) {
            HorizontalScrollView lh = new HorizontalScrollView(this);
            lh.setHorizontalScrollBarEnabled(false);
            LinearLayout lr = new LinearLayout(this);
            lh.addView(lr);
            lr.addView(cmChip(L("الكل", "All"), cmLeague.length() == 0, new View.OnClickListener() {
                @Override public void onClick(View v) { cmLeague = ""; cmRenderPred(); }
            }));
            java.util.LinkedHashSet<String> comps = new java.util.LinkedHashSet<String>();
            for (int i = 0; i < cmMatches.length(); i++) { JSONObject mm = cmMatches.optJSONObject(i); if (mm != null && mm.optString("competition_name").length() > 0) comps.add(mm.optString("competition_name")); }
            for (final String cn : comps) {
                lr.addView(cmChip(cmLeagueName(cn), cn.equals(cmLeague), new View.OnClickListener() {
                    @Override public void onClick(View v) { cmLeague = cn; cmRenderPred(); }
                }));
            }
            LinearLayout.LayoutParams llp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            llp.setMargins(0, dp(10), 0, dp(4));
            cmTopicFields.addView(lh, llp);
        }
        EditText q = cmInput(L("ابحث عن مباراة أو فريق", "Search a match or team"), new TextW() { @Override public void on(String s) { cmMatchQuery = s; cmFillMatchList(); } });
        q.setText(cmMatchQuery);
        cmTopicFields.addView(q);
        LinearLayout list = new LinearLayout(this);
        list.setOrientation(LinearLayout.VERTICAL);
        list.setTag("mlist");
        cmTopicFields.addView(list);
        cmFillMatchList();
    }

    private String cmLeagueName(String n) {
        if ("Primera Division".equals(n)) return L("الإسباني", "La Liga");
        if ("Premier League".equals(n)) return L("الإنجليزي", "Premier League");
        if ("Serie A".equals(n)) return L("الإيطالي", "Serie A");
        if ("Bundesliga".equals(n)) return L("الألماني", "Bundesliga");
        if ("Ligue 1".equals(n)) return L("الفرنسي", "Ligue 1");
        if ("UEFA Champions League".equals(n)) return L("أبطال أوروبا", "Champions League");
        if ("Championship".equals(n)) return L("تشامبيونشيب", "Championship");
        if ("Eredivisie".equals(n)) return L("الهولندي", "Eredivisie");
        if (n.startsWith("Campeonato Brasileiro")) return L("البرازيلي", "Brasileirão");
        return n;
    }

    private void cmFillMatchList() {
        if (cmTopicFields == null) return;
        LinearLayout list = (LinearLayout) cmTopicFields.findViewWithTag("mlist");
        if (list == null) return;
        list.removeAllViews();
        if (cmMatches == null) { list.addView(cmHint("")); return; }
        String ql = cmMatchQuery == null ? "" : cmMatchQuery.trim().toLowerCase();
        int shown = 0;
        for (int i = 0; i < cmMatches.length() && shown < 40; i++) {
            final JSONObject m = cmMatches.optJSONObject(i);
            if (m == null) continue;
            String hay = (teamHay(m.optString("team_a")) + " " + teamHay(m.optString("team_b")) + " " + m.optString("competition_name")).toLowerCase();
            if (ql.length() > 0 && hay.indexOf(ql) < 0) continue;
            if (cmLeague.length() > 0 && !cmLeague.equals(m.optString("competition_name"))) continue;
            shown++;
            TextView it = tv(Color.WHITE, 14, true);
            it.setText(teamName(m.optString("team_a")) + " × " + teamName(m.optString("team_b")) + "\n" + cmWhen(m.optString("match_date")) + " · " + cmLeagueName(m.optString("competition_name")));
            it.setPadding(dp(12), dp(10), dp(12), dp(10));
            it.setBackground(rbg(CARD, 0x33FFFFFF, 12));
            it.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { cmPredMatch = m; cmPredPick = -1; cmRenderPred(); } });
            LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            p.setMargins(0, dp(6), 0, 0);
            list.addView(it, p);
        }
        if (shown == 0) list.addView(cmHint(L("لا توجد مباريات قادمة مطابقة.", "No upcoming matches found.")));
    }

    private String cmWhen(String iso) {
        try {
            SimpleDateFormat f = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss");
            f.setTimeZone(TimeZone.getTimeZone("UTC"));
            Date d = f.parse(iso.substring(0, 19));
            return new SimpleDateFormat("dd/MM HH:mm").format(d);
        } catch (Exception e) { return ""; }
    }

    // ---------- الصور والفيديو ----------
    // camera=false: أيقونة الإرفاق (معرض صور وفيديو)، camera=true: أيقونة الكاميرا (صورة أو فيديو)
    private void cmPickMedia(final boolean camera) {
        if (cmTier < 2) {
            cmNote(L("📎 نشر الصور والفيديو في الباقة المميّزة (1.99$) فما فوق (اضغط)", "📎 Images and video need the Plus plan or higher (tap)"), "media");
            return;
        }
        MediaCb cb = new MediaCb() { @Override public void picked(Uri u, boolean video) { if (video) cmHandleVideo(u); else cmHandleImage(u); } };
        if (camera) mediaCameraShow(cb); else mediaAttachShow(cb);
    }

    @Override protected void onActivityResult(int code, int res, Intent data) {
        super.onActivityResult(code, res, data);
        if (mpOnResult(code, res, data)) return;
        if (res != RESULT_OK || data == null || data.getData() == null) return;
        if (code == CM_IMG) cmHandleImage(data.getData());
        else if (code == CM_VID) cmHandleVideo(data.getData());
    }

    private void cmHandleImage(final Uri u) {
        pool.execute(new Runnable() {
            @Override public void run() {
                Bitmap b = null;
                try {
                    android.graphics.BitmapFactory.Options o = new android.graphics.BitmapFactory.Options();
                    o.inJustDecodeBounds = true;
                    InputStream in = getContentResolver().openInputStream(u);
                    BitmapFactory.decodeStream(in, null, o);
                    in.close();
                    int s = 1;
                    while (Math.max(o.outWidth, o.outHeight) / s > 1800) s *= 2;
                    o = new android.graphics.BitmapFactory.Options();
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
                    cmImage = fb; cmVideoUri = null; cmVideoName = null;
                    cmRenderPreview();
                } });
            }
        });
    }

    private void cmHandleVideo(final Uri u) {
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
                    else if (size > CM_VID_MAX) err = L("حجم الفيديو يتجاوز 100 ميغابايت.", "Video is larger than 100 MB.");
                    else {
                        android.media.MediaMetadataRetriever mr = new android.media.MediaMetadataRetriever();
                        mr.setDataSource(Compose.this, u);
                        String dur = mr.extractMetadata(android.media.MediaMetadataRetriever.METADATA_KEY_DURATION);
                        mr.release();
                        if (dur != null && Long.parseLong(dur) > CM_VID_SECS * 1000) err = L("مدة الفيديو تتجاوز 60 ثانية.", "Video is longer than 60 seconds.");
                    }
                } catch (Exception e) { err = L("تعذّر قراءة الفيديو.", "Could not read the video."); }
                final String fe = err, fn = name;
                runOnUiThread(new Runnable() { @Override public void run() {
                    if (fe != null) { toast(fe); return; }
                    cmVideoUri = u; cmVideoName = fn; cmImage = null;
                    cmRenderPreview();
                } });
            }
        });
    }

    private void cmRenderPreview() {
        cmPreview.removeAllViews();
        if (cmImage == null && cmVideoUri == null) return;
        FrameLayout fl = new FrameLayout(this);
        if (cmImage != null) {
            ImageView iv = new ImageView(this);
            iv.setImageBitmap(cmImage);
            iv.setAdjustViewBounds(true);
            iv.setScaleType(ImageView.ScaleType.FIT_CENTER);
            fl.addView(iv, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        } else {
            TextView vt = tv(Color.WHITE, 14, true);
            vt.setText("🎬 " + cmVideoName);
            vt.setPadding(dp(14), dp(18), dp(14), dp(18));
            vt.setBackground(rbg(CARD, 0x33FFFFFF, 12));
            fl.addView(vt, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        }
        TextView x = tv(Color.WHITE, 16, true);
        x.setText("✕");
        x.setGravity(Gravity.CENTER);
        x.setBackground(oval(0xAA000000, 0));
        x.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { cmImage = null; cmVideoUri = null; cmVideoName = null; cmRenderPreview(); } });
        FrameLayout.LayoutParams xp = new FrameLayout.LayoutParams(dp(30), dp(30), Gravity.TOP | Gravity.END);
        xp.setMargins(dp(6), dp(6), dp(6), dp(6));
        fl.addView(x, xp);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        lp.setMargins(0, dp(10), 0, 0);
        cmPreview.addView(fl, lp);
    }

    // ---------- النشر ----------
    private boolean cmBad(String s) {
        String[] w = s.toLowerCase().split("[^\\p{L}]+");
        for (String x : w) for (String b : CM_BAD) if (x.equals(b)) return true;
        return false;
    }

    private void cmStage(final String t) {
        runOnUiThread(new Runnable() { @Override public void run() { if (cmPost != null) cmPost.setText(t); } });
    }

    private void cmSubmit() {
        if (cmPosting) return;
        final String content = cmText.getText().toString().trim();
        if (cmPred && (cmPredMatch == null || cmPredPick < 0)) { toast(L("اختر المباراة ثم توقّعك.", "Choose a match and your prediction.")); return; }
        if (content.length() == 0 && cmImage == null && cmVideoUri == null && !cmPred) { toast(L("اكتب نصاً أو أضف صورة أو فيديو أولاً.", "Write something or add an image or video first.")); return; }
        if (content.length() > CM_FREE && cmTier < 1) { openSubscriptions(); return; }
        if (content.length() > cmMax()) return;
        final String type = cmTopicType;
        final String n = cmTopicName.trim(), nb = cmTopicNameB.trim();
        if (type != null) {
            if (n.length() < 2 || ("compare".equals(type) && nb.length() < 2)) { toast(L("اكتب اسم الموضوع (حرفان على الأقل).", "Enter the subject name (2+ characters).")); return; }
            if (content.length() == 0) { toast(L("اكتب رأيك في المنشور أولاً.", "Write your opinion first.")); return; }
            if (cmBad(content + " " + n + " " + nb)) { toast(L("المنشور يحتوي على سب أو اتهام غير مسموح. انتقد الأداء والقرارات فقط.", "Your post contains an insult or accusation. Criticize performance and decisions only.")); return; }
        }
        cmPosting = true;
        cmPost.setAlpha(0.6f);
        cmPost.setText(L("جارٍ النشر...", "Posting..."));
        final Bitmap img = cmImage;
        final Uri vid = cmVideoUri;
        final JSONObject pm = cmPredMatch;
        final int pick = cmPredPick;
        pool.execute(new Runnable() {
            @Override public void run() {
                String imgPath = null, vidPath = null, imgUrl = null, vidUrl = null, error = null;
                try {
                    if (vid != null) {
                        Exception last = null;
                        for (int at = 1; at <= 3; at++) {
                            try {
                                JSONObject sg = r2UploadVideo(vid, new R2Progress() { @Override public void on(int pct, double mb) {
                                    cmStage(L("جارٍ رفع الفيديو ", "Uploading ") + pct + "% (" + String.format(java.util.Locale.US, "%.1f", mb) + " MB)");
                                } });
                                vidPath = sg.getString("key"); vidUrl = sg.getString("publicUrl");
                                last = null; break; }
                            catch (Exception e) {
                                String m = String.valueOf(e.getMessage());
                                if (m.matches("(?s).*(already exists|duplicate|409).*")) { last = null; break; }
                                last = e;
                                if (at < 3) { cmStage(L("إعادة محاولة الرفع (" + (at + 1) + "/3)...", "Retrying upload (" + (at + 1) + "/3)...")); Thread.sleep(1500L * at); }
                            }
                        }
                        if (last != null) throw new Exception(L("فشل رفع الفيديو: ", "Video upload failed: ") + last.getMessage());
                        cmStage(L("جارٍ إنشاء المنشور...", "Creating the post..."));
                    }
                    if (img != null) {
                        ByteArrayOutputStream bo = new ByteArrayOutputStream();
                        img.compress(Bitmap.CompressFormat.JPEG, 75, bo);
                        JSONObject si = r2UploadBytes(bo.toByteArray(), "image", "image/jpeg");
                        imgPath = si.getString("key"); imgUrl = si.getString("publicUrl");
                    }
                    JSONObject o = new JSONObject();
                    o.put("user_id", uid);
                    o.put("author_name", uname);
                    o.put("author_avatar", uavatar);
                    o.put("content", content);
                    o.put("image_url", imgUrl == null ? JSONObject.NULL : imgUrl);
                    o.put("video_url", vidUrl == null ? JSONObject.NULL : vidUrl);
                    o.put("video_path", vidPath == null ? JSONObject.NULL : vidPath);
                    if (type != null) {
                        o.put("topic_type", type);
                        o.put("topic_name", n);
                        o.put("topic_name_b", "compare".equals(type) ? nb : JSONObject.NULL);
                    }
                    String r;
                    try { r = cmHttp("POST", url + "/rest/v1/posts?select=id", o.toString().getBytes("UTF-8"), "application/json", null); }
                    catch (Exception e) {
                        if (vidPath != null) cmRemove("post-videos", vidPath);
                        if (imgPath != null) cmRemove("post-images", imgPath);
                        throw e;
                    }
                    if (pm != null) {
                        String pid = new JSONArray(r).getJSONObject(0).optString("id");
                        try { rpc("attach_prediction", "{\"p_post\":" + pid + ",\"p_match\":\"" + pm.optString("id") + "\",\"p_pick\":" + pick + "}"); }
                        catch (Exception e) {
                            try { sendUrl("DELETE", url + "/rest/v1/posts?id=eq." + pid, null); } catch (Exception ig) {}
                            if (imgPath != null) cmRemove("post-images", imgPath);
                            String m = String.valueOf(e.getMessage());
                            throw new Exception(m.indexOf("match_started") >= 0 ? L("هذه المباراة بدأت، اختر مباراة أخرى.", "That match already started.") : L("تعذّر نشر التوقّع: ", "Could not publish: ") + m);
                        }
                    }
                } catch (Exception e) { error = String.valueOf(e.getMessage()); }
                final String fe = error;
                runOnUiThread(new Runnable() { @Override public void run() {
                    cmPosting = false;
                    if (fe == null) { cmDlg.dismiss(); toast(L("تم النشر", "Posted")); refresh(); return; }
                    cmPost.setAlpha(1f);
                    cmPost.setText(L("نشر", "Post"));
                    if (fe.indexOf("premium_required") >= 0) { openSubscriptions(); return; }
                    if (fe.indexOf("video_daily_limit") >= 0) toast(L("وصلت إلى حد 5 فيديوهات اليوم.", "You reached the limit of 5 videos today."));
                    else if (fe.indexOf("tier3_required") >= 0) { toast(L("أنواع المنشور والتوقّع في الباقة الكاملة (4.99$).", "Post types and predictions need the Pro plan.")); openSubscriptions(); }
                    else if (fe.indexOf("post_too_long") >= 0) toast(L("المنشور أطول من 1000 حرف.", "Post is over 1000 characters."));
                    else toast(L("فشل النشر: ", "Post failed: ") + fe);
                } });
            }
        });
    }

    protected String cmEnc(String path) throws Exception {
        String[] ps = path.split("/");
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < ps.length; i++) { if (i > 0) sb.append('/'); sb.append(java.net.URLEncoder.encode(ps[i], "UTF-8").replace("+", "%20")); }
        return sb.toString();
    }

    protected void cmRemove(String bucket, String path) {
        if (path != null && (path.startsWith("v/") || path.startsWith("i/"))) { r2Delete(path); return; }
        try { sendUrl("DELETE", url + "/storage/v1/object/" + bucket + "/" + cmEnc(path), null); } catch (Exception ignore) {}
    }

    // ===== Cloudflare R2 =====
    protected static final String R2_PUB = "https://media.zelosport.net/";

    protected interface R2Progress { void on(int pct, double mb); }

    // استخراج مفتاح R2 من رابط عام (للحذف)؛ يرجع null لو الرابط ليس من R2
    protected String r2KeyFromUrl(String u) {
        if (u != null && u.startsWith(R2_PUB)) return u.substring(R2_PUB.length());
        return null;
    }

    protected String r2Call(String json) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(url + "/functions/v1/r2-sign").openConnection();
        c.setRequestMethod("POST");
        c.setRequestProperty("apikey", key);
        c.setRequestProperty("Authorization", "Bearer " + token);
        c.setRequestProperty("Content-Type", "application/json");
        c.setConnectTimeout(15000);
        c.setReadTimeout(30000);
        c.setDoOutput(true);
        c.getOutputStream().write(json.getBytes("UTF-8"));
        int code = c.getResponseCode();
        BufferedReader r = new BufferedReader(new InputStreamReader(code >= 400 ? c.getErrorStream() : c.getInputStream(), "UTF-8"));
        StringBuilder sb = new StringBuilder();
        String ln;
        while ((ln = r.readLine()) != null) sb.append(ln);
        r.close();
        if (code >= 400) { banCheck(sb.toString()); throw new Exception(sb.length() > 0 ? sb.toString() : ("HTTP " + code)); }
        return sb.toString();
    }

    protected void r2Delete(final String key2) {
        pool.execute(new Runnable() { @Override public void run() {
            try { r2Call("{\"action\":\"delete\",\"key\":\"" + key2 + "\"}"); } catch (Exception ignore) {}
        } });
    }

    // رفع بايتات (صور) إلى R2. يرجع {publicUrl,key}
    protected JSONObject r2UploadBytes(byte[] data, String kind, String ctype) throws Exception {
        JSONObject s = new JSONObject(r2Call("{\"kind\":\"" + kind + "\"}"));
        HttpURLConnection c = (HttpURLConnection) new URL(s.getString("uploadUrl")).openConnection();
        c.setRequestMethod("PUT");
        c.setRequestProperty("Content-Type", ctype);
        c.setConnectTimeout(20000);
        c.setReadTimeout(60000);
        c.setDoOutput(true);
        c.setFixedLengthStreamingMode(data.length);
        c.getOutputStream().write(data);
        r2Check(c);
        return s;
    }

    // رفع فيديو من Uri إلى R2 مع نسبة التقدم. يرجع {publicUrl,key}
    protected JSONObject r2UploadVideo(Uri u, R2Progress pg) throws Exception {
        JSONObject s = new JSONObject(r2Call("{\"kind\":\"video\"}"));
        InputStream in = getContentResolver().openInputStream(u);
        long total = 0;
        try {
            android.content.res.AssetFileDescriptor fd = getContentResolver().openAssetFileDescriptor(u, "r");
            total = fd.getLength();
            fd.close();
        } catch (Exception ignore) {}
        HttpURLConnection c = (HttpURLConnection) new URL(s.getString("uploadUrl")).openConnection();
        c.setRequestMethod("PUT");
        c.setRequestProperty("Content-Type", "video/mp4");
        c.setConnectTimeout(20000);
        c.setReadTimeout(120000);
        c.setDoOutput(true);
        if (total > 0) c.setFixedLengthStreamingMode(total); else c.setChunkedStreamingMode(64 * 1024);
        java.io.OutputStream out = c.getOutputStream();
        byte[] buf = new byte[32 * 1024];
        long sent = 0; int last = -1, n;
        while ((n = in.read(buf)) > 0) {
            out.write(buf, 0, n);
            sent += n;
            if (total > 0 && pg != null) {
                int pct = (int) Math.min(99, sent * 100 / total);
                if (pct != last) { last = pct; pg.on(pct, total / 1048576.0); }
            }
        }
        in.close();
        out.close();
        r2Check(c);
        return s;
    }

    private void r2Check(HttpURLConnection c) throws Exception {
        int code = c.getResponseCode();
        if (code >= 300) {
            StringBuilder sb = new StringBuilder();
            try {
                BufferedReader r = new BufferedReader(new InputStreamReader(c.getErrorStream(), "UTF-8"));
                String ln;
                while ((ln = r.readLine()) != null) sb.append(ln);
                r.close();
            } catch (Exception ignore) {}
            throw new Exception(sb.length() > 0 ? sb.toString() : ("HTTP " + code));
        }
    }

    // إرسال خام (للتخزين والصفوف التي نحتاج إرجاعها)
    protected String cmHttp(String method, String full, byte[] body, String ctype, String upsert) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(full).openConnection();
        c.setRequestMethod(method);
        c.setRequestProperty("apikey", key);
        c.setRequestProperty("Authorization", "Bearer " + token);
        c.setRequestProperty("Content-Type", ctype);
        if (upsert != null) c.setRequestProperty("x-upsert", upsert); else c.setRequestProperty("Prefer", "return=representation");
        c.setConnectTimeout(15000);
        c.setReadTimeout(60000);
        c.setDoOutput(true);
        c.getOutputStream().write(body);
        int code = c.getResponseCode();
        BufferedReader r = new BufferedReader(new InputStreamReader(code >= 400 ? c.getErrorStream() : c.getInputStream(), "UTF-8"));
        StringBuilder sb = new StringBuilder();
        String ln;
        while ((ln = r.readLine()) != null) sb.append(ln);
        r.close();
        if (code >= 400) { banCheck(sb.toString()); throw new Exception(sb.toString().length() > 0 ? sb.toString() : ("HTTP " + code)); }
        return sb.toString();
    }

    // ================= اختيار الوسائط: كاميرا / معرض / قصّ الفيديو =================
    protected interface MediaCb { void picked(Uri u, boolean video); }
    protected static final int MP_GAL = 7401, MP_CAM_IMG = 7402, MP_CAM_VID = 7403;
    protected static final long MP_MAX_SECS = 60;
    private MediaCb mpCb;
    private java.io.File mpCamFile;

    protected ImageView mpIconBtn(int type) {
        ImageView iv = new ImageView(this);
        iv.setImageDrawable(new Ic(type, GOLD, false, dp(24)));
        iv.setScaleType(ImageView.ScaleType.CENTER);
        iv.setBackground(rbg(CARD, 0x44F5C35A, 22));
        iv.setLayoutParams(new LinearLayout.LayoutParams(dp(46), dp(46)));
        return iv;
    }

    private TextView mpRow(String text, int icon) {
        TextView t = tv(Color.WHITE, 16, true);
        t.setText(text);
        t.setGravity(Gravity.CENTER_VERTICAL);
        t.setPadding(dp(18), dp(16), dp(18), dp(16));
        t.setBackground(rbg(CARD, 0x33FFFFFF, 14));
        if (icon >= 0) { t.setCompoundDrawablesRelativeWithIntrinsicBounds(new Ic(icon, GOLD, false, dp(24)), null, null, null); t.setCompoundDrawablePadding(dp(14)); }
        return t;
    }

    // أيقونة الكاميرا: التقاط صورة أو تصوير فيديو
    protected void mediaCameraShow(final MediaCb cb) {
        mpCb = cb;
        final Dialog d = sheetDialog(false);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackground(rbg(NAVY, 0x22FFFFFF, 22));
        root.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);
        root.setPadding(dp(16), dp(16), dp(16), dp(16) + navH());
        TextView h = tv(GOLD, 17, true);
        h.setText(L("الكاميرا", "Camera"));
        h.setGravity(Gravity.CENTER);
        root.addView(h, new LinearLayout.LayoutParams(-1, -2));
        TextView ph = mpRow(L("التقاط صورة", "Take a photo"), 31);
        TextView vd = mpRow(L("تصوير فيديو (حتى 60 ثانية)", "Record a video (up to 60 s)"), 33);
        TextView no = mpRow(L("إلغاء", "Cancel"), -1);
        no.setTextColor(MUTED); no.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1, -2);
        lp.topMargin = dp(10);
        root.addView(ph, lp); root.addView(vd, lp); root.addView(no, lp);
        ph.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { d.dismiss(); mpOpenCamera(true); } });
        vd.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { d.dismiss(); mpOpenCamera(false); } });
        no.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { d.dismiss(); } });
        d.setContentView(root);
        d.show();
    }

    // أيقونة الإرفاق: معرض الهاتف (صور وفيديو معاً)
    protected void mediaAttachShow(MediaCb cb) {
        mpCb = cb;
        Intent i = new Intent(Intent.ACTION_GET_CONTENT);
        i.setType("*/*");
        i.putExtra(Intent.EXTRA_MIME_TYPES, new String[] { "image/*", "video/*" });
        i.addCategory(Intent.CATEGORY_OPENABLE);
        try { startActivityForResult(Intent.createChooser(i, null), MP_GAL); }
        catch (Exception e) { toast(L("تعذّر فتح المعرض", "Could not open the gallery")); }
    }

    private Uri mpFileUri(java.io.File f) throws Exception {
        Class<?> fp = Class.forName("androidx.core.content.FileProvider");
        return (Uri) fp.getMethod("getUriForFile", Context.class, String.class, java.io.File.class).invoke(null, this, getPackageName() + ".fileprovider", f);
    }

    private void mpOpenCamera(boolean image) {
        try {
            mpCleanCache();
            mpCamFile = new java.io.File(getCacheDir(), "cam_" + System.currentTimeMillis() + (image ? ".jpg" : ".mp4"));
            Uri out = mpFileUri(mpCamFile);
            Intent it = new Intent(image ? android.provider.MediaStore.ACTION_IMAGE_CAPTURE : android.provider.MediaStore.ACTION_VIDEO_CAPTURE);
            it.putExtra(android.provider.MediaStore.EXTRA_OUTPUT, out);
            if (!image) { it.putExtra(android.provider.MediaStore.EXTRA_DURATION_LIMIT, (int) MP_MAX_SECS); it.putExtra(android.provider.MediaStore.EXTRA_VIDEO_QUALITY, 1); }
            it.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
            it.setClipData(android.content.ClipData.newRawUri("out", out));
            startActivityForResult(it, image ? MP_CAM_IMG : MP_CAM_VID);
        } catch (Throwable e) { toast(L("تعذّر فتح الكاميرا", "Could not open the camera")); }
    }

    // حذف ملفات الكاميرا والقصّ القديمة من الكاش
    private void mpCleanCache() {
        try {
            java.io.File[] fs = getCacheDir().listFiles();
            if (fs == null) return;
            long old = System.currentTimeMillis() - 30L * 60 * 1000;
            for (java.io.File f : fs) {
                String n = f.getName();
                if ((n.startsWith("cam_") || n.startsWith("trim_")) && f.lastModified() < old) f.delete();
            }
        } catch (Exception ignore) {}
    }

    // نتيجة الكاميرا/المعرض. يرجع true إن عالجها
    protected boolean mpOnResult(int code, int res, Intent data) {
        if (code != MP_GAL && code != MP_CAM_IMG && code != MP_CAM_VID) return false;
        if (res != RESULT_OK || mpCb == null) return true;
        Uri u = null;
        if (code == MP_GAL) u = data != null ? data.getData() : null;
        else if (mpCamFile != null && mpCamFile.exists() && mpCamFile.length() > 0) u = Uri.fromFile(mpCamFile);
        else if (data != null) u = data.getData();
        if (u == null) { toast(L("لم يُحفظ الملف", "File was not saved")); return true; }
        if (code == MP_CAM_IMG) { mpCb.picked(u, false); return true; }
        if (code == MP_CAM_VID) { mpVideoChosen(u); return true; }
        String mt = null;
        try { mt = getContentResolver().getType(u); } catch (Exception ignore) {}
        if (mt != null && mt.startsWith("image/")) mpCb.picked(u, false);
        else if (mt != null && mt.startsWith("video/")) mpVideoChosen(u);
        else toast(L("اختر صورة أو فيديو", "Choose an image or a video"));
        return true;
    }

    // فيديو مختار: إن كان أطول من 60 ثانية تظهر شاشة القصّ
    private void mpVideoChosen(final Uri u) {
        pool.execute(new Runnable() { @Override public void run() {
            long dur = 0;
            try {
                android.media.MediaMetadataRetriever mr = new android.media.MediaMetadataRetriever();
                mr.setDataSource(Compose.this, u);
                String s = mr.extractMetadata(android.media.MediaMetadataRetriever.METADATA_KEY_DURATION);
                mr.release();
                dur = s == null ? 0 : Long.parseLong(s);
            } catch (Exception e) { dur = 0; }
            final long fd = dur;
            runOnUiThread(new Runnable() { @Override public void run() {
                if (fd <= 0) { toast(L("تعذّر قراءة الفيديو.", "Could not read the video.")); return; }
                if (fd <= MP_MAX_SECS * 1000) { if (mpCb != null) mpCb.picked(u, true); }
                else mpTrimDialog(u, fd);
            } });
        } });
    }

    private static String mpFmt(long ms) {
        long s = ms / 1000;
        return String.format(java.util.Locale.US, "%d:%02d", s / 60, s % 60);
    }

    // شريط اختيار الجزء: إطار ذهبي بمقبضين، يُسحب أو يُسحب أحد طرفيه
    private class RangeBar extends View {
        long dur, a, b; final long maxWin = MP_MAX_SECS * 1000, minWin = 1000;
        int mode = 0; float lastX;
        Runnable onChange;
        final Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        RangeBar(Context c, long d) { super(c); dur = d; a = 0; b = Math.min(d, maxWin); setLayoutDirection(View.LAYOUT_DIRECTION_LTR); }
        float x(long t) { float w = getWidth() - 2 * dp(14); return dp(14) + w * t / dur; }
        long t(float x) { float w = getWidth() - 2 * dp(14); return Math.max(0, Math.min(dur, (long) ((x - dp(14)) / w * dur))); }
        @Override protected void onDraw(Canvas cv) {
            float h = getHeight(), top = h * 0.2f, bot = h * 0.8f;
            p.setStyle(Paint.Style.FILL); p.setColor(CARD);
            cv.drawRoundRect(new RectF(dp(14), top, getWidth() - dp(14), bot), dp(8), dp(8), p);
            RectF r = new RectF(x(a), top - dp(4), x(b), bot + dp(4));
            p.setColor(0x33F5C35A); cv.drawRoundRect(r, dp(8), dp(8), p);
            p.setStyle(Paint.Style.STROKE); p.setStrokeWidth(dp(3)); p.setColor(GOLD); cv.drawRoundRect(r, dp(8), dp(8), p);
            p.setStyle(Paint.Style.FILL); p.setColor(GOLD);
            cv.drawRoundRect(new RectF(x(a) - dp(7), top - dp(8), x(a) + dp(7), bot + dp(8)), dp(5), dp(5), p);
            cv.drawRoundRect(new RectF(x(b) - dp(7), top - dp(8), x(b) + dp(7), bot + dp(8)), dp(5), dp(5), p);
        }
        @Override public boolean onTouchEvent(android.view.MotionEvent e) {
            float ex = e.getX();
            if (e.getAction() == android.view.MotionEvent.ACTION_DOWN) {
                getParent().requestDisallowInterceptTouchEvent(true);
                float da = Math.abs(ex - x(a)), db = Math.abs(ex - x(b)), th = dp(30);
                if (da <= th && da <= db) mode = 1;
                else if (db <= th) mode = 2;
                else if (ex > x(a) && ex < x(b)) mode = 3;
                else mode = 0;
                lastX = ex; return true;
            }
            if (e.getAction() == android.view.MotionEvent.ACTION_MOVE && mode != 0) {
                long tt = t(ex);
                if (mode == 1) { a = Math.min(tt, b - minWin); if (b - a > maxWin) b = a + maxWin; }
                else if (mode == 2) { b = Math.max(tt, a + minWin); if (b - a > maxWin) a = b - maxWin; }
                else { long w = b - a, d2 = t(ex) - t(lastX); long na = Math.max(0, Math.min(dur - w, a + d2)); a = na; b = na + w; }
                a = Math.max(0, a); b = Math.min(dur, b);
                lastX = ex; invalidate();
                if (onChange != null) onChange.run();
                return true;
            }
            if (e.getAction() == android.view.MotionEvent.ACTION_UP || e.getAction() == android.view.MotionEvent.ACTION_CANCEL) { mode = 0; return true; }
            return true;
        }
    }

    private void mpTrimDialog(final Uri u, final long dur) {
        final Dialog d = sheetDialog(true);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(NAVY);
        root.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);
        root.setPadding(dp(14), statusH() + dp(10), dp(14), dp(14) + navH());
        TextView h = tv(GOLD, 18, true);
        h.setText(L("✂️ قصّ الفيديو", "✂️ Trim video"));
        h.setGravity(Gravity.CENTER);
        root.addView(h, new LinearLayout.LayoutParams(-1, -2));
        final VideoView vv = new VideoView(this);
        FrameLayout vf = new FrameLayout(this);
        vf.setBackgroundColor(0xFF000000);
        vf.addView(vv, new FrameLayout.LayoutParams(-1, -1, Gravity.CENTER));
        LinearLayout.LayoutParams vl = new LinearLayout.LayoutParams(-1, 0, 1f);
        vl.topMargin = dp(10);
        root.addView(vf, vl);
        final RangeBar rb = new RangeBar(this, dur);
        LinearLayout.LayoutParams rl = new LinearLayout.LayoutParams(-1, dp(64));
        rl.topMargin = dp(12);
        root.addView(rb, rl);
        final TextView info = tv(Color.WHITE, 14, true);
        info.setGravity(Gravity.CENTER);
        root.addView(info, new LinearLayout.LayoutParams(-1, -2));
        TextView hint = tv(MUTED, 12, false);
        hint.setText(L("الحد الأقصى 60 ثانية. حرّك الإطار الذهبي أو اسحب طرفيه لاختيار الجزء.", "Max 60 seconds. Drag the gold frame or its edges to choose the part."));
        hint.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams hl = new LinearLayout.LayoutParams(-1, -2);
        hl.topMargin = dp(4);
        root.addView(hint, hl);
        TextView ok = pill(L("قصّ واستخدام", "Trim & use"), NAVY, GOLD, 0);
        TextView no = pill(L("إلغاء", "Cancel"), Color.WHITE, CARD, 0x33FFFFFF);
        LinearLayout.LayoutParams bl = new LinearLayout.LayoutParams(-1, -2);
        bl.topMargin = dp(12);
        root.addView(ok, bl);
        LinearLayout.LayoutParams bl2 = new LinearLayout.LayoutParams(-1, -2);
        bl2.topMargin = dp(8);
        root.addView(no, bl2);

        final android.os.Handler hd = new android.os.Handler(android.os.Looper.getMainLooper());
        final Runnable[] loop = new Runnable[1];
        final Runnable upd = new Runnable() { @Override public void run() {
            info.setText("‎" + L("البداية ", "Start ") + mpFmt(rb.a) + "   •   " + L("المدة ", "Length ") + mpFmt(rb.b - rb.a) + "   •   " + L("النهاية ", "End ") + mpFmt(rb.b));
        } };
        rb.onChange = new Runnable() { @Override public void run() { upd.run(); try { vv.seekTo((int) rb.a); } catch (Exception ignore) {} } };
        upd.run();
        vv.setVideoURI(u);
        vv.setOnPreparedListener(new android.media.MediaPlayer.OnPreparedListener() { @Override public void onPrepared(android.media.MediaPlayer mp) {
            mp.setLooping(false);
            vv.seekTo((int) rb.a); vv.start();
            loop[0] = new Runnable() { @Override public void run() {
                try { if (vv.getCurrentPosition() >= rb.b || !vv.isPlaying()) { vv.seekTo((int) rb.a); vv.start(); } } catch (Exception ignore) {}
                hd.postDelayed(this, 250);
            } };
            hd.postDelayed(loop[0], 250);
        } });
        d.setOnDismissListener(new DialogInterface.OnDismissListener() { @Override public void onDismiss(DialogInterface x) { hd.removeCallbacksAndMessages(null); try { vv.stopPlayback(); } catch (Exception ignore) {} } });
        no.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { d.dismiss(); } });
        ok.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) {
            final long s = rb.a, e = rb.b;
            d.dismiss();
            final Dialog pg = new AlertDialog.Builder(Compose.this).setMessage(L("جارٍ قصّ الفيديو...", "Trimming video...")).setCancelable(false).show();
            pool.execute(new Runnable() { @Override public void run() {
                Uri out = null; String err = null;
                try { out = Uri.fromFile(mpTrim(u, s, e)); } catch (Throwable t) { err = String.valueOf(t.getMessage()); }
                final Uri fo = out; final String fe = err;
                runOnUiThread(new Runnable() { @Override public void run() {
                    try { pg.dismiss(); } catch (Exception ignore) {}
                    if (fo == null) { toast(L("تعذّر قصّ الفيديو", "Could not trim the video")); return; }
                    if (mpCb != null) mpCb.picked(fo, true);
                } });
            } });
        } });
        d.setContentView(root);
        d.show();
    }

    // قصّ بدون إعادة ترميز (سريع وبلا فقد جودة). يبدأ من أول إطار مفتاحي بعد البداية فلا تتجاوز المدة 60 ثانية
    private java.io.File mpTrim(Uri src, long startMs, long endMs) throws Exception {
        java.io.File out = new java.io.File(getCacheDir(), "trim_" + System.currentTimeMillis() + ".mp4");
        android.media.MediaExtractor ex = new android.media.MediaExtractor();
        ex.setDataSource(this, src, null);
        int n = ex.getTrackCount();
        int[] map = new int[n];
        android.media.MediaMuxer mux = new android.media.MediaMuxer(out.getAbsolutePath(), android.media.MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4);
        int vTrack = -1; int rot = 0;
        try {
            android.media.MediaMetadataRetriever mr = new android.media.MediaMetadataRetriever();
            mr.setDataSource(this, src);
            String r = mr.extractMetadata(android.media.MediaMetadataRetriever.METADATA_KEY_VIDEO_ROTATION);
            mr.release();
            if (r != null) rot = Integer.parseInt(r);
        } catch (Exception ignore) {}
        if (rot != 0) mux.setOrientationHint(rot);
        int added = 0;
        for (int i = 0; i < n; i++) {
            android.media.MediaFormat f = ex.getTrackFormat(i);
            String mime = f.getString(android.media.MediaFormat.KEY_MIME);
            map[i] = -1;
            if (mime != null && (mime.startsWith("video/") || mime.startsWith("audio/"))) {
                ex.selectTrack(i);
                map[i] = mux.addTrack(f);
                if (mime.startsWith("video/")) vTrack = i;
                added++;
            }
        }
        if (added == 0 || vTrack < 0) { try { mux.release(); } catch (Exception ignore) {} ex.release(); throw new Exception("no tracks"); }
        mux.start();
        ex.seekTo(startMs * 1000, android.media.MediaExtractor.SEEK_TO_NEXT_SYNC);
        long base = -1, endUs = endMs * 1000;
        java.nio.ByteBuffer buf = java.nio.ByteBuffer.allocate(4 * 1024 * 1024);
        android.media.MediaCodec.BufferInfo bi = new android.media.MediaCodec.BufferInfo();
        long wrote = 0;
        while (true) {
            int ti = ex.getSampleTrackIndex();
            if (ti < 0) break;
            long ts = ex.getSampleTime();
            if (ts > endUs) break;
            if (base < 0) { if (ti != vTrack) { ex.advance(); continue; } base = ts; }
            if (ts < base) { ex.advance(); continue; }
            buf.clear();
            int sz = ex.readSampleData(buf, 0);
            if (sz < 0) break;
            bi.set(0, sz, ts - base, ex.getSampleFlags());
            if (map[ti] >= 0) { mux.writeSampleData(map[ti], buf, bi); wrote++; }
            ex.advance();
        }
        try { mux.stop(); } catch (Exception ignore) {}
        mux.release();
        ex.release();
        if (wrote == 0 || out.length() < 1000) { out.delete(); throw new Exception("empty"); }
        return out;
    }

    // تصحيح اتجاه الصورة حسب EXIF (صور الكاميرا تأتي مقلوبة أحياناً)
    protected Bitmap mpExifFix(Uri u, Bitmap b) {
        try {
            InputStream in = getContentResolver().openInputStream(u);
            int o = new android.media.ExifInterface(in).getAttributeInt(android.media.ExifInterface.TAG_ORIENTATION, 1);
            in.close();
            int deg = o == 6 ? 90 : o == 3 ? 180 : o == 8 ? 270 : 0;
            if (deg == 0) return b;
            android.graphics.Matrix m = new android.graphics.Matrix();
            m.postRotate(deg);
            return Bitmap.createBitmap(b, 0, 0, b.getWidth(), b.getHeight(), m, true);
        } catch (Throwable e) { return b; }
    }
}
