import React, { useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  Image,
  Dimensions,
  TouchableOpacity,
  ViewToken,
} from 'react-native';
import colors from '../theme/colors';

const { width: screenWidth } = Dimensions.get('window');
const CAROUSEL_WIDTH = screenWidth - 40;
const CAROUSEL_HEIGHT = 250;

interface ImageCarouselProps {
  images: string[];
  baseUrl?: string;
  onImageChange?: (index: number) => void;
}

function ImageCarousel({
  images,
  baseUrl = '',
  onImageChange,
}: ImageCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  // Use placeholder if no images
  const imageList = images.length > 0 ? images : ['placeholder'];

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index !== null) {
        const newIndex = viewableItems[0].index;
        setActiveIndex(newIndex);
        // Callback'i çağır
        if (onImageChange) {
          onImageChange(newIndex);
        }
      }
    },
  ).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  const goToPrev = () => {
    if (activeIndex > 0) {
      const newIndex = activeIndex - 1;
      flatListRef.current?.scrollToIndex({
        index: newIndex,
        animated: true,
      });
      setActiveIndex(newIndex);
      if (onImageChange) {
        onImageChange(newIndex);
      }
    }
  };

  const goToNext = () => {
    if (activeIndex < imageList.length - 1) {
      const newIndex = activeIndex + 1;
      flatListRef.current?.scrollToIndex({
        index: newIndex,
        animated: true,
      });
      setActiveIndex(newIndex);
      if (onImageChange) {
        onImageChange(newIndex);
      }
    }
  };

  const renderItem = ({ item }: { item: string }) => {
    if (item === 'placeholder') {
      return (
        <View style={[styles.imageContainer, styles.placeholder]}>
          <Text style={styles.placeholderIcon}>📷</Text>
          <Text style={styles.placeholderText}>Resim Yok</Text>
        </View>
      );
    }

    const imageUri = item.startsWith('http') ? item : `${baseUrl}${item}`;

    return (
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: imageUri }}
          style={styles.image}
          resizeMode="contain"
        />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Left Arrow */}
      <TouchableOpacity
        style={[
          styles.arrow,
          styles.arrowLeft,
          activeIndex === 0 && styles.arrowDisabled,
        ]}
        onPress={goToPrev}
        disabled={activeIndex === 0}
      >
        <Text
          style={[
            styles.arrowText,
            activeIndex === 0 && styles.arrowTextDisabled,
          ]}
        >
          ‹
        </Text>
      </TouchableOpacity>

      {/* Image Carousel */}
      <FlatList
        ref={flatListRef}
        data={imageList}
        renderItem={renderItem}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        keyExtractor={(_, index) => index.toString()}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={(_, index) => ({
          length: CAROUSEL_WIDTH,
          offset: CAROUSEL_WIDTH * index,
          index,
        })}
        style={styles.flatList}
      />

      {/* Right Arrow */}
      <TouchableOpacity
        style={[
          styles.arrow,
          styles.arrowRight,
          activeIndex === imageList.length - 1 && styles.arrowDisabled,
        ]}
        onPress={goToNext}
        disabled={activeIndex === imageList.length - 1}
      >
        <Text
          style={[
            styles.arrowText,
            activeIndex === imageList.length - 1 && styles.arrowTextDisabled,
          ]}
        >
          ›
        </Text>
      </TouchableOpacity>

      {/* Pagination Dots */}
      {imageList.length > 1 && (
        <View style={styles.pagination}>
          {imageList.map((_, index) => (
            <View
              key={index}
              style={[styles.dot, index === activeIndex && styles.dotActive]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  flatList: {
    width: CAROUSEL_WIDTH,
    height: CAROUSEL_HEIGHT,
  },
  imageContainer: {
    width: CAROUSEL_WIDTH,
    height: CAROUSEL_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  image: {
    width: CAROUSEL_WIDTH - 40,
    height: CAROUSEL_HEIGHT - 20,
  },
  placeholder: {
    backgroundColor: '#f0f0f0',
  },
  placeholderIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  placeholderText: {
    fontSize: 16,
    color: '#999',
  },
  arrow: {
    position: 'absolute',
    top: '50%',
    marginTop: -25,
    width: 40,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    zIndex: 10,
    borderRadius: 8,
  },
  arrowLeft: {
    left: 8,
  },
  arrowRight: {
    right: 8,
  },
  arrowDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  arrowText: {
    fontSize: 36,
    color: colors.primary,
    fontWeight: '300',
  },
  arrowTextDisabled: {
    color: '#ccc',
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ddd',
    marginHorizontal: 4,
  },
  dotActive: {
    backgroundColor: colors.primary,
    width: 24,
  },
  counter: {
    position: 'absolute',
    bottom: 50,
    right: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  counterText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default ImageCarousel;
