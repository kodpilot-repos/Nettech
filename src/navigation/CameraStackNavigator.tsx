import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { CameraStackParamList } from '../types/navigation';
import CameraScreen from '../screens/CameraScreen';
import ProductDetailScreen from '../screens/ProductDetailScreen';
import ProductListScreen from '../screens/ProductListScreen';
// import colors from '../theme/colors';

const Stack = createNativeStackNavigator<CameraStackParamList>();

function CameraStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
      initialRouteName="Scanner"
    >
      <Stack.Screen name="Scanner" component={CameraScreen} />
      <Stack.Screen
        name="ProductDetail"
        component={ProductDetailScreen}
        options={{
          headerShown: true,
          title: 'Ürün Detayı',
          headerBackTitle: 'Geri',
          headerStyle: {
            backgroundColor: '#F99D26',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      />
      <Stack.Screen
        name="ProductList"
        component={ProductListScreen}
        options={{
          headerShown: false,
        }}
      />
    </Stack.Navigator>
  );
}

export default CameraStackNavigator;
