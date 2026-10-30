package br.com.minhascontas.app.capture;

import android.content.Context;
import android.util.Log;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONException;

/** Fila em arquivo JSON em filesDir; escrita atômica; até 2.000 itens, descartando os mais antigos (10.6). */
final class CaptureQueue {
    private static final String TAG = "MpCapture";
    private static final String FILE = "mp_capture_queue.json";
    private static final int MAX_ITEMS = 2000;

    private CaptureQueue() {}

    /** Retorna false se o hash já estava na fila. */
    static synchronized boolean append(Context ctx, CaptureItem item) {
        List<CaptureItem> items = readAll(ctx);
        for (CaptureItem it : items) if (it.hash.equals(item.hash)) return false;
        items.add(item);
        while (items.size() > MAX_ITEMS) {
            Log.w(TAG, "fila cheia, descartando captura antiga " + items.get(0).hash);
            items.remove(0);
        }
        writeAll(ctx, items);
        return true;
    }

    static synchronized List<CaptureItem> peek(Context ctx, int limit) {
        List<CaptureItem> all = readAll(ctx);
        return new ArrayList<>(all.subList(0, Math.min(Math.max(limit, 0), all.size())));
    }

    static synchronized int ack(Context ctx, Set<String> hashes) {
        List<CaptureItem> items = readAll(ctx);
        int before = items.size();
        items.removeIf(it -> hashes.contains(it.hash));
        if (items.size() != before) writeAll(ctx, items);
        return before - items.size();
    }

    static synchronized int count(Context ctx) {
        return readAll(ctx).size();
    }

    private static List<CaptureItem> readAll(Context ctx) {
        File f = new File(ctx.getFilesDir(), FILE);
        List<CaptureItem> out = new ArrayList<>();
        if (!f.exists()) return out;
        try {
            JSONArray arr = new JSONArray(new String(Files.readAllBytes(f.toPath()), StandardCharsets.UTF_8));
            for (int i = 0; i < arr.length(); i++) out.add(CaptureItem.fromJson(arr.getJSONObject(i)));
        } catch (IOException | JSONException e) {
            Log.e(TAG, "fila ilegível; guardando cópia e recomeçando", e);
            f.renameTo(new File(ctx.getFilesDir(), FILE + ".corrupt-" + System.currentTimeMillis()));
            out.clear();
        }
        return out;
    }

    private static void writeAll(Context ctx, List<CaptureItem> items) {
        File tmp = new File(ctx.getFilesDir(), FILE + ".tmp");
        File dst = new File(ctx.getFilesDir(), FILE);
        try {
            JSONArray arr = new JSONArray();
            for (CaptureItem it : items) arr.put(it.toJson());
            try (FileOutputStream os = new FileOutputStream(tmp)) {
                os.write(arr.toString().getBytes(StandardCharsets.UTF_8));
                os.getFD().sync();
            }
            if (!tmp.renameTo(dst)) throw new IOException("rename falhou");
        } catch (IOException | JSONException e) {
            Log.e(TAG, "falha ao gravar a fila", e);
        }
    }
}
