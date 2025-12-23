/**
 * @format
 */

import 'react-native-gesture-handler';
import { AppRegistry } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import notifee, { EventType } from '@notifee/react-native';
import App from './App';
import { name as appName } from './app.json';

// Background message handler
messaging().setBackgroundMessageHandler(async remoteMessage => {
  console.log('Background message:', remoteMessage);
});

// Background notification event handler
notifee.onBackgroundEvent(async ({ type, detail }) => {
  console.log('Background notification event:', type, detail);

  if (type === EventType.PRESS) {
    console.log(
      'User pressed notification in background:',
      detail.notification,
    );
  }
});

AppRegistry.registerComponent(appName, () => App);
