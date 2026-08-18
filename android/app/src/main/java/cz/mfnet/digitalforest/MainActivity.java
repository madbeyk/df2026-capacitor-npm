package cz.mfnet.digitalforest;

import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState); // Důležité: spustí se jako první

        Window window = getWindow();

        // Odstraní splash.png z pozadí okna a nahradí ho čistě černou barvou
        window.setBackgroundDrawable(new ColorDrawable(Color.BLACK));
        window.getDecorView().setBackgroundColor(Color.BLACK);

        // Barva stavové lišty
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        window.setStatusBarColor(Color.BLACK);

        // Vynutí bílé ikony a čas
        WindowInsetsControllerCompat controller = 
            WindowCompat.getInsetsController(window, window.getDecorView());
        if (controller != null) {
            controller.setAppearanceLightStatusBars(false);
        }

        // Výřez kamery
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            window.getAttributes().layoutInDisplayCutoutMode =
                WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        }

        // Odsazení aplikace pod stavovou lištu
        View rootView = window.getDecorView().findViewById(android.R.id.content);
        ViewCompat.setOnApplyWindowInsetsListener(rootView, (v, insets) -> {
            int statusBarTop = insets.getInsets(WindowInsetsCompat.Type.statusBars()).top;
            int cutoutTop = insets.getInsets(WindowInsetsCompat.Type.displayCutout()).top;

            int realTopMargin = Math.max(statusBarTop, cutoutTop);
            v.setPadding(0, realTopMargin, 0, 0);
            return insets;
        });
    }
}