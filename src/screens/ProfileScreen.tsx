import React, { useEffect } from 'react';
import { StyleSheet, View, Text, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../hooks/api/useAuth';
import { useApiRequest } from '../hooks/api/useApiRequest';
import userService from '../api/services/userService';
import { User } from '../api/types/user.types';
import colors from '../theme/colors';

function ProfileScreen() {
  const { user, isAuthenticated, logout, isLoading: authLoading } = useAuth();
  const { data: profile, loading, error, execute } = useApiRequest<User>();
  const insets = useSafeAreaInsets();

  // Tab bar height: 56px + bottom inset
  const TAB_BAR_HEIGHT = 56;

  useEffect(() => {
    if (isAuthenticated) {
      execute(() => userService.getProfile());
    }
  }, [isAuthenticated]);

  if (authLoading || loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={[styles.content, { paddingBottom: TAB_BAR_HEIGHT + insets.bottom }]}>
          <ActivityIndicator size="large" color="#F99D26" />
          <Text style={styles.loadingText}>Yükleniyor...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={[styles.content, { paddingBottom: TAB_BAR_HEIGHT + insets.bottom }]}>
          <Text style={styles.title}>Profil</Text>
          <Text style={styles.subtitle}>Giriş Yapmanız Gerekiyor</Text>
          <Text style={styles.description}>
            Profil bilgilerinizi görmek için lütfen Ana Sayfa'dan giriş yapın
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={[styles.content, { paddingBottom: TAB_BAR_HEIGHT + insets.bottom }]}>
          <Text style={styles.errorTitle}>Hata</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => execute(() => userService.getProfile())}
          >
            <Text style={styles.retryButtonText}>Tekrar Dene</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const userData = profile || user;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={[styles.content, { paddingBottom: TAB_BAR_HEIGHT + insets.bottom }]}>
        <Text style={styles.title}>Profil</Text>

        <View style={styles.infoContainer}>
          <View style={styles.infoRow}>
            <Text style={styles.label}>İsim:</Text>
            <Text style={styles.value}>{userData?.name || 'Bilinmiyor'}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.label}>E-posta:</Text>
            <Text style={styles.value}>{userData?.email || 'Bilinmiyor'}</Text>
          </View>

          {userData?.phoneNumber && (
            <View style={styles.infoRow}>
              <Text style={styles.label}>Telefon:</Text>
              <Text style={styles.value}>{userData.phoneNumber}</Text>
            </View>
          )}

          {userData?.role && (
            <View style={styles.infoRow}>
              <Text style={styles.label}>Rol:</Text>
              <Text style={styles.value}>{userData.role}</Text>
            </View>
          )}
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={logout}>
          <Text style={styles.logoutButtonText}>Çıkış Yap</Text>
        </TouchableOpacity>
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
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 24,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#F99D26',
    marginBottom: 16,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  infoContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#495057',
  },
  value: {
    fontSize: 16,
    color: '#212529',
  },
  logoutButton: {
    backgroundColor: '#dc3545',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#dc3545',
    marginBottom: 12,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#F99D26',
    borderRadius: 8,
    padding: 12,
    paddingHorizontal: 24,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ProfileScreen;
