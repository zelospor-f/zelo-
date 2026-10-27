package com.zelosport.app;

import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.unity3d.ads.IUnityAdsInitializationListener;
import com.unity3d.ads.IUnityAdsLoadListener;
import com.unity3d.ads.IUnityAdsShowListener;
import com.unity3d.ads.UnityAds;
import com.unity3d.ads.UnityAdsShowOptions;
import com.unity3d.services.banners.BannerErrorInfo;
import com.unity3d.services.banners.BannerView;
import com.unity3d.services.banners.UnityBannerSize;

// جسر بين JavaScript (ads.js) و Unity Ads SDK على أندرويد
@CapacitorPlugin(name = "UnityAds")
public class UnityAdsPlugin extends Plugin {

    private BannerView bannerView;

    @PluginMethod
    public void initialize(PluginCall call) {
        String gameId = call.getString("gameId", "");
        boolean testMode = call.getBoolean("testMode", false);
        if (gameId == null || gameId.isEmpty()) {
            call.reject("gameId is required");
            return;
        }
        UnityAds.initialize(getContext(), gameId, testMode, new IUnityAdsInitializationListener() {
            @Override
            public void onInitializationComplete() {
                call.resolve();
            }

            @Override
            public void onInitializationFailed(UnityAds.UnityAdsInitializationError error, String message) {
                call.reject("Unity init failed: " + message);
            }
        });
    }

    @PluginMethod
    public void showRewardedAd(PluginCall call) {
        String placementId = call.getString("placementId", "");
        if (placementId == null || placementId.isEmpty()) {
            call.reject("placementId is required");
            return;
        }
        getActivity().runOnUiThread(() ->
            UnityAds.load(placementId, new IUnityAdsLoadListener() {
                @Override
                public void onUnityAdsAdLoaded(String loadedPlacementId) {
                    showAd(placementId, call);
                }

                @Override
                public void onUnityAdsFailedToLoad(String failedPlacementId, UnityAds.UnityAdsLoadError error, String message) {
                    JSObject result = new JSObject();
                    result.put("completed", false);
                    result.put("error", error + ": " + message);
                    call.resolve(result);
                }
            })
        );
    }

    private void showAd(String placementId, PluginCall call) {
        getActivity().runOnUiThread(() ->
            UnityAds.show(getActivity(), placementId, new UnityAdsShowOptions(), new IUnityAdsShowListener() {
                @Override
                public void onUnityAdsShowFailure(String showPlacementId, UnityAds.UnityAdsShowError error, String message) {
                    JSObject result = new JSObject();
                    result.put("completed", false);
                    result.put("error", error + ": " + message);
                    call.resolve(result);
                }

                @Override
                public void onUnityAdsShowStart(String showPlacementId) {
                }

                @Override
                public void onUnityAdsShowClick(String showPlacementId) {
                }

                @Override
                public void onUnityAdsShowComplete(String showPlacementId, UnityAds.UnityAdsShowCompletionState state) {
                    JSObject result = new JSObject();
                    result.put("completed", state == UnityAds.UnityAdsShowCompletionState.COMPLETED);
                    call.resolve(result);
                }
            })
        );
    }

    @PluginMethod
    public void showBanner(PluginCall call) {
        String placementId = call.getString("placementId", "");
        int marginDp = call.getInt("margin", 0);
        if (placementId == null || placementId.isEmpty()) {
            call.reject("placementId is required");
            return;
        }
        getActivity().runOnUiThread(() -> {
            removeBannerView();
            bannerView = new BannerView(getActivity(), placementId, new UnityBannerSize(320, 50));

            FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.WRAP_CONTENT,
                FrameLayout.LayoutParams.WRAP_CONTENT,
                Gravity.TOP | Gravity.CENTER_HORIZONTAL
            );
            params.topMargin = dp(marginDp);

            ViewGroup root = getActivity().findViewById(android.R.id.content);
            root.addView(bannerView, params);
            bannerView.setListener(new BannerView.IListener() {
                @Override
                public void onBannerLoaded(BannerView view) {
                    JSObject o = new JSObject();
                    o.put("placementId", placementId);
                    UnityAdsPlugin.this.notifyListeners("bannerLoaded", o);
                }

                @Override
                public void onBannerFailedToLoad(BannerView view, BannerErrorInfo errorInfo) {
                    JSObject o = new JSObject();
                    o.put("placementId", placementId);
                    o.put("code", String.valueOf(errorInfo.errorCode));
                    o.put("message", errorInfo.errorMessage);
                    UnityAdsPlugin.this.notifyListeners("bannerError", o);
                }

                @Override
                public void onBannerClick(BannerView view) {
                }

                @Override
                public void onBannerLeftApplication(BannerView view) {
                }
            });
            bannerView.load();
            call.resolve();
        });
    }

    @PluginMethod
    public void hideBanner(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            removeBannerView();
            call.resolve();
        });
    }

    private void removeBannerView() {
        if (bannerView != null) {
            ViewGroup parent = (ViewGroup) bannerView.getParent();
            if (parent != null) parent.removeView(bannerView);
            bannerView = null;
        }
    }

    private int dp(int value) {
        return Math.round(TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP, value, getContext().getResources().getDisplayMetrics()));
    }
}
