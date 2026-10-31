# YoFaSo Shop - Ứng dụng khách hàng

React Native + Expo SDK 57 + TypeScript + Expo Router. Màn hình ở `src/app`, UI dùng lại ở `src/components/shop`, API và validation ở `src/lib`.

```powershell
npm ci
npx expo install --check
npx expo start --clear
```

Đặt `.env` với `EXPO_PUBLIC_API_BASE_URL` trỏ Spring Boot `/api/v1` theo thiết bị. Android Emulator dùng `10.0.2.2`; điện thoại thật dùng IP LAN của Backend. Không đặt secret trong EXPO_PUBLIC.

Đọc [setupGuide.md](../../YoFaSoShop_Docs/extra-info/setupGuide.md), phần C, và [báo cáo UI/API](../../YoFaSoShop_Docs/extra-info/frontendIntegrationReport.md).

Onboarding dùng cờ AsyncStorage riêng. Đăng xuất không xóa cờ. Token native dùng SecureStore, Expo Web chỉ giữ trong bộ nhớ. Phiên ứng dụng mới đi qua đăng nhập theo yêu cầu hiện tại.

```powershell
npx tsc --noEmit
npx expo export --platform web
node ../scripts/test-validation.cjs
```

Bundle/TypeScript không thay nghiệm thu Android/iOS thật. Camera, lưu/chia sẻ ảnh, quyền thiết bị, máy in và GPU cần kiểm tra riêng. Không dùng helper reset của template để chạy/cài ứng dụng nghiệp vụ.
