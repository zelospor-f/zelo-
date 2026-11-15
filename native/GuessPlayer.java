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

abstract class GuessPlayer extends Index {
    // ===== من guess-player.js: لعبة «خمّن اللاعب» (لغز جديد كل يوم) =====
    // السيرفر هو المرجع: الجواب الصحيح لا يصل إلا بعد انتهاء اللغز
    // دوال Supabase: guess_today, guess_hint, guess_answer, guess_leaderboard
    protected JSONObject gpSt = null;
    protected boolean gpBusy = false;
    protected LinearLayout gpBody;
    protected Dialog gpDialog;
    protected EditText gpInput;
    protected TextView gpMsg;
    protected String gpPendingMsg = null;

    protected String gpLang() { return isAr() ? "ar" : "en"; }

    // يعيد JSONObject أو JSONArray؛ وإن جاء فيه error يرمي استثناء
    protected Object gpCall(String fn, JSONObject args) throws Exception {
        String r = rpc(fn, args == null ? "{}" : args.toString()).trim();
        if (r.startsWith("[")) return new JSONArray(r);
        if (r.length() == 0 || r.equals("null")) return new JSONObject();
        JSONObject o = new JSONObject(r);
        if (o.has("error") && !o.isNull("error")) throw new Exception(o.optString("error"));
        return o;
    }

