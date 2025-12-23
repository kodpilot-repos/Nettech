export type RootTabParamList = {
  Dashboard: undefined;
  CameraStack: undefined;
  Notification: undefined;
  Settings: undefined;
};

export type CameraStackParamList = {
  Scanner: undefined;
  ProductDetail: { barcode: string };
  ProductList: {
    categoryId?: number;
    categoryName?: string;
    brandId?: number;
    brandName?: string;
    searchQuery?: string;
  };
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootTabParamList {}
  }
}
