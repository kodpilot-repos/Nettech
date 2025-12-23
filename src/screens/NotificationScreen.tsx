import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import notifee, { AndroidImportance } from '@notifee/react-native';
import messaging from '@react-native-firebase/messaging';

function NotificationScreen() {
  const [fcmToken, setFcmToken] = useState<string>('');
  const [permissionStatus, setPermissionStatus] = useState<string>('');

  useEffect(() => {
    getFCMToken();
    checkPermissionStatus();
  }, []);

  async function getFCMToken() {
    try {
      const token = await messaging().getToken();
      setFcmToken(token);
      console.log('FCM Token:', token);
    } catch (error) {
      console.error('Error getting FCM token:', error);
    }
  }

  async function checkPermissionStatus() {
    const authStatus = await messaging().hasPermission();
    let status = 'Unknown';

    if (authStatus === messaging.AuthorizationStatus.AUTHORIZED) {
      status = 'Authorized';
    } else if (authStatus === messaging.AuthorizationStatus.PROVISIONAL) {
      status = 'Provisional';
    } else if (authStatus === messaging.AuthorizationStatus.DENIED) {
      status = 'Denied';
    } else if (authStatus === messaging.AuthorizationStatus.NOT_DETERMINED) {
      status = 'Not Determined';
    }

    setPermissionStatus(status);
  }

  async function requestNotificationPermission() {
    try {
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (enabled) {
        console.log('Notification permission granted');
        await checkPermissionStatus();
        await getFCMToken();
      } else {
        console.log('Notification permission denied');
        await checkPermissionStatus();
      }
    } catch (error) {
      console.error('Error requesting permission:', error);
    }
  }

  async function onDisplayNotification() {
    try {
      // Request permissions (required for iOS)
      await notifee.requestPermission();

      // Create a channel (required for Android)
      const channelId = await notifee.createChannel({
        id: 'default-nettech',
        name: 'Default Channel',
        importance: AndroidImportance.HIGH,
      });

      // Display a notification
      await notifee.displayNotification({
        title: 'Test Notification',
        body: 'This is a local test notification from Notifee',
        android: {
          channelId,
          importance: AndroidImportance.HIGH,
          pressAction: {
            id: 'default-nettech',
          },
        },
      });
    } catch (error) {
      console.error('Error displaying notification:', error);
    }
  }

  async function deleteToken() {
    try {
      await messaging().deleteToken();
      setFcmToken('');
      console.log('FCM Token deleted');
      // Get new token
      await getFCMToken();
    } catch (error) {
      console.error('Error deleting token:', error);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.section}>
          <Text style={styles.title}>Firebase Cloud Messaging</Text>

          <View style={styles.infoCard}>
            <Text style={styles.label}>Permission Status:</Text>
            <Text style={styles.value}>{permissionStatus}</Text>
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.label}>FCM Token:</Text>
            <Text style={styles.tokenText} numberOfLines={3}>
              {fcmToken || 'No token available'}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.button}
            onPress={requestNotificationPermission}
          >
            <Text style={styles.buttonText}>Request Permission</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.button}
            onPress={onDisplayNotification}
          >
            <Text style={styles.buttonText}>Display Local Notification</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.button}
            onPress={getFCMToken}
          >
            <Text style={styles.buttonText}>Refresh FCM Token</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.dangerButton]}
            onPress={deleteToken}
          >
            <Text style={styles.buttonText}>Delete & Regenerate Token</Text>
          </TouchableOpacity>

          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>How to test:</Text>
            <Text style={styles.infoText}>
              1. Copy the FCM Token above{'\n'}
              2. Use Firebase Console or your backend to send a test notification{'\n'}
              3. The app will receive notifications in foreground, background, and quit states
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    padding: 16,
  },
  section: {
    gap: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  infoCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  value: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  tokenText: {
    fontSize: 12,
    color: '#333',
    fontFamily: 'monospace',
    backgroundColor: '#f0f0f0',
    padding: 12,
    borderRadius: 8,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  dangerButton: {
    backgroundColor: '#FF3B30',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  infoBox: {
    backgroundColor: '#FFF3CD',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#FFC107',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#856404',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#856404',
    lineHeight: 22,
  },
});

export default NotificationScreen;
