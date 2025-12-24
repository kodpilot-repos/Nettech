/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import messaging from '@react-native-firebase/messaging';
import notifee, { AndroidImportance, EventType } from '@notifee/react-native';
import BottomTabNavigator from './src/navigation/BottomTabNavigator';
import { AuthProvider } from './src/context/AuthContext';
import { TabBarProvider } from './src/context/TabBarContext';

function App() {
  useEffect(() => {
    // Request notification permission
    async function requestUserPermission() {
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (enabled) {
        console.log('Authorization status:', authStatus);

        // Get FCM token
        const token = await messaging().getToken();
        console.log('FCM Token:', token);
      }
    }

    requestUserPermission();

    // Foreground message handler
    const unsubscribe = messaging().onMessage(async remoteMessage => {
      console.log('Foreground message:', remoteMessage);

      // Channel oluştur
      await notifee.createChannel({
        id: 'default-nettech',
        name: 'Bildirimler',
        importance: AndroidImportance.HIGH,
        sound: 'default',
        vibration: true,
      });

      // // Firebase data'dan bilgileri al
      // const title = String(remoteMessage.data?.title || 'Yeni Bildirim');
      // const body = String(remoteMessage.data?.body || 'Bir mesajınız var');
      // const imageUrl = remoteMessage.data?.image ? String(remoteMessage.data.image) : undefined;

      // Custom Notifee bildirimi göster
      // await notifee.displayNotification({
      //   title: title,
      //   body: body,
      //   android: {
      //     channelId,
      //     importance: AndroidImportance.HIGH,
      //     pressAction: { id: 'default' },
      //     ...(imageUrl && { largeIcon: imageUrl }),
      //     color: '#4285F4',
      //     smallIcon: 'ic_launcher',
      //   },
      // });
    });

    // Handle notification opened app from background
    messaging().onNotificationOpenedApp(remoteMessage => {
      console.log(
        'Notification caused app to open from background state:',
        remoteMessage,
      );
    });

    // Check if app was opened by a notification
    messaging()
      .getInitialNotification()
      .then(remoteMessage => {
        if (remoteMessage) {
          console.log(
            'Notification caused app to open from quit state:',
            remoteMessage,
          );
        }
      });

    // Foreground notification event handler
    const unsubscribeNotifee = notifee.onForegroundEvent(({ type, detail }) => {
      console.log('Foreground notification event:', type, detail);

      if (type === EventType.PRESS) {
        console.log('User pressed notification:', detail.notification);
      }
    });

    return () => {
      unsubscribe();
      unsubscribeNotifee();
    };
  }, []);

  return (
    <AuthProvider>
      <TabBarProvider>
        <SafeAreaProvider>
          <StatusBar
            barStyle="light-content"
            backgroundColor="#000"
            translucent={false}
          />
          <NavigationContainer>
            <BottomTabNavigator />
          </NavigationContainer>
        </SafeAreaProvider>
      </TabBarProvider>
    </AuthProvider>
  );
}

export default App;
