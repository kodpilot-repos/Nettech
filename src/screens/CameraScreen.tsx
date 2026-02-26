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
  useCodeScanner,
} from 'react-native-vision-camera';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CameraStackParamList } from '../types/navigation';
import { findProductByBarcode } from '../services/api';
import colors from '../theme/colors';
import BarcodeScannerOverlay from '../components/BarcodeScannerOverlay';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const FRAME_SIZE = SCREEN_WIDTH * 0.7;
const CAMERA_BOTTOM_OFFSET = 80;
const CAMERA_HEIGHT = SCREEN_HEIGHT - CAMERA_BOTTOM_OFFSET;

// regionOfInterest: kare çerçevenin kamera görünümüne göre normalize koordinatları (0-1) — sadece iOS
const SCAN_REGION = {
  x: (SCREEN_WIDTH - FRAME_SIZE) / 2 / SCREEN_WIDTH,
  y: (SCREEN_HEIGHT - FRAME_SIZE) / 2 / CAMERA_HEIGHT,
  width: FRAME_SIZE / SCREEN_WIDTH,
  height: FRAME_SIZE / CAMERA_HEIGHT,
};

// Kare çerçevenin ekran koordinatları (dp) — yazılım tarafı filtre için
const SCAN_FRAME_LEFT = (SCREEN_WIDTH - FRAME_SIZE) / 2;
const SCAN_FRAME_RIGHT = SCAN_FRAME_LEFT + FRAME_SIZE;
const SCAN_FRAME_TOP = (SCREEN_HEIGHT - FRAME_SIZE) / 2;
const SCAN_FRAME_BOTTOM = SCAN_FRAME_TOP + FRAME_SIZE;

type Props = NativeStackScreenProps<CameraStackParamList, 'Scanner'>;

function CameraScreen({ navigation }: Props) {
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmProgress, setConfirmProgress] = useState(0);

  // Barkod doğrulama için referanslar
  const lastScanTime = useRef<number>(0);
  const barcodeBuffer = useRef<string[]>([]);
  const confirmTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const SCAN_COOLDOWN = 500; // Her okuma arası 500ms bekleme
  const CONFIRM_COUNT = 3; // Aynı barkod 3 kere okunmalı
  const CONFIRM_TIMEOUT = 2500; // 2.5 saniye içinde aynı barkod tekrarlanmalı

  // Buffer'ı temizle
  const clearBarcodeBuffer = useCallback(() => {
    barcodeBuffer.current = [];
    setIsConfirming(false);
    setConfirmProgress(0);
    if (confirmTimeout.current) {
      clearTimeout(confirmTimeout.current);
      confirmTimeout.current = null;
    }
  }, []);

  // Barkod işleme fonksiyonu
  const processBarcodeRequest = useCallback(
    async (barcode: string) => {
      setIsProcessing(true);
      clearBarcodeBuffer();

      try {
        // API'den ürün bilgisi çek
        const response = await findProductByBarcode(barcode);

        if (response.success && response.data) {
          // Başarılı - ProductDetail sayfasına yönlendir
          navigation.navigate('ProductDetail', { barcode });
        } else {
          // Ürün bulunamadı
          Alert.alert(
            'Ürün Bulunamadı',
            `"${barcode}" barkodlu ürün bulunamadı. Tekrar denemek için farklı bir barkod okutun.`,
            [
              {
                text: 'Tamam',
                onPress: () => {
                  setIsProcessing(false);
                },
              },
            ],
          );
        }
      } catch {
        Alert.alert(
          'Hata',
          'Ürün bilgisi alınırken bir hata oluştu. Lütfen tekrar deneyin.',
          [
            {
              text: 'Tamam',
              onPress: () => {
                setIsProcessing(false);
              },
            },
          ],
        );
      }
    },
    [navigation, clearBarcodeBuffer],
  );

  // Barkod okuma fonksiyonu - Kesinleşme mekanizması ile
  const handleBarcodeScanned = useCallback(
    async (barcode: string) => {
      if (isProcessing) {
        return;
      }

      // Cooldown kontrolü
      const now = Date.now();
      if (now - lastScanTime.current < SCAN_COOLDOWN) {
        return;
      }
      lastScanTime.current = now;

      // Barkod buffer'ına ekle
      barcodeBuffer.current.push(barcode);

      // Son CONFIRM_COUNT kadar barkodu kontrol et
      const recentBarcodes = barcodeBuffer.current.slice(-CONFIRM_COUNT);

      // Tüm son barkodlar aynı mı?
      const allSame = recentBarcodes.every(b => b === barcode);
      const hasEnoughScans = recentBarcodes.length >= CONFIRM_COUNT;

      if (allSame && hasEnoughScans) {
        // Barkod kesinleşti - İşleme başla
        processBarcodeRequest(barcode);
      } else {
        // Henüz kesinleşmedi - Progress göster
        setIsConfirming(true);
        setConfirmProgress(recentBarcodes.length / CONFIRM_COUNT);

        // Timeout'u sıfırla
        if (confirmTimeout.current) {
          clearTimeout(confirmTimeout.current);
        }

        // Belirli bir süre sonra buffer'ı temizle
        confirmTimeout.current = setTimeout(() => {
          clearBarcodeBuffer();
        }, CONFIRM_TIMEOUT);
      }
    },
    [
      isProcessing,
      SCAN_COOLDOWN,
      CONFIRM_COUNT,
      CONFIRM_TIMEOUT,
      processBarcodeRequest,
      clearBarcodeBuffer,
    ],
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
    regionOfInterest: SCAN_REGION,
    onCodeScanned: codes => {
      // code.frame: kamera önizlemesine göre dp cinsinden konum (her iki platform)
      const validCode = codes.find(code => {
        if (!code.value) {
          return false;
        }
        if (!code.frame) {
          // Konum bilgisi yoksa geç, taramayı engelle
          return false;
        }
        const centerX = code.frame.x + code.frame.width / 2;
        const centerY = code.frame.y + code.frame.height / 2;
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
      console.log('📷 CameraScreen focused - Resetting states');
      setIsProcessing(false);
      clearBarcodeBuffer();

      return () => {
        // Ekran blur olduğunda cleanup
        console.log('📷 CameraScreen blurred - Cleaning up');
        clearBarcodeBuffer();
      };
    }, [clearBarcodeBuffer]),
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
        ) : isConfirming ? (
          <>
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${confirmProgress * 100}%` },
                  ]}
                />
              </View>
            </View>
            <Text style={styles.messageText}>Barkod Okunuyor...</Text>
            <Text style={styles.subText}>
              Lütfen barkodu sabit tutun ({Math.round(confirmProgress * 100)}%)
            </Text>
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
  progressContainer: {
    width: '80%',
    alignItems: 'center',
    marginBottom: 16,
  },
  progressBar: {
    width: '100%',
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 3,
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
