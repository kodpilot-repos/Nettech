/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import BottomTabNavigator from './src/navigation/BottomTabNavigator';
import { AuthProvider } from './src/context/AuthContext';
import { TabBarProvider } from './src/context/TabBarContext';

function App() {
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
