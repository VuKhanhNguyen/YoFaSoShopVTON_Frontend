import { Alert, Linking, Platform } from "react-native";

export const SHOP_SUPPORT = {
  brandName: "YoFaSo Shop",
  hotline: "0795605214",
  hotlineDisplay: "0795 605 214",
  zalo: "0795605214",
  email: "nguyenvukhanh392@gmail.com",
  hours: "08:00 - 22:00 (Thứ 2 - Chủ nhật)",
  showroomName: "YoFaSo Atelier Flagship Đà Nẵng",
  showroomAddress: "48 Cao Thắng, Thanh Bình, Hải Châu, Đà Nẵng",
  mapsQuery: "48 Cao Thắng, Hải Châu, Đà Nẵng",
} as const;

export const SIZE_GUIDE_ROWS = [
  { size: "XS", height: "< 1m55", weight: "< 45 kg", fit: "Gọn nhẹ" },
  { size: "S", height: "1m55 – 1m62", weight: "45 – 52 kg", fit: "Ôm vừa" },
  { size: "M", height: "1m60 – 1m68", weight: "52 – 60 kg", fit: "Tiêu chuẩn" },
  { size: "L", height: "1m66 – 1m74", weight: "60 – 68 kg", fit: "Thoải mái" },
  { size: "XL", height: "1m72 – 1m80", weight: "68 – 78 kg", fit: "Rộng vừa" },
  { size: "XXL", height: "> 1m78", weight: "> 78 kg", fit: "Oversize" },
] as const;

export const SUPPORT_FAQS = [
  {
    id: "size",
    title: "Cách chọn size chuẩn tại YoFaSo Shop",
    body: "Bạn có thể đối chiếu bảng quy đổi size bên dưới theo chiều cao & cân nặng. Nếu phân vân giữa 2 size: chọn size nhỏ hơn nếu thích dáng ôm gọn, hoặc tăng 1 size nếu thích dáng suông thoải mái. Trợ lý AI cũng có thể tư vấn theo từng chất liệu sản phẩm.",
    showSizeTable: true,
  },
  {
    id: "vton",
    title: "Hướng dẫn chụp ảnh thử đồ ảo AI VTON đẹp & chính xác",
    body: "• Đứng thẳng mặt hướng về camera, đủ ánh sáng đều, nền gọn gàng.\n• Thử áo (upper_body): ảnh nửa người (HALF_BODY) hoặc toàn thân (FULL_BODY).\n• Thử quần/váy/đầm (lower_body / dress): bắt buộc ảnh toàn thân (FULL_BODY) để AI chấm điểm tỉ lệ 1/3 – 2/3 chuẩn xác.",
  },
  {
    id: "o2o",
    title: "Vé O2O Fitting Pass, thanh toán VietQR & COD",
    body: "• Sau khi thử đồ AI trên App, mở Tủ đồ VTON để lấy mã QR/mã phiên (TD...) mang ra quầy Showroom — thu ngân quét mã lấy đúng mẫu & size thật cho bạn thử ngay.\n• Hỗ trợ thanh toán tiền mặt COD khi nhận hàng hoặc chuyển khoản VietQR động xác nhận tức thì.",
  },
  {
    id: "loyalty",
    title: "Tích điểm hội viên & Voucher sinh nhật BIRTHDAY15",
    body: "• Mọi đơn hàng Online & tại quầy POS đều tích điểm nâng hạng (Đồng → Bạc → Vàng → Kim cương).\n• Tài khoản mới tự động nhận voucher chào mừng VTON5 & FREESHIP.\n• Cập nhật ngày sinh trong Hồ sơ để tự động nhận voucher sinh nhật BIRTHDAY15 (giảm 15%) mỗi năm.",
  },
] as const;

export const RETURN_POLICY_POINTS = [
  "Đổi size hoặc đổi mẫu miễn phí trong vòng 30 ngày kể từ ngày nhận hàng.",
  "Hỗ trợ linh hoạt O2O: gửi đổi Online hoặc mang trực tiếp ra Showroom kèm mã đơn hàng (DH...).",
  "Sản phẩm đổi trả còn nguyên tem mác, chưa qua giặt ủi hoặc hư hại do sử dụng.",
  "Hoàn tiền nhanh trong 1–3 ngày làm việc đối với đơn đã thanh toán chuyển khoản VietQR.",
] as const;

/** Mở trình quay số điện thoại và tự điền sẵn số Hotline của Chủ shop. */
export async function openPhoneDialer(phone: string = SHOP_SUPPORT.hotline) {
  const digits = phone.replace(/[^0-9+]/g, "");
  const url = Platform.OS === "ios" ? `telprompt:${digits}` : `tel:${digits}`;
  try {
    await Linking.openURL(url);
  } catch {
    try {
      await Linking.openURL(`tel:${digits}`);
    } catch {
      Alert.alert(
        "Hotline YoFaSo Shop",
        `Thiết bị hiện không hỗ trợ mở trình gọi điện. Bạn vui lòng gọi trực tiếp số: ${SHOP_SUPPORT.hotlineDisplay}`,
      );
    }
  }
}

/** Mở thẳng app Zalo tới tài khoản Chủ shop (hoặc mở trang Zalo nếu chưa cài app). */
export async function openZaloChat(zalo: string = SHOP_SUPPORT.zalo) {
  const digits = zalo.replace(/[^0-9]/g, "");
  const url = `https://zalo.me/${digits}`;
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert(
      "Zalo CSKH YoFaSo Shop",
      `Không mở được liên kết Zalo tự động. Bạn vui lòng tìm Zalo theo số: ${SHOP_SUPPORT.hotlineDisplay}`,
    );
  }
}

/** Mở ứng dụng Email (Gmail/Mail) với sẵn địa chỉ nhận và tiêu đề hỗ trợ. */
export async function openSupportEmail(
  email: string = SHOP_SUPPORT.email,
  subject = "[YoFaSo Shop] Yêu cầu hỗ trợ khách hàng",
  body = "Xin chào YoFaSo Shop,\nMình cần hỗ trợ về: ",
) {
  const url = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert(
      "Email CSKH YoFaSo Shop",
      `Thiết bị chưa cài đặt ứng dụng Email. Bạn vui lòng gửi thư tới: ${email}`,
    );
  }
}

/** Mở Google Maps chỉ đường tới Showroom YoFaSo. */
export async function openShowroomMaps(query: string = SHOP_SUPPORT.mapsQuery) {
  const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert("Địa chỉ Showroom", SHOP_SUPPORT.showroomAddress);
  }
}
