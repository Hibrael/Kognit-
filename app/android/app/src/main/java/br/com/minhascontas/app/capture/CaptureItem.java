package br.com.minhascontas.app.capture;

import org.json.JSONException;
import org.json.JSONObject;

final class CaptureItem {
    final String hash, pkg, title, text;
    final long postTime;

    CaptureItem(String hash, String pkg, long postTime, String title, String text) {
        this.hash = hash; this.pkg = pkg; this.postTime = postTime; this.title = title; this.text = text;
    }

    JSONObject toJson() throws JSONException {
        return new JSONObject().put("hash", hash).put("package", pkg).put("postTime", postTime)
                .put("title", title).put("text", text);
    }

    static CaptureItem fromJson(JSONObject o) {
        return new CaptureItem(o.optString("hash"), o.optString("package"), o.optLong("postTime"),
                o.optString("title"), o.optString("text"));
    }
}
