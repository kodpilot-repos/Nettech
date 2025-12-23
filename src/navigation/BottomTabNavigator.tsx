import React from 'react';
import { Alert } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { RootTabParamList } from '../types/navigation';
import AnimatedTabBar from '../components/AnimatedTabBar';
import { useAuth } from '../hooks/api/useAuth';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import DashboardScreen from '../screens/DashboardScreen';
import CameraStackNavigator from './CameraStackNavigator';
import NotificationScreen from '../screens/NotificationScreen';
import SettingsScreen from '../screens/SettingsScreen';

const Tab = createBottomTabNavigator<RootTabParamList>();

const renderTabBarIcon = (route: any, focused: boolean, color: string, size: number) => {
  let iconName: string;

  if (route.name === 'Dashboard') {
    iconName = focused ? 'home' : 'home-outline';
  } else if (route.name === 'CameraStack') {
    iconName = focused ? 'camera' : 'camera-outline';
  } else if (route.name === 'Notification') {
    iconName = focused ? 'bell' : 'bell-outline';
  } else if (route.name === 'Settings') {
    iconName = focused ? 'cog' : 'cog-outline';
  } else {
    iconName = 'help-circle-outline';
  }

  return <Icon name={iconName} size={size} color={color} />;
};

function BottomTabNavigator() {
  const { isAuthenticated } = useAuth();

  return (
    <Tab.Navigator
      initialRouteName="Dashboard"
      tabBar={(props) => <AnimatedTabBar {...props} />}
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) =>
          renderTabBarIcon(route, focused, color, size),
        headerShown: false,
      })}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarLabel: 'Ana Sayfa',
        }}
      />
      <Tab.Screen
        name="CameraStack"
        component={CameraStackNavigator}
        options={{
          tabBarLabel: 'Kamera',
        }}
        listeners={{
          tabPress: e => {
            if (!isAuthenticated) {
              // Kullanıcı giriş yapmamışsa, navigasyonu engelle
              e.preventDefault();
              Alert.alert(
                'Giriş Gerekli',
                'Kamera özelliğini kullanmak için lütfen giriş yapın.',
                [{ text: 'Tamam', style: 'default' }],
              );
            }
          },
        }}
      />
      <Tab.Screen
        name="Notification"
        component={NotificationScreen}
        options={{
          tabBarLabel: 'Bildirimler',
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarLabel: 'Ayarlar',
        }}
      />
    </Tab.Navigator>
  );
}

export default BottomTabNavigator;
