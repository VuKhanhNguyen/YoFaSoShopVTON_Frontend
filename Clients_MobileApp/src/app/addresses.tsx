import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Fonts, Radii, Shadows, Spacing } from "@/constants/theme";
import { api } from "@/lib/api";
import { useResource } from "@/hooks/use-resource";
import type { Row } from "@/lib/models";
import { RequireAccount } from "@/components/shop/RequireAccount";
import { SelectField } from "@/components/shop/SelectField";

type AddressMode = "new" | "legacy";

interface LocationCandidate {
  province: {
    code: string;
    name: string;
    type: string;
    fullName?: string;
  };
  ward: {
    code: string;
    name: string;
    type: string;
    fullName?: string;
  };
  street?: string;
  fullAddress?: string;
}

interface ConversionResponse {
  status: "EXACT" | "NEEDS_CONFIRMATION" | "UNMAPPED";
  requiresConfirmation: boolean;
  candidates: LocationCandidate[];
  oldAddress?: {
    fullAddress?: string;
  };
}

// Chuẩn hóa tên địa danh để so khớp linh hoạt, bỏ tiền tố hành chính (thành phố, tỉnh, phường, xã,...)
function normalizeLocationName(name: string): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .trim()
    .replace(/^(thành phố|tỉnh|quận|huyện|thị xã|thị trấn|phường|xã|tp\.|tp)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isLocationMatch(candidate: Row | undefined, target: string): boolean {
  if (!candidate || !target) return false;
  const targetTrim = target.trim().toLowerCase();
  const cName = String(candidate.name || "").trim().toLowerCase();
  const cFull = String(
    candidate.fullName || (candidate.type ? `${candidate.type} ${candidate.name}` : "")
  ).trim().toLowerCase();
  const cWithType = `${String(candidate.type || "").trim()} ${cName}`.trim().toLowerCase();

  // 1. So khớp trực tiếp chuỗi (không phân biệt hoa thường)
  if (targetTrim === cName || targetTrim === cFull || targetTrim === cWithType) {
    return true;
  }

  // 2. So khớp sau khi lược bỏ tiền tố hành chính (VD: "thành phố Đà Nẵng" và "Đà Nẵng")
  const targetNorm = normalizeLocationName(target);
  const cNorm = normalizeLocationName(cName);
  if (targetNorm && cNorm && targetNorm === cNorm) {
    return true;
  }

  return false;
}

export default function AddressesScreen() {
  return (
    <RequireAccount>
      <AddressesContent />
    </RequireAccount>
  );
}

function AddressesContent() {
  const state = useResource<Row[]>("/me/addresses");

  // Resource danh mục địa chính MỚI (sau sáp nhập 01/07/2025)
  const newProvinces = useResource<Row[]>("/new-provinces");

  // Resource danh mục địa chính CŨ (trước sáp nhập)
  const legacyProvinces = useResource<Row[]>("/provinces");

  // Dialog & Form states
  const [editing, setEditing] = useState<Row | null>(null);
  const [formVisible, setFormVisible] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    state.reload();
  }, [state.reload]);

  useEffect(() => {
    if (!state.loading) {
      setRefreshing(false);
    }
  }, [state.loading]);

  // Chế độ chọn địa chỉ: "new" (sau sáp nhập 1/7/2025) hoặc "legacy" (cũ -> tự chuyển đổi)
  const [mode, setMode] = useState<AddressMode>("new");

  // Thông tin liên lạc
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [street, setStreet] = useState("");
  const [isDefault, setIsDefault] = useState(false);

  // States dành cho Địa chỉ MỚI (Tỉnh -> Phường/Xã)
  const [newProvince, setNewProvince] = useState<Row>();
  const [newWard, setNewWard] = useState<Row>();
  const newWards = useResource<Row[]>(
    newProvince?.code ? `/new-provinces/${newProvince.code}/wards` : null
  );

  // States dành cho Địa chỉ CŨ (Tỉnh -> Quận/Huyện -> Phường/Xã)
  const [legacyProvince, setLegacyProvince] = useState<Row>();
  const [legacyDistrict, setLegacyDistrict] = useState<Row>();
  const [legacyWard, setLegacyWard] = useState<Row>();
  const legacyDistricts = useResource<Row[]>(
    legacyProvince?.code ? `/provinces/${legacyProvince.code}/districts` : null
  );
  const legacyWards = useResource<Row[]>(
    legacyDistrict?.code ? `/districts/${legacyDistrict.code}/wards` : null
  );

  // State kết quả chuyển đổi từ cũ -> mới
  const [converting, setConverting] = useState(false);
  const [conversionResult, setConversionResult] = useState<ConversionResponse | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<LocationCandidate | null>(null);

  const addresses = state.data || [];

  // Thực hiện chuyển đổi địa chỉ cũ sang địa chỉ mới sau sáp nhập
  const runConversion = useCallback(
    async (provCode: string, distCode: string, wardCode?: string, currentStreet?: string) => {
      if (!provCode || !distCode) return;
      setConverting(true);
      setError("");
      try {
        const res = await api<ConversionResponse>("/convert/address", "POST", {
          provinceCode: provCode,
          districtCode: distCode,
          wardCode: wardCode || undefined,
          street: currentStreet?.trim() || "",
        });
        setConversionResult(res);
        if (res?.candidates && res.candidates.length > 0) {
          setSelectedCandidate(res.candidates[0]);
        } else {
          setSelectedCandidate(null);
        }
      } catch (e) {
        setConversionResult(null);
        setSelectedCandidate(null);
        setError("Không thể chuyển đổi địa chỉ cũ: " + (e as Error).message);
      } finally {
        setConverting(false);
      }
    },
    []
  );

  // Trạng thái chờ đồng bộ địa chỉ khi mở Modal chỉnh sửa
  const [pendingSyncCity, setPendingSyncCity] = useState<string | null>(null);
  const [pendingSyncWard, setPendingSyncWard] = useState<string | null>(null);

  // Mở modal Thêm mới
  const handleOpenAdd = () => {
    setEditing(null);
    setMode("new");
    setName("");
    setPhone("");
    setStreet("");
    setNewProvince(undefined);
    setNewWard(undefined);
    setPendingSyncCity(null);
    setPendingSyncWard(null);
    setLegacyProvince(undefined);
    setLegacyDistrict(undefined);
    setLegacyWard(undefined);
    setConversionResult(null);
    setSelectedCandidate(null);
    setIsDefault(addresses.length === 0);
    setError("");
    setFormVisible(true);
  };

  // Mở modal Chỉnh sửa
  const handleOpenEdit = (a: Row) => {
    setEditing(a);
    setMode("new");
    setName(String(a.recipientName || ""));
    setPhone(String(a.phone || ""));
    setStreet(String(a.street || ""));
    setIsDefault(Boolean(a.defaultAddress));

    const currentCity = String(a.city || "");
    const currentWard = String(a.ward || "");

    setPendingSyncCity(currentCity);
    setPendingSyncWard(currentWard);

    // Tìm tỉnh mới nếu danh sách newProvinces đã tải
    const foundP = newProvinces.data?.find((p) => isLocationMatch(p, currentCity));
    setNewProvince(foundP);
    setNewWard(undefined);

    // Chuẩn bị sẵn tỉnh cũ phòng trường hợp user chuyển tab sang Địa chỉ cũ
    const foundLegacyP = legacyProvinces.data?.find((p) => isLocationMatch(p, currentCity));
    setLegacyProvince(foundLegacyP);
    setLegacyDistrict(undefined);
    setLegacyWard(undefined);

    setConversionResult(null);
    setSelectedCandidate(null);
    setError("");
    setFormVisible(true);
  };

  // Tự động tìm và chọn tỉnh mới khi danh sách newProvinces đã sẵn sàng
  useEffect(() => {
    if (editing && pendingSyncCity && newProvinces.data && newProvinces.data.length > 0) {
      const foundP = newProvinces.data.find((p) => isLocationMatch(p, pendingSyncCity));
      if (foundP) {
        setNewProvince(foundP);
      }
      setPendingSyncCity(null);
    }
  }, [editing, pendingSyncCity, newProvinces.data]);

  // Tự động tìm và chọn phường/xã mới khi danh sách wards của tỉnh mới đã tải xong
  useEffect(() => {
    if (editing && pendingSyncWard && newWards.data && newWards.data.length > 0) {
      const foundW = newWards.data.find((w) => isLocationMatch(w, pendingSyncWard));
      if (foundW) {
        setNewWard(foundW);
        setPendingSyncWard(null);
      }
    }
  }, [editing, pendingSyncWard, newWards.data]);

  // Xóa địa chỉ
  const handleDelete = (a: Row) => {
    Alert.alert(
      "Xóa địa chỉ này?",
      "Bạn có chắc muốn xóa địa chỉ giao hàng này khỏi sổ địa chỉ?",
      [
        { text: "Giữ lại", style: "cancel" },
        {
          text: "Xóa địa chỉ",
          style: "destructive",
          onPress: async () => {
            try {
              await api(`/me/addresses/${a.addressId}`, "DELETE");
              state.reload();
            } catch (e) {
              setError((e as Error).message);
            }
          },
        },
      ]
    );
  };

  // Lưu địa chỉ (Thêm mới hoặc Cập nhật)
  const handleSave = async () => {
    if (!name.trim() || !phone.trim() || !street.trim()) {
      setError("Vui lòng điền đầy đủ họ tên người nhận, số điện thoại và địa chỉ chi tiết.");
      return;
    }

    let finalCity = "";
    let finalWard = "";
    let finalProvinceCode: string | undefined = undefined;
    let finalWardCode: string | undefined = undefined;

    if (mode === "new") {
      if (!newProvince) {
        setError("Vui lòng chọn Tỉnh / Thành phố mới (sau sáp nhập).");
        return;
      }
      if (!newWard) {
        setError("Vui lòng chọn Phường / Xã mới (sau sáp nhập).");
        return;
      }
      finalCity = String(newProvince.name);
      finalWard = String(newWard.name);
      finalProvinceCode = String(newProvince.code);
      finalWardCode = String(newWard.code);
    } else {
      // Chế độ địa chỉ cũ
      if (!legacyProvince || !legacyDistrict) {
        setError("Vui lòng chọn Tỉnh/Thành và Quận/Huyện cũ.");
        return;
      }
      if (!selectedCandidate) {
        setError("Chưa hoàn tất chuyển đổi địa chỉ sang đơn vị hành chính sau sáp nhập.");
        return;
      }
      finalCity = String(selectedCandidate.province.name);
      finalWard = String(selectedCandidate.ward.name);
      finalProvinceCode = String(selectedCandidate.province.code);
      finalWardCode = String(selectedCandidate.ward.code);
    }

    setBusy(true);
    setError("");
    try {
      const payload = {
        recipientName: name.trim(),
        phone: phone.trim(),
        street: street.trim(),
        defaultAddress: isDefault,
        city: finalCity,
        ward: finalWard,
        provinceCode: finalProvinceCode,
        wardCode: finalWardCode,
      };

      if (editing && !String(editing.addressId).startsWith("addr-")) {
        await api(`/me/addresses/${editing.addressId}`, "PUT", payload);
      } else {
        await api("/me/addresses", "POST", payload);
      }
      setFormVisible(false);
      state.reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={st.container}>
      <Stack.Screen
        options={{
          title: "Sổ địa chỉ nhận hàng",
          headerTitleStyle: {
            fontFamily: "Editorial",
            fontSize: 18,
            color: Colors.primary,
          },
          headerTintColor: Colors.primary,
          headerStyle: { backgroundColor: Colors.canvas },
        }}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={st.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.champagneDeep}
            colors={[Colors.champagneDeep]}
          />
        }
      >
        {/* Header Intro */}
        <View style={st.introBox}>
          <Text style={st.introTitle}>Địa chỉ giao hàng</Text>
          <Text style={st.introSub}>
            Hỗ trợ chuẩn đơn vị hành chính mới sau sáp nhập (01/07/2025) và tự động chuyển đổi từ địa chỉ cũ.
          </Text>
        </View>

        {/* Address Cards List */}
        <View style={st.cardList}>
          {addresses.length === 0 ? (
            <View
              style={{
                backgroundColor: Colors.surface,
                borderRadius: Radii.md,
                padding: 24,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: Colors.borderHairline,
                gap: 8,
              }}
            >
              <Ionicons name="location-outline" size={38} color={Colors.champagneDeep} />
              <Text
                style={{
                  fontFamily: Fonts.sansSemiBold,
                  fontSize: 15,
                  color: Colors.primary,
                }}
              >
                Chưa có địa chỉ giao hàng
              </Text>
              <Text
                style={{
                  fontFamily: Fonts.sans,
                  fontSize: 12,
                  color: Colors.muted,
                  textAlign: "center",
                  lineHeight: 18,
                }}
              >
                Bạn chưa lưu địa chỉ nào trong sổ địa chỉ. Hãy bấm nút "Thêm địa chỉ mới" bên dưới để thiết lập địa chỉ nhận hàng đầu tiên của bạn.
              </Text>
            </View>
          ) : (
            addresses.map((a) => {
              const isDef = Boolean(a.defaultAddress);
              return (
                <View key={String(a.addressId)} style={[st.addressCard, isDef && st.addressCardDefault]}>
                  <View style={st.cardTopRow}>
                    <View style={st.nameWithIcon}>
                      <Ionicons
                        name="person-circle-outline"
                        size={20}
                        color={Colors.champagneDeep}
                      />
                      <Text style={st.recipientName}>{String(a.recipientName)}</Text>
                    </View>
                    {isDef && (
                      <View style={st.defaultBadge}>
                        <Ionicons name="checkmark-circle" size={12} color={Colors.champagneDeep} />
                        <Text style={st.defaultBadgeText}>Mặc định</Text>
                      </View>
                    )}
                  </View>

                  <View style={st.infoRow}>
                    <Ionicons name="location-outline" size={16} color={Colors.muted} style={{ marginTop: 2 }} />
                    <Text style={st.addressText}>
                      {String(a.street)}, {String(a.ward)}, {String(a.city)}
                    </Text>
                  </View>

                  <View style={st.infoRow}>
                    <Ionicons name="call-outline" size={16} color={Colors.muted} />
                    <Text style={st.phoneText}>{String(a.phone)}</Text>
                  </View>

                  <View style={st.cardActions}>
                    <Pressable
                      style={st.actionBtn}
                      onPress={() => handleOpenEdit(a)}
                    >
                      <Ionicons name="create-outline" size={16} color={Colors.primary} />
                      <Text style={st.actionBtnText}>Sửa</Text>
                    </Pressable>
                    <Pressable
                      style={st.actionBtn}
                      onPress={() => handleDelete(a)}
                    >
                      <Ionicons name="trash-outline" size={16} color="#DC2626" />
                      <Text style={[st.actionBtnText, { color: "#DC2626" }]}>Xóa</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* Add Address CTA */}
        <Pressable
          style={({ pressed }) => [st.addAddressBtn, pressed && { opacity: 0.85 }]}
          onPress={handleOpenAdd}
        >
          <Ionicons name="add-circle-outline" size={20} color={Colors.canvas} />
          <Text style={st.addAddressBtnText}>Thêm địa chỉ mới</Text>
        </Pressable>
      </ScrollView>

      {/* Add / Edit Address Modal */}
      <Modal
        visible={formVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setFormVisible(false)}
      >
        <View style={st.modalContainer}>
          <View style={st.modalHeader}>
            <Text style={st.modalTitle}>
              {editing ? "Chỉnh sửa địa chỉ" : "Thêm địa chỉ mới"}
            </Text>
            <Pressable
              onPress={() => setFormVisible(false)}
              style={st.closeModalBtn}
            >
              <Ionicons name="close" size={22} color={Colors.primary} />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={st.modalContent}
          >
            {!!error && (
              <View style={st.errorBanner}>
                <Ionicons name="alert-circle" size={16} color="#DC2626" />
                <Text style={st.errorBannerText}>{error}</Text>
              </View>
            )}

            {/* Recipient Details */}
            <View style={st.inputGroup}>
              <Text style={st.inputLabel}>Họ và tên người nhận</Text>
              <TextInput
                style={st.textInput}
                value={name}
                onChangeText={setName}
                placeholder="Ví dụ: Nguyễn Văn A"
                placeholderTextColor={Colors.muted}
              />
            </View>

            <View style={st.inputGroup}>
              <Text style={st.inputLabel}>Số điện thoại liên lạc</Text>
              <TextInput
                style={st.textInput}
                value={phone}
                onChangeText={setPhone}
                placeholder="Ví dụ: 0912345678"
                placeholderTextColor={Colors.muted}
                keyboardType="phone-pad"
              />
            </View>

            {/* Dual Mode Switch */}
            <View style={st.modeSection}>
              <Text style={st.inputLabel}>Phương thức chọn khu vực</Text>
              <View style={st.modeTabsContainer}>
                <Pressable
                  onPress={() => setMode("new")}
                  style={[st.modeTab, mode === "new" && st.modeTabActive]}
                >
                  <Ionicons
                    name="sparkles"
                    size={13}
                    color={mode === "new" ? Colors.primary : Colors.muted}
                  />
                  <Text style={[st.modeTabText, mode === "new" && st.modeTabTextActive]}>
                    Địa chỉ mới
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => setMode("legacy")}
                  style={[st.modeTab, mode === "legacy" && st.modeTabActive]}
                >
                  <Ionicons
                    name="time-outline"
                    size={13}
                    color={mode === "legacy" ? Colors.primary : Colors.muted}
                  />
                  <Text style={[st.modeTabText, mode === "legacy" && st.modeTabTextActive]}>
                    Địa chỉ cũ
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* MODE 1: ĐỊA CHỈ MỚI (TỈNH -> PHƯỜNG/XÃ TRỰC THUỘC) */}
            {mode === "new" ? (
              <View style={st.sectionBlock}>
                <View style={st.guideBanner}>
                  <Ionicons name="information-circle-outline" size={15} color={Colors.champagneDeep} />
                  <Text style={[st.guideBannerText, { textAlign: "justify" }]}>
                    Theo mô hình hành chính mới, Tỉnh/Thành phố trực tiếp quản lý Phường/Xã (không còn Quận/Huyện).
                  </Text>
                </View>

                <SelectField
                  label="Tỉnh / Thành phố mới"
                  value={String(newProvince?.code || "")}
                  displayValue={
                    newProvince
                      ? `${newProvince.type ? newProvince.type + " " : ""}${newProvince.name}`
                      : editing ? String(editing.city || "") : undefined
                  }
                  options={(newProvinces.data || []).map((p) => ({
                    value: String(p.code),
                    label: `${p.type ? p.type + " " : ""}${p.name}`,
                  }))}
                  onChange={(code) => {
                    const selected = newProvinces.data?.find((p) => String(p.code) === code);
                    setNewProvince(selected);
                    setNewWard(undefined);
                    setPendingSyncCity(null);
                    setPendingSyncWard(null);
                  }}
                />

                <SelectField
                  label="Phường / Xã mới"
                  value={String(newWard?.code || "")}
                  displayValue={
                    newWard
                      ? `${newWard.type ? newWard.type + " " : ""}${newWard.name}`
                      : editing && (newProvince || !pendingSyncCity)
                      ? String(editing.ward || "")
                      : undefined
                  }
                  options={(newWards.data || []).map((w) => ({
                    value: String(w.code),
                    label: `${w.type ? w.type + " " : ""}${w.name}`,
                  }))}
                  onChange={(code) => {
                    const selected = newWards.data?.find((w) => String(w.code) === code);
                    setNewWard(selected);
                    setPendingSyncWard(null);
                  }}
                  error={!newProvince ? "Vui lòng chọn Tỉnh / Thành phố mới trước" : undefined}
                  disabled={!newProvince}
                />
              </View>
            ) : (
              /* MODE 2: ĐỊA CHỈ CŨ (TỈNH -> QUẬN/HUYỆN -> PHƯỜNG/XÃ) -> TỰ ĐỘNG CHUYỂN ĐỔI */
              <View style={st.sectionBlock}>
                <View style={st.guideBanner}>
                  <Ionicons name="sync-outline" size={15} color={Colors.champagneDeep} />
                  <Text style={[st.guideBannerText, { textAlign: "justify" }]}>
                    Chọn địa chỉ cũ quen thuộc, hệ thống sẽ tự động quy đổi sang địa chỉ mới sau sáp nhập để lưu vào hệ thống.
                  </Text>
                </View>

                <SelectField
                  label="Tỉnh / Thành phố cũ (63 tỉnh thành)"
                  value={String(legacyProvince?.code || "")}
                  displayValue={
                    legacyProvince
                      ? `${legacyProvince.type ? legacyProvince.type + " " : ""}${legacyProvince.name}`
                      : undefined
                  }
                  options={(legacyProvinces.data || []).map((p) => ({
                    value: String(p.code),
                    label: `${p.type ? p.type + " " : ""}${p.name}`,
                  }))}
                  onChange={(code) => {
                    const selected = legacyProvinces.data?.find((p) => String(p.code) === code);
                    setLegacyProvince(selected);
                    setLegacyDistrict(undefined);
                    setLegacyWard(undefined);
                    setConversionResult(null);
                    setSelectedCandidate(null);
                  }}
                />

                <SelectField
                  label="Quận / Huyện cũ"
                  value={String(legacyDistrict?.code || "")}
                  displayValue={
                    legacyDistrict
                      ? `${legacyDistrict.type ? legacyDistrict.type + " " : ""}${legacyDistrict.name}`
                      : undefined
                  }
                  options={(legacyDistricts.data || []).map((d) => ({
                    value: String(d.code),
                    label: `${d.type ? d.type + " " : ""}${d.name}`,
                  }))}
                  onChange={(code) => {
                    const selected = legacyDistricts.data?.find((d) => String(d.code) === code);
                    setLegacyDistrict(selected);
                    setLegacyWard(undefined);
                    setConversionResult(null);
                    setSelectedCandidate(null);
                  }}
                  error={!legacyProvince ? "Vui lòng chọn Tỉnh/Thành cũ trước" : undefined}
                  disabled={!legacyProvince}
                />

                <SelectField
                  label="Phường / Xã cũ"
                  value={String(legacyWard?.code || "")}
                  displayValue={
                    legacyWard
                      ? `${legacyWard.type ? legacyWard.type + " " : ""}${legacyWard.name}`
                      : undefined
                  }
                  options={(legacyWards.data || []).map((w) => ({
                    value: String(w.code),
                    label: `${w.type ? w.type + " " : ""}${w.name}`,
                  }))}
                  onChange={(code) => {
                    const selected = legacyWards.data?.find((w) => String(w.code) === code);
                    setLegacyWard(selected);
                    if (legacyProvince && legacyDistrict) {
                      void runConversion(
                        String(legacyProvince.code),
                        String(legacyDistrict.code),
                        code,
                        street
                      );
                    }
                  }}
                  error={!legacyDistrict ? "Vui lòng chọn Quận/Huyện cũ trước" : undefined}
                />

                {/* Conversion Status & Candidate Card */}
                {converting && (
                  <View style={st.convertingCard}>
                    <ActivityIndicator size="small" color={Colors.champagneDeep} />
                    <Text style={st.convertingText}>Đang đối soát lịch sử sáp nhập 01/07/2025...</Text>
                  </View>
                )}

                {!converting && conversionResult && (
                  <View style={st.conversionCard}>
                    <View style={st.conversionHeader}>
                      <Ionicons
                        name={conversionResult.status === "EXACT" ? "checkmark-circle" : "alert-circle"}
                        size={18}
                        color={conversionResult.status === "EXACT" ? Colors.statusSuccess : Colors.statusWarning}
                      />
                      <Text style={st.conversionTitle}>
                        {conversionResult.status === "EXACT"
                          ? "Quy đổi tự động chính xác"
                          : "Cần bạn xác nhận khu vực sáp nhập"}
                      </Text>
                    </View>

                    {conversionResult.candidates && conversionResult.candidates.length > 0 ? (
                      <View style={{ gap: 8 }}>
                        <Text style={st.conversionNotice}>
                          Địa chỉ sau chuyển đổi:
                        </Text>
                        {conversionResult.candidates.map((cand, idx) => {
                          const isPicked = selectedCandidate?.ward.code === cand.ward.code;
                          return (
                            <Pressable
                              key={`${cand.ward.code}-${idx}`}
                              onPress={() => setSelectedCandidate(cand)}
                              style={[st.candidateItem, isPicked && st.candidateItemActive]}
                            >
                              <Ionicons
                                name={isPicked ? "radio-button-on" : "radio-button-off"}
                                size={16}
                                color={isPicked ? Colors.champagneDeep : Colors.muted}
                              />
                              <View style={{ flex: 1 }}>
                                <Text style={[st.candidateTitle, isPicked && st.candidateTitleActive]}>
                                  {cand.ward.type} {cand.ward.name}, {cand.province.type} {cand.province.name}
                                </Text>
                                <Text style={st.candidateSub}>
                                  Mã phường: {cand.ward.code} · Mã tỉnh: {cand.province.code}
                                </Text>
                              </View>
                            </Pressable>
                          );
                        })}
                      </View>
                    ) : (
                      <Text style={st.conversionErrorText}>
                        Không tìm thấy quy hoạch sáp nhập tự động. Vui lòng chuyển sang tab "Địa chỉ mới" để chọn trực tiếp.
                      </Text>
                    )}
                  </View>
                )}
              </View>
            )}

            {/* Street input */}
            <View style={st.inputGroup}>
              <Text style={st.inputLabel}>Địa chỉ chi tiết (Số nhà, tên đường, tòa nhà)</Text>
              <TextInput
                style={[st.textInput, { height: 75, textAlignVertical: "top" }]}
                value={street}
                onChangeText={(val) => {
                  setStreet(val);
                  // Nếu đang ở tab legacy và đã có kết quả chuyển đổi, cập nhật lại
                  if (mode === "legacy" && legacyProvince && legacyDistrict && legacyWard) {
                    void runConversion(
                      String(legacyProvince.code),
                      String(legacyDistrict.code),
                      String(legacyWard.code),
                      val
                    );
                  }
                }}
                placeholder="Ví dụ: Số 88 Đồng Khởi"
                placeholderTextColor={Colors.muted}
                multiline
              />
            </View>

            {/* Default Address Switch */}
            <View style={st.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={st.switchLabel}>Đặt làm địa chỉ mặc định</Text>
                <Text style={st.switchSub}>
                  Tự động điền khi thanh toán đơn hàng & ướm thử VTON
                </Text>
              </View>
              <Switch
                value={isDefault}
                onValueChange={setIsDefault}
                trackColor={{ false: Colors.hairline, true: Colors.champagne }}
                thumbColor={isDefault ? Colors.canvas : "#f4f3f4"}
              />
            </View>

            {/* Save CTA */}
            <Pressable
              style={({ pressed }) => [
                st.saveBtn,
                busy && { opacity: 0.6 },
                pressed && { opacity: 0.9 },
              ]}
              disabled={busy}
              onPress={handleSave}
            >
              <Text style={st.saveBtnText}>
                {busy ? "Đang lưu..." : "Lưu địa chỉ nhận hàng"}
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const st = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.canvas,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: 40,
    gap: 16,
  },
  introBox: {
    marginBottom: 4,
  },
  introTitle: {
    fontFamily: "Editorial",
    fontSize: 22,
    color: Colors.primary,
  },
  introSub: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: Colors.muted,
    lineHeight: 18,
    marginTop: 4,
  },
  cardList: {
    gap: 12,
  },
  addressCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.hairline,
    padding: Spacing.md,
    ...Shadows.sm,
    gap: 8,
  },
  addressCardDefault: {
    borderColor: Colors.champagne,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  nameWithIcon: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  recipientName: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 15,
    color: Colors.primary,
  },
  defaultBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.champagneSubtle,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: Colors.champagne,
  },
  defaultBadgeText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 11,
    color: Colors.champagneDeep,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  addressText: {
    flex: 1,
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: Colors.primary,
    lineHeight: 18,
  },
  phoneText: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    color: Colors.muted,
  },
  cardActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.hairline,
    paddingTop: Spacing.xs,
    marginTop: 4,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  actionBtnText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 12,
    color: Colors.primary,
  },
  addAddressBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: Radii.md,
    marginTop: 8,
    ...Shadows.sm,
  },
  addAddressBtnText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 14,
    color: Colors.canvas,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.canvas,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.hairline,
  },
  modalTitle: {
    fontFamily: "Editorial",
    fontSize: 18,
    color: Colors.primary,
  },
  closeModalBtn: {
    padding: 6,
  },
  modalContent: {
    padding: Spacing.lg,
    gap: 16,
    paddingBottom: 40,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    padding: 10,
    borderRadius: Radii.sm,
  },
  errorBannerText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: "#DC2626",
    flex: 1,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 12,
    color: Colors.primary,
  },
  textInput: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    color: Colors.primary,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.hairline,
    borderRadius: Radii.sm,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  modeSection: {
    gap: 8,
  },
  modeTabsContainer: {
    flexDirection: "row",
    backgroundColor: Colors.surfaceMuted,
    borderRadius: Radii.md,
    padding: 4,
    gap: 4,
  },
  modeTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: Radii.sm,
  },
  modeTabActive: {
    backgroundColor: Colors.surface,
    ...Shadows.sm,
  },
  modeTabText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: Colors.muted,
  },
  modeTabTextActive: {
    fontFamily: Fonts.sansSemiBold,
    color: Colors.primary,
  },
  sectionBlock: {
    gap: 12,
  },
  guideBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.champagneSubtle,
    borderWidth: 1,
    borderColor: "rgba(197, 168, 128, 0.4)",
    padding: 10,
    borderRadius: Radii.sm,
  },
  guideBannerText: {
    flex: 1,
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: Colors.champagneDeep,
    lineHeight: 16,
  },
  convertingCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 14,
    backgroundColor: Colors.surface,
    borderRadius: Radii.sm,
    borderWidth: 1,
    borderColor: Colors.hairline,
  },
  convertingText: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: Colors.champagneDeep,
  },
  conversionCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.champagne,
    padding: Spacing.md,
    gap: 10,
  },
  conversionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  conversionTitle: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 13,
    color: Colors.primary,
  },
  conversionNotice: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: Colors.muted,
  },
  candidateItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderRadius: Radii.sm,
    backgroundColor: Colors.surfaceMuted,
    borderWidth: 1,
    borderColor: "transparent",
  },
  candidateItemActive: {
    backgroundColor: Colors.champagneSubtle,
    borderColor: Colors.champagne,
  },
  candidateTitle: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 13,
    color: Colors.primary,
  },
  candidateTitleActive: {
    color: Colors.champagneDeep,
  },
  candidateSub: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    color: Colors.muted,
    marginTop: 2,
  },
  conversionErrorText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: "#DC2626",
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: Radii.sm,
    borderWidth: 1,
    borderColor: Colors.hairline,
  },
  switchLabel: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 13,
    color: Colors.primary,
  },
  switchSub: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    color: Colors.muted,
    marginTop: 2,
  },
  saveBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: Radii.md,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    ...Shadows.sm,
  },
  saveBtnText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 14,
    color: Colors.canvas,
  },
});
