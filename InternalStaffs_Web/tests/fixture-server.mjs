// API stub chỉ dành cho browser tests, không kết nối MySQL/FastAPI/R2.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '../..');
const user = { userId: 'NDTEST01', username: 'KhanhTest', fullName: 'Nguyễn Vũ Khanh', email: 'khanh@example.test', phone: '0901234567', roles: ['ROLE_SHOP_ADMIN'], loyaltyPoints: 120, membership: 'BAC' };
const variant = { variantId: 'BTTEST01', productId: 'SPTEST01', sku: 'POLO-NAVY-M', size: 'M', colorName: 'Xanh navy', colors: '#0F172A', price: 450000, salePrice: null, stock: 12, shelf: 'A-01', status: 'DANG_BAN' };
const product = { coverUrl: '/api/v1/catalog/images/HATEST01/content?kind=original', minPrice: 450000, productId: 'SPTEST01', categoryId: 'DMTEST01', name: 'Polo Silk Touch', description: 'Áo polo dành cho một ngày thoải mái.', material: 'Cotton', fit: 'SUONG_VUA', waist: 'KHONG_AP_DUNG', length: 'AO_TIEU_CHUAN', pattern: 'VAI_TRON', subtype: 'polo', vtonCategory: 'upper_body', status: 'DANG_KINH_DOANH', variants: [variant], images: [{ imageId: 'HATEST01', originalUrl: '/api/v1/catalog/images/HATEST01/content?kind=original' }] };
let roles = user.roles, cart = [], addresses = [{ addressId: 'DCTEST01', recipientName: user.fullName, phone: user.phone, street: '12 Nguyễn Văn Linh', ward: 'Phường Hải Châu', city: 'Thành phố Đà Nẵng', defaultAddress: true }], orders = [], notifications = [{ notificationId: 'TBTEST01', title: 'Chào mừng tới YoFaSo', message: 'Thông báo dùng trong kiểm thử giao diện.', readStatus: false }];
const keys = new Map();
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*'); res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Idempotency-Key'); res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204).end(); return; }
  const url = new URL(req.url, 'http://localhost'), p = url.pathname.replace('/api/v1', ''), method = req.method;
  const chunks = []; for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks); let body = {}; if (raw.length && req.headers['content-type']?.includes('application/json')) body = JSON.parse(raw.toString());
  function send(value, status = 200) { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(value)); }
  if (p.startsWith('/catalog/images/') || p.startsWith('/assets/') && p.endsWith('/content')) { res.writeHead(200, { 'Content-Type': 'image/jpeg' }); fs.createReadStream(path.join(root, 'Clients_MobileApp/assets/editorial/onboard-1.jpg')).pipe(res); return; }
  if (p === '/auth/login' || p === '/auth/register') { roles = body.username?.toLowerCase().startsWith('customer') ? ['ROLE_CUSTOMER'] : body.username?.toLowerCase().startsWith('warehouse') ? ['ROLE_STAFF_WAREHOUSE'] : body.username?.toLowerCase().startsWith('shipper') ? ['ROLE_STAFF_SHIPPER'] : ['ROLE_SHOP_ADMIN']; send({ accessToken: 'test-access', refreshToken: 'test-refresh', expiresIn: 900, user: { ...user, roles } }); return; }
  if (p === '/auth/refresh') {
    if (body.refreshToken === 'invalid-refresh') { send({ message: 'Phiên đã bị thu hồi.' }, 401); return; }
    if (body.refreshToken === 'unavailable-refresh') { send({ message: 'Dịch vụ tạm gián đoạn.' }, 503); return; }
    send({ accessToken: 'test-access', refreshToken: 'test-refresh-rotated', user: { ...user, roles } }); return;
  }
  if (p === '/auth/logout') { send({ revoked: true }); return; }
  if (p === '/auth/forgot-password') { send({ requestId: 'a'.repeat(32) }, 202); return; }
  if (p === '/auth/reset-password') { send({ loginAgain: true }); return; }
  const publicPath = p.startsWith('/catalog/') || p === '/promotions' || p.startsWith('/new-provinces');
  if (!publicPath && !req.headers.authorization) { send({ message: 'Cần đăng nhập.', errorCode: 'UNAUTHORIZED' }, 401); return; }
  if (p === '/me') { send({ ...user, ...body, roles }); return; }
  if (p === '/me/password') { send({ loginAgain: true }); return; }
  if (p === '/admin/reports/summary') { send({ orderCount: orders.length, completedCount: 0, activeProducts: 1, grossSales: 0 }); return; }
  if (['/staff/products', '/admin/products', '/catalog/products'].includes(p) && method === 'GET') { send({ items: [product], total: 1, page: 0, size: 20 }); return; }
  if (/^\/(staff|catalog|admin)\/products\/SPTEST01$/.test(p)) { send(product); return; }
  if (p === '/catalog/categories') { send([{ categoryId: 'DMTEST01', name: 'Áo', description: 'Áo thời trang' }]); return; }
  if (p.endsWith('/reviews') && p.startsWith('/catalog/')) { send([]); return; }
  if (p === '/staff/variants/by-sku') { send(variant); return; }
  if (p === '/staff/inventory/low-stock') { send([variant]); return; }
  if (p === '/staff/inventory/movements') { send([]); return; }
  if (p === '/pos/customers') { send({ userId: user.userId, fullName: user.fullName, points: 120, membership: 'BAC' }); return; }
  if (p === '/promotions') { send([{ code: 'YOFASO10', name: 'Ưu đãi kiểm thử', type: 'PHAN_TRAM', value: 10, minimumTotal: 0 }]); return; }
  if (p === '/promotions/quote') { send({ discount: body.voucher ? 45000 : 0 }); return; }
  if (p === '/cart' && method === 'GET') { send(cart.map(l => ({ ...variant, ...l, unitPrice: variant.price }))); return; }
  if (p === '/cart/items') { cart = [{ variantId: body.variantId, quantity: body.quantity }]; send(cart); return; }
  if (p.startsWith('/cart/items/') && method === 'DELETE') { cart = []; send({ deleted: true }); return; }
  if (p === '/me/addresses' && method === 'GET') { send(addresses); return; }
  if (p === '/me/addresses' && method === 'POST') { addresses.push({ ...body, addressId: 'DCTEST02' }); send({ addressId: 'DCTEST02' }); return; }
  if (p === '/new-provinces') { send([{ code: '48', name: 'Thành phố Đà Nẵng' }]); return; }
  if (p === '/new-provinces/48/wards') { send([{ code: '20194', name: 'Phường Hải Châu' }]); return; }
  if ((p === '/orders' || p === '/pos/orders') && method === 'POST') {
    const key = req.headers['idempotency-key']; if (!key) { send({ message: 'Thiếu key.' }, 400); return; }
    if (keys.has(key)) { send(keys.get(key)); return; }
    const order = { orderId: 'DHTEST01', ...addresses[0], address: '12 Nguyễn Văn Linh, Hải Châu, Đà Nẵng', recipientName: user.fullName, channel: p === '/pos/orders' ? 'TAI_QUAY_POS' : 'ONLINE', status: 'CHO_XAC_NHAN', paymentStatus: 'CHUA_THANH_TOAN', items: body.items.map(l => ({ ...l, productName: product.name, orderLineId: 'CTTEST01', unitPrice: variant.price, size: 'M', colorName: variant.colorName })), subtotal: 450000, discount: body.voucher ? 45000 : 0, total: body.voucher ? 405000 : 450000, shippingFee: 0, collectAmount: 450000 }; keys.set(key, order); orders = [order]; cart = []; send(order, 201); return;
  }
  if (['/orders', '/staff/orders'].includes(p)) { send(orders); return; }
  if (/^\/(orders|staff\/orders)\/DHTEST01$/.test(p)) { send(orders[0] || {}); return; }
  if (p.endsWith('/pick-list')) { send([{ ...variant, quantity: 1, name: product.name }]); return; }
  if (p === '/notifications') { send(notifications); return; }
  if (p.endsWith('/read')) { notifications[0].readStatus = true; send({ read: true }); return; }
  if (p === '/try-on/sessions' && method === 'GET') { send([]); return; }
  if (p === '/assets' && method === 'POST') { send({ assetId: 'assettest01' }, 201); return; }
  if (p === '/ai/persons/validate') { send({ accepted: true, personFrame: 'full_body', simulated: true, warnings: ['Kiểm định mô phỏng.'] }); return; }
  if (p === '/try-on/sessions' && method === 'POST') { send({ operationId: 'TDTEST01', resourceId: 'TDTEST01', status: 'QUEUED', simulated: true }); return; }
  if (p === '/try-on/sessions/TDTEST01') { send({ operationId: 'TDTEST01', status: 'COMPLETED', simulated: true, result: { resultAssetId: 'assettest02' } }); return; }
  if (p === '/pos/shifts') { send([]); return; }
  if (p === '/admin/users') { send([user]); return; }
  if (p === `/admin/users/${user.userId}`) { send({ ...user, status: 'HOAT_DONG', roles: [{ roleId: 'VT001', name: 'ROLE_SHOP_ADMIN', label: 'Chủ shop' }] }); return; }
  if (p === '/admin/roles') { send([{ roleId: 'VT001', name: 'ROLE_SHOP_ADMIN', label: 'Chủ shop' }]); return; }
  if (p === '/admin/reviews') { send([]); return; }
  send({ message: `Fixture chưa hỗ trợ ${method} ${p}` }, 404);
});
server.listen(18080, '127.0.0.1', () => console.log('Test API stub listening on 127.0.0.1:18080'));
