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


abstract class Auth extends Badges {
    protected abstract void showLoginScreen(Runnable done);
    // ===== من auth.js: تسجيل الدخول (كلمة سر + بريد/اسم مستخدم + رمز تحقق + Google) =====
    // الشاشات: login | email (تسجيل جديد) | forgot | code | newpass | setup
    protected static final String LOGO_URL = "https://raw.githubusercontent.com/zelospor-f/zelo-/main/zelo-coin.png";
    protected static final String AUTH_REDIRECT = "com.zelosport.app://login-callback";
    protected static final int MIN_AGE = 18, MIN_PASS = 6;

    protected Dialog authDlg;
    protected FrameLayout authRoot;
    protected String aStep = "login", aFlow = "signup", aEmail = "";
    protected boolean aBusy = false, aUserOk = false;
    protected int aResendLeft = 0;
    protected String aRefresh = "";
    protected Runnable aDone = null;
    protected final android.os.Handler aH = new android.os.Handler();
    protected Runnable aResendTick, aUserCheck;
    protected EditText fId, fPass, fPass2, fEmail, fCode, fUser;
    protected TextView aMsg, aNext, aResendV, aUMsg, aPMsg, aDMsg;
    protected android.widget.Spinner spD, spM, spY;
    protected TextView dobField;

    // ---------- الجلسة المحفوظة ----------
    protected void saveSession(String access, String refresh, String id, String mail) {
        token = access; uid = id; aRefresh = refresh;
        getSharedPreferences("zn_auth", MODE_PRIVATE).edit().putString("access", access).putString("refresh", refresh).putString("uid", id).putString("email", mail == null ? "" : mail).apply();
    }

    protected void clearSession() {
        getSharedPreferences("zn_auth", MODE_PRIVATE).edit().clear().apply();
        token = null; aRefresh = "";
    }

    // يعيد true إذا وُجدت جلسة محفوظة (ويجدّد الرمز إن لزم)
    protected boolean restoreSession() {
        SharedPreferences sp = getSharedPreferences("zn_auth", MODE_PRIVATE);
        String a = sp.getString("access", ""), r = sp.getString("refresh", ""), i = sp.getString("uid", "");
        if (a.length() == 0 || i.length() == 0) return false;
        token = a; uid = i; aRefresh = r;
        return true;
    }

    protected boolean refreshSession() {
        if (aRefresh == null || aRefresh.length() == 0) return false;
        try {
            JSONObject b = new JSONObject().put("refresh_token", aRefresh);
            JSONObject r = authCall("POST", "/auth/v1/token?grant_type=refresh_token", b.toString(), null);
            if (!r.has("access_token")) return false;
            JSONObject u = r.optJSONObject("user");
            saveSession(r.optString("access_token"), r.optString("refresh_token", aRefresh), u != null ? u.optString("id", uid) : uid, u != null ? u.optString("email", "") : "");
            return true;
        } catch (Exception e) { return false; }
    }