    protected void openGuessPlayer() {
        if (uid == null) { toast(L("سجّل الدخول أولاً أو حاول لاحقاً", "Sign in first or try later")); return; }
        closeGuessPlayer();
        gpSt = null; gpBusy = false;
        gpDialog = sheetDialog(true);
        ScrollView sc = new ScrollView(this);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(16), statusH() + dp(6), dp(16), navH() + dp(40));
        root.addView(backBtn(new Runnable() { @Override public void run() { closeGuessPlayer(); } }));
        TextView h = tv(GOLD, 22, true);
        h.setText("🕵️ " + L("خمّن اللاعب", "Guess the Player"));
        h.setPadding(0, dp(10), 0, dp(2));
        root.addView(h);
        TextView sub = tv(MUTED, 13, false);
        sub.setText(L("لغز جديد كل يوم · كلما قلّت التلميحات زادت نقاطك", "New puzzle every day · fewer hints, more points"));
        sub.setPadding(0, 0, 0, dp(12));
        root.addView(sub);
        gpBody = new LinearLayout(this);
        gpBody.setOrientation(LinearLayout.VERTICAL);
        TextView ld = tv(MUTED, 22, false);
        ld.setText("⏳");
        ld.setGravity(Gravity.CENTER);
        ld.setPadding(0, dp(30), 0, dp(30));
        gpBody.addView(ld);
        root.addView(gpBody);
        sc.addView(root);
        gpDialog.setContentView(sc);
        gpDialog.show();
        pool.execute(new Runnable() {
            @Override public void run() {
                try {
                    final JSONObject s = (JSONObject) gpCall("guess_today", new JSONObject().put("p_lang", gpLang()));
                    runOnUiThread(new Runnable() { @Override public void run() { gpSt = s; gpRender(); } });
                } catch (Exception e) {
                    runOnUiThread(new Runnable() {
                        @Override public void run() {
                            if (gpBody == null) return;
                            gpBody.removeAllViews();
                            TextView m = tv(MUTED, 13, false);
                            m.setText(L("سجّل الدخول أولاً أو حاول لاحقاً", "Sign in first or try later"));
                            m.setGravity(Gravity.CENTER);
                            m.setPadding(0, dp(30), 0, dp(30));
                            gpBody.addView(m);
                        }
                    });
                }
            }
        });
    }

    protected void closeGuessPlayer() {
        if (gpDialog != null) { try { gpDialog.dismiss(); } catch (Exception ignore) {} }
        gpDialog = null; gpBody = null; gpInput = null; gpMsg = null;
    }

    protected GradientDrawable gpBtnBg(boolean ghost) {
        GradientDrawable g;
        if (ghost) {
            g = new GradientDrawable();
            g.setColor(0x00000000);
            g.setStroke(dp(2), 0x73F5C35A);
        } else {
            g = new GradientDrawable(GradientDrawable.Orientation.LEFT_RIGHT, new int[] { 0xFF2C4BB5, 0xFF14206B, 0xFFF5C35A });
        }
        g.setCornerRadius(dp(14));
        return g;
    }

    protected TextView gpBtn(String text, boolean ghost, boolean enabled) {
        TextView b = tv(ghost ? GOLD : Color.WHITE, 15, true);
        b.setText(text);
        b.setGravity(Gravity.CENTER);
        b.setBackground(gpBtnBg(ghost));
        b.setPadding(dp(12), dp(12), dp(12), dp(12));
        b.setAlpha(enabled ? 1f : 0.5f);
        b.setEnabled(enabled);
        return b;
    }

    protected void gpRender() {
        if (gpBody == null || gpSt == null) return;
        final JSONObject st = gpSt;
        gpBody.removeAllViews();
        String status = st.optString("status", "playing");
        boolean over = !status.equals("playing");
        JSONArray hints = st.optJSONArray("hints");
        int hintsUsed = st.optInt("hints_used", 0);
        boolean canHint = !over && hintsUsed < 4;
        int left = st.optInt("max_wrong", 0) - st.optInt("wrong", 0);

        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(dp(14), dp(14), dp(14), dp(14));
        GradientDrawable cg = new GradientDrawable();
        cg.setColor(0xFF111A4A);
        cg.setCornerRadius(dp(18));
        cg.setStroke(dp(1), 0x73F5C35A);
        card.setBackground(cg);

        LinearLayout pts = new LinearLayout(this);
        pts.setGravity(Gravity.CENTER_VERTICAL);
        TextView pl = tv(MUTED, 13, false);
        pl.setText(over ? L("نتيجتك اليوم", "Your score today") : L("نقاط هذا اللغز", "Points for this puzzle"));
        pts.addView(pl, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        TextView pv = tv(GOLD, 19, true);
        pv.setText((over ? st.optInt("score", 0) : st.optInt("potential", 0)) + " / 10");
        pts.addView(pv);
        card.addView(pts);

        TextView av = tv(GOLD, 40, true);
        av.setText(over && status.equals("solved") ? "⚽" : "؟");
        av.setGravity(Gravity.CENTER);
        GradientDrawable ag = new GradientDrawable(GradientDrawable.Orientation.TL_BR, new int[] { 0xFF2C4BB5, 0xFF14206B });
        ag.setShape(GradientDrawable.OVAL);
        ag.setStroke(dp(2), GOLD);
        av.setBackground(ag);
        LinearLayout.LayoutParams alp = new LinearLayout.LayoutParams(dp(92), dp(92));
        alp.gravity = Gravity.CENTER_HORIZONTAL;
        alp.setMargins(0, dp(12), 0, dp(12));
        card.addView(av, alp);

        if (hints != null) {
            for (int i = 0; i < hints.length(); i++) {
                LinearLayout hr = new LinearLayout(this);
                hr.setGravity(Gravity.CENTER_VERTICAL);
                hr.setPadding(dp(10), dp(10), dp(10), dp(10));
                GradientDrawable hg = new GradientDrawable();
                hg.setColor(0x0FFFFFFF);
                hg.setCornerRadius(dp(12));
                hr.setBackground(hg);
                TextView num = tv(NAVY, 12, true);
                num.setText(String.valueOf(i + 1));
                num.setGravity(Gravity.CENTER);
                num.setBackground(oval(GOLD, 0));
                hr.addView(num, new LinearLayout.LayoutParams(dp(24), dp(24)));
                TextView ht = tv(Color.WHITE, 14, false);
                ht.setText(hints.optString(i));
                ht.setPadding(dp(10), 0, dp(10), 0);
                hr.addView(ht, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
                LinearLayout.LayoutParams hlp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
                hlp.setMargins(0, dp(8), 0, 0);
                card.addView(hr, hlp);
            }
        }

        gpInput = null; gpMsg = null;
        if (over) {
            TextView rb = tv(status.equals("solved") ? 0xFF2DE2C4 : 0xFFFF6B86, 16, true);
            rb.setGravity(Gravity.CENTER);
            rb.setPadding(0, dp(10), 0, 0);
            if (status.equals("solved")) rb.setText("✅ " + L("أحسنت! اللاعب هو", "Correct! The player is") + " " + st.optString("answer", "") + "\n" + L("نقاط اللغز", "Score") + ": " + st.optInt("score", 0) + "/10 · +1 " + L("كورة", "Kora"));
            else rb.setText("❌ " + L("انتهت محاولاتك. اللاعب هو", "Out of tries. The player is") + " " + st.optString("answer", ""));
            card.addView(rb);
        } else {
            gpInput = new EditText(this);
            gpInput.setHint(L("اكتب اسم اللاعب…", "Type the player name…"));
            gpInput.setHintTextColor(MUTED);
            gpInput.setTextColor(Color.WHITE);
            gpInput.setTextSize(16);
            gpInput.setSingleLine(true);
            gpInput.setFilters(new android.text.InputFilter[] { new android.text.InputFilter.LengthFilter(60) });
            gpInput.setImeOptions(android.view.inputmethod.EditorInfo.IME_ACTION_DONE);
            gpInput.setPadding(dp(12), dp(12), dp(12), dp(12));
            GradientDrawable ig = new GradientDrawable();
            ig.setColor(0x0DFFFFFF);
            ig.setCornerRadius(dp(12));
            ig.setStroke(dp(2), 0x73F5C35A);
            gpInput.setBackground(ig);
            gpInput.setOnEditorActionListener(new TextView.OnEditorActionListener() {
                @Override public boolean onEditorAction(TextView v, int actionId, android.view.KeyEvent e) { gpSubmit(); return true; }
            });
            LinearLayout.LayoutParams ilp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            ilp.setMargins(0, dp(12), 0, 0);
            card.addView(gpInput, ilp);
            LinearLayout row = new LinearLayout(this);
            TextView go = gpBtn(L("تأكيد", "Submit"), false, true);
            go.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { gpSubmit(); } });
            TextView hb = gpBtn(canHint ? L("تلميح (-2)", "Hint (-2)") : L("لا مزيد", "No more"), true, canHint);
            if (canHint) hb.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { gpHint(); } });
            LinearLayout.LayoutParams b1 = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
            b1.setMargins(0, 0, dp(4), 0);
            LinearLayout.LayoutParams b2 = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
            b2.setMargins(dp(4), 0, 0, 0);
            row.addView(go, b1);
            row.addView(hb, b2);
            LinearLayout.LayoutParams rlp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            rlp.setMargins(0, dp(10), 0, 0);
            card.addView(row, rlp);
            gpMsg = tv(MUTED, 13, false);
            gpMsg.setGravity(Gravity.CENTER);
            gpMsg.setText(L("المحاولات المتبقية", "Tries left") + ": " + left);
            gpMsg.setPadding(0, dp(10), 0, 0);
            card.addView(gpMsg);
            if (gpPendingMsg != null) { gpMsg.setTextColor(0xFFFF6B86); gpMsg.setText(gpPendingMsg); gpPendingMsg = null; }
        }
        LinearLayout.LayoutParams clp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        clp.setMargins(0, 0, 0, dp(12));
        gpBody.addView(card, clp);

        if (over) {
            TextView sh = gpBtn("📤 " + L("شارك نتيجتك", "Share your result"), true, true);
            sh.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { gpShare(); } });
            gpBody.addView(sh, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
            TextView nx = tv(MUTED, 13, false);
            nx.setText(L("لغز جديد غداً 🌙", "A new puzzle tomorrow 🌙"));
            nx.setGravity(Gravity.CENTER);
            nx.setPadding(0, dp(10), 0, dp(12));
            gpBody.addView(nx);
        }

        LinearLayout lbCard = new LinearLayout(this);
        lbCard.setOrientation(LinearLayout.VERTICAL);
        lbCard.setPadding(dp(14), dp(14), dp(14), dp(14));
        lbCard.setBackground(cg);
        TextView lt = tv(Color.WHITE, 15, true);
        lt.setText("🏆 " + L("أسرع المخمّنين اليوم", "Today's top guessers"));
        lt.setPadding(0, 0, 0, dp(6));
        lbCard.addView(lt);
        final LinearLayout lbList = new LinearLayout(this);
        lbList.setOrientation(LinearLayout.VERTICAL);
        TextView lw = tv(MUTED, 13, false);
        lw.setText("…");
        lbList.addView(lw);
        lbCard.addView(lbList);
        gpBody.addView(lbCard);
        gpLoadBoard(lbList);
    }

    protected void gpLoadBoard(final LinearLayout lb) {
        pool.execute(new Runnable() {
            @Override public void run() {
                JSONArray rows = null;
                try { Object o = gpCall("guess_leaderboard", null); if (o instanceof JSONArray) rows = (JSONArray) o; } catch (Exception ignore) {}
                final JSONArray fr = rows;
                runOnUiThread(new Runnable() {
                    @Override public void run() {
                        lb.removeAllViews();
                        if (fr == null) { TextView e = tv(MUTED, 13, false); e.setText("—"); lb.addView(e); return; }
                        if (fr.length() == 0) { TextView e = tv(MUTED, 13, false); e.setText(L("كن أول من يحل لغز اليوم!", "Be the first to solve today!")); lb.addView(e); return; }
                        for (int i = 0; i < fr.length(); i++) {
                            JSONObject r = fr.optJSONObject(i);
                            if (r == null) continue;
                            LinearLayout row = new LinearLayout(this_());
                            row.setPadding(0, dp(8), 0, dp(8));
                            TextView nm = tv(Color.WHITE, 14, false);
                            nm.setText((i + 1) + ". " + r.optString("name", ""));
                            row.addView(nm, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
                            TextView sc = tv(GOLD, 14, true);
                            sc.setText(String.valueOf((long) r.optDouble("score", 0)));
                            row.addView(sc);
                            lb.addView(row);
                        }
                    }
                });
            }
        });
    }

    protected GuessPlayer this_() { return this; }

    protected void gpHint() {
        if (gpBusy) return;
        gpBusy = true;
        pool.execute(new Runnable() {
            @Override public void run() {
                JSONObject s = null;
                try { s = (JSONObject) gpCall("guess_hint", new JSONObject().put("p_lang", gpLang())); } catch (Exception ignore) {}
                final JSONObject fs = s;
                runOnUiThread(new Runnable() {
                    @Override public void run() {
                        gpBusy = false;
                        if (fs == null) { toast(L("تعذّر جلب التلميح", "Could not get hint")); return; }
                        gpSt = fs;
                        gpRender();
                    }
                });
            }
        });
    }

    protected void gpSubmit() {
        final String v = gpInput == null ? "" : gpInput.getText().toString().trim();
        if (v.length() < 2) { toast(L("اكتب اسم اللاعب", "Type a name")); return; }
        if (gpBusy) return;
        gpBusy = true;
        pool.execute(new Runnable() {
            @Override public void run() {
                JSONObject r = null;
                String err = null;
                try { r = (JSONObject) gpCall("guess_answer", new JSONObject().put("p_text", v).put("p_lang", gpLang())); }
                catch (Exception e) { err = String.valueOf(e.getMessage()); }
                final JSONObject fr = r;
                final String fe = err;
                runOnUiThread(new Runnable() {
                    @Override public void run() {
                        gpBusy = false;
                        if (fr == null) {
                            toast(fe != null && fe.indexOf("bad_input") >= 0 ? L("الاسم غير صالح", "Invalid name") : L("تعذّر الإرسال", "Could not send"));
                            return;
                        }
                        gpSt = fr;
                        String res = fr.optString("result", "");
                        if (res.equals("wrong") && fr.optString("status", "").equals("playing"))
                            gpPendingMsg = L("إجابة خاطئة، حاول مرة أخرى. المتبقي: ", "Wrong. Tries left: ") + (fr.optInt("max_wrong", 0) - fr.optInt("wrong", 0));
                        gpRender();
                        if (res.equals("correct")) toast("✅ +1 " + L("كورة", "Kora"));
                    }
                });
            }
        });
    }

    protected void gpShare() {
        if (gpSt == null) return;
        int used = gpSt.optInt("hints_used", 0);
        StringBuilder sq = new StringBuilder();
        if (gpSt.optString("status", "").equals("solved")) {
            for (int i = 0; i < Math.max(1, 5 - used); i++) sq.append("🟩");
            for (int i = 0; i < used; i++) sq.append("⬜");
        } else sq.append("🟥");
        String text = "🕵️ " + L("خمّن اللاعب في ZELO Sport", "Guess the Player on ZELO Sport") + "\n" + sq + " " + gpSt.optInt("score", 0) + "/10\n" + L("هل تستطيع التفوق عليّ؟", "Can you beat me?") + "\nhttps://t.me/ZeloSport";
        try {
            Intent i = new Intent(Intent.ACTION_SEND);
            i.setType("text/plain");
            i.putExtra(Intent.EXTRA_TEXT, text);
            startActivity(Intent.createChooser(i, null));
        } catch (Exception e) { toast(L("تعذّرت المشاركة", "Could not share")); }
    }
}
