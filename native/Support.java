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


abstract class Support extends Base {
    // ---------------- الدعم ----------------
    protected static final String[][] GIFTS = {
        { "ball", "5", "كرة", "⚽", "#FFFFFF" },
        { "boot", "30", "حذاء ذهبي", "👟", "#F5C35A" },
        { "cup", "500", "كأس", "🏆", "#C8D0DC" },
        { "goldcup", "1000", "كأس البطولة", "🏆", "#F5C35A" }
    };
    protected static final String[][] SHIRTS = {
        { "s1", "20", "1", "حارس المرمى", "#2E7D32" }, { "s4", "20", "4", "مدافع", "#546E7A" },
        { "s5", "20", "5", "مدافع", "#455A64" }, { "s6", "50", "6", "وسط", "#6A1B9A" },
        { "s8", "50", "8", "وسط", "#00838F" }, { "s7", "100", "7", "جناح", "#C0392B" },
        { "s11", "100", "11", "جناح", "#EF6C00" }, { "s9", "150", "9", "مهاجم", "#2C4BB5" },
        { "s10", "200", "10", "صانع ألعاب", "#B7791F" }
    };

    protected String kfmt(long n) {
        if (n >= 1000000L) return (n / 100000L) / 10.0 + "M";
        if (n >= 1000L) return (n / 100L) / 10.0 + "K";
        return String.valueOf(n);
    }
    protected String nfmt(long n) { return String.format(java.util.Locale.US, "%,d", n); }

    protected void loadSupportStats(String fids) {
        try {
            JSONArray x = new JSONArray(rpc("support_stats", "{\"p_post_ids\":[" + fids + "]}"));
            for (int q = 0; q < x.length(); q++) {
                JSONObject r = x.getJSONObject(q);
                sup.put(String.valueOf(r.optLong("post_id")), new long[] { r.optLong("total_net", 0), r.optLong("supporters", 0) });
            }
            runOnUiThread(new Runnable() { @Override public void run() { refreshUi(); } });
        } catch (Exception ignore) {}
    }

    protected static final String COIN_URL = "https://raw.githubusercontent.com/zelospor-f/zelo-/main/zelo-coin.png";
    protected Bitmap coinBmp = null;
    protected boolean coinLoading = false;
    protected final List<Object[]> coinWaiters = new ArrayList<Object[]>();

    protected void applyCoin(TextView t, int px) {
        BitmapDrawable bd = new BitmapDrawable(getResources(), coinBmp);
        bd.setBounds(0, 0, px, px);
        t.setCompoundDrawablesRelative(null, null, bd, null);
        t.setCompoundDrawablePadding(dp(6));
    }

    // يضع صورة العملة (الكورة) بعد نص النقاط
    protected void withCoin(final TextView t, final int px) {
        if (coinBmp != null) { applyCoin(t, px); return; }
        coinWaiters.add(new Object[] { t, Integer.valueOf(px) });
        if (coinLoading) return;
        coinLoading = true;
        pool.execute(new Runnable() {
            @Override public void run() {
                try {
                    HttpURLConnection c = (HttpURLConnection) new URL(COIN_URL).openConnection();
                    c.setConnectTimeout(15000);
                    c.setReadTimeout(20000);
                    InputStream in = c.getInputStream();
                    ByteArrayOutputStream bo = new ByteArrayOutputStream();
                    byte[] buf = new byte[8192];
                    int n;
                    while ((n = in.read(buf)) > 0) bo.write(buf, 0, n);
                    in.close();
                    byte[] bytes = bo.toByteArray();
                    final Bitmap bm = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
                    if (bm != null) {
                        runOnUiThread(new Runnable() {
                            @Override public void run() {
                                coinBmp = bm;
                                for (Object[] w : coinWaiters) applyCoin((TextView) w[0], (Integer) w[1]);
                                coinWaiters.clear();
                            }
                        });
                    }
                } catch (Exception ignore) {}
                coinLoading = false;
            }
        });
    }

    protected View goldDot() {
        ImageView iv = new ImageView(this);
        iv.setScaleType(ImageView.ScaleType.FIT_CENTER);
        loadImage(COIN_URL, iv);
        return iv;
    }

