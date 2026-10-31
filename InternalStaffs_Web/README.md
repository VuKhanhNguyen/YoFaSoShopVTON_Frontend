# YoFaSo Shop - Cổng nhân sự

Next.js App Router + TypeScript. Màn hình gọi Spring Boot, không dùng store mô phỏng của Lovable.

```powershell
npm ci
# .env: BACKEND_API_BASE_URL=http://localhost:8080/api/v1
npm run dev
```

Mở [đăng nhập](http://localhost:3000/login). Tài khoản cần SHOP_ADMIN, STAFF_CASHIER, STAFF_WAREHOUSE hoặc STAFF_SHIPPER. Thu ngân mở ca trước khi nhận thanh toán tiền mặt.

Browser gọi `/api/backend`. Next Route Handler giữ token trong cookie HttpOnly và kiểm tra Origin khi thay đổi dữ liệu. Production cần HTTPS; không dùng static export cho cổng nhân sự.

```powershell
npm run lint
npm run build
npm run start
node ../scripts/test-validation.cjs
```

Đọc [setupGuide.md](../../YoFaSoShop_Docs/extra-info/setupGuide.md), phần C, và [báo cáo UI/API](../../YoFaSoShop_Docs/extra-info/frontendIntegrationReport.md).

Browser test ở `tests/browser-check.mjs` dùng fixture loopback `tests/fixture-server.mjs`, Next port 3100 và bản Expo export port 8181. Cấu hình API test là `http://127.0.0.1:18080/api/v1`; mobile export thêm `--clear` khi đổi URL. Có thể đặt BROWSER_PATH nếu Chrome không ở đường dẫn Windows mặc định. Kết quả/screenshot ở workspace `scratch/frontend-evidence`.

Không dùng fixture làm backend vận hành. Test UI dùng stub không thay nghiệm thu dữ liệu shop thật, GPU hoặc ngân hàng.
