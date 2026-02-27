import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  TextInput,
  Modal,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CameraStackParamList } from '../types/navigation';
import {
  searchProducts,
  getBrands,
  getCategories,
  getDeviceModels,
  type Product,
  type Brand,
  type Category,
  type DeviceModel,
} from '../services/api';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTabBar } from '../context/TabBarContext';
import fonts from '../theme/fonts';

type Props = NativeStackScreenProps<CameraStackParamList, 'ProductList'>;

function ProductListScreen({ route, navigation }: Props) {
  const {
    categoryId,
    categoryName,
    brandId,
    brandName,
    modelId,
    searchQuery: initialSearchQuery,
  } = route.params;
  const insets = useSafeAreaInsets();
  const { showTabBar, hideTabBar } = useTabBar();
  const lastScrollY = useRef(0);

  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery || '');
  const [isSearching, setIsSearching] = useState(false);

  // Infinite scroll state'leri
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Aktif filtreler (uygulanan)
  const [activeCategoryId, setActiveCategoryId] = useState<
    number | undefined
  >(categoryId);
  const [activeBrandId, setActiveBrandId] = useState<number | undefined>(
    brandId,
  );

  // Filtre modal state'leri
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoadingBrands, setIsLoadingBrands] = useState(false);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [isBrandDropdownOpen, setIsBrandDropdownOpen] = useState(false);
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
  const [activeModelId, setActiveModelId] = useState<number | undefined>(modelId);

  // Mağaza stoğu filtresi state'leri
  const [selectedByStoreStock, setSelectedByStoreStock] = useState(false);
  const [selectedStoreStockLimit, setSelectedStoreStockLimit] = useState('1');
  const [activeByStoreStock, setActiveByStoreStock] = useState(false);
  const [activeStoreStockLimit, setActiveStoreStockLimit] = useState(1);

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

  // Başlık oluştur
  const getTitle = () => {
    if (categoryName && brandName) {
      return `${categoryName} - ${brandName}`;
    } else if (categoryName) {
      return categoryName;
    } else if (brandName) {
      return brandName;
    }
    return 'Ürün Listesi';
  };

  // Header padding style - memoized
  const headerStyle = useMemo(
    () => [styles.header, { paddingTop: insets.top > 0 ? insets.top : 12 }],
    [insets.top],
  );

  // Ürünleri yükle
  const loadProducts = useCallback(
    async (
      query: string = '',
      page: number = 1,
      catId?: number,
      brId?: number,
      byStoreStock?: boolean,
      storeStockLimit?: number,
      mdlId?: number,
    ) => {
      if (page === 1) {
        setIsLoading(true);
      }

      try {
        const response = await searchProducts(
          query,
          page,
          catId,
          undefined,
          brId,
          mdlId,
          byStoreStock,
          storeStockLimit,
        );

        if (response.success && response.data) {
          const filteredProducts = response.data;

          if (page === 1) {
            setProducts(filteredProducts);
          } else {
            setProducts(prev => [...prev, ...filteredProducts]);
          }

          setHasMore(filteredProducts.length === 50);
        } else {
          if (page === 1) {
            setProducts([]);
          }
          setHasMore(false);
        }
      } catch (err) {
        console.error('Product load error:', err);
        if (page === 1) {
          setProducts([]);
        }
        setHasMore(false);
      } finally {
        if (page === 1) {
          setIsLoading(false);
        }
      }
    },
    [setProducts],
  );

  // İlk yükleme
  useEffect(() => {
    loadProducts(initialSearchQuery, 1, activeCategoryId, activeBrandId, undefined, undefined, activeModelId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Daha fazla ürün yükle (infinite scroll)
  const loadMoreProducts = () => {
    if (!isLoadingMore && hasMore && !isLoading) {
      setIsLoadingMore(true);
      const nextPage = currentPage + 1;
      setCurrentPage(nextPage);
      loadProducts(searchQuery, nextPage, activeCategoryId, activeBrandId, activeByStoreStock, activeStoreStockLimit, activeModelId).finally(
        () => {
          setIsLoadingMore(false);
        },
      );
    }
  };

  // Arama fonksiyonu - debounce ile
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setCurrentPage(1);
      setHasMore(true);
      loadProducts('', 1, activeCategoryId, activeBrandId, activeByStoreStock, activeStoreStockLimit, activeModelId);
      return;
    }
    setIsSearching(true);
    const timeoutId = setTimeout(() => {
      setCurrentPage(1);
      setHasMore(true);
      loadProducts(searchQuery, 1, activeCategoryId, activeBrandId, activeByStoreStock, activeStoreStockLimit, activeModelId);
      setIsSearching(false);
    }, 500);

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  // Markaları yükle
  const loadBrands = async () => {
    if (isLoadingBrands) return;
    setIsLoadingBrands(true);
    try {
      const response = await getBrands();
      if (response.success && response.data) {
        setBrands(response.data);
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
      if (response.success && response.data) {
        setCategories(response.data);
      }
    } catch (err) {
      console.error('Categories load error:', err);
    } finally {
      setIsLoadingCategories(false);
    }
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

  const toggleCategoryDropdown = () => {
    setIsCategoryDropdownOpen(!isCategoryDropdownOpen);
    if (categories.length === 0) loadCategories();
  };

  const toggleBrandDropdown = () => {
    if (isLoadingBrands) return;
    setIsBrandDropdownOpen(prev => !prev);
    if (brands.length === 0) loadBrands();
  };

  const toggleModelDropdown = () => {
    if (isLoadingModels) return;
    setIsModelDropdownOpen(prev => !prev);
  };

  // Ürün seçimi
  const handleProductPress = async (product: Product) => {
    navigation.navigate('ProductDetail', {
      barcode: product.barcode,
    });
  };

  // Scroll handler
  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const currentScrollY = event.nativeEvent.contentOffset.y;
    const scrollDiff = currentScrollY - lastScrollY.current;

    if (Math.abs(scrollDiff) > 5) {
      if (scrollDiff > 0 && currentScrollY > 50) {
        hideTabBar();
      } else if (scrollDiff < 0) {
        showTabBar();
      }
    }

    lastScrollY.current = currentScrollY;
  };

  // Ürün render fonksiyonu
  const renderProduct = ({ item }: { item: Product }) => (
    <TouchableOpacity
      style={styles.productCard}
      onPress={() => handleProductPress(item)}
      activeOpacity={0.7}
    >
      {item.coverUrlThumb ? (
        <Image
          source={{ uri: item.coverUrlThumb }}
          style={styles.productImage}
          resizeMode="contain"
        />
      ) : (
        <View style={styles.productImagePlaceholder}>
          <Icon name="package-variant" size={48} color="#ccc" />
        </View>
      )}
      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={2}>
          {item.name}
        </Text>
        <Text style={styles.productBarcode}>{item.barcode}</Text>
        <View style={styles.productFooter}>
          <Text style={styles.productPrice}>
            {item.price5} {item.price5_cur}
          </Text>
          {item.totalStock > 0 ? (
            <View style={styles.stockBadge}>
              <Icon name="check-circle" size={14} color="#4CAF50" />
              <Text style={styles.stockText}>{item.totalStock} Adet</Text>
            </View>
          ) : (
            <View style={[styles.stockBadge, styles.stockBadgeEmpty]}>
              <Icon name="close-circle" size={14} color="#F44336" />
              <Text style={[styles.stockText, styles.stockTextEmpty]}>
                Stokta Yok
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={headerStyle}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>{getTitle()}</Text>
        </View>
      </View>

      {/* Arama Input + Filtre Butonu */}
      <View style={styles.searchRow}>
        <View style={styles.searchContainer}>
          <Icon
            name="magnify"
            size={20}
            color="#999"
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Ürünler içinde ara..."
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
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

        {/* Filtre Butonu */}
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => {
            setShowFilterModal(true);
            if (brands.length === 0) loadBrands();
            if (categories.length === 0) loadCategories();
          }}
        >
          <Icon name="filter" size={22} color="#666" />
        </TouchableOpacity>
      </View>

      {/* Ürün Listesi */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#F99D26" />
          <Text style={styles.loadingText}>Ürünler yükleniyor...</Text>
        </View>
      ) : products.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Icon name="package-variant-closed" size={64} color="#ccc" />
          <Text style={styles.emptyTitle}>Ürün Bulunamadı</Text>
          <Text style={styles.emptyText}>
            {searchQuery
              ? 'Arama kriterlerine uygun ürün bulunamadı'
              : 'Bu kategoride ürün bulunmuyor'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={item => item.id.toString()}
          renderItem={renderProduct}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 80 },
          ]}
          showsVerticalScrollIndicator={false}
          onEndReached={loadMoreProducts}
          onEndReachedThreshold={0.5}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          ListFooterComponent={
            isLoadingMore ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color="#F99D26" />
                <Text style={styles.footerLoaderText}>
                  Daha fazla ürün yükleniyor...
                </Text>
              </View>
            ) : null
          }
        />
      )}

      {/* Filtre Modal */}
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
                    Kategori{' '}
                    {selectedCategory && `(${selectedCategory.name})`}
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

              {/* Mağaza Stoğu Filtresi */}
              <View style={styles.storeStockContainer}>
                <TouchableOpacity
                  style={styles.checkboxRow}
                  onPress={() => setSelectedByStoreStock(prev => !prev)}
                  activeOpacity={0.7}
                >
                  <Icon
                    name={selectedByStoreStock ? 'checkbox-marked' : 'checkbox-blank-outline'}
                    size={22}
                    color={selectedByStoreStock ? '#F99D26' : '#999'}
                  />
                  <Text style={styles.checkboxLabel}>Mağaza stoğumda ara</Text>
                </TouchableOpacity>
                {selectedByStoreStock && (
                  <View style={styles.stockLimitRow}>
                    <Text style={styles.stockLimitLabel}>Minimum stok adedi:</Text>
                    <TextInput
                      style={styles.stockLimitInput}
                      value={selectedStoreStockLimit}
                      onChangeText={text => {
                        const numeric = text.replace(/[^0-9]/g, '');
                        setSelectedStoreStockLimit(numeric === '' ? '1' : numeric);
                      }}
                      keyboardType="numeric"
                      maxLength={4}
                    />
                  </View>
                )}
              </View>
            </View>

            {/* Modal Footer */}
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
                  setSelectedByStoreStock(false);
                  setSelectedStoreStockLimit('1');
                  setActiveCategoryId(categoryId);
                  setActiveBrandId(brandId);
                  setActiveModelId(undefined);
                  setActiveByStoreStock(false);
                  setActiveStoreStockLimit(1);
                  setCurrentPage(1);
                  setHasMore(true);
                  loadProducts(searchQuery, 1, categoryId, brandId, false, 1, undefined);
                  setShowFilterModal(false);
                }}
              >
                <Text style={styles.filterClearButtonText}>Temizle</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.filterApplyButton}
                onPress={() => {
                  const newCatId = selectedCategory?.id;
                  const newBrId = selectedBrand?.id;
                  const newMdlId = selectedModel?.id;
                  const newByStoreStock = selectedByStoreStock;
                  const newStoreStockLimit = parseInt(selectedStoreStockLimit, 10) || 1;
                  setActiveCategoryId(newCatId);
                  setActiveBrandId(newBrId);
                  setActiveModelId(newMdlId);
                  setActiveByStoreStock(newByStoreStock);
                  setActiveStoreStockLimit(newStoreStockLimit);
                  setCurrentPage(1);
                  setHasMore(true);
                  loadProducts(searchQuery, 1, newCatId, newBrId, newByStoreStock, newStoreStockLimit, newMdlId);
                  setShowFilterModal(false);
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#F99D26',
    paddingHorizontal: 16,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#fff',
    opacity: 0.9,
    marginTop: 2,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    gap: 8,
  },
  searchContainer: {
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
  filterButton: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  listContent: {
    padding: 16,
  },
  productCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    flexDirection: 'row',
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  productImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
  },
  productImagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  productInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'space-between',
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  productBarcode: {
    fontSize: 12,
    color: '#999',
    marginBottom: 8,
  },
  productFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  productPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F99D26',
  },
  stockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  stockBadgeEmpty: {
    backgroundColor: '#FFEBEE',
  },
  stockText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4CAF50',
    marginLeft: 4,
  },
  stockTextEmpty: {
    color: '#F44336',
  },
  footerLoader: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerLoaderText: {
    marginTop: 8,
    fontSize: 13,
    color: '#666',
  },
  // Filter Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
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
  storeStockContainer: {
    marginBottom: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkboxLabel: {
    fontSize: 16,
    fontFamily: fonts.semiBold,
    color: '#333',
    marginLeft: 10,
  },
  stockLimitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
  },
  stockLimitLabel: {
    flex: 1,
    fontSize: 14,
    fontFamily: fonts.regular,
    color: '#666',
  },
  stockLimitInput: {
    width: 72,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    textAlign: 'center',
    fontSize: 16,
    fontFamily: fonts.semiBold,
    color: '#333',
  },
});

export default ProductListScreen;
