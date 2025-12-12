import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import colors from '../theme/colors';

function SettingsScreen() {
  const insets = useSafeAreaInsets();

  // Tab bar height: 56px + bottom inset
  const TAB_BAR_HEIGHT = 56;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={[styles.content, { paddingBottom: TAB_BAR_HEIGHT + insets.bottom }]}>
        <Text style={styles.title}>Ayarlar</Text>
        <Text style={styles.subtitle}>Çok Yakında</Text>
        <Text style={styles.description}>
          Ayarlar özelliği şu anda geliştirme aşamasında
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#F99D26',
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
});

export default SettingsScreen;
