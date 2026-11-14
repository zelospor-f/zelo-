package PKG;

import android.content.Intent;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "NativeFeed")
public class NativeFeedPlugin extends Plugin {
    @PluginMethod
    public void open(PluginCall call) {
        try {
            // إن لم تكتمل المرة السابقة (احتمال انهيار) نرجع للرئيسية القديمة (ويب)
            if (getContext().getSharedPreferences("zn", android.content.Context.MODE_PRIVATE).getInt("boot", 0) == 1) {
                call.reject("native_unstable");
                return;
            }
            Intent i = new Intent(getContext(), Home.class);
            i.putExtra("url", call.getString("url"));
            i.putExtra("key", call.getString("key"));
            i.putExtra("token", call.getString("token"));
            i.putExtra("uid", call.getString("uid"));
            i.putExtra("uname", call.getString("uname"));
            i.putExtra("uavatar", call.getString("uavatar"));
            i.putExtra("linkTpl", call.getString("linkTpl"));
            i.putExtra("pjson", call.getString("pjson"));
            getActivity().startActivity(i);
            call.resolve();
        } catch (Exception e) {
            call.reject(String.valueOf(e.getMessage()));
        }
    }

    // عند الرجوع من الشاشة الأصلية إلى صفحة ويب: نُبلغ الويب بالإجراء المطلوب
    @Override
    protected void handleOnResume() {
        java.util.List<String[]> nl = new java.util.ArrayList<String[]>();
        synchronized (Home.pendingNotify) {
            nl.addAll(Home.pendingNotify);
            Home.pendingNotify.clear();
        }
        for (String[] n : nl) {
            JSObject o2 = new JSObject();
            o2.put("kind", n[0]); o2.put("target", n[1]); o2.put("postId", n[2]); o2.put("text", n[3]); o2.put("amount", n[4]);
            notifyListeners("notify", o2);
        }
        String a = Home.pendingAction;
        if (a != null) {
            Home.pendingAction = null;
            JSObject o = new JSObject();
            o.put("name", a);
            notifyListeners("action", o);
        }
    }
}
