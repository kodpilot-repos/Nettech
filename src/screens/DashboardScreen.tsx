import React, { useRef } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import WebView, { WebViewMessageEvent } from 'react-native-webview';
import { useAuth } from '../hooks/api/useAuth';
import { useTabBar } from '../context/TabBarContext';
import { useCart } from '../context/CartContext';

function DashboardScreen() {
  const { setAuthToken } = useAuth();
  const { showTabBar, hideTabBar } = useTabBar();
  const { setCartItems, setWebViewRef, syncCartData } = useCart();
  const webViewRef = useRef<WebView>(null);
  const lastScrollY = useRef(0);
  const isPopupOpen = useRef(false);

  // WebView ref'ini CartContext'e kaydet
  React.useEffect(() => {
    setWebViewRef(webViewRef);
  }, [setWebViewRef]);

  const lastTabBarChangeTime = useRef(0);
  const scrollThreshold = 20; // Minimum scroll mesafesi
  const tabBarCooldown = 300; // Tab bar değişiklikleri arasında minimum süre (ms)

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

      // Sepet verilerini oku ve gönder
      function sendBasketData() {
        const basketData = localStorage.getItem('basket');
        const cartType = localStorage.getItem('cartType');
        const cartAccountData = localStorage.getItem('cartAccount');
        const cartOrderData = localStorage.getItem('cartOrder');

        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'BASKET_DATA',
          basket: basketData ? JSON.parse(basketData) : [],
          cartType: cartType || null,
          cartAccount: cartAccountData ? JSON.parse(cartAccountData) : null,
          cartOrder: cartOrderData ? JSON.parse(cartOrderData) : null
        }));
      }

      // Sayfa yüklendiğinde kontrol et
      checkAndSendToken();
      sendBasketData();

      // Her 2 saniyede bir kontrol et (login sonrası için)
      setInterval(checkAndSendToken, 2000);

      // Sepet değişikliklerini dinle
      setInterval(sendBasketData, 3000);

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

      // Hamburger menü ve popup durumunu izle
      let isMenuOpen = false;

      function checkOverlayState() {
        let overlayDetected = false;

        // 1. Vue VerticalNav - hamburger menü kontrolü (sitenize özel)
        const verticalNav = document.querySelector('.layout-vertical-nav.visible');
        const overlayNav = document.querySelector('.layout-vertical-nav.overlay-nav.visible');
        if (verticalNav || overlayNav) {
          overlayDetected = true;
        }

        // 2. Vuetify dialog/modal kontrolü
        const vuetifyDialog = document.querySelector('.v-dialog.v-dialog--active, .v-overlay--active .v-dialog');
        const vuetifyOverlay = document.querySelector('.v-overlay.v-overlay--active:not(.v-overlay--contained)');
        if (vuetifyDialog || vuetifyOverlay) {
          overlayDetected = true;
        }

        // 3. Vuetify navigation drawer
        const vNavigationDrawer = document.querySelector('.v-navigation-drawer--active, .v-navigation-drawer.v-navigation-drawer--active');
        if (vNavigationDrawer) {
          overlayDetected = true;
        }

        // 4. Vuetify bottom sheet / menu
        const vBottomSheet = document.querySelector('.v-bottom-sheet.v-dialog--active');
        const vMenu = document.querySelector('.v-menu > .v-overlay--active');
        if (vBottomSheet || vMenu) {
          overlayDetected = true;
        }

        // 5. Genel overlay backdrop kontrolü
        const backdrop = document.querySelector('.layout-overlay.visible, .v-overlay__scrim');
        if (backdrop) {
          const style = window.getComputedStyle(backdrop);
          if (style.display !== 'none' && style.visibility !== 'hidden' && parseFloat(style.opacity) > 0) {
            overlayDetected = true;
          }
        }

        // 6. Body scroll engellenmiş mi
        const bodyStyle = window.getComputedStyle(document.body);
        const bodyScrollBlocked = bodyStyle.overflow === 'hidden' || bodyStyle.overflowY === 'hidden';

        // 7. Aria dialog kontrolü
        const openDialog = document.querySelector('[role="dialog"]:not([aria-hidden="true"])');

        const menuOpen = overlayDetected || (bodyScrollBlocked && !!openDialog);

        if (menuOpen !== isMenuOpen) {
          isMenuOpen = menuOpen;
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'UI_OVERLAY_STATE',
            isOpen: isMenuOpen
          }));
          console.log('📱 UI Overlay State:', isMenuOpen ? 'OPEN' : 'CLOSED');
        }
      }

      // MutationObserver ile DOM değişikliklerini izle
      const observer = new MutationObserver((mutations) => {
        // Debounce için requestAnimationFrame kullan
        requestAnimationFrame(checkOverlayState);
      });

      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class', 'style'],
        childList: true,
        subtree: true
      });

      // Periyodik kontrol (bazı framework'ler için)
      setInterval(checkOverlayState, 300);

      // İlk kontrol
      setTimeout(checkOverlayState, 500);

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
          // Popup açıkken scroll ile tab bar değişikliği yapma
          if (isPopupOpen.current) {
            break;
          }

          const { scrollY, lastScrollY: prevScrollY } = data;
          const scrollDifference = scrollY - prevScrollY;
          const now = Date.now();

          // Ani pozisyon değişikliklerini ignore et (popup açılma/kapanma)
          // Gerçek kullanıcı scroll'u genelde 150px'den az olur
          if (Math.abs(scrollDifference) > 150) {
            lastScrollY.current = scrollY;
            break;
          }

          // Cooldown kontrolü - çok hızlı değişiklikleri engelle
          if (now - lastTabBarChangeTime.current < tabBarCooldown) {
            lastScrollY.current = scrollY;
            break;
          }

          // Scroll yönünü kontrol et - sadece gerçek kullanıcı scroll'u
          if (Math.abs(scrollDifference) > scrollThreshold) {
            if (scrollDifference > 0 && scrollY > 100) {
              // Aşağı scroll ve sayfa üstünde değilse - bottom bar'ı gizle
              hideTabBar();
              lastTabBarChangeTime.current = now;
            } else if (scrollDifference < -scrollThreshold) {
              // Belirgin yukarı scroll - bottom bar'ı göster
              showTabBar();
              lastTabBarChangeTime.current = now;
            }
          }

          lastScrollY.current = scrollY;
          break;

        case 'BASKET_DATA':
          if (Array.isArray(data.basket)) {
            setCartItems(data.basket);
          }
          // cartType, cartAccount, cartOrder verilerini senkronize et
          syncCartData({
            cartType: data.cartType,
            cartAccount: data.cartAccount,
            cartOrder: data.cartOrder,
          });
          break;

        case 'UI_OVERLAY_STATE':
          // Hamburger menü veya popup açık/kapalı durumu
          isPopupOpen.current = data.isOpen;
          if (data.isOpen) {
            hideTabBar();
          } else {
            showTabBar();
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
