import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Platform,
  Linking,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useCameraFormat,
  useCodeScanner,
} from 'react-native-vision-camera';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CameraStackParamList } from '../types/navigation';
import { findProductByBarcode } from '../services/api';
import BarcodeScannerOverlay from '../components/BarcodeScannerOverlay';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const FRAME_SIZE = SCREEN_WIDTH * 0.7;
const SCAN_FRAME_LEFT = (SCREEN_WIDTH - FRAME_SIZE) / 2;
const SCAN_FRAME_RIGHT = SCAN_FRAME_LEFT + FRAME_SIZE;
const SCAN_FRAME_TOP = (SCREEN_HEIGHT - FRAME_SIZE) / 2;
const SCAN_FRAME_BOTTOM = SCAN_FRAME_TOP + FRAME_SIZE;

type Props = NativeStackScreenProps<CameraStackParamList, 'Scanner'>;

function CameraScreen({ navigation }: Props) {
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const format = useCameraFormat(device, [
    { videoResolution: { width: 1920, height: 1080 } },
  ]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Çift okumayı önlemek için debounce referansı
  const lastScanTime = useRef<number>(0);
  const SCAN_DEBOUNCE = 1500; // ms

  // Barkod işleme fonksiyonu
  const processBarcodeRequest = useCallback(
    async (barcode: string) => {
      setIsProcessing(true);

      try {
        const response = await findProductByBarcode(barcode);

        if (response.success && response.data) {
          navigation.navigate('ProductDetail', { barcode });
        } else {
          Alert.alert(
            'Ürün Bulunamadı',
            `"${barcode}" barkodlu ürün bulunamadı. Tekrar denemek için farklı bir barkod okutun.`,
            [{ text: 'Tamam', onPress: () => setIsProcessing(false) }],
          );
        }
      } catch {
        Alert.alert(
          'Hata',
          'Ürün bilgisi alınırken bir hata oluştu. Lütfen tekrar deneyin.',
          [{ text: 'Tamam', onPress: () => setIsProcessing(false) }],
        );
      }
    },
    [navigation],
  );

  // Barkod okuma fonksiyonu - debounce ile çift okuma önlenir
  const handleBarcodeScanned = useCallback(
    (barcode: string) => {
      if (isProcessing) {
        return;
      }
      const now = Date.now();
      if (now - lastScanTime.current < SCAN_DEBOUNCE) {
        return;
      }
      lastScanTime.current = now;
      processBarcodeRequest(barcode);
    },
    [isProcessing, SCAN_DEBOUNCE, processBarcodeRequest],
  );

  // Code Scanner konfigürasyonu - Yaygın barkod formatları
  const codeScanner = useCodeScanner({
    codeTypes: [
      'ean-13', // Standart ürün barkodu
      'ean-8', // Kısa ürün barkodu
      'qr', // QR kod desteği
      'code-128', // Yaygın format
      'upc-a', // ABD ürün barkodu
    ],
    onCodeScanned: codes => {
      const validCode = codes.find(code => {
        if (!code.value) {
          return false;
        }
        if (!code.frame) {
          return false;
        }
        let centerX: number;
        let centerY: number;
        if (Platform.OS === 'ios' && format) {
          // iOS'ta frame koordinatları kamera sensörünün landscape uzayında gelir.
          // Kameranın uzun kenarı (örn. 1920) ekran Y'sine, kısa kenarı (örn. 1080)
          // ekran X'ine karşılık gelir. Bu dönüşümle ekran koordinatlarına çeviriyoruz.
          const camLong = Math.max(format.videoWidth, format.videoHeight);
          const camShort = Math.min(format.videoWidth, format.videoHeight);
          centerX = (code.frame.y + code.frame.height / 2) / camShort * SCREEN_WIDTH;
          centerY = (code.frame.x + code.frame.width / 2) / camLong * SCREEN_HEIGHT;
        } else {
          centerX = code.frame.x + code.frame.width / 2;
          centerY = code.frame.y + code.frame.height / 2;
        }
        return (
          centerX >= SCAN_FRAME_LEFT &&
          centerX <= SCAN_FRAME_RIGHT &&
          centerY >= SCAN_FRAME_TOP &&
          centerY <= SCAN_FRAME_BOTTOM
        );
      });
      if (validCode?.value) {
        handleBarcodeScanned(validCode.value);
      }
    },
  });

  // Ekran odaklandığında state'leri sıfırla
  useFocusEffect(
    useCallback(() => {
      setIsProcessing(false);
      lastScanTime.current = 0;
      return () => {
        lastScanTime.current = 0;
      };
    }, []),
  );

  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission, requestPermission]);

  const openSettings = () => {
    Linking.openSettings();
  };

  if (hasPermission === undefined) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionTitle}>Kamera İzni Gerekli</Text>
          <Text style={styles.permissionText}>
            Barkod okutabilmek için kamera iznine ihtiyacımız var
          </Text>
          <TouchableOpacity style={styles.button} onPress={requestPermission}>
            <Text style={styles.buttonText}>İzin Ver</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (hasPermission === false) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionTitle}>Kamera İzni Reddedildi</Text>
          <Text style={styles.permissionText}>
            Uygulamayı kullanabilmek için ayarlardan kamera iznini aktif etmeniz
            gerekiyor
          </Text>
          <TouchableOpacity style={styles.button} onPress={openSettings}>
            <Text style={styles.buttonText}>Ayarları Aç</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!device) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionTitle}>Kamera Bulunamadı</Text>
          <Text style={styles.permissionText}>
            {Platform.OS === 'ios'
              ? 'iOS Simulator kamerayı desteklemiyor.\n\nGerçek iPhone cihazında test edin.'
              : 'Android Emulator kamerayı desteklemiyor.\n\nGerçek cihazda test edin.'}
          </Text>
          <Text
            style={[styles.permissionText, { marginTop: 16, fontSize: 14 }]}
          >
            💡 Gerçek cihazınızı USB ile bağlayıp test edebilirsiniz.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <Camera
        style={[StyleSheet.absoluteFill, { bottom: 80 }]}
        device={device}
        format={format}
        isActive={!isProcessing}
        codeScanner={codeScanner}
      />

      {/* Tarama çerçevesi ve dış alan karartması */}
      <BarcodeScannerOverlay />

      {/* Mesaj alanı */}
      <View style={styles.messageContainer}>
        {isProcessing ? (
          <>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.messageText}>Ürün bilgisi yükleniyor...</Text>
          </>
        ) : (
          <>
            <Text style={styles.messageText}>Barkod Okutun</Text>
            <Text style={styles.subText}>
              Ürün barkodunu tarama çerçevesine getirin
            </Text>
          </>
        )}
      </View>

      {/* Geri butonu */}
      <SafeAreaView style={styles.topBar} edges={['top']}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          disabled={isProcessing}
        >
          <Text style={styles.backButtonText}>✕</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  permissionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  permissionText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  button: {
    backgroundColor: '#F99D26',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  messageContainer: {
    position: 'absolute',
    bottom: 150,
    left: 0,
    right: 0,
    alignItems: 'center',
    padding: 20,
  },
  messageText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subText: {
    fontSize: 14,
    color: '#fff',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '600',
  },
});

export default CameraScreen;
