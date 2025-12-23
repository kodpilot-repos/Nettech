import React, { useRef } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import WebView, { WebViewMessageEvent } from 'react-native-webview';
import { useAuth } from '../hooks/api/useAuth';
import { useTabBar } from '../context/TabBarContext';

function DashboardScreen() {
  const { setAuthToken } = useAuth();
  const { showTabBar, hideTabBar } = useTabBar();
  const webViewRef = useRef<WebView>(null);
  const lastScrollY = useRef(0);
  const scrollThreshold = 10; // Minimum scroll mesafesi

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

      // Scroll tracking için
      let lastScrollY = 0;
      let ticking = false;

      function handleScroll() {
        const currentScrollY = window.pageYOffset || document.documentElement.scrollTop;

        if (!ticking) {
          window.requestAnimationFrame(() => {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'SCROLL',
              scrollY: currentScrollY,
              lastScrollY: lastScrollY
            }));
            lastScrollY = currentScrollY;
            ticking = false;
          });
          ticking = true;
        }
      }

      window.addEventListener('scroll', handleScroll, { passive: true });

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

        case 'SCROLL':
          const { scrollY, lastScrollY: prevScrollY } = data;
          const scrollDifference = scrollY - prevScrollY;

          // Scroll yönünü kontrol et
          if (Math.abs(scrollDifference) > scrollThreshold) {
            if (scrollDifference > 0) {
              // Aşağı scroll - bottom bar'ı gizle
              hideTabBar();
            } else {
              // Yukarı scroll - bottom bar'ı göster
              showTabBar();
            }
          }

          // Sayfanın en üstündeysek bottom bar'ı göster
          if (scrollY <= 50) {
            showTabBar();
          }

          lastScrollY.current = scrollY;
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
    <SafeAreaView style={styles.container} edges={['top']}>
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
});

export default DashboardScreen;