    // ---------- اتصال GoTrue ----------
    protected JSONObject authCall(String method, String path, String body, String bearer) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(url + path).openConnection();
        c.setRequestMethod(method);
        c.setRequestProperty("apikey", key);
        c.setRequestProperty("Authorization", "Bearer " + (bearer != null ? bearer : key));
        c.setRequestProperty("Content-Type", "application/json");
        c.setConnectTimeout(15000);
        c.setReadTimeout(20000);
        if (body != null) { c.setDoOutput(true); c.getOutputStream().write(body.getBytes("UTF-8")); }
        int code = c.getResponseCode();
        InputStream is = code >= 400 ? c.getErrorStream() : c.getInputStream();
        StringBuilder sb = new StringBuilder();
        if (is != null) {
            BufferedReader r = new BufferedReader(new InputStreamReader(is, "UTF-8"));
            String ln;
            while ((ln = r.readLine()) != null) sb.append(ln);
            r.close();
        }
        String txt = sb.toString();
        JSONObject o;
        try { o = txt.length() == 0 ? new JSONObject() : new JSONObject(txt); } catch (Exception e) { o = new JSONObject(); }
        if (code >= 400) {
            String m = o.optString("error_description", o.optString("msg", o.optString("message", o.optString("error", "HTTP " + code))));
            throw new Exception(m);
        }
        return o;
    }

    protected JSONObject loadUserRow(String id) {
        try {
            JSONArray a = new JSONArray(get("users?select=*&user_id=eq." + id + "&limit=1"));
            return a.length() > 0 ? a.getJSONObject(0) : null;
        } catch (Exception e) { return null; }
    }

    // ---------- الواجهة ----------
    protected void showAuth(Runnable done) {
        aDone = done;
        aStep = "login"; aFlow = "signup";
        if (authDlg == null) {
            authDlg = sheetDialog(true);
            authDlg.setCancelable(false);
            authDlg.getWindow().setBackgroundDrawable(new ColorDrawable(NAVY));
            authRoot = new FrameLayout(this);
            authDlg.setContentView(authRoot);
            authDlg.show();
        }
        authDraw();
    }

    protected void closeAuth() {
        try { if (authDlg != null) authDlg.dismiss(); } catch (Exception ignore) {}
        authDlg = null;
        if (aResendTick != null) aH.removeCallbacks(aResendTick);
    }

    protected EditText aField(LinearLayout col, String label, int inputType, boolean ltr) {
        LinearLayout f = new LinearLayout(this);
        f.setOrientation(LinearLayout.VERTICAL);
        f.setPadding(dp(14), dp(8), dp(14), dp(8));
        GradientDrawable g = new GradientDrawable();
        g.setColor(CARD); g.setCornerRadius(dp(14)); g.setStroke(dp(1), 0x40F5C35A);
        f.setBackground(g);
        TextView l = tv(MUTED, 11, true);
        l.setText(label);
        f.addView(l);
        EditText e = new EditText(this);
        e.setTextColor(Color.WHITE);
        e.setTextSize(16);
        e.setTypeface(Typeface.DEFAULT_BOLD);
        e.setBackground(null);
        e.setPadding(0, dp(4), 0, dp(4));
        e.setSingleLine(true);
        e.setInputType(inputType);
        if (ltr) { e.setTextDirection(View.TEXT_DIRECTION_LTR); e.setGravity(Gravity.START); }
        f.addView(e);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        lp.setMargins(0, 0, 0, dp(10));
        col.addView(f, lp);
        return e;
    }

    protected TextView aButton(String text, boolean primary) {
        TextView b = tv(primary ? NAVY : Color.WHITE, 16, true);
        b.setText(text);
        b.setGravity(Gravity.CENTER);
        GradientDrawable g = new GradientDrawable();
        g.setCornerRadius(dp(30));
        if (primary) g.setColor(GOLD); else { g.setColor(0x00000000); g.setStroke(dp(2), 0x73F5C35A); }
        b.setBackground(g);
        b.setPadding(dp(10), dp(14), dp(10), dp(14));
        return b;
    }

    protected TextView aLink(String text) {
        TextView l = tv(GOLD, 13, true);
        l.setText(text);
        l.setGravity(Gravity.CENTER);
        l.setPadding(0, dp(12), 0, dp(4));
        return l;
    }

    protected void aSetMsg(String t, boolean bad, boolean ok) {
        if (aMsg == null) return;
        aMsg.setText(t == null ? "" : t);
        aMsg.setTextColor(bad ? 0xFFFF6B6B : ok ? 0xFF14F195 : MUTED);
    }

    protected void aEnable(boolean on) {
        if (aNext == null) return;
        boolean e = on && !aBusy;
        aNext.setAlpha(e ? 1f : 0.4f);
        aNext.setEnabled(e);
    }

    protected android.text.TextWatcher aWatch(final Runnable r) {
        return new android.text.TextWatcher() {
            @Override public void beforeTextChanged(CharSequence s, int a, int b, int c) {}
            @Override public void onTextChanged(CharSequence s, int a, int b, int c) {}
            @Override public void afterTextChanged(android.text.Editable e) { r.run(); }
        };
    }

    protected void authDraw() {
        authRoot.removeAllViews();
        ScrollView sc = new ScrollView(this);
        sc.setFillViewport(true);
        LinearLayout col = new LinearLayout(this);
        col.setOrientation(LinearLayout.VERTICAL);
        col.setPadding(dp(20), statusH() + dp(6), dp(20), navH() + dp(16));
        sc.addView(col, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        authRoot.addView(sc);
        aMsg = tv(MUTED, 13, true);
        aMsg.setPadding(0, 0, 0, dp(8));
        aUMsg = null; aPMsg = null; aDMsg = null; aResendV = null;
        fId = null; fPass = null; fPass2 = null; fEmail = null; fCode = null; fUser = null;

        if ("login".equals(aStep)) {
            ImageView lg = new ImageView(this);
            lg.setScaleType(ImageView.ScaleType.CENTER_CROP);
            loadImage(LOGO_URL, lg);
            LinearLayout.LayoutParams lgp = new LinearLayout.LayoutParams(dp(64), dp(64));
            lgp.gravity = Gravity.CENTER_HORIZONTAL;
            lgp.setMargins(0, dp(30), 0, dp(12));
            col.addView(lg, lgp);
            aTitle(col, L("سجّل الدخول إلى Zelo Sport", "Sign in to Zelo Sport"), L("أدخل اسم المستخدم أو البريد الإلكتروني وكلمة السر.", "Enter your username or email and password."));
            fId = aField(col, L("اسم المستخدم أو البريد الإلكتروني", "Username or email"), android.text.InputType.TYPE_CLASS_TEXT | android.text.InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS, true);
            fId.setText(getSharedPreferences("zn_auth", MODE_PRIVATE).getString("last_id", ""));
            fPass = aField(col, L("كلمة السر", "Password"), android.text.InputType.TYPE_CLASS_TEXT | android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD, true);
            TextView fg = tv(GOLD, 13, true);
            fg.setText(L("هل نسيت كلمة السر؟", "Forgot your password?"));
            fg.setPadding(0, 0, 0, dp(10));
            fg.setOnClickListener(new View.OnClickListener() {
                @Override public void onClick(View v) {
                    aFlow = "reset"; aStep = "forgot";
                    String id = fId.getText().toString().trim();
                    if (id.contains("@")) aEmail = id.toLowerCase();
                    authDraw();
                }
            });
            col.addView(fg);
            col.addView(new View(this), new LinearLayout.LayoutParams(1, 0, 1f));
            col.addView(aMsg);
            aNext = aButton(L("تسجيل الدخول", "Sign in"), true);
            col.addView(aNext, aBtnLp());
            TextView su = aButton(L("إنشاء حساب عبر البريد الإلكتروني", "Create account with email"), false);
            su.setOnClickListener(new View.OnClickListener() {
                @Override public void onClick(View v) { aFlow = "signup"; aStep = "email"; authDraw(); }
            });
            col.addView(su, aBtnLp());
            TextView or = tv(MUTED, 12, true);
            or.setText(L("— أو —", "— or —"));
            or.setGravity(Gravity.CENTER);
            or.setPadding(0, dp(4), 0, dp(10));
            col.addView(or);
            TextView gg = aButton(L("G   المتابعة عبر Google", "G   Continue with Google"), false);
            gg.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { authGoogle(); } });
            col.addView(gg, aBtnLp());
            Runnable chk = new Runnable() { @Override public void run() { aEnable(fId.getText().toString().trim().length() > 0 && fPass.getText().length() > 0); } };
            fId.addTextChangedListener(aWatch(chk));
            fPass.addTextChangedListener(aWatch(chk));
            aNext.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { if (aNext.isEnabled()) authLogin(); } });
            chk.run();
        } else if ("email".equals(aStep) || "forgot".equals(aStep)) {
            boolean reset = "forgot".equals(aStep);
            aTitle(col, reset ? L("إعادة تعيين كلمة السر", "Reset password") : L("إنشاء حساب جديد", "Create a new account"),
                reset ? L("أدخل بريدك الإلكتروني وسنرسل لك رمز تحقق لتعيين كلمة سر جديدة.", "Enter your email and we'll send you a verification code to set a new password.") : L("أدخل بريدك الإلكتروني وسنرسل لك رمز تحقق.", "Enter your email and we'll send you a verification code."));
            fEmail = aField(col, T("البريد الإلكتروني"), android.text.InputType.TYPE_CLASS_TEXT | android.text.InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS, true);
            fEmail.setText(aEmail);
            col.addView(aMsg);
            TextView back = aLink(L("لديّ حساب – تسجيل الدخول", "I have an account – Sign in"));
            back.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { aFlow = "signup"; aStep = "login"; authDraw(); } });
            col.addView(back);
            col.addView(new View(this), new LinearLayout.LayoutParams(1, 0, 1f));
            aNext = aButton(T("التالي"), true);
            col.addView(aNext, aBtnLp());
            Runnable chk = new Runnable() {
                @Override public void run() {
                    aEmail = fEmail.getText().toString().trim();
                    aEnable(android.util.Patterns.EMAIL_ADDRESS.matcher(aEmail).matches());
                }
            };
            fEmail.addTextChangedListener(aWatch(chk));
            aNext.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { if (aNext.isEnabled()) authSendCode(); } });
            chk.run();
        } else if ("code".equals(aStep)) {
            aTitle(col, L("أدخل رمز التحقق", "Enter the verification code"), L("أرسلنا رمزًا إلى ", "We sent a code to ") + aEmail);
            fCode = aField(col, L("الرمز", "Code"), android.text.InputType.TYPE_CLASS_NUMBER, true);
            fCode.setGravity(Gravity.CENTER);
            fCode.setTextSize(24);
            fCode.setFilters(new android.text.InputFilter[] { new android.text.InputFilter.LengthFilter(8) });
            col.addView(aMsg);
            aResendV = aLink("");
            aResendV.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { authResend(); } });
            col.addView(aResendV);
            TextView ch = aLink(L("تغيير البريد", "Change email"));
            ch.setOnClickListener(new View.OnClickListener() {
                @Override public void onClick(View v) { aStep = "reset".equals(aFlow) ? "forgot" : "email"; if (aResendTick != null) aH.removeCallbacks(aResendTick); authDraw(); }
            });
            col.addView(ch);
            col.addView(new View(this), new LinearLayout.LayoutParams(1, 0, 1f));
            aNext = aButton(L("تحقق", "Verify"), true);
            col.addView(aNext, aBtnLp());
            Runnable chk = new Runnable() { @Override public void run() { aEnable(fCode.getText().toString().trim().length() >= 6); } };
            fCode.addTextChangedListener(aWatch(chk));
            aNext.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { if (aNext.isEnabled()) authVerify(); } });
            chk.run();
            updateResend();
        } else if ("newpass".equals(aStep)) {
            aTitle(col, L("كلمة سر جديدة", "New password"), L("اختر كلمة سر لا تقل عن ", "Choose a password of at least ") + MIN_PASS + L(" أحرف.", " characters."));
            fPass = aField(col, L("كلمة السر الجديدة", "New password"), android.text.InputType.TYPE_CLASS_TEXT | android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD, true);
            fPass2 = aField(col, L("تأكيد كلمة السر", "Confirm password"), android.text.InputType.TYPE_CLASS_TEXT | android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD, true);
            col.addView(aMsg);
            col.addView(new View(this), new LinearLayout.LayoutParams(1, 0, 1f));
            aNext = aButton(T("حفظ"), true);
            col.addView(aNext, aBtnLp());
            Runnable chk = new Runnable() {
                @Override public void run() {
                    String p1 = fPass.getText().toString(), p2 = fPass2.getText().toString();
                    if (p1.length() > 0 && p1.length() < MIN_PASS) aSetMsg(MIN_PASS + L(" أحرف على الأقل", " characters minimum"), true, false);
                    else if (p2.length() > 0 && !p1.equals(p2)) aSetMsg("كلمتا السر غير متطابقتين", true, false);
                    else aSetMsg("", false, false);
                    aEnable(p1.length() >= MIN_PASS && p1.equals(p2));
                }
            };
            fPass.addTextChangedListener(aWatch(chk));
            fPass2.addTextChangedListener(aWatch(chk));
            aNext.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { if (aNext.isEnabled()) authSaveNewPass(); } });
            chk.run();
        } else {
            drawSetup(col);
        }
    }

    protected LinearLayout.LayoutParams aBtnLp() {
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        lp.setMargins(0, 0, 0, dp(10));
        return lp;
    }

    protected void aTitle(LinearLayout col, String t, String s) {
        TextView a = tv(Color.WHITE, 23, true);
        a.setText(t);
        a.setPadding(0, dp(6), 0, dp(6));
        col.addView(a);
        TextView b = tv(MUTED, 13, false);
        b.setText(s);
        b.setPadding(0, 0, 0, dp(16));
        col.addView(b);
    }

    // ---------- تسجيل الدخول ----------
    protected void authLogin() {
        final String id = fId.getText().toString().trim();
        final String pass = fPass.getText().toString();
        aBusy = true; aEnable(false); aSetMsg(L("جارٍ تسجيل الدخول...", "Signing in..."), false, false);
        pool.execute(new Runnable() {
            @Override public void run() {
                try {
                    JSONObject r;
                    if (!id.contains("@")) {
                        JSONObject t = authCall("POST", "/functions/v1/login-username", new JSONObject().put("username", id).put("password", pass).toString(), null);
                        if (!t.has("access_token")) throw new Exception("invalid");
                        JSONObject u = authCall("GET", "/auth/v1/user", null, t.optString("access_token"));
                        t.put("user", u);
                        r = t;
                    } else {
                        r = authCall("POST", "/auth/v1/token?grant_type=password", new JSONObject().put("email", id.toLowerCase()).put("password", pass).toString(), null);
                    }
                    final JSONObject u = r.optJSONObject("user");
                    if (u == null) throw new Exception("invalid");
                    saveSession(r.optString("access_token"), r.optString("refresh_token"), u.optString("id"), u.optString("email", ""));
                    getSharedPreferences("zn_auth", MODE_PRIVATE).edit().putString("last_id", id).apply();
                    afterSession();
                } catch (Exception e) {
                    runOnUiThread(new Runnable() {
                        @Override public void run() { aBusy = false; aEnable(true); aSetMsg(L("البريد/اسم المستخدم أو كلمة السر غير صحيحة", "Email/username or password is incorrect"), true, false); }
                    });
                }
            }
        });
    }

    // ---------- رمز التحقق ----------
    protected void authSendCode() {
        aBusy = true; aEnable(false); aSetMsg(T("جارٍ الإرسال..."), false, false);
        final String em = aEmail.toLowerCase();
        pool.execute(new Runnable() {
            @Override public void run() {
                try {
                    authCall("POST", "/auth/v1/otp", new JSONObject().put("email", em).put("create_user", !"reset".equals(aFlow)).toString(), null);
                    runOnUiThread(new Runnable() {
                        @Override public void run() { aBusy = false; aEmail = em; aStep = "code"; startResend(60); authDraw(); }
                    });
                } catch (final Exception e) {
                    runOnUiThread(new Runnable() {
                        @Override public void run() { aBusy = false; aEnable(true); aSetMsg(L("تعذر إرسال الرمز: ", "Could not send the code: ") + e.getMessage(), true, false); }
                    });
                }
            }
        });
    }

    protected void startResend(int sec) {
        aResendLeft = sec;
        if (aResendTick != null) aH.removeCallbacks(aResendTick);
        aResendTick = new Runnable() {
            @Override public void run() {
                aResendLeft--;
                updateResend();
                if (aResendLeft > 0) aH.postDelayed(this, 1000);
            }
        };
        aH.postDelayed(aResendTick, 1000);
    }

    protected void updateResend() {
        if (aResendV == null) return;
        if (aResendLeft > 0) { aResendV.setText(L("إعادة الإرسال بعد ", "Resend in ") + aResendLeft + L("ث", "s")); aResendV.setTextColor(MUTED); }
        else { aResendV.setText(L("إعادة إرسال الرمز", "Resend code")); aResendV.setTextColor(GOLD); }
    }

    protected void authResend() {
        if (aResendLeft > 0) return;
        aSetMsg(T("جارٍ الإرسال..."), false, false);
        pool.execute(new Runnable() {
            @Override public void run() {
                try {
                    authCall("POST", "/auth/v1/otp", new JSONObject().put("email", aEmail).put("create_user", !"reset".equals(aFlow)).toString(), null);
                    runOnUiThread(new Runnable() { @Override public void run() { aSetMsg(T("تم إرسال رمز جديد ✅"), false, true); startResend(60); } });
                } catch (final Exception e) {
                    runOnUiThread(new Runnable() { @Override public void run() { aSetMsg(String.valueOf(e.getMessage()), true, false); } });
                }
            }
        });
    }

    protected void authVerify() {
        final String code = fCode.getText().toString().trim();
        aBusy = true; aEnable(false); aSetMsg(T("جارٍ التحقق..."), false, false);
        pool.execute(new Runnable() {
            @Override public void run() {
                try {
                    JSONObject r = authCall("POST", "/auth/v1/verify", new JSONObject().put("type", "email").put("email", aEmail).put("token", code).toString(), null);
                    JSONObject u = r.optJSONObject("user");
                    if (u == null || !r.has("access_token")) throw new Exception("invalid");
                    saveSession(r.optString("access_token"), r.optString("refresh_token"), u.optString("id"), u.optString("email", aEmail));
                    if ("reset".equals(aFlow)) {
                        runOnUiThread(new Runnable() { @Override public void run() { aBusy = false; aStep = "newpass"; authDraw(); } });
                        return;
                    }
                    afterSession();
                } catch (final Exception e) {
                    runOnUiThread(new Runnable() {
                        @Override public void run() { aBusy = false; aEnable(true); aSetMsg(L("الرمز غير صحيح أو منتهي (", "The code is incorrect or expired (") + e.getMessage() + ")", true, false); }
                    });
                }
            }
        });
    }

    protected void authSaveNewPass() {
        final String p = fPass.getText().toString();
        aBusy = true; aEnable(false); aSetMsg(L("جارٍ الحفظ...", "Saving..."), false, false);
        pool.execute(new Runnable() {
            @Override public void run() {
                try {
                    authCall("PUT", "/auth/v1/user", new JSONObject().put("password", p).toString(), token);
                    aFlow = "signup";
                    afterSession();
                } catch (final Exception e) {
                    runOnUiThread(new Runnable() {
                        @Override public void run() { aBusy = false; aEnable(true); aSetMsg(L("تعذر الحفظ: ", "Could not save: ") + e.getMessage(), true, false); }
                    });
                }
            }
        });
    }

    // ---------- Google ----------
    protected void authGoogle() {
        try {
            String u = url + "/auth/v1/authorize?provider=google&redirect_to=" + java.net.URLEncoder.encode(AUTH_REDIRECT, "UTF-8") + "&prompt=select_account";
            startActivity(new Intent(Intent.ACTION_VIEW, android.net.Uri.parse(u)));
        } catch (Exception e) { aSetMsg(L("تعذر فتح المتصفح: ", "Could not open the browser: ") + e.getMessage(), true, false); }
    }

    // يُستدعى عند الرجوع من المتصفح بعد موافقة Google (الرابط العميق com.zelosport.app://login-callback#access_token=...)
    protected boolean handleAuthIntent(Intent in) {
        if (in == null || in.getData() == null) return false;
        String s = in.getData().toString();
        if (!s.startsWith(AUTH_REDIRECT)) return false;
        String frag = in.getData().getEncodedFragment();
        if (frag == null) return true;
        String at = "", rt = "";
        for (String kv : frag.split("&")) {
            String[] p = kv.split("=", 2);
            if (p.length < 2) continue;
            try {
                if (p[0].equals("access_token")) at = java.net.URLDecoder.decode(p[1], "UTF-8");
                if (p[0].equals("refresh_token")) rt = java.net.URLDecoder.decode(p[1], "UTF-8");
            } catch (Exception ignore) {}
        }
        if (at.length() == 0) return true;
        final String fa = at, fr = rt;
        pool.execute(new Runnable() {
            @Override public void run() {
                try {
                    JSONObject u = authCall("GET", "/auth/v1/user", null, fa);
                    saveSession(fa, fr, u.optString("id"), u.optString("email", ""));
                    afterSession();
                } catch (Exception e) {
                    runOnUiThread(new Runnable() { @Override public void run() { aSetMsg(L("تعذر تسجيل الدخول", "Could not sign in"), true, false); } });
                }
            }
        });
        return true;
    }

    // ---------- بعد نجاح الجلسة ----------
    protected void afterSession() {
        final JSONObject row = loadUserRow(uid);
        runOnUiThread(new Runnable() {
            @Override public void run() {
                aBusy = false;
                if (row == null || row.optString("username", "").length() == 0 || row.isNull("dob") || row.optString("dob", "").length() == 0) {
                    aStep = "setup"; authDraw(); return;
                }
                proceedAfterAuth(row);
            }
        });
    }

    protected void proceedAfterAuth(JSONObject row) {
        JSONArray clubs = row == null ? null : row.optJSONArray("selected_clubs");
        closeAuth();
        if (clubs != null && clubs.length() > 0) { if (aDone != null) aDone.run(); }
        else showLoginScreen(aDone); // شاشة اختيار الأندية (Login.java)
    }

    // ---------- إكمال الحساب ----------
    protected void drawSetup(LinearLayout col) {
        aTitle(col, L("أنشئ حسابك", "Create your account"), L("اختر اسم مستخدم فريدًا وكلمة سر وأدخل تاريخ ميلادك. يمكنك تغيير اسمك المستعار لاحقًا من ملفك الشخصي.", "Choose a unique username and password and enter your date of birth. You can change your nickname later from your profile."));
        fUser = aField(col, L("اسم المستخدم (إنجليزي، أرقام و_)", "Username (English letters, numbers, _)"), android.text.InputType.TYPE_CLASS_TEXT | android.text.InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD, true);
        fUser.setFilters(new android.text.InputFilter[] { new android.text.InputFilter.LengthFilter(20), new android.text.InputFilter() {
            @Override public CharSequence filter(CharSequence src, int s, int e, android.text.Spanned d, int ds, int de) {
                StringBuilder sb = new StringBuilder();
                for (int i = s; i < e; i++) { char ch = src.charAt(i); if ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || (ch >= '0' && ch <= '9') || ch == '_') sb.append(ch); }
                return sb.toString();
            }
        } });
        aUMsg = tv(MUTED, 12, true);
        col.addView(aUMsg);
        fPass = aField(col, L("كلمة السر", "Password"), android.text.InputType.TYPE_CLASS_TEXT | android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD, true);
        aPMsg = tv(MUTED, 12, true);
        aPMsg.setText(MIN_PASS + L(" أحرف على الأقل", " characters minimum"));
        col.addView(aPMsg);
        TextView dl = tv(MUTED, 11, true);
        dl.setText(T("تاريخ الميلاد"));
        dl.setPadding(0, dp(10), 0, dp(4));
        col.addView(dl);
        spD = new android.widget.Spinner(this);
        spM = new android.widget.Spinner(this);
        spY = new android.widget.Spinner(this);
        List<String> days = new ArrayList<String>(); days.add(L("اليوم", "Day"));
        for (int i = 1; i <= 31; i++) days.add(String.valueOf(i));
        String[] ms = { L("يناير", "January"), L("فبراير", "February"), L("مارس", "March"), L("أبريل", "April"), L("مايو", "May"), L("يونيو", "June"), L("يوليو", "July"), L("أغسطس", "August"), L("سبتمبر", "September"), L("أكتوبر", "October"), L("نوفمبر", "November"), L("ديسمبر", "December") };
        List<String> mons = new ArrayList<String>(); mons.add(L("الشهر", "Month"));
        for (String m : ms) mons.add(m);
        List<String> yrs = new ArrayList<String>(); yrs.add(L("السنة", "Year"));
        int thisYear = java.util.Calendar.getInstance().get(java.util.Calendar.YEAR);
        for (int y = thisYear - MIN_AGE; y >= 1930; y--) yrs.add(String.valueOf(y));
        spD.setAdapter(new android.widget.ArrayAdapter<String>(this, android.R.layout.simple_spinner_dropdown_item, days));
        spM.setAdapter(new android.widget.ArrayAdapter<String>(this, android.R.layout.simple_spinner_dropdown_item, mons));
        spY.setAdapter(new android.widget.ArrayAdapter<String>(this, android.R.layout.simple_spinner_dropdown_item, yrs));
        dobField = tv(0xFF94A3B8, 16, false);
        dobField.setText(L("اختر تاريخ الميلاد", "Choose your date of birth") + "  \u25BE");
        dobField.setGravity(Gravity.CENTER_VERTICAL);
        dobField.setPadding(dp(16), 0, dp(16), 0);
        dobField.setBackground(dobBg(0xFF111A4A, 0xFF2A3258, 14));
        col.addView(dobField, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(54)));
        aDMsg = tv(MUTED, 12, true);
        aDMsg.setText(L("يجب ألا يقل العمر عن ", "You must be at least ") + MIN_AGE + L(" سنة", " years old"));
        col.addView(aDMsg);
        col.addView(aMsg);
        TextView back = aLink(L("لديّ حساب – رجوع لتسجيل الدخول", "I have an account – Back to sign in"));
        back.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) {
                pool.execute(new Runnable() {
                    @Override public void run() {
                        try { authCall("POST", "/auth/v1/logout", "{}", token); } catch (Exception ignore) {}
                        clearSession();
                        runOnUiThread(new Runnable() { @Override public void run() { aUserOk = false; aFlow = "signup"; aStep = "login"; authDraw(); } });
                    }
                });
            }
        });
        col.addView(back);
        col.addView(new View(this), new LinearLayout.LayoutParams(1, 0, 1f));
        aNext = aButton(T("التالي"), true);
        col.addView(aNext, aBtnLp());
        final Runnable chk = new Runnable() {
            @Override public void run() {
                String dob = readDob();
                if ("invalid".equals(dob)) { aDMsg.setText("تاريخ غير صحيح"); aDMsg.setTextColor(0xFFFF6B6B); }
                else if ("young".equals(dob)) { aDMsg.setText("يجب ألا يقل العمر عن " + MIN_AGE + " سنة"); aDMsg.setTextColor(0xFFFF6B6B); }
                else aDMsg.setTextColor(MUTED);
                boolean passOk = fPass.getText().length() >= MIN_PASS;
                aPMsg.setTextColor(fPass.getText().length() > 0 && !passOk ? 0xFFFF6B6B : MUTED);
                aEnable(aUserOk && passOk && dob != null && !"invalid".equals(dob) && !"young".equals(dob));
            }
        };
        fPass.addTextChangedListener(aWatch(chk));
        android.widget.AdapterView.OnItemSelectedListener sel = new android.widget.AdapterView.OnItemSelectedListener() {
            @Override public void onItemSelected(android.widget.AdapterView<?> p, View v, int pos, long id) { chk.run(); }
            @Override public void onNothingSelected(android.widget.AdapterView<?> p) {}
        };
        spD.setOnItemSelectedListener(sel); spM.setOnItemSelectedListener(sel); spY.setOnItemSelectedListener(sel);
        dobField.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { dobPick(chk); } });
        fUser.addTextChangedListener(aWatch(new Runnable() { @Override public void run() { usernameInput(chk); } }));
        aNext.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) { if (aNext.isEnabled()) authFinishSetup(); } });
        chk.run();
    }

    // ---------- نافذة اختيار تاريخ الميلاد (عجلات) ----------
    protected GradientDrawable dobBg(int fill, int stroke, int rDp) {
        GradientDrawable g = new GradientDrawable();
        g.setColor(fill);
        g.setCornerRadius(dp(rDp));
        if ((stroke >>> 24) != 0) g.setStroke(dp(1), stroke);
        return g;
    }
    protected TextView dobTxt(String t, int color, int size, boolean bold) {
        TextView v = tv(color, size, bold);
        v.setText(t);
        return v;
    }
    protected void dobStyle(final android.widget.NumberPicker np) {
        np.setDescendantFocusability(android.widget.NumberPicker.FOCUS_BLOCK_DESCENDANTS);
        if (android.os.Build.VERSION.SDK_INT >= 29) { try { np.setTextColor(Color.WHITE); np.setTextSize(dp(9)); } catch (Throwable ignore) {} }
        try { java.lang.reflect.Field f = android.widget.NumberPicker.class.getDeclaredField("mSelectionDivider"); f.setAccessible(true); f.set(np, new ColorDrawable(0x00000000)); } catch (Throwable ignore) {}
        try { np.setLayoutDirection(View.LAYOUT_DIRECTION_LTR); } catch (Throwable ignore) {}
    }
    protected String[] dobMonths() {
        return new String[] { L("يناير", "January"), L("فبراير", "February"), L("مارس", "March"), L("أبريل", "April"), L("مايو", "May"), L("يونيو", "June"), L("يوليو", "July"), L("أغسطس", "August"), L("سبتمبر", "September"), L("أكتوبر", "October"), L("نوفمبر", "November"), L("ديسمبر", "December") };
    }
    protected void dobPick(final Runnable chk) {
        try { android.view.inputmethod.InputMethodManager im = (android.view.inputmethod.InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE); if (fUser != null) im.hideSoftInputFromWindow(fUser.getWindowToken(), 0); } catch (Throwable ignore) {}
        final Dialog dlg = sheetDialog(false);
        final int thisYear = java.util.Calendar.getInstance().get(java.util.Calendar.YEAR);
        final int maxYear = thisYear - MIN_AGE;
        final String[] mn = dobMonths();
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        GradientDrawable bg = new GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM, new int[] { 0xFF131D52, 0xFF0D1540 });
        bg.setCornerRadii(new float[] { dp(28), dp(28), dp(28), dp(28), 0, 0, 0, 0 });
        bg.setStroke(dp(1), 0x44F5C35A);
        box.setBackground(bg);
        box.setPadding(dp(20), dp(14), dp(20), navH() + dp(22));
        View grab = new View(this);
        grab.setBackground(dobBg(0x33FFFFFF, 0x00000000, 3));
        LinearLayout.LayoutParams gl = new LinearLayout.LayoutParams(dp(46), dp(5));
        gl.gravity = Gravity.CENTER_HORIZONTAL; gl.bottomMargin = dp(14);
        box.addView(grab, gl);
        LinearLayout hd = new LinearLayout(this);
        hd.setGravity(Gravity.CENTER_VERTICAL);
        hd.addView(dobTxt("\uD83C\uDF82 " + T("تاريخ الميلاد"), Color.WHITE, 18, true), new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        final TextView ageT = dobTxt("", 0xFF14F195, 13, true);
        hd.addView(ageT);
        box.addView(hd);
        FrameLayout wheels = new FrameLayout(this);
        View band = new View(this);
        band.setBackground(dobBg(0x1FF5C35A, 0x88F5C35A, 16));
        FrameLayout.LayoutParams bl = new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(48), Gravity.CENTER_VERTICAL);
        wheels.addView(band, bl);
        LinearLayout row = new LinearLayout(this);
        row.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);
        final android.widget.NumberPicker pY = new android.widget.NumberPicker(this), pM = new android.widget.NumberPicker(this), pD = new android.widget.NumberPicker(this);
        final int nYears = maxYear - 1930 + 1;
        String[] ys = new String[nYears];
        for (int i = 0; i < nYears; i++) ys[i] = String.valueOf(maxYear - i);
        pY.setMinValue(0); pY.setMaxValue(nYears - 1); pY.setDisplayedValues(ys); pY.setWrapSelectorWheel(false);
        pM.setMinValue(0); pM.setMaxValue(11); pM.setDisplayedValues(mn); pM.setWrapSelectorWheel(true);
        pD.setMinValue(1); pD.setMaxValue(31); pD.setWrapSelectorWheel(true);
        int curD = spD.getSelectedItemPosition(), curM = spM.getSelectedItemPosition(), curY = spY.getSelectedItemPosition();
        pY.setValue(curY > 0 ? curY - 1 : Math.min(nYears - 1, 25 - MIN_AGE + 0));
        pM.setValue(curM > 0 ? curM - 1 : 0);
        pD.setValue(curD > 0 ? curD : 1);
        dobStyle(pY); dobStyle(pM); dobStyle(pD);
        LinearLayout.LayoutParams wl = new LinearLayout.LayoutParams(0, dp(220), 1f);
        row.addView(pY, wl);
        row.addView(pM, new LinearLayout.LayoutParams(0, dp(220), 1.3f));
        row.addView(pD, new LinearLayout.LayoutParams(0, dp(220), 1f));
        wheels.addView(row, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(220)));
        LinearLayout.LayoutParams wlp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(220));
        wlp.topMargin = dp(10);
        box.addView(wheels, wlp);
        final Runnable upd = new Runnable() { @Override public void run() {
            int y = maxYear - pY.getValue(), m = pM.getValue();
            java.util.Calendar c = java.util.Calendar.getInstance();
            c.set(y, m, 1);
            int dim = c.getActualMaximum(java.util.Calendar.DAY_OF_MONTH);
            if (pD.getMaxValue() != dim) { if (pD.getValue() > dim) pD.setValue(dim); pD.setMaxValue(dim); }
            java.util.Calendar now = java.util.Calendar.getInstance();
            int age = now.get(java.util.Calendar.YEAR) - y;
            if (now.get(java.util.Calendar.MONTH) < m || (now.get(java.util.Calendar.MONTH) == m && now.get(java.util.Calendar.DAY_OF_MONTH) < pD.getValue())) age--;
            ageT.setText(L("العمر: ", "Age: ") + age + (age >= MIN_AGE ? "  \u2713" : ""));
            ageT.setTextColor(age >= MIN_AGE ? 0xFF14F195 : 0xFFFF6B6B);
        } };
        android.widget.NumberPicker.OnValueChangeListener ol = new android.widget.NumberPicker.OnValueChangeListener() {
            @Override public void onValueChange(android.widget.NumberPicker p, int o, int n) { upd.run(); }
        };
        pY.setOnValueChangedListener(ol); pM.setOnValueChangedListener(ol); pD.setOnValueChangedListener(ol);
        upd.run();
        TextView note = dobTxt(L("يجب ألا يقل العمر عن ", "You must be at least ") + MIN_AGE + L(" سنة", " years old"), 0xFF94A3B8, 12, false);
        note.setGravity(Gravity.CENTER);
        note.setPadding(0, dp(8), 0, dp(12));
        box.addView(note);
        TextView ok = dobTxt(L("تأكيد", "Confirm"), NAVY, 16, true);
        ok.setGravity(Gravity.CENTER);
        GradientDrawable og = new GradientDrawable(GradientDrawable.Orientation.LEFT_RIGHT, new int[] { 0xFFF5C35A, 0xFFFDE9A8 });
        og.setCornerRadius(dp(18));
        ok.setBackground(og);
        ok.setOnClickListener(new View.OnClickListener() { @Override public void onClick(View v) {
            int y = maxYear - pY.getValue(), m = pM.getValue(), d = pD.getValue();
            spD.setSelection(d); spM.setSelection(m + 1); spY.setSelection(pY.getValue() + 1);
            dobField.setText(d + " " + mn[m] + " " + y);
            dobField.setTextColor(Color.WHITE);
            dlg.dismiss();
            chk.run();
        } });
        box.addView(ok, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(52)));
        dlg.setContentView(box);
        dlg.show();
    }

    protected void usernameInput(final Runnable chk) {
        final String u = fUser.getText().toString().trim();
        aUserOk = false;
        if (aUserCheck != null) aH.removeCallbacks(aUserCheck);
        if (u.length() == 0) { aUMsg.setText(""); chk.run(); return; }
        if (!u.matches("^[a-zA-Z0-9_]{3,20}$")) { aUMsg.setText("من 3 إلى 20 حرفًا إنجليزيًا أو أرقامًا أو _"); aUMsg.setTextColor(0xFFFF6B6B); chk.run(); return; }
        aUMsg.setText(T("جارٍ الفحص...")); aUMsg.setTextColor(MUTED);
        aUserCheck = new Runnable() {
            @Override public void run() {
                pool.execute(new Runnable() {
                    @Override public void run() {
                        boolean taken = false;
                        try { taken = "false".equals(rpc("is_username_available", new JSONObject().put("p_username", u).toString()).trim()); } catch (Exception ignore) {}
                        final boolean tk = taken;
                        runOnUiThread(new Runnable() {
                            @Override public void run() {
                                if (!fUser.getText().toString().trim().equals(u)) return;
                                aUserOk = !tk;
                                aUMsg.setText(tk ? L("اسم المستخدم محجوز، جرّب اسمًا آخر", "Username is taken, try another") : L("✅ اسم المستخدم متاح", "✅ Username is available"));
                                aUMsg.setTextColor(tk ? 0xFFFF6B6B : 0xFF14F195);
                                chk.run();
                            }
                        });
                    }
                });
            }
        };
        aH.postDelayed(aUserCheck, 400);
    }

    // يعيد: null (غير مكتمل) | "invalid" | "young" | yyyy-MM-dd
    protected String readDob() {
        int d = spD.getSelectedItemPosition(), m = spM.getSelectedItemPosition();
        String ys = spY.getSelectedItemPosition() > 0 ? String.valueOf(spY.getSelectedItem()) : "";
        if (d == 0 || m == 0 || ys.length() == 0) return null;
        int y = Integer.parseInt(ys);
        java.util.Calendar c = java.util.Calendar.getInstance();
        c.setLenient(false);
        try { c.set(y, m - 1, d); c.getTime(); } catch (Exception e) { return "invalid"; }
        java.util.Calendar now = java.util.Calendar.getInstance();
        int age = now.get(java.util.Calendar.YEAR) - y;
        if (now.get(java.util.Calendar.MONTH) < m - 1 || (now.get(java.util.Calendar.MONTH) == m - 1 && now.get(java.util.Calendar.DAY_OF_MONTH) < d)) age--;
        if (age < MIN_AGE) return "young";
        return String.format(java.util.Locale.US, "%04d-%02d-%02d", y, m, d);
    }

    protected void authFinishSetup() {
        final String username = fUser.getText().toString().trim();
        final String dob = readDob();
        final String pass = fPass.getText().toString();
        aBusy = true; aEnable(false); aSetMsg("", false, false);
        pool.execute(new Runnable() {
            @Override public void run() {
                try {
                    authCall("PUT", "/auth/v1/user", new JSONObject().put("password", pass).toString(), token);
                } catch (final Exception e) {
                    runOnUiThread(new Runnable() { @Override public void run() { aBusy = false; aEnable(true); aSetMsg(L("تعذر حفظ كلمة السر: ", "Could not save the password: ") + e.getMessage(), true, false); } });
                    return;
                }
                String mail = getSharedPreferences("zn_auth", MODE_PRIVATE).getString("email", aEmail);
                String name = mail.contains("@") ? mail.substring(0, mail.indexOf('@')) : mail;
                if (name.length() > 30) name = name.substring(0, 30);
                boolean ar = false;
                for (int i = 0; i < name.length(); i++) { char ch = name.charAt(i); if (ch >= 0x0600 && ch <= 0x06FF) { ar = true; break; } }
                try {
                    JSONObject p = new JSONObject();
                    p.put("user_id", uid);
                    p.put("email", mail);
                    p.put("username", username);
                    p.put("dob", dob);
                    String lg0 = getSharedPreferences("zelo_lang", MODE_PRIVATE).getString("app_lang", "ar");
                    p.put("lang", lg0 == null || lg0.length() < 2 ? "ar" : lg0.substring(0, 2));
                    if (ar) p.put("nickname_ar", name); else p.put("nickname_en", name);
                    sendUrl("POST", url + "/rest/v1/users?on_conflict=user_id", p.toString(), "resolution=merge-duplicates,return=minimal");
                } catch (final Exception e) {
                    final boolean dup = String.valueOf(e.getMessage()).toLowerCase().matches("(?s).*(duplicate|unique).*");
                    runOnUiThread(new Runnable() {
                        @Override public void run() { aBusy = false; aEnable(true); aSetMsg(dup ? L("اسم المستخدم محجوز", "Username is taken") : L("تعذر الحفظ: ", "Could not save: ") + e.getMessage(), true, false); }
                    });
                    return;
                }
                getSharedPreferences("zn_auth", MODE_PRIVATE).edit().putString("last_id", username).apply();
                runOnUiThread(new Runnable() { @Override public void run() { aBusy = false; proceedAfterAuth(null); } });
            }
        });
    }

    // تسجيل الخروج
    protected static final String SB_URL = "https://mvbolnxjiqhlphxkuogn.supabase.co";
    protected static final String SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12Ym9sbnhqaXFobHBoeGt1b2duIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5ODMxNzQsImV4cCI6MjEwNzU1OTE3NH0.xDZgXGmoXe9Qt7U3vDp2BoyeLGsoMLRegXNbh_M4sfY";
    protected void signOutThen(final Runnable after) {
        final String t = token;
        pool.execute(new Runnable() {
            @Override public void run() {
                try { authCall("POST", "/auth/v1/logout", "{}", t); } catch (Exception ignore) {}
                runOnUiThread(new Runnable() { @Override public void run() { clearSession(); after.run(); } });
            }
        });
    }
    protected void signOut() {
        pool.execute(new Runnable() {
            @Override public void run() {
                try { authCall("POST", "/auth/v1/logout", "{}", token); } catch (Exception ignore) {}
                clearSession();
            }
        });
    }
}
