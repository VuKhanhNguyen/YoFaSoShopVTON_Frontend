/**
 * Từ điển nhãn tiếng Việt đồng bộ với com.yofaso.shop.common.VietnameseLabels trong Backend.
 * Chuẩn hóa hiển thị toàn bộ các mã enum hệ thống sang tiếng Việt có dấu.
 */
export const VIETNAMESE_LABELS: Record<string, string> = {
  // Trạng thái đơn hàng
  CHO_XAC_NHAN: "Chờ xác nhận",
  DA_XAC_NHAN: "Đã xác nhận",
  DANG_CHUAN_BI_HANG: "Đang chuẩn bị hàng",
  DANG_DONG_GOI: "Đang đóng gói",
  CHO_GIAO_HANG: "Chờ giao hàng",
  CHO_SHIPPER: "Chờ shipper nhận",
  DANG_GIAO_HANG: "Đang giao hàng",
  HOAN_TAT: "Hoàn tất",
  DA_HUY: "Đã hủy",
  TRA_HANG: "Trả hàng",
  GIAO_HANG_THAT_BAI: "Giao hàng thất bại",
  HOAN_VE_KHO: "Hoàn về kho",
  DA_PHE_DUYET_BAN_GIAO: "Đã phê duyệt bàn giao",

  // Kênh bán hàng
  ONLINE_APP: "Online (App)",
  TAI_QUAY_POS: "Tại quầy (POS)",

  // Trạng thái & Phương thức thanh toán
  CHUA_THANH_TOAN: "Chưa thanh toán",
  DA_THANH_TOAN: "Đã thanh toán",
  DA_HOAN_TIEN: "Đã hoàn tiền",
  COD_TIEN_MAT_KHI_NHAN: "COD - Tiền mặt khi nhận",
  VIETQR_CHUYEN_KHOAN_ONLINE: "VietQR chuyển khoản online",
  TIEN_MAT_TAI_QUAY: "Tiền mặt tại quầy",
  VIETQR_TAI_QUAY: "VietQR tại quầy",

  // Trạng thái tài khoản & khuyến mãi
  HOAT_DONG: "Hoạt động",
  KHOA_TAM_THOI: "Khóa tạm thời",
  KHOA: "Đã khóa",
  HIEN_THI: "Đã hiển thị",
  AN: "Ẩn",
  DA_AN: "Đã ẩn vi phạm",
  DA_AN_VI_PHAM: "Đã ẩn vi phạm",
  TAM_NGUNG: "Tạm ngừng",
  TAM_DUNG: "Tạm dừng",
  DANG_DIEN_RA: "Đang diễn ra",
  KET_THUC: "Đã kết thúc",
  HET_HAN: "Hết hạn",
  HET_LUOT: "Hết lượt",

  // Kiểm duyệt đánh giá
  CHO_DUYET: "Chờ duyệt",
  DA_HIEN_THI: "Đã hiển thị",

  // Loại khuyến mãi
  PHAN_TRAM: "Phần trăm (%)",
  PERCENT: "Phần trăm (%)",
  TIEN_MAT_TRUC_TIEP: "Giảm tiền trực tiếp",
  FIXED: "Giảm tiền trực tiếp",
  MIEN_PHI_VAN_CHUYEN: "Miễn phí vận chuyển",
  SHIPPING: "Miễn phí vận chuyển",

  // Hạng thành viên
  DONG: "Đồng",
  BAC: "Bạc",
  VANG: "Vàng",
  KIM_CUONG: "Kim Cương",
  VIP: "VIP",

  // Giới tính
  NAM: "Nam",
  NU: "Nữ",
  KHAC: "Khác",

  // Ca làm việc POS
  DANG_MO: "Đang mở ca",
  DA_DONG_CHO_DUYET: "Đã đóng ca, chờ duyệt",
  DA_DUYET: "Đã duyệt",
  YEU_CAU_DEM_LAI: "Yêu cầu đếm lại",

  // Trạng thái sản phẩm
  BAN_NHAP: "Bản nháp",
  DANG_XU_LY_AI: "Đang xử lý AI",
  DANG_KINH_DOANH: "Đang kinh doanh",
  NGUNG_KINH_DOANH: "Ngừng kinh doanh",
  DANG_BAN: "Đang bán",
  HET_HANG: "Hết hàng",
  NGUNG_BAN: "Ngừng bán",

  // Vai trò
  ROLE_SHOP_ADMIN: "Chủ shop / Quản trị viên",
  ROLE_STAFF_CASHIER: "Thu ngân bán lẻ POS",
  ROLE_STAFF_WAREHOUSE: "Nhân viên kho",
  ROLE_STAFF_SHIPPER: "Nhân viên giao vận",
  ROLE_CUSTOMER: "Khách hàng",
};

/**
 * Trả về chuỗi tiếng Việt có dấu tương ứng từ mã enum, nếu không tìm thấy sẽ giữ nguyên code.
 */
export function vnLabel(code: string | null | undefined): string {
  if (!code) return "";
  return VIETNAMESE_LABELS[code] ?? code;
}
