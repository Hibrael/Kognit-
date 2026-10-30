package br.com.minhascontas.app.capture;

import android.app.Notification;
import android.content.ComponentName;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HashMap;
import java.util.Map;

/** Só aceita o pacote do Mercado Pago; nunca lê outros apps nem códigos de verificação (seção 13). */
public class MpNotificationService extends NotificationListenerService {
    static final String MP_PACKAGE = "com.mercadopago.wallet";   // confirmar no aparelho (8.3)
    private final Map<String, String> lastText = new HashMap<>();

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        if (!MP_PACKAGE.equals(sbn.getPackageName())) return;
        Notification n = sbn.getNotification();
        if ((n.flags & Notification.FLAG_GROUP_SUMMARY) != 0) return;
        Bundle ex = n.extras;
        String title = str(ex.getCharSequence(Notification.EXTRA_TITLE));
        CharSequence big = ex.getCharSequence(Notification.EXTRA_BIG_TEXT);
        String text = str(big != null ? big : ex.getCharSequence(Notification.EXTRA_TEXT));
        if (title.isEmpty() && text.isEmpty()) return;
        if (text.equals(lastText.get(sbn.getKey()))) return;          // reenvio da mesma notificação
        if (lastText.size() > 200) lastText.clear();
        lastText.put(sbn.getKey(), text);
        String hash = sha256Hex(sbn.getPackageName() + "|" + sbn.getPostTime() + "|" + title + "|" + text);
        if (CaptureQueue.append(this, new CaptureItem(hash, sbn.getPackageName(), sbn.getPostTime(), title, text))) {
            MpCapturePlugin.emitCaptured(hash);
        }
    }

    @Override
    public void onListenerDisconnected() {
        requestRebind(new ComponentName(this, MpNotificationService.class));
    }

    private static String str(CharSequence cs) {
        return cs == null ? "" : cs.toString();
    }

    static String sha256Hex(String s) {
        try {
            byte[] d = MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(d.length * 2);
            for (byte b : d) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