    protected View goldDotOld() {
        TextView z = tv(NAVY, 11, true);
        z.setText("Z");
        z.setGravity(Gravity.CENTER);
        z.setBackground(oval(GOLD, 0xFFFFE7AD));
        return z;
    }

    protected void bindSupport(Holder h, JSONObject o) {
        h.supbar.removeAllViews();
        h.supbar.setVisibility(View.GONE);
        h.supBtn.setVisibility(View.GONE);
        final String pk = String.valueOf(o.optLong("id"));
        final String owner = o.optString("user_id", "");
        final boolean isOwner = owner.equals(uid);
        long[] st = sup.get(pk);
        long net = st == null ? 0 : st[0];
        long cnt = st == null ? 0 : st[1];
        LinearLayout left = new LinearLayout(this);
        left.setGravity(Gravity.CENTER_VERTICAL);
        if (cnt > 0) {
            left.addView(goldDot(), new LinearLayout.LayoutParams(dp(20), dp(20)));
            TextView t = tv(GOLD, 14, true);
            t.setText("  " + nfmt(net) + " ZELO");
            left.addView(t);
            TextView c2 = tv(MUTED, 12, true);
            c2.setText("  ·  " + kfmt(cnt) + (cnt == 1 ? L(" داعم", " supporter") : L(" داعمين", " supporters")) + "  ›");
            left.addView(c2);
            left.setOnClickListener(new View.OnClickListener() {
                @Override public void onClick(View v) { openSupporters(pk, owner); }
            });
            h.supbar.addView(left, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
            h.supbar.setVisibility(View.VISIBLE);
        }
        if (!isOwner) {
            h.supBtn.setVisibility(View.VISIBLE);
            h.supBtn.setOnClickListener(new View.OnClickListener() {
                @Override public void onClick(View v) { openSupportSheet(pk, owner); }
            });
        }
    }

    protected int col(String hex) { try { return Color.parseColor(hex); } catch (Exception e) { return GOLD; } }

    // حالة نافذة الهدايا الحالية
    protected String sPost, sOwner;
    protected boolean sShirts = false, sBusy = false;
    protected int sSel = 0, sCombo = 0, sQty = 1;
    protected long sComboNet = 0, sBalance = 0;
    protected String sNum = "10";
    protected Dialog sDlg;
    protected LinearLayout sGrid;
    protected TextView sBal, sMsg, sSend, sTabG, sTabS;
    protected EditText sNumEt;
    protected LinearLayout sNumRow, sQtyRow;
    protected EditText sQtyEt;
    protected boolean sQtyBusy = false;

    protected String[] curItem() {
        // {id, price, name, glyphOrNum, color, sub}
        if (!sShirts) { String[] g = GIFTS[Math.min(sSel, GIFTS.length - 1)]; return new String[] { g[0], g[1], T(g[2]), g[3], g[4], "" }; }
        if (sSel == 0) return new String[] { "custom", "100", L("قميصك", "Your jersey"), sNum, "#C0392B", uname == null ? "" : uname };
        String[] x = SHIRTS[Math.min(sSel - 1, SHIRTS.length - 1)];
        return new String[] { x[0], x[1], L("قميص ", "Jersey ") + x[2], x[2], x[4], T(x[3]) };
    }

    protected void flushSupportNotify() {
        if (sComboNet > 0) queueNotify("support", sOwner, sPost, null, String.valueOf(sComboNet));
        sComboNet = 0;
        sCombo = 0;
    }

    protected void openSupportSheet(String pk, String owner) {
        if (uid == null) return;
        sPost = pk; sOwner = owner; sShirts = false; sSel = 0; sQty = 1; sBusy = false; sCombo = 0; sComboNet = 0; sBalance = 0;
        final Dialog d = new Dialog(this, android.R.style.Theme_Material_NoActionBar);
        sDlg = d;
        d.getWindow().setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        d.getWindow().setGravity(Gravity.BOTTOM);
        d.getWindow().setBackgroundDrawable(new ColorDrawable(0xCC000000));
        d.getWindow().getDecorView().setLayoutDirection(View.LAYOUT_DIRECTION_RTL);
        d.setOnDismissListener(new DialogInterface.OnDismissListener() {
            @Override public void onDismiss(DialogInterface x) { flushSupportNotify(); loadBalance(); }
        });
        final ScrollView sc = new ScrollView(this);
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setPadding(dp(18), dp(14), dp(18), navH() + dp(14));
        GradientDrawable pbg = new GradientDrawable();
        pbg.setColor(0xFF16161C);
        pbg.setCornerRadii(new float[] { dp(26), dp(26), dp(26), dp(26), 0, 0, 0, 0 });
        box.setBackground(pbg);

        TextView title = tv(Color.WHITE, 17, true);
        title.setText(L("أرسل هدية للكاتب", "Send a gift to the author"));
        title.setGravity(Gravity.CENTER);
        title.setPadding(0, 0, 0, dp(12));
        box.addView(title);

        LinearLayout tabs = new LinearLayout(this);
        sTabG = tv(GOLD, 14, true); sTabG.setText(L("الهدايا", "Gifts"));
        sTabS = tv(Color.WHITE, 14, true); sTabS.setText(L("القمصان", "Jerseys"));
        TextView[] tb = new TextView[] { sTabG, sTabS };
        for (int i = 0; i < 2; i++) {
            final int ti2 = i;
            tb[i].setGravity(Gravity.CENTER);
            tb[i].setPadding(0, dp(10), 0, dp(10));
            tb[i].setOnClickListener(new View.OnClickListener() {
                @Override public void onClick(View v) { flushSupportNotify(); sShirts = ti2 == 1; sSel = 0; drawSupportGrid(); updateSupport(); }
            });
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
            lp.setMargins(dp(4), 0, dp(4), 0);
            tabs.addView(tb[i], lp);
        }
        box.addView(tabs);

        sGrid = new LinearLayout(this);
        sGrid.setOrientation(LinearLayout.VERTICAL);
        sGrid.setPadding(0, dp(10), 0, dp(6));
        box.addView(sGrid);

        sNumRow = new LinearLayout(this);
        sNumRow.setGravity(Gravity.CENTER_VERTICAL);
        sNumRow.setPadding(dp(14), dp(8), dp(14), dp(8));
        GradientDrawable nbg = new GradientDrawable();
        nbg.setColor(CARD); nbg.setCornerRadius(dp(14));
        sNumRow.setBackground(nbg);
        TextView nl = tv(MUTED, 13, false);
        nl.setText(L("رقم قميصك (1 - 99)", "Your jersey number (1 - 99)"));
        sNumRow.addView(nl, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        sNumEt = new EditText(this);
        sNumEt.setInputType(android.text.InputType.TYPE_CLASS_NUMBER);
        sNumEt.setText(sNum);
        sNumEt.setTextColor(Color.WHITE);
        sNumEt.setGravity(Gravity.CENTER);
        sNumEt.setFilters(new android.text.InputFilter[] { new android.text.InputFilter.LengthFilter(2) });
        sNumEt.addTextChangedListener(new android.text.TextWatcher() {
            @Override public void beforeTextChanged(CharSequence a, int b, int c, int e) {}
            @Override public void onTextChanged(CharSequence a, int b, int c, int e) {}
            @Override public void afterTextChanged(android.text.Editable ed) {
                String v = ed.toString().replaceAll("[^0-9]", "");
                int n = 0;
                try { n = v.length() == 0 ? 0 : Integer.parseInt(v); } catch (Exception ignore) {}
                sNum = n > 0 ? String.valueOf(n) : "1";
                if (sShirts && sSel == 0) { drawSupportGrid(); updateSupport(); }
            }
        });
        sNumRow.addView(sNumEt, new LinearLayout.LayoutParams(dp(80), ViewGroup.LayoutParams.WRAP_CONTENT));
        LinearLayout.LayoutParams nlp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        nlp.setMargins(0, dp(4), 0, dp(8));
        box.addView(sNumRow, nlp);

        sQtyRow = new LinearLayout(this);
        sQtyRow.setGravity(Gravity.CENTER_VERTICAL);
        sQtyRow.setPadding(dp(12), dp(6), dp(12), dp(6));
        GradientDrawable qbg = new GradientDrawable();
        qbg.setColor(CARD); qbg.setCornerRadius(dp(14));
        sQtyRow.setBackground(qbg);
        TextView ql = tv(MUTED, 13, false);
        ql.setText(L("العدد", "Quantity"));
        sQtyRow.addView(ql, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        int[] qs = new int[] { 10, 5, 1 };
        for (int qi = 0; qi < qs.length; qi++) {
            final int qv = qs[qi];
            TextView ch = tv(0xFFCFD4F3, 12, false);
            ch.setText("×" + qv);
            ch.setGravity(Gravity.CENTER);
            GradientDrawable chg = new GradientDrawable();
            chg.setCornerRadius(dp(20)); chg.setStroke(dp(1), 0xFF3A4378);
            ch.setBackground(chg);
            ch.setPadding(dp(10), dp(5), dp(10), dp(5));
            ch.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { setQty(qv); } });
            LinearLayout.LayoutParams chl = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            chl.setMargins(dp(3), 0, dp(3), 0);
            sQtyRow.addView(ch, chl);
        }
        TextView qplus = tv(GOLD, 22, true);
        qplus.setText("＋"); qplus.setGravity(Gravity.CENTER);
        qplus.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { setQty(sQty + 1); } });
        sQtyRow.addView(qplus, new LinearLayout.LayoutParams(dp(38), dp(38)));
        sQtyEt = new EditText(this);
        sQtyEt.setInputType(android.text.InputType.TYPE_CLASS_NUMBER);
        sQtyEt.setText("1");
        sQtyEt.setTextColor(Color.WHITE);
        sQtyEt.setGravity(Gravity.CENTER);
        sQtyEt.setFilters(new android.text.InputFilter[] { new android.text.InputFilter.LengthFilter(2) });
        sQtyEt.addTextChangedListener(new android.text.TextWatcher() {
            @Override public void beforeTextChanged(CharSequence a, int b, int c, int e) {}
            @Override public void onTextChanged(CharSequence a, int b, int c, int e) {}
            @Override public void afterTextChanged(android.text.Editable ed) {
                if (sQtyBusy) return;
                String v = ed.toString().replaceAll("[^0-9]", "");
                int n = 1;
                try { n = v.length() == 0 ? 1 : Integer.parseInt(v); } catch (Exception ignore) {}
                sQty = Math.max(1, Math.min(99, n));
                updateSupport();
            }
        });
        sQtyRow.addView(sQtyEt, new LinearLayout.LayoutParams(dp(56), ViewGroup.LayoutParams.WRAP_CONTENT));
        TextView qminus = tv(GOLD, 22, true);
        qminus.setText("－"); qminus.setGravity(Gravity.CENTER);
        qminus.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { setQty(sQty - 1); } });
        sQtyRow.addView(qminus, new LinearLayout.LayoutParams(dp(38), dp(38)));
        LinearLayout.LayoutParams qlp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        qlp.setMargins(0, dp(4), 0, dp(8));
        box.addView(sQtyRow, qlp);

        LinearLayout balRow = new LinearLayout(this);
        balRow.setGravity(Gravity.CENTER);
        sBal = tv(MUTED, 13, false);
        sBal.setGravity(Gravity.CENTER);
        balRow.addView(sBal);
        TextView topup = tv(GOLD, 13, true);
        topup.setText("＋ " + L("اشحن", "Top up"));
        GradientDrawable tg = new GradientDrawable();
        tg.setCornerRadius(dp(20)); tg.setStroke(dp(1), GOLD);
        topup.setBackground(tg);
        topup.setPadding(dp(12), dp(4), dp(12), dp(4));
        topup.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) { if (sDlg != null) sDlg.dismiss(); openStorePage(); }
        });
        LinearLayout.LayoutParams tlp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        tlp.setMargins(dp(10), 0, dp(10), 0);
        balRow.addView(topup, tlp);
        box.addView(balRow);
        sMsg = tv(MUTED, 12, false);
        sMsg.setGravity(Gravity.CENTER);
        sMsg.setPadding(0, dp(4), 0, dp(6));
        box.addView(sMsg);

        sSend = tv(NAVY, 16, true);
        sSend.setGravity(Gravity.CENTER);
        GradientDrawable sgd = new GradientDrawable();
        sgd.setColor(GOLD); sgd.setCornerRadius(dp(16));
        sSend.setBackground(sgd);
        sSend.setPadding(0, dp(15), 0, dp(15));
        sSend.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) { submitSupport(); }
        });
        box.addView(sSend);

        sc.addView(box);
        d.setContentView(sc);
        keyboardLift(d, sc);
        View.OnFocusChangeListener fcl = new View.OnFocusChangeListener() { @Override public void onFocusChange(View v, boolean f) {
            if (f) sc.postDelayed(new Runnable() { @Override public void run() { sc.fullScroll(View.FOCUS_DOWN); } }, 350);
        } };
        sNumEt.setOnFocusChangeListener(fcl);
        sQtyEt.setOnFocusChangeListener(fcl);
        d.show();
        drawSupportGrid();
        updateSupport();
        pool.execute(new Runnable() {
            @Override public void run() {
                try {
                    JSONArray a = new JSONArray(get("users?select=points&user_id=eq." + uid));
                    if (a.length() > 0) sBalance = a.getJSONObject(0).optLong("points", 0);
                } catch (Exception ignore) {}
                runOnUiThread(new Runnable() { @Override public void run() { updateSupport(); } });
            }
        });
    }

    protected void drawSupportGrid() {
        sGrid.removeAllViews();
        int n = sShirts ? SHIRTS.length + 1 : GIFTS.length;
        LinearLayout rowL = null;
        for (int i = 0; i < n; i++) {
            if (i % 3 == 0) {
                rowL = new LinearLayout(this);
                LinearLayout.LayoutParams rp2 = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
                rp2.setMargins(0, dp(4), 0, dp(4));
                sGrid.addView(rowL, rp2);
            }
            final int idx = i;
            String[] it;
            if (!sShirts) { String[] g = GIFTS[i]; it = new String[] { g[0], g[1], T(g[2]), g[3], g[4], "" }; }
            else if (i == 0) it = new String[] { "custom", "100", L("قميصك", "Your jersey"), sNum, "#C0392B", uname == null ? L("باسمك", "With your name") : uname };
            else { String[] x = SHIRTS[i - 1]; it = new String[] { x[0], x[1], L("قميص ", "Jersey ") + x[2], x[2], x[4], T(x[3]) }; }
            LinearLayout cell = new LinearLayout(this);
            cell.setOrientation(LinearLayout.VERTICAL);
            cell.setGravity(Gravity.CENTER_HORIZONTAL);
            cell.setPadding(dp(4), dp(10), dp(4), dp(8));
            GradientDrawable cg = new GradientDrawable();
            cg.setCornerRadius(dp(16));
            cg.setColor(idx == sSel ? 0x33F5C35A : CARD);
            cg.setStroke(dp(1), idx == sSel ? GOLD : 0x14FFFFFF);
            cell.setBackground(cg);
            TextView ic = tv(sShirts ? Color.WHITE : NAVY, sShirts ? 18 : 24, true);
            ic.setText(it[3]);
            ic.setGravity(Gravity.CENTER);
            GradientDrawable ig = new GradientDrawable();
            ig.setShape(GradientDrawable.OVAL);
            ig.setColor(sShirts ? col(it[4]) : 0x1FFFFFFF);
            ig.setStroke(dp(1), 0x33FFFFFF);
            ic.setBackground(ig);
            cell.addView(ic, new LinearLayout.LayoutParams(dp(54), dp(54)));
            TextView nm = tv(Color.WHITE, 13, true);
            nm.setText(it[2]);
            nm.setGravity(Gravity.CENTER);
            nm.setPadding(0, dp(5), 0, 0);
            nm.setSingleLine(true);
            cell.addView(nm);
            if (it[5].length() > 0) {
                TextView sb = tv(MUTED, 11, false);
                sb.setText(it[5]);
                sb.setGravity(Gravity.CENTER);
                sb.setSingleLine(true);
                cell.addView(sb);
            }
            TextView pr = tv(GOLD, 13, true);
            pr.setText(it[1]);
            pr.setGravity(Gravity.CENTER);
            withCoin(pr, dp(15));
            cell.addView(pr);
            cell.setOnClickListener(new View.OnClickListener() {
                @Override public void onClick(View v) { flushSupportNotify(); sSel = idx; drawSupportGrid(); updateSupport(); }
            });
            LinearLayout.LayoutParams cl = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
            cl.setMargins(dp(4), 0, dp(4), 0);
            rowL.addView(cell, cl);
        }
        int rem = n % 3;
        if (rem != 0 && rowL != null) for (int k = rem; k < 3; k++) rowL.addView(new View(this), new LinearLayout.LayoutParams(0, 1, 1f));
    }

    protected void setQty(int n) {
        sQty = Math.max(1, Math.min(99, n));
        updateSupport();
    }

    protected void updateSupport() {
        if (sDlg == null || !sDlg.isShowing()) return;
        String[] it = curItem();
        int qty = sShirts ? 1 : sQty;
        long price = Long.parseLong(it[1]) * qty;
        boolean enough = sBalance >= price;
        sTabG.setTextColor(!sShirts ? GOLD : Color.WHITE);
        sTabS.setTextColor(sShirts ? GOLD : Color.WHITE);
        sNumRow.setVisibility(sShirts && sSel == 0 ? View.VISIBLE : View.GONE);
        sQtyRow.setVisibility(sShirts ? View.GONE : View.VISIBLE);
        if (!sShirts && !String.valueOf(sQty).equals(sQtyEt.getText().toString())) {
            sQtyBusy = true; sQtyEt.setText(String.valueOf(sQty)); sQtyEt.setSelection(sQtyEt.getText().length()); sQtyBusy = false;
        }
        sBal.setText(L("رصيدك الحالي: ", "Your current balance: ") + nfmt(sBalance) + " ZELO");
        sMsg.setText(enough ? (sCombo > 1 ? "" : (sShirts ? L("اضغط أكثر من مرة لتكرار الهدية", "Tap multiple times to repeat the gift") : L("الحد الأقصى 99 هدية في المرة", "Max 99 gifts at a time"))) : L("رصيدك لا يكفي لهذه الهدية", "Your balance isn't enough for this gift"));
        sMsg.setTextColor(enough ? MUTED : 0xFFFF6B6B);
        sSend.setText(L("أرسل ", "Send ") + (qty > 1 ? qty + " " : "") + it[2] + ("custom".equals(it[0]) ? " " + it[3] : "") + " · " + price + " ZELO");
        sSend.setAlpha(!enough || sBusy ? 0.45f : 1f);
    }

    protected void submitSupport() {
        if (sBusy) return;
        final String[] it = curItem();
        final long price = Long.parseLong(it[1]);
        final int qty = sShirts ? 1 : sQty;
        if (sBalance < price * qty) return;
        sBusy = true;
        updateSupport();
        pool.execute(new Runnable() {
            @Override public void run() {
                String err = null;
                long net = 0;
                int done = 0;
                for (int k = 0; k < qty; k++) {
                    try {
                        JSONObject b = new JSONObject();
                        b.put("p_from_user_id", uid);
                        b.put("p_from_name", uname == null ? "" : uname);
                        b.put("p_post_id", Long.parseLong(sPost));
                        b.put("p_amount", price);
                        b.put("p_gift_id", it[0]);
                        String res = rpc("support_post", b.toString());
                        long n1 = price;
                        try { JSONObject r = new JSONObject(res); if (!r.isNull("net")) n1 = r.optLong("net", price); } catch (Exception ignore) {}
                        net += n1;
                        done++;
                    } catch (Exception e) { err = String.valueOf(e.getMessage()); break; }
                }
                try {
                    JSONArray a = new JSONArray(get("users?select=points&user_id=eq." + uid));
                    if (a.length() > 0) sBalance = a.getJSONObject(0).optLong("points", sBalance);
                } catch (Exception ignore) {}
                try { loadSupportStats(sPost); } catch (Exception ignore) {}
                final String fe = err;
                final long fnet = net;
                final int fdone = done;
                runOnUiThread(new Runnable() {
                    @Override public void run() {
                        sBusy = false;
                        if (fdone > 0) {
                            sCombo += fdone;
                            sComboNet += fnet;
                            toast("🎁 " + it[2] + (fdone > 1 ? " ×" + fdone : ""));
                        }
                        if (fe != null) {
                            String m = L("تعذّر الدعم، حاول لاحقًا", "Could not support, try again later");
                            if (fe.contains("insufficient_balance")) m = L("رصيدك لا يكفي", "Your balance isn't enough");
                            else if (fe.contains("daily_limit")) m = L("وصلت إلى حد الدعم اليومي", "You reached the daily support limit");
                            else if (fe.contains("own_post")) m = L("لا يمكنك دعم منشورك", "You can't support your own post");
                            else if (fe.contains("invalid_gift")) m = L("هذه الهدية غير متاحة، حدّث التطبيق", "This gift is unavailable, update the app");
                            if (qty > 1) m = m + (L(" — أُرسل ", " — sent ") + fdone + "/" + qty);
                            toast(m);
                        }
                        updateSupport();
                    }
                });
            }
        });
    }

    protected void openSupporters(final String pk, final String owner) {
        final Dialog d = new Dialog(this, android.R.style.Theme_Material_NoActionBar);
        d.getWindow().setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        d.getWindow().setGravity(Gravity.BOTTOM);
        d.getWindow().setBackgroundDrawable(new ColorDrawable(0xCC000000));
        d.getWindow().getDecorView().setLayoutDirection(View.LAYOUT_DIRECTION_RTL);
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setPadding(dp(18), dp(14), dp(18), navH() + dp(10));
        GradientDrawable pbg = new GradientDrawable();
        pbg.setColor(0xFF16161C);
        pbg.setCornerRadii(new float[] { dp(26), dp(26), dp(26), dp(26), 0, 0, 0, 0 });
        box.setBackground(pbg);
        TextView title = tv(Color.WHITE, 18, true);
        title.setText(L("الداعمون", "Supporters"));
        box.addView(title);
        final TextView count = tv(MUTED, 12, false);
        count.setText(" ");
        box.addView(count);
        final TextView total = tv(GOLD, 16, true);
        total.setPadding(0, dp(8), 0, dp(8));
        box.addView(total);
        final ScrollView sv2 = new ScrollView(this);
        final LinearLayout list = new LinearLayout(this);
        list.setOrientation(LinearLayout.VERTICAL);
        TextView ld = tv(MUTED, 14, false);
        ld.setText("");
        ld.setGravity(Gravity.CENTER);
        ld.setPadding(0, dp(24), 0, dp(24));
        list.addView(ld);
        sv2.addView(list);
        box.addView(sv2, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(320)));
        if (!owner.equals(uid)) {
            TextView go = tv(NAVY, 15, true);
            go.setText(L("ادعم هذا المنشور", "Support this post"));
            go.setGravity(Gravity.CENTER);
            GradientDrawable gg = new GradientDrawable();
            gg.setColor(GOLD); gg.setCornerRadius(dp(16));
            go.setBackground(gg);
            go.setPadding(0, dp(14), 0, dp(14));
            go.setOnClickListener(new View.OnClickListener() {
                @Override public void onClick(View v) { d.dismiss(); openSupportSheet(pk, owner); }
            });
            LinearLayout.LayoutParams glp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            glp.setMargins(0, dp(10), 0, 0);
            box.addView(go, glp);
        }
        d.setContentView(box);
        d.show();
        pool.execute(new Runnable() {
            @Override public void run() {
                final List<String[]> rows = new ArrayList<String[]>();
                String err = null;
                try {
                    JSONArray a = new JSONArray(rpc("support_supporters", "{\"p_post_id\":" + pk + ",\"p_limit\":50}"));
                    Map<String, String> names = new HashMap<String, String>();
                    StringBuilder ids = new StringBuilder();
                    for (int i = 0; i < a.length(); i++) { if (ids.length() > 0) ids.append(","); ids.append(a.getJSONObject(i).optString("from_user_id")); }
                    if (ids.length() > 0) {
                        try {
                            JSONArray pp = new JSONArray(get("public_profiles?select=user_id,nickname,username&user_id=in.(" + ids + ")"));
                            for (int i = 0; i < pp.length(); i++) {
                                JSONObject p = pp.getJSONObject(i);
                                String nn = p.isNull("nickname") ? "" : p.optString("nickname", "");
                                if (nn.length() == 0) nn = p.isNull("username") ? "" : p.optString("username", "");
                                if (nn.length() > 0) names.put(p.optString("user_id"), nn);
                            }
                        } catch (Exception ignore) {}
                    }
                    for (int i = 0; i < a.length(); i++) {
                        JSONObject r = a.getJSONObject(i);
                        String uidr = r.optString("from_user_id");
                        String nm = names.containsKey(uidr) ? names.get(uidr) : r.optString("from_name", "مستخدم");
                        rows.add(new String[] { nm, String.valueOf(r.optLong("total_amount")), String.valueOf(r.optInt("times")) });
                    }
                } catch (Exception e) { err = String.valueOf(e.getMessage()); }
                long[] st = sup.get(pk);
                final long tn = st == null ? 0 : st[0];
                final long cn = st == null ? rows.size() : st[1];
                final boolean bad = err != null;
                runOnUiThread(new Runnable() {
                    @Override public void run() {
                        list.removeAllViews();
                        if (bad) {
                            TextView e1 = tv(MUTED, 14, false); e1.setText(T("تعذّر التحميل")); e1.setGravity(Gravity.CENTER); e1.setPadding(0, dp(24), 0, dp(24)); list.addView(e1); return;
                        }
                        if (rows.isEmpty()) {
                            TextView e1 = tv(MUTED, 14, false); e1.setText(L("لا يوجد داعمون بعد\nكن أول من يدعم", "No supporters yet\nBe the first to support")); e1.setGravity(Gravity.CENTER); e1.setPadding(0, dp(24), 0, dp(24)); list.addView(e1);
                            count.setText(L("عدد الدعم 0", "Support count 0"));
                            return;
                        }
                        count.setText(L("عدد الدعم ", "Support count ") + kfmt(cn));
                        total.setText(L("إجمالي الدعم: ", "Total support: ") + nfmt(tn) + " ZELO");
                        int[] rk = new int[] { 0xFFFFD978, 0xFFD9DEE7, 0xFFD9975B };
                        for (int i = 0; i < rows.size(); i++) {
                            String[] r = rows.get(i);
                            LinearLayout line = new LinearLayout(this_());
                            line.setGravity(Gravity.CENTER_VERTICAL);
                            line.setPadding(0, dp(10), 0, dp(10));
                            TextView rank = tv(i < 3 ? NAVY : MUTED, 12, true);
                            rank.setText(String.valueOf(i + 1));
                            rank.setGravity(Gravity.CENTER);
                            rank.setBackground(oval(i < 3 ? rk[i] : 0x1FFFFFFF, 0x00000000));
                            line.addView(rank, new LinearLayout.LayoutParams(dp(24), dp(24)));
                            LinearLayout mid = new LinearLayout(this_());
                            mid.setOrientation(LinearLayout.VERTICAL);
                            mid.setPadding(dp(10), 0, dp(10), 0);
                            TextView nm = tv(Color.WHITE, 15, true);
                            nm.setText(r[0]);
                            nm.setSingleLine(true);
                            mid.addView(nm);
                            TextView sb = tv(MUTED, 12, false);
                            sb.setText(nfmt(Long.parseLong(r[1])) + " ZELO · " + r[2] + L(" مرة", " times"));
                            mid.addView(sb);
                            line.addView(mid, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
                            list.addView(line);
                        }
                    }
                });
            }
        });
    }
    protected Context this_() { return this; }

}
