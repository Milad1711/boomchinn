package com.boomchin.game;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import com.example.android.trivialdrivesample.util.IabHelper;
import com.example.android.trivialdrivesample.util.IabResult;
import com.example.android.trivialdrivesample.util.Inventory;
import com.example.android.trivialdrivesample.util.Purchase;

import org.json.JSONObject;

/**
 * WebView wrapper for the Boom Chin web game + Café Bazaar in-app billing.
 *
 * The web page talks to native through window.BoomChinAndroid:
 *   isBazaar()              -> true when Bazaar billing is ready
 *   purchase(sku, payload)  -> starts the Bazaar purchase flow
 * Results are pushed back to the page through window.onBazaarResult /
 * window.onBazaarRestore with a JSON argument: {state, sku}.
 */
public class MainActivity extends Activity {

    private static final int RC_PURCHASE = 1001;

    private WebView web;
    private IabHelper billing;
    private volatile boolean billingReady = false;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        web = new WebView(this);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        web.setBackgroundColor(Color.parseColor("#a8ecd9"));
        web.setOverScrollMode(WebView.OVER_SCROLL_NEVER);

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                if (url == null) return false;
                if (url.startsWith("file:")) return false;
                Uri u = Uri.parse(url);
                String host = u.getHost() == null ? "" : u.getHost();
                if (url.startsWith("http") && host.equals(Config.SITE_HOST)) return false;
                // external links open in the browser
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, u));
                } catch (Exception ignored) {
                }
                return true;
            }

            @Override
            public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
                if (Config.SITE_URL.equals(failingUrl)) {
                    view.loadUrl("file:///android_asset/error.html");
                }
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame() && Config.SITE_URL.equals(String.valueOf(request.getUrl()))) {
                    view.loadUrl("file:///android_asset/error.html");
                }
            }
        });

        web.addJavascriptInterface(new Bridge(), "BoomChinAndroid");

        initBilling();
        web.loadUrl(Config.SITE_URL);
    }

    private void initBilling() {
        String key = Config.BAZAAR_RSA_KEY;
        if (key == null || key.trim().length() < 10) return; // RSA not configured yet
        try {
            billing = new IabHelper(this, key.trim());
            billing.enableDebugLogging(false);
            billing.startSetup(new IabHelper.OnIabSetupFinishedListener() {
                @Override
                public void onIabSetupFinished(IabResult result) {
                    if (!result.isSuccess()) {
                        billing = null;
                        billingReady = false;
                        return;
                    }
                    billingReady = true;
                    restoreOwned();
                }
            });
        } catch (Exception e) {
            billing = null;
            billingReady = false;
        }
    }

    /**
     * If the app died right after a purchase (before the coins were credited),
     * the purchase token is still owned: consume it and credit the coins.
     */
    private void restoreOwned() {
        try {
            billing.queryInventoryAsync(false, new IabHelper.QueryInventoryFinishedListener() {
                @Override
                public void onQueryInventoryFinished(IabResult result, Inventory inv) {
                    if (!result.isSuccess() || inv == null) return;
                    for (String sku : Config.PURCHASABLE_SKUS) {
                        Purchase p = inv.getPurchase(sku);
                        if (p != null) consumeAndNotify(p, true);
                    }
                }
            });
        } catch (Exception ignored) {
        }
    }

    private void consumeAndNotify(final Purchase purchase, final boolean restored) {
        try {
            billing.consumeAsync(purchase, new IabHelper.OnConsumeFinishedListener() {
                @Override
                public void onConsumeFinished(Purchase p, IabResult result) {
                    if (result.isSuccess()) {
                        notifyJs(restored ? "onBazaarRestore" : "onBazaarResult", "success", p.getSku());
                    }
                }
            });
        } catch (Exception ignored) {
        }
    }

    private void notifyJs(final String callback, final String state, final String sku) {
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                if (web == null) return;
                try {
                    JSONObject o = new JSONObject();
                    o.put("state", state);
                    o.put("sku", sku);
                    web.evaluateJavascript(
                            "window." + callback + " && window." + callback + "(" + o + ");", null);
                } catch (Exception ignored) {
                }
            }
        });
    }

    class Bridge {
        @JavascriptInterface
        public boolean isBazaar() {
            return billing != null && billingReady;
        }

        @JavascriptInterface
        public void purchase(final String sku, final String payload) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    if (billing == null || !billingReady) {
                        notifyJs("onBazaarResult", "fail", sku);
                        return;
                    }
                    try {
                        billing.launchPurchaseFlow(MainActivity.this, sku, RC_PURCHASE,
                                new IabHelper.OnIabPurchaseFinishedListener() {
                                    @Override
                                    public void onIabPurchaseFinished(IabResult result, Purchase info) {
                                        if (result.isFailure()) {
                                            int code = result.getResponse();
                                            String state = (code == IabHelper.IABHELPER_USER_CANCELLED
                                                    || code == IabHelper.BILLING_RESPONSE_RESULT_USER_CANCELED)
                                                    ? "cancel" : "fail";
                                            notifyJs("onBazaarResult", state, sku);
                                            return;
                                        }
                                        if (info != null && info.getSku().equals(sku)) {
                                            consumeAndNotify(info, false);
                                        } else {
                                            notifyJs("onBazaarResult", "fail", sku);
                                        }
                                    }
                                },
                                payload == null ? "" : payload);
                    } catch (Exception e) {
                        notifyJs("onBazaarResult", "fail", sku);
                    }
                }
            });
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (billing != null && billing.handleActivityResult(requestCode, resultCode, data)) return;
        super.onActivityResult(requestCode, resultCode, data);
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (billing != null) {
            try {
                billing.dispose();
            } catch (Exception ignored) {
            }
            billing = null;
        }
        if (web != null) web.destroy();
        super.onDestroy();
    }
}
