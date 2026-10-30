package br.com.minhascontas.app;

import android.os.Bundle;
import br.com.minhascontas.app.capture.MpCapturePlugin;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(MpCapturePlugin.class);   // antes do super.onCreate
        super.onCreate(savedInstanceState);
    }
}
