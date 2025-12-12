import React, { useRef, useEffect, useCallback } from 'react';
import { StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import WebView, { WebViewMessageEvent } from 'react-native-webview';
import { useAuth } from '../hooks/api/useAuth';
import { useTabBar } from '../context/TabBarContext';
import Ionicons from 'react-native-vector-icons/Ionicons';

const AUTO_HIDE_DELAY = 4000; // 4 saniye sonra otomatik kapanma

function DashboardScreen() {
  const { setAuthToken } = useAuth();
  const { isTabBarVisible, toggleTabBar, hideTabBar } = useTabBar();
  const webViewRef = useRef<WebView>(null);
  const autoHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Animasyon değerleri
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Ok animasyonu - tab bar durumuna göre döndür
  useEffect(() => {
    Animated.timing(rotateAnim, {
      toValue: isTabBarVisible ? 1 : 0,
      duration: 300,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
      useNativeDriver: true,
    }).start();
  }, [isTabBarVisible, rotateAnim]);

  // Pulse animasyonu - sürekli
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  // Otomatik kapanma timer'ı
  const resetAutoHideTimer = useCallback(() => {
    if (autoHideTimer.current) {
      clearTimeout(autoHideTimer.current);
    }
    if (isTabBarVisible) {
      autoHideTimer.current = setTimeout(() => {
        hideTabBar();
      }, AUTO_HIDE_DELAY);
    }
  }, [isTabBarVisible, hideTabBar]);

  useEffect(() => {
    resetAutoHideTimer();
    return () => {
      if (autoHideTimer.current) {
        clearTimeout(autoHideTimer.current);
      }
    };
  }, [isTabBarVisible, resetAutoHideTimer]);

  const handleToggle = () => {
    toggleTabBar();
  };

  // Rotasyon interpolasyonu
  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  // WebView içindeki localStorage/sessionStorage'dan token çekmek için inject edilecek JS
  const injectedJavaScript = `
    (function() {
      // Token'ı çeşitli kaynaklardan almaya çalış
      function getToken() {
        // 1. localStorage'dan
        const localToken = localStorage.getItem('token') ||
                          localStorage.getItem('accessToken') ||
                          localStorage.getItem('access_token') ||
                          localStorage.getItem('authToken');

        // 2. sessionStorage'dan
        const sessionToken = sessionStorage.getItem('token') ||
                            sessionStorage.getItem('accessToken') ||
                            sessionStorage.getItem('access_token');

        // 3. Cookie'den
        const cookies = document.cookie;

        return localToken || sessionToken;
      }

      // User bilgisini al
      function getUser() {
        const userStr = localStorage.getItem('user') ||
                       localStorage.getItem('userData') ||
                       localStorage.getItem('currentUser');
        try {
          return userStr ? JSON.parse(userStr) : null;
        } catch(e) {
          return null;
        }
      }

      // Token değişikliklerini dinle
      function checkAndSendToken() {
        const token = getToken();
        const user = getUser();

        if (token) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'AUTH_TOKEN',
            token: token,
            user: user,
            source: 'auto_detect'
          }));
        }
      }

      // Sayfa yüklendiğinde kontrol et
      checkAndSendToken();

      // Her 2 saniyede bir kontrol et (login sonrası için)
      setInterval(checkAndSendToken, 2000);

      // localStorage değişikliklerini dinle
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = function(key, value) {
        originalSetItem.apply(this, arguments);
        if (key.toLowerCase().includes('token')) {
          setTimeout(checkAndSendToken, 100);
        }
      };

      // Fetch isteklerini intercept et ve logla
      const originalFetch = window.fetch;
      window.fetch = async function(...args) {
        const [url, options] = args;
        console.log('🌐 Fetch Request:', url);

        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'FETCH_REQUEST',
          url: url,
          method: options?.method || 'GET',
          headers: options?.headers
        }));

        try {
          const response = await originalFetch.apply(this, args);
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'FETCH_RESPONSE',
            url: url,
            status: response.status,
            ok: response.ok
          }));
          return response;
        } catch(error) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'FETCH_ERROR',
            url: url,
            error: error.message
          }));
          throw error;
        }
      };

      // XHR isteklerini de intercept et
      const originalXHROpen = XMLHttpRequest.prototype.open;
      const originalXHRSend = XMLHttpRequest.prototype.send;

      XMLHttpRequest.prototype.open = function(method, url) {
        this._url = url;
        this._method = method;
        return originalXHROpen.apply(this, arguments);
      };

      XMLHttpRequest.prototype.send = function(body) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'XHR_REQUEST',
          url: this._url,
          method: this._method
        }));

        this.addEventListener('load', function() {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'XHR_RESPONSE',
            url: this._url,
            status: this.status,
            ok: this.status >= 200 && this.status < 300
          }));
        });

        return originalXHRSend.apply(this, arguments);
      };

      console.log('✅ React Native WebView injection completed');
      true;
    })();
  `;

  const handleWebViewMessage = async (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      // Farklı mesaj tiplerini işle
      switch (data.type) {
        case 'AUTH_TOKEN':
          if (data.token && data.user) {
            await setAuthToken(data.token, data.user);
          }
          break;

        case 'FETCH_REQUEST':
        case 'FETCH_RESPONSE':
        case 'FETCH_ERROR':
        case 'XHR_REQUEST':
        case 'XHR_RESPONSE':
        default:
          // Mesajlar sessizce işlenir
          break;
      }
    } catch {
      // Parse hatası sessizce yok sayılır
    }
  };

  return (
    <SafeAreaView
      style={styles.container}
      edges={isTabBarVisible ? ['top'] : ['top', 'bottom']}
    >
      <WebView
        ref={webViewRef}
        source={{ uri: 'https://nettech.kodpilot.com' }}
        style={styles.webview}
        startInLoadingState={true}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        scrollEnabled={true}
        bounces={true}
        onMessage={handleWebViewMessage}
        injectedJavaScript={injectedJavaScript}
      />
      {/* Floating Arrow Button - Centered */}
      <TouchableOpacity
        style={styles.floatingButton}
        onPress={handleToggle}
        activeOpacity={0.7}
      >
        <Animated.View
          style={[
            styles.arrowContainer,
            {
              transform: [
                { rotate },
                { scale: isTabBarVisible ? 1 : pulseAnim },
              ],
            },
          ]}
        >
          <Ionicons name="chevron-up" size={32} color="rgba(0, 0, 0, 0.6)" />
        </Animated.View>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  webview: {
    flex: 1,
  },
  floatingButton: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    width: 60,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrowContainer: {
    width: 60,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
});

export default DashboardScreen;
