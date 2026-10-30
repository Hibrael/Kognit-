package br.com.minhascontas.app.capture;

import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.PowerManager;
import android.provider.Settings;
import androidx.core.app.NotificationManagerCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.HashSet;
import java.util.Set;
import org.json.JSONException;

@CapacitorPlugin(name = "MpCapture")
public class MpCapturePlugin extends Plugin {
    private static volatile MpCapturePlugin instance;

    @Override
    public void load() { instance = this; }

    @Override
    protected void handleOnDestroy() { if (instance == this) instance = null; }

    static void emitCaptured(String hash) {
        MpCapturePlugin p = instance;
        if (p == null) return;                  // app fechado: o JS lê a fila no próximo resume
        JSObject data = new JSObject();
        data.put("hash", hash);
        p.notifyListeners("captured", data);
    }

    @PluginMethod
    public void isEnabled(PluginCall call) {
        Context c = getContext();
        JSObject r = new JSObject();
        r.put("enabled", NotificationManagerCompat.getEnabledListenerPackages(c).contains(c.getPackageName()));
        call.resolve(r);
    }

    @PluginMethod
    public void isIgnoringBattery(PluginCall call) {
        PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
        JSObject r = new JSObject();
        r.put("ignoring", pm != null && pm.isIgnoringBatteryOptimizations(getContext().getPackageName()));
        call.resolve(r);
    }

    @PluginMethod
    public void openNotificationAccess(PluginCall call) {
        start(call, new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS));
    }

    @PluginMethod
    public void openAppDetails(PluginCall call) {
        start(call, new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getContext().getPackageName())));
    }

    @PluginMethod
    public void openBatterySettings(PluginCall call) {
        start(call, new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:" + getContext().getPackageName())));
    }

    @PluginMethod
    public void peek(PluginCall call) {
        int limit = call.getInt("limit", 100);
        JSArray items = new JSArray();
        for (CaptureItem it : CaptureQueue.peek(getContext(), limit)) {
            JSObject o = new JSObject();
            o.put("hash", it.hash);
            o.put("package", it.pkg);
            o.put("postTime", it.postTime);
            o.put("title", it.title);
            o.put("text", it.text);
            items.put(o);
        }
        JSObject r = new JSObject();
        r.put("items", items);
        r.put("total", CaptureQueue.count(getContext()));
        call.resolve(r);
    }

    @PluginMethod
    public void ack(PluginCall call) {
        JSArray hashes = call.getArray("hashes");
        if (hashes == null) { call.reject("hashes é obrigatório"); return; }
        try {
            Set<String> set = new HashSet<>(hashes.<String>toList());
            JSObject r = new JSObject();
            r.put("removed", CaptureQueue.ack(getContext(), set));
            call.resolve(r);
        } catch (JSONException e) {
            call.reject("hashes inválido", e);
        }
    }

    private void start(PluginCall call, Intent intent) {
        try {
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (ActivityNotFoundException e) {
            call.reject("Esta tela de configurações não existe neste aparelho", e);
        }
    }
}
