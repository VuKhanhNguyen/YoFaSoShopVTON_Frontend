import definitions from "./contract-schemas.json";
export type Schema = {
  type?: string;
  properties?: Record<string, Schema>;
  required?: string[];
  items?: Schema;
  $ref?: string;
  pattern?: string;
  format?: string;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  minItems?: number;
  maxItems?: number;
  const?: unknown;
};
export const schemas = definitions as Record<string, Schema>;
export const resolve = (s: Schema): Schema =>
  s.$ref ? schemas[s.$ref.split("/").pop()!] : s;
export const labels: Record<string, string> = {
  username: "Tên đăng nhập",
  password: "Mật khẩu",
  fullName: "Họ và tên",
  phone: "Số điện thoại",
  email: "Email",
  currentPassword: "Mật khẩu hiện tại",
  newPassword: "Mật khẩu mới",
  recipientName: "Tên người nhận",
  street: "Số nhà, tên đường",
  ward: "Phường / xã",
  city: "Tỉnh / thành phố",
  provinceCode: "Mã tỉnh",
  wardCode: "Mã phường / xã",
  defaultAddress: "Địa chỉ mặc định",
  otp: "Mã OTP 6 số",
  requestId: "Mã yêu cầu",
  comment: "Nội dung đánh giá",
  stars: "Số sao",
  orderLineId: "Dòng đơn hàng",
  firstVariantId: "Trang phục chính",
  secondVariantId: "Trang phục phối kèm",
  tucked: "Sơ vin",
  name: "Tên",
  description: "Mô tả",
  categoryId: "Danh mục",
  material: "Chất liệu",
  fit: "Phom dáng",
  waist: "Cạp",
  length: "Chiều dài",
  pattern: "Họa tiết",
  vtonCategory: "Nhóm thử đồ",
  subtype: "Loại trang phục",
  sku: "Mã SKU",
  size: "Kích cỡ",
  colorName: "Tên màu",
  colors: "Mã màu HEX",
  price: "Giá niêm yết",
  salePrice: "Giá khuyến mãi",
  shelf: "Vị trí kệ",
  status: "Trạng thái",
  delta: "Số lượng thay đổi",
  reason: "Lý do",
  variantId: "Biến thể",
  amount: "Số tiền",
  note: "Ghi chú",
  code: "Mã",
  type: "Loại",
  value: "Giá trị",
  minimumTotal: "Đơn tối thiểu",
  maxDiscount: "Giảm tối đa",
  quantity: "Số lượng",
  startsAt: "Bắt đầu",
  endsAt: "Kết thúc",
  roleIds: "Vai trò",
  account: "Tài khoản",
  parentId: "Danh mục cha",
  position: "Thứ tự",
  shipperId: "Nhân viên giao hàng",
  reply: "Phản hồi",
  productAssetIds: "Ảnh sản phẩm",
  referenceAssetIds: "Ảnh người mẫu",
  bindings: "Liên kết ảnh và biến thể",
  sourceAssetId: "Ảnh nguồn",
  consent: "Đồng ý xử lý ảnh",
};
export function choices(schema: Schema): string[] | undefined {
  const p = resolve(schema).pattern;
  if (!p || !p.includes("|")) return;
  const clean = p
    .replace(/^\^\(\?:/, "")
    .replace(/\)\$$/, "")
    .replace(/^\^/, "")
    .replace(/\$$/, "");
  return /^[A-Za-z0-9_|]+$/.test(clean) ? clean.split("|") : undefined;
}
export function validate(
  schema: Schema,
  input: unknown,
  path = "",
): Record<string, string> {
  const s = resolve(schema),
    errors: Record<string, string> = {};
  const fail = (message: string) => {
    errors[path] = message;
  };
  if (s.type === "object") {
    const obj = (input || {}) as Record<string, unknown>;
    for (const [key, child] of Object.entries(s.properties || {})) {
      const field = path ? `${path}.${key}` : key,
        value = obj[key];
      if (value === undefined || value === null || value === "") {
        if (s.required?.includes(key))
          errors[field] = "Vui lòng nhập trường này.";
      } else Object.assign(errors, validate(child, value, field));
    }
  } else if (s.type === "array") {
    if (!Array.isArray(input)) fail("Vui lòng chọn danh sách hợp lệ.");
    else {
      if (input.length < Math.max(s.minItems ?? 0, 1))
        fail("Cần ít nhất một mục.");
      if (s.maxItems && input.length > s.maxItems)
        fail(`Tối đa ${s.maxItems} mục.`);
      input.forEach((v, i) =>
        Object.assign(errors, validate(s.items!, v, `${path}.${i}`)),
      );
    }
  } else if (s.type === "boolean") {
    if (typeof input !== "boolean" || (s.const === true && !input))
      fail("Vui lòng xác nhận.");
  } else if (s.type === "number" || s.type === "integer") {
    if (
      typeof input !== "number" ||
      !Number.isFinite(input) ||
      (s.type === "integer" && !Number.isInteger(input))
    )
      fail("Nhập số hợp lệ.");
    else if (
      input < (s.minimum ?? -Infinity) ||
      input > (s.maximum ?? Infinity)
    )
      fail(
        `Giá trị từ ${s.minimum ?? 0} đến ${s.maximum ?? "không giới hạn"}.`,
      );
  } else if (typeof input !== "string") fail("Vui lòng nhập văn bản.");
  else {
    if (!input.trim()) fail("Không được chỉ nhập khoảng trắng.");
    if (s.maxLength && input.length > s.maxLength)
      fail(`Tối đa ${s.maxLength} ký tự.`);
    if (s.minLength && input.length < s.minLength)
      fail(`Ít nhất ${s.minLength} ký tự.`);
    if (s.pattern && !new RegExp(s.pattern).test(input))
      fail(
        path.endsWith("username")
          ? "4-16 ký tự, bắt đầu bằng chữ, chỉ gồm chữ Latin và số."
          : "Giá trị không đúng định dạng.",
      );
    if (s.format === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input))
      fail("Email không hợp lệ.");
    if (s.format === "date-time" && !Number.isFinite(Date.parse(input)))
      fail("Ngày giờ không hợp lệ.");
    if (
      /(?:^|\.)(?:newPassword|password)$/.test(path) &&
      s.minLength === 10 &&
      (!/\p{L}/u.test(input) || !/\d/.test(input) || utf8Length(input) > 72)
    )
      fail("Ít nhất 10 ký tự, có chữ và số, tối đa 72 byte UTF-8.");
  }
  return errors;
}
export const utf8Length = (s: string) => unescape(encodeURIComponent(s)).length;
export function strength(value: string) {
  const score = [
    value.length >= 10,
    /[A-Z]/.test(value),
    /[a-z]/.test(value),
    /\d/.test(value),
    /[^A-Za-z0-9]/.test(value),
  ].filter(Boolean).length;
  return value.length < 10
    ? "Yếu"
    : score === 5
      ? "Mạnh"
      : score >= 4
        ? "Tốt"
        : "Trung bình";
}
