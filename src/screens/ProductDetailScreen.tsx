import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  Pressable,
  ActivityIndicator,
  Alert,
  TextInput,
  FlatList,
  Image,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTabBar } from '../context/TabBarContext';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CameraStackParamList } from '../types/navigation';
import { mockProduct } from '../types/product';
import {
  findProductByBarcode,
  sendProductIdToService,
  searchProducts,
  getBrands,
  getCategories,
  getDeviceModels,
  sendFeedback,
  type Product,
  type Brand,
  type Category,
  type DeviceModel,
} from '../services/api';
import ImageCarousel from '../components/ImageCarousel';
import InfoTable from '../components/InfoTable';
import StoreStockList from '../components/StoreStockList';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import fonts from '../theme/fonts';
// import colors from '../theme/colors';

type Props = NativeStackScreenProps<CameraStackParamList, 'ProductDetail'>;

function ProductDetailScreen({ route, navigation }: Props) {
  const { barcode } = route.params;
  const insets = useSafeAreaInsets();
  const { showTabBar, hideTabBar } = useTabBar();
  const lastScrollY = useRef(0);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [product, setProduct] = useState<Product | null>(null);
  const [variations, setVariations] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Arama state'leri
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);

  // Filtre state'leri
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoadingBrands, setIsLoadingBrands] = useState(false);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);

  // Dropdown açık/kapalı state'leri
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [isBrandDropdownOpen, setIsBrandDropdownOpen] = useState(false);
  const [isFeatureDropdownOpen, setIsFeatureDropdownOpen] = useState(false);

  // Seçili filtreler
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(
    null,
  );
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);
  const [categorySearchQuery, setCategorySearchQuery] = useState('');
  const [brandSearchQuery, setBrandSearchQuery] = useState('');

  // Model state'leri
  const [models, setModels] = useState<DeviceModel[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<DeviceModel | null>(null);
  const [modelSearchQuery, setModelSearchQuery] = useState('');

  // Feedback state'leri
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [isSendingFeedback, setIsSendingFeedback] = useState(false);

  // Bilgi tablosu için veriler - Memoized (early return'den önce tanımlanmalı)
  const infoRows = useMemo(() => {
    if (!product) return [];
    return [
      {
        label: 'Normal Fiyat',
        value: product.price1,
        suffix: product.price1_cur,
        highlight: true,
      },
      {
        label: 'Club Fiyat',
        value: product.price6,
        suffix: product.price6_cur,
        highlight: true,
      },
      {
        label: 'Güncelleme Tarihi',
        value: new Date().toLocaleDateString('tr-TR'),
        suffix: undefined,
      },
      {
        label: 'Toplam Stok',
        value: String(product.totalStock),
        suffix: 'Adet',
      },
      {
        label: 'Yıllık Satış',
        value: product.sales_total > 0 ? String(product.sales_total) : '-',
        suffix: product.sales_total > 0 ? 'Adet' : undefined,
      },
    ];
  }, [product]);

  const filteredBrands = useMemo(
    () =>
      brands.filter(item =>
        item.name.toLowerCase().includes(brandSearchQuery.toLowerCase()),
      ),
    [brands, brandSearchQuery],
  );

  const filteredCategories = useMemo(
    () =>
      categories.filter(item =>
        item.name.toLowerCase().includes(categorySearchQuery.toLowerCase()),
      ),
    [categories, categorySearchQuery],
  );

  const filteredModels = useMemo(
    () =>
      models.filter(item =>
        item.name.toLowerCase().includes(modelSearchQuery.toLowerCase()),
      ),
    [models, modelSearchQuery],
  );

  // Resim listesi - Memoized (early return'den önce tanımlanmalı)
  // Eğer varyantlar varsa, tüm varyantların resimlerini göster
  const images = useMemo(() => {
    if (variations.length > 1) {
      // Varyantların resimlerini döndür
      return variations.map(v => v.coverUrlThumb).filter(Boolean);
    }
    if (!product) return [];
    return product.coverUrlThumb ? [product.coverUrlThumb] : [];
  }, [product, variations]);

  // Resim değiştiğinde varyantı değiştir
  const handleImageChange = (index: number) => {
    console.log('🔄 [handleImageChange] Called with index:', index);
    console.log('📦 [handleImageChange] Variations length:', variations.length);
    console.log(
      '✅ [handleImageChange] Has variation at index:',
      !!variations[index],
    );

    if (variations.length > 1 && variations[index]) {
      console.log(
        '🎯 [handleImageChange] Changing to variation:',
        variations[index].name,
      );
      setProduct(variations[index]);
    }
  };

  // Arama fonksiyonu - debounce ile
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    setIsSearching(true);
    const timeoutId = setTimeout(async () => {
      try {
        const response = await searchProducts(searchQuery);
        if (response.success && response.data) {
          setSearchResults(response.data);
          setShowSearchResults(true);
        } else {
          setSearchResults([]);
        }
      } catch (err) {
        console.error('Search error:', err);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // Ürün bilgisini API'den çek
  useEffect(() => {
    const fetchProduct = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await findProductByBarcode(barcode);

        if (response.success && response.data) {
          // İlk API'nin verisini hemen kullanıcıya göster
          console.log(
            '📦 [ProductDetail] İlk API verisi:',
            JSON.stringify(response.data, null, 2),
          );
          setProduct(response.data);
          // Variations varsa kaydet
          if (response.variations && response.variations.length > 0) {
            setVariations(response.variations);
          }
          setIsLoading(false);

          // İkinci API'yi arka planda çağır - kullanıcı beklemeyecek
          sendProductIdToService(barcode, response.data.id)
            .then(postResponse => {
              if (postResponse.success && postResponse.data) {
                console.log(
                  '📦 [ProductDetail] İkinci API (POST) verisi:',
                  JSON.stringify(postResponse.data, null, 2),
                );
                console.log(
                  '✅ [fetchProduct] POST response variations:',
                  postResponse.variations?.length,
                );
                // Variations varsa güncelle
                if (
                  postResponse.variations &&
                  postResponse.variations.length > 0
                ) {
                  setVariations(postResponse.variations);
                  // İlk varyantı set et
                  setProduct(postResponse.variations[0]);
                } else {
                  // Variations yoksa sadece product'ı güncelle
                  setProduct(postResponse.data);
                }
              }
            })
            .catch(postError => {
              // İkinci API başarısız olsa bile ilk veriye devam et
              console.error('Background POST failed:', postError);
            });
        } else {
          setError(response.error || 'Ürün bulunamadı');
          setIsLoading(false);
          Alert.alert(
            'Ürün Bulunamadı',
            `"${barcode}" barkodlu ürün bulunamadı.`,
            [
              {
                text: 'Tekrar Tara',
                onPress: () => navigation.goBack(),
              },
              {
                text: 'Mock Data Kullan',
                onPress: () => setProduct(mockProduct),
              },
            ],
          );
        }
      } catch {
        setError('Bir hata oluştu');
        setIsLoading(false);
        Alert.alert('Hata', 'Ürün bilgisi alınırken bir hata oluştu.', [
          {
            text: 'Tekrar Dene',
            onPress: () => fetchProduct(),
          },
          {
            text: 'Mock Data Kullan',
            onPress: () => setProduct(mockProduct),
          },
        ]);
      }
    };

    fetchProduct();
  }, [barcode, navigation]);

  // Yükleme durumu
  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#F99D26" />
          <Text style={styles.loadingText}>Ürün bilgisi yükleniyor...</Text>
        </View>
      </View>
    );
  }

  // Hata durumu
  if (error || !product) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>Ürün bilgisi yüklenemedi</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.retryButtonText}>Geri Dön</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Arama sonucundan ürün seçme
  const handleSelectProduct = async (selectedProduct: Product) => {
    setShowSearchResults(false);
    setSearchQuery('');
    setProduct(selectedProduct);

    // Arka planda ikinci API'yi çağır
    if (selectedProduct.barcode && selectedProduct.id) {
      sendProductIdToService(selectedProduct.barcode, selectedProduct.id)
        .then(postResponse => {
          if (postResponse.success && postResponse.data) {
            setProduct(postResponse.data);
            // Variations varsa güncelle
            if (postResponse.variations && postResponse.variations.length > 0) {
              setVariations(postResponse.variations);
            }
          }
        })
        .catch(postError => {
          console.error('Background POST failed:', postError);
        });
    }
  };

  // Markaları yükle
  const loadBrands = async () => {
    if (isLoadingBrands) return;
    setIsLoadingBrands(true);
    try {
      const response = await getBrands();
      console.log('🔍 [ProductDetailScreen] getBrands response:', {
        success: response.success,
        dataLength: response.data?.length,
        firstItem: response.data?.[0],
      });
      if (response.success && response.data) {
        setBrands(response.data);
        console.log(
          '✅ [ProductDetailScreen] Brands state güncellendi:',
          response.data.length,
        );
      }
    } catch (err) {
      console.error('Brands load error:', err);
    } finally {
      setIsLoadingBrands(false);
    }
  };

  // Kategorileri yükle
  const loadCategories = async () => {
    setIsLoadingCategories(true);
    try {
      const response = await getCategories();
      console.log('🔍 [ProductDetailScreen] getCategories response:', {
        success: response.success,
        dataLength: response.data?.length,
        firstItem: response.data?.[0],
      });
      if (response.success && response.data) {
        setCategories(response.data);
        console.log(
          '✅ [ProductDetailScreen] Categories state güncellendi:',
          response.data.length,
        );
      }
    } catch (err) {
      console.error('Categories load error:', err);
    } finally {
      setIsLoadingCategories(false);
    }
  };

  // Dropdown toggle fonksiyonları
  const toggleCategoryDropdown = () => {
    console.log('🔄 [ProductDetailScreen] Category dropdown toggled:', {
      before: isCategoryDropdownOpen,
      after: !isCategoryDropdownOpen,
      categoriesLength: categories.length,
    });
    setIsCategoryDropdownOpen(!isCategoryDropdownOpen);
    if (categories.length === 0) {
      console.log('📥 [ProductDetailScreen] Loading categories...');
      loadCategories();
    }
  };

  const toggleBrandDropdown = () => {
    if (isLoadingBrands) return;
    console.log('🔄 [ProductDetailScreen] Brand dropdown toggled:', {
      before: isBrandDropdownOpen,
      after: !isBrandDropdownOpen,
      brandsLength: brands.length,
    });
    setIsBrandDropdownOpen(prev => !prev);
    if (brands.length === 0) {
      console.log('📥 [ProductDetailScreen] Loading brands...');
      loadBrands();
    }
  };

  const toggleFeatureDropdown = () => {
    console.log('🔄 [ProductDetailScreen] Feature dropdown toggled:', {
      before: isFeatureDropdownOpen,
      after: !isFeatureDropdownOpen,
    });
    setIsFeatureDropdownOpen(!isFeatureDropdownOpen);
  };

  // Modelleri yükle
  const loadModels = async (brId: number) => {
    setIsLoadingModels(true);
    setModels([]);
    try {
      const response = await getDeviceModels(brId);
      if (response.success && response.data) {
        setModels(response.data);
      }
    } catch (err) {
      console.error('Models load error:', err);
    } finally {
      setIsLoadingModels(false);
    }
  };

  const toggleModelDropdown = () => {
    if (isLoadingModels) return;
    setIsModelDropdownOpen(prev => !prev);
  };

  // Scroll handler - aşağı kaydırınca tab bar gizle, yukarı kaydırınca göster
  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const currentScrollY = event.nativeEvent.contentOffset.y;
    const scrollDiff = currentScrollY - lastScrollY.current;

    // Sadece belirli bir eşik değerini geçtikten sonra tepki ver (5px)
    if (Math.abs(scrollDiff) > 5) {
      if (scrollDiff > 0 && currentScrollY > 50) {
        // Aşağı kaydırılıyor - tab bar'ı gizle
        hideTabBar();
      } else if (scrollDiff < 0) {
        // Yukarı kaydırılıyor - tab bar'ı göster
        showTabBar();
      }
    }

    lastScrollY.current = currentScrollY;
  };

  // Feedback gönderme fonksiyonu
  const handleSendFeedback = async (type: 'Expensive' | 'Cheap' | 'Other') => {
    setShowSortMenu(false);

    // "Diğer" seçildiyse modal aç
    if (type === 'Other') {
      setShowFeedbackModal(true);
      return;
    }

    // Expensive veya Cheap için direkt gönder
    setIsSendingFeedback(true);
    try {
      const response = await sendFeedback(barcode, type);
      if (response.success) {
        Alert.alert('Başarılı', 'Geri bildiriminiz gönderildi. Teşekkürler!');
      } else {
        Alert.alert('Hata', response.error || 'Geri bildirim gönderilemedi');
      }
    } catch {
      Alert.alert('Hata', 'Bir hata oluştu');
    } finally {
      setIsSendingFeedback(false);
    }
  };

  // "Diğer" için text ile feedback gönder
  const handleSendOtherFeedback = async () => {
    if (!feedbackText.trim()) {
      Alert.alert('Uyarı', 'Lütfen geri bildirim metnini girin');
      return;
    }

    setIsSendingFeedback(true);
    try {
      const response = await sendFeedback(barcode, 'Other', feedbackText);
      if (response.success) {
        Alert.alert('Başarılı', 'Geri bildiriminiz gönderildi. Teşekkürler!');
        setShowFeedbackModal(false);
        setFeedbackText('');
      } else {
        Alert.alert('Hata', response.error || 'Geri bildirim gönderilemedi');
      }
    } catch {
      Alert.alert('Hata', 'Bir hata oluştu');
    } finally {
      setIsSendingFeedback(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Arama ve Aksiyon Butonları - Tek Satır */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrapper}>
          <Icon
            name="magnify"
            size={20}
            color="#999"
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Ürün ara..."
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFocus={() => {
              if (searchQuery.length >= 2) {
                setShowSearchResults(true);
              }
            }}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setSearchQuery('');
                setShowSearchResults(false);
              }}
              style={styles.clearButton}
            >
              <Icon name="close" size={20} color="#999" />
            </TouchableOpacity>
          )}
          {isSearching && (
            <ActivityIndicator
              size="small"
              color="#F99D26"
              style={styles.searchLoader}
            />
          )}
        </View>

        {/* Kamera Butonu */}
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => navigation.navigate('Scanner')}
        >
          <Icon name="camera" size={22} color="#666" />
        </TouchableOpacity>

        {/* Filtre Butonu */}
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => {
            console.log('🎯 [ProductDetailScreen] Filter modal opening:', {
              brandsLength: brands.length,
              categoriesLength: categories.length,
              willLoadBrands: brands.length === 0,
              willLoadCategories: categories.length === 0,
            });
            setShowFilterModal(true);
            if (brands.length === 0) loadBrands();
            if (categories.length === 0) loadCategories();
          }}
        >
          <Icon name="filter" size={22} color="#666" />
        </TouchableOpacity>

        {/* Üç Nokta Menü Butonu */}
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => setShowSortMenu(true)}
        >
          <Icon name="dots-vertical" size={22} color="#666" />
        </TouchableOpacity>
      </View>

      {/* Arama Sonuçları - Overlay */}
      {showSearchResults && searchResults.length > 0 && (
        <View style={styles.searchResultsOverlay}>
          <FlatList
            data={searchResults}
            keyExtractor={item => item.id.toString()}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.searchResultItem}
                onPress={() => handleSelectProduct(item)}
              >
                {item.coverUrlThumb ? (
                  <Image
                    source={{ uri: item.coverUrlThumb }}
                    style={styles.searchResultImage}
                    resizeMode="contain"
                  />
                ) : (
                  <View style={styles.searchResultImagePlaceholder}>
                    <Icon name="package-variant" size={32} color="#999" />
                  </View>
                )}
                <View style={styles.searchResultInfo}>
                  <Text style={styles.searchResultName} numberOfLines={2}>
                    {item.name}
                  </Text>
                  <Text style={styles.searchResultBarcode}>{item.barcode}</Text>
                  <Text style={styles.searchResultPrice}>
                    {item.price1} {item.price1_cur}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
            style={styles.searchResultsList}
            keyboardShouldPersistTaps="handled"
          />
        </View>
      )}

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: 80 + insets.bottom },
        ]}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {/* Ürün Resmi Carousel - Varyantlar varsa resimleri carousel'de göster */}
        <ImageCarousel images={images} onImageChange={handleImageChange} />

        {/* Ürün Adı */}
        <View style={styles.productNameSection}>
          <Text style={styles.productName}>{product.name}</Text>
        </View>

        {/* Bilgi Tablosu */}
        <InfoTable rows={infoRows} />

        {/* Mağaza Stokları - Sadece varsa göster */}
        {product.storeStocks && product.storeStocks.length > 0 ? (
          <StoreStockList
            storeStocks={product.storeStocks}
            totalStock={product.totalStock}
          />
        ) : (
          <View style={styles.emptySection}>
            <Text style={styles.emptySectionTitle}>Mağaza Stokları</Text>
            <Text style={styles.emptySectionText}>
              Mağaza stok bilgisi bulunamadı
            </Text>
          </View>
        )}

        {/* Ürün Özellikleri - Sadece varsa göster */}
        {product.features && product.features.length > 0 ? (
          <View style={styles.priceSection}>
            <Text style={styles.priceSectionTitle}>Ürün Özellikleri</Text>
            <View style={styles.priceGrid}>
              {product.features.map((feature, index) => (
                <View key={index} style={styles.priceItem}>
                  <Text style={styles.priceLabel}>{feature.name}</Text>
                  <Text style={styles.priceValue}>{feature.value}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : (
          <View style={styles.emptySection}>
            <Text style={styles.emptySectionTitle}>Ürün Özellikleri</Text>
            <Text style={styles.emptySectionText}>
              Ürün özelliği bulunamadı
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Sıralama Menü Modal */}
      <Modal
        visible={showSortMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSortMenu(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowSortMenu(false)}
        >
          <View style={styles.sortMenu}>
            <Text style={styles.sortMenuTitle}>Geri Bildirim</Text>
            <TouchableOpacity
              style={styles.sortMenuItem}
              onPress={() => handleSendFeedback('Expensive')}
              disabled={isSendingFeedback}
            >
              <Text style={styles.sortMenuItemText}>Fiyat Pahalı</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.sortMenuItem}
              onPress={() => handleSendFeedback('Cheap')}
              disabled={isSendingFeedback}
            >
              <Text style={styles.sortMenuItemText}>Fiyat Düşük</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sortMenuItem, styles.sortMenuItemLast]}
              onPress={() => handleSendFeedback('Other')}
              disabled={isSendingFeedback}
            >
              <Text style={styles.sortMenuItemText}>Diğer</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Filtre Modal - Dropdown'lar ile */}
      <Modal
        visible={showFilterModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFilterModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.filterModal}>
            {/* Modal Header */}
            <View style={styles.filterModalHeader}>
              <Text style={styles.filterModalTitle}>Filtreler</Text>
              <TouchableOpacity onPress={() => setShowFilterModal(false)}>
                <Icon name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <View style={styles.filterModalContent}>
              {/* Kategori Dropdown */}
              <View style={styles.dropdownContainer}>
                <TouchableOpacity
                  style={styles.dropdownHeader}
                  onPress={toggleCategoryDropdown}
                >
                  <Text style={styles.dropdownHeaderText}>
                    Kategori {selectedCategory && `(${selectedCategory.name})`}
                  </Text>
                  <Icon
                    name={
                      isCategoryDropdownOpen ? 'chevron-up' : 'chevron-down'
                    }
                    size={20}
                    color="#666"
                  />
                </TouchableOpacity>

                {isCategoryDropdownOpen && (
                  <View style={styles.dropdownContent}>
                    {/* Kategori Arama Input */}
                    <View style={styles.dropdownSearchContainer}>
                      <Icon
                        name="magnify"
                        size={18}
                        color="#999"
                        style={styles.dropdownSearchIcon}
                      />
                      <TextInput
                        style={styles.dropdownSearchInput}
                        placeholder="Kategori ara..."
                        placeholderTextColor="#999"
                        value={categorySearchQuery}
                        onChangeText={setCategorySearchQuery}
                      />
                    </View>

                    {isLoadingCategories ? (
                      <View style={styles.dropdownLoading}>
                        <ActivityIndicator size="small" color="#F99D26" />
                        <Text style={styles.dropdownLoadingText}>
                          Yükleniyor...
                        </Text>
                      </View>
                    ) : filteredCategories.length === 0 ? (
                      <Text style={styles.dropdownEmptyText}>
                        Kategori bulunamadı
                      </Text>
                    ) : (
                      <FlatList
                        data={filteredCategories}
                        keyExtractor={item => item.id.toString()}
                        style={styles.dropdownItemsScroll}
                        nestedScrollEnabled={true}
                        showsVerticalScrollIndicator={true}
                        keyboardShouldPersistTaps="handled"
                        renderItem={({ item }) => (
                          <TouchableOpacity
                            style={[
                              styles.dropdownItem,
                              selectedCategory?.id === item.id &&
                                styles.dropdownItemSelected,
                            ]}
                            onPress={() => {
                              setSelectedCategory(item);
                              setIsCategoryDropdownOpen(false);
                              setCategorySearchQuery('');
                            }}
                          >
                            <Text
                              style={[
                                styles.dropdownItemText,
                                selectedCategory?.id === item.id &&
                                  styles.dropdownItemTextSelected,
                              ]}
                            >
                              {item.name}
                            </Text>
                          </TouchableOpacity>
                        )}
                      />
                    )}
                  </View>
                )}
              </View>

              {/* Marka Dropdown */}
              <View style={styles.dropdownContainer}>
                <TouchableOpacity
                  style={styles.dropdownHeader}
                  onPress={toggleBrandDropdown}
                  disabled={isLoadingBrands}
                >
                  <Text style={styles.dropdownHeaderText}>
                    Marka {selectedBrand && `(${selectedBrand.name})`}
                  </Text>
                  <Icon
                    name={isBrandDropdownOpen ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color="#666"
                  />
                </TouchableOpacity>

                {isBrandDropdownOpen && (
                  <View style={styles.dropdownContent}>
                    {/* Marka Arama Input */}
                    <View style={styles.dropdownSearchContainer}>
                      <Icon
                        name="magnify"
                        size={18}
                        color="#999"
                        style={styles.dropdownSearchIcon}
                      />
                      <TextInput
                        style={styles.dropdownSearchInput}
                        placeholder="Marka ara..."
                        placeholderTextColor="#999"
                        value={brandSearchQuery}
                        onChangeText={setBrandSearchQuery}
                      />
                    </View>

                    {isLoadingBrands ? (
                      <View style={styles.dropdownLoading}>
                        <ActivityIndicator size="small" color="#F99D26" />
                        <Text style={styles.dropdownLoadingText}>
                          Yükleniyor...
                        </Text>
                      </View>
                    ) : filteredBrands.length === 0 ? (
                      <Text style={styles.dropdownEmptyText}>
                        Marka bulunamadı
                      </Text>
                    ) : (
                      <FlatList
                        data={filteredBrands}
                        keyExtractor={item => item.id.toString()}
                        style={styles.dropdownItemsScroll}
                        nestedScrollEnabled={true}
                        showsVerticalScrollIndicator={true}
                        keyboardShouldPersistTaps="handled"
                        renderItem={({ item }) => (
                          <TouchableOpacity
                            style={[
                              styles.dropdownItem,
                              selectedBrand?.id === item.id &&
                                styles.dropdownItemSelected,
                            ]}
                            onPress={() => {
                              setSelectedBrand(item);
                              setIsBrandDropdownOpen(false);
                              setBrandSearchQuery('');
                              setSelectedModel(null);
                              setModels([]);
                              setIsModelDropdownOpen(false);
                              setModelSearchQuery('');
                              loadModels(item.id);
                            }}
                          >
                            <Text
                              style={[
                                styles.dropdownItemText,
                                selectedBrand?.id === item.id &&
                                  styles.dropdownItemTextSelected,
                              ]}
                            >
                              {item.name}
                            </Text>
                          </TouchableOpacity>
                        )}
                      />
                    )}
                  </View>
                )}
              </View>

              {/* Model Dropdown - sadece marka seçiliyse göster */}
              {selectedBrand && (
                <View style={styles.dropdownContainer}>
                  <TouchableOpacity
                    style={styles.dropdownHeader}
                    onPress={toggleModelDropdown}
                    disabled={isLoadingModels}
                  >
                    <Text style={styles.dropdownHeaderText}>
                      Model {selectedModel && `(${selectedModel.name})`}
                    </Text>
                    {isLoadingModels ? (
                      <ActivityIndicator size="small" color="#F99D26" />
                    ) : (
                      <Icon
                        name={isModelDropdownOpen ? 'chevron-up' : 'chevron-down'}
                        size={20}
                        color="#666"
                      />
                    )}
                  </TouchableOpacity>

                  {isModelDropdownOpen && (
                    <View style={styles.dropdownContent}>
                      <View style={styles.dropdownSearchContainer}>
                        <Icon
                          name="magnify"
                          size={18}
                          color="#999"
                          style={styles.dropdownSearchIcon}
                        />
                        <TextInput
                          style={styles.dropdownSearchInput}
                          placeholder="Model ara..."
                          placeholderTextColor="#999"
                          value={modelSearchQuery}
                          onChangeText={setModelSearchQuery}
                        />
                      </View>
                      {isLoadingModels ? (
                        <View style={styles.dropdownLoading}>
                          <ActivityIndicator size="small" color="#F99D26" />
                          <Text style={styles.dropdownLoadingText}>
                            Yükleniyor...
                          </Text>
                        </View>
                      ) : filteredModels.length === 0 ? (
                        <Text style={styles.dropdownEmptyText}>
                          Model bulunamadı
                        </Text>
                      ) : (
                        <FlatList
                          data={filteredModels}
                          keyExtractor={item => item.id.toString()}
                          style={styles.dropdownItemsScroll}
                          nestedScrollEnabled={true}
                          showsVerticalScrollIndicator={true}
                          keyboardShouldPersistTaps="handled"
                          renderItem={({ item }) => (
                            <TouchableOpacity
                              style={[
                                styles.dropdownItem,
                                selectedModel?.id === item.id &&
                                  styles.dropdownItemSelected,
                              ]}
                              onPress={() => {
                                setSelectedModel(item);
                                setIsModelDropdownOpen(false);
                                setModelSearchQuery('');
                              }}
                            >
                              <Text
                                style={[
                                  styles.dropdownItemText,
                                  selectedModel?.id === item.id &&
                                    styles.dropdownItemTextSelected,
                                ]}
                              >
                                {item.name}
                              </Text>
                            </TouchableOpacity>
                          )}
                        />
                      )}
                    </View>
                  )}
                </View>
              )}

              {/* Özellikler Dropdown */}
              <View style={styles.dropdownContainer}>
                <TouchableOpacity
                  style={styles.dropdownHeader}
                  onPress={toggleFeatureDropdown}
                >
                  <Text style={styles.dropdownHeaderText}>Özellikler</Text>
                  <Icon
                    name={isFeatureDropdownOpen ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color="#666"
                  />
                </TouchableOpacity>

                {isFeatureDropdownOpen && (
                  <View style={styles.dropdownContent}>
                    <Text style={styles.dropdownEmptyText}>
                      Özellik filtreleri yakında eklenecek
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Modal Footer - Uygula ve Temizle Butonları */}
            <View style={styles.filterModalFooter}>
              <TouchableOpacity
                style={styles.filterClearButton}
                onPress={() => {
                  setSelectedCategory(null);
                  setSelectedBrand(null);
                  setSelectedModel(null);
                  setModels([]);
                  setModelSearchQuery('');
                  setIsModelDropdownOpen(false);
                }}
              >
                <Text style={styles.filterClearButtonText}>Temizle</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.filterApplyButton}
                onPress={() => {
                  navigation.navigate('ProductList', {
                    categoryId: selectedCategory?.id,
                    categoryName: selectedCategory?.name,
                    brandId: selectedBrand?.id,
                    brandName: selectedBrand?.name,
                    modelId: selectedModel?.id,
                  });

                  setShowFilterModal(false);
                  setSelectedCategory(null);
                  setSelectedBrand(null);
                  setSelectedModel(null);
                  setModels([]);
                  setCategorySearchQuery('');
                  setBrandSearchQuery('');
                  setModelSearchQuery('');
                  setIsCategoryDropdownOpen(false);
                  setIsBrandDropdownOpen(false);
                  setIsModelDropdownOpen(false);
                }}
              >
                <Text style={styles.filterApplyButtonText}>Uygula</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Diğer Feedback Modal - Text Input ile */}
      <Modal
        visible={showFeedbackModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowFeedbackModal(false);
          setFeedbackText('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.feedbackModal}>
            {/* Modal Header */}
            <View style={styles.feedbackModalHeader}>
              <Text style={styles.feedbackModalTitle}>Geri Bildiriminiz</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowFeedbackModal(false);
                  setFeedbackText('');
                }}
              >
                <Icon name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {/* Text Input */}
            <View style={styles.feedbackModalContent}>
              <Text style={styles.feedbackLabel}>
                Lütfen geri bildiriminizi yazın:
              </Text>
              <TextInput
                style={styles.feedbackTextInput}
                placeholder="Görüşlerinizi buraya yazın..."
                placeholderTextColor="#999"
                value={feedbackText}
                onChangeText={setFeedbackText}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            {/* Modal Footer */}
            <View style={styles.feedbackModalFooter}>
              <TouchableOpacity
                style={styles.feedbackCancelButton}
                onPress={() => {
                  setShowFeedbackModal(false);
                  setFeedbackText('');
                }}
                disabled={isSendingFeedback}
              >
                <Text style={styles.feedbackCancelButtonText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.feedbackSendButton}
                onPress={handleSendOtherFeedback}
                disabled={isSendingFeedback}
              >
                {isSendingFeedback ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.feedbackSendButtonText}>Gönder</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    gap: 8,
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#333',
    paddingVertical: 0,
    fontFamily: fonts.regular,
  },
  clearButton: {
    padding: 4,
    marginLeft: 4,
  },
  searchLoader: {
    marginLeft: 8,
  },
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchResultsOverlay: {
    position: 'absolute',
    top: 68,
    left: 16,
    right: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    maxHeight: 400,
    zIndex: 1000,
  },
  searchResultsList: {
    maxHeight: 400,
  },
  searchResultItem: {
    flexDirection: 'row',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    alignItems: 'center',
  },
  searchResultImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
  },
  searchResultImagePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchResultInfo: {
    flex: 1,
    marginLeft: 12,
  },
  searchResultName: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: '#333',
    marginBottom: 4,
  },
  searchResultBarcode: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
    fontFamily: fonts.regular,
  },
  searchResultPrice: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: '#F99D26',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    fontFamily: fonts.regular,
  },
  errorText: {
    fontSize: 18,
    fontFamily: fonts.semiBold,
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: 'colors.primary',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: fonts.semiBold,
  },
  emptySection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    alignItems: 'center',
  },
  emptySectionTitle: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: '#333',
    marginBottom: 8,
  },
  emptySectionText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    fontFamily: fonts.regular,
  },
  filterTabs: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  filterTabActive: {
    backgroundColor: 'colors.primary',
  },
  filterTabText: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: '#666',
  },
  filterTabTextActive: {
    color: '#fff',
  },
  content: {
    padding: 16,
  },
  productNameSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  productName: {
    fontSize: 18,
    fontFamily: fonts.bold,
    color: '#333',
    lineHeight: 24,
    marginBottom: 12,
  },
  barcodeTag: {
    alignSelf: 'flex-start',
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  barcodeTagText: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: '#1976d2',
    letterSpacing: 1,
  },
  variationInfo: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  priceSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  priceSectionTitle: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: '#333',
    marginBottom: 16,
  },
  priceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  priceItem: {
    width: '50%',
    paddingHorizontal: 6,
    marginBottom: 12,
  },
  priceLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
    fontFamily: fonts.regular,
  },
  priceValue: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: '#333',
  },
  priceDiscount: {
    color: '#4CAF50',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sortMenu: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '80%',
    maxWidth: 300,
    overflow: 'hidden',
  },
  sortMenuTitle: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: '#333',
    padding: 16,
    textAlign: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  sortMenuItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  sortMenuItemLast: {
    borderBottomWidth: 0,
  },
  sortMenuItemText: {
    fontSize: 15,
    color: '#333',
    textAlign: 'center',
    fontFamily: fonts.regular,
  },
  filterModal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    width: '100%',
    height: '80%',
    marginTop: 'auto',
  },
  filterModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  filterModalTitle: {
    fontSize: 18,
    fontFamily: fonts.bold,
    color: '#333',
  },
  filterModalContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  dropdownContainer: {
    marginBottom: 16,
    borderRadius: 12,
    backgroundColor: '#f8f9fa',
    overflow: 'hidden',
  },
  dropdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  dropdownHeaderDisabled: {
    opacity: 0.5,
  },
  dropdownHeaderText: {
    fontSize: 16,
    fontFamily: fonts.semiBold,
    color: '#333',
    flex: 1,
  },
  dropdownContent: {
    backgroundColor: '#fff',
    maxHeight: 300,
  },
  dropdownSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginHorizontal: 12,
    marginBottom: 8,
    marginTop: 4,
    paddingHorizontal: 12,
    height: 40,
  },
  dropdownSearchIcon: {
    marginRight: 8,
  },
  dropdownSearchInput: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    padding: 0,
    fontFamily: fonts.regular,
  },
  dropdownItemsScroll: {
    maxHeight: 200,
  },
  dropdownLoading: {
    padding: 20,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  dropdownLoadingText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
    fontFamily: fonts.regular,
  },
  dropdownEmptyText: {
    padding: 20,
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    fontFamily: fonts.regular,
  },
  dropdownItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  dropdownItemSelected: {
    backgroundColor: '#FFF8E1',
  },
  dropdownItemText: {
    fontSize: 15,
    color: '#333',
    fontFamily: fonts.regular,
  },
  dropdownItemTextSelected: {
    color: '#F99D26',
    fontFamily: fonts.semiBold,
  },
  filterModalFooter: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    gap: 12,
  },
  filterClearButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  filterClearButtonText: {
    fontSize: 16,
    fontFamily: fonts.semiBold,
    color: '#666',
  },
  filterApplyButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    backgroundColor: '#F99D26',
    alignItems: 'center',
  },
  filterApplyButtonText: {
    fontSize: 16,
    fontFamily: fonts.semiBold,
    color: '#fff',
  },
  filterModalLoading: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterModalLoadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
    fontFamily: fonts.regular,
  },
  filterModalList: {
    flex: 1,
  },
  filterModalItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  filterModalItemText: {
    fontSize: 15,
    color: '#333',
    fontFamily: fonts.regular,
  },
  debugText: {
    fontSize: 10,
    color: '#856404',
    fontFamily: 'Courier',
    lineHeight: 14,
  },
  listHeaderText: {
    padding: 12,
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: '#333',
    backgroundColor: '#f8f9fa',
  },
  // Feedback Modal Styles
  feedbackModal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    width: '100%',
    marginTop: 'auto',
    paddingBottom: 20,
  },
  feedbackModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  feedbackModalTitle: {
    fontSize: 18,
    fontFamily: fonts.bold,
    color: '#333',
  },
  feedbackModalClose: {
    fontSize: 24,
    color: '#666',
    padding: 4,
  },
  feedbackModalContent: {
    padding: 20,
  },
  feedbackLabel: {
    fontSize: 15,
    fontFamily: fonts.semiBold,
    color: '#333',
    marginBottom: 12,
  },
  feedbackTextInput: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    color: '#333',
    minHeight: 120,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    fontFamily: fonts.regular,
  },
  feedbackModalFooter: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
  },
  feedbackCancelButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  feedbackCancelButtonText: {
    fontSize: 16,
    fontFamily: fonts.semiBold,
    color: '#666',
  },
  feedbackSendButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    backgroundColor: '#F99D26',
    alignItems: 'center',
  },
  feedbackSendButtonText: {
    fontSize: 16,
    fontFamily: fonts.semiBold,
    color: '#fff',
  },
});

export default ProductDetailScreen;
