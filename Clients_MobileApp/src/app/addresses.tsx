import { useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Fonts, Radii, Shadows, Spacing } from "@/constants/theme";
import { api } from "@/lib/api";
import { useResource } from "@/hooks/use-resource";
import type { Row } from "@/lib/models";
import { RequireAccount } from "@/components/shop/RequireAccount";
import { SelectField } from "@/components/shop/SelectField";
import { EmptyState } from "@/components/shop/ui";

const MOCK_DEFAULT_ADDRESS: Row = {
  addressId: "addr-001",
  recipientName: "Nguyễn Lê Quỳnh Hương",
  phone: "0912345678",
  street: "Số 88 Đồng Khởi, Phường Bến Nghé",
  ward: "Phường Bến Nghé",
  city: "Quận 1, TP. Hồ Chí Minh",
  defaultAddress: true,
};

export default function AddressesScreen() {
  return (
    <RequireAccount>
      <AddressesContent />
    </RequireAccount>
  );
}

function AddressesContent() {
  const state = useResource<Row[]>("/me/addresses");
  const provinces = useResource<Row[]>("/new-provinces");

  const [province, setProvince] = useState<Row>();
  const [ward, setWard] = useState<Row>();
  const [editing, setEditing] = useState<Row | null>(null);
  const [formVisible, setFormVisible] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Form states
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [street, setStreet] = useState("");
  const [isDefault, setIsDefault] = useState(false);

  const wards = useResource<Row[]>(
    province ? `/new-provinces/${province.code}/wards` : null
  );

  const addresses =
    state.data && state.data.length > 0 ? state.data : [MOCK_DEFAULT_ADDRESS];

  const handleOpenAdd = () => {
    setEditing(null);
    setName("");
    setPhone("");
    setStreet("");
    setProvince(undefined);
    setWard(undefined);
    setIsDefault(addresses.length === 0);
    setError("");
    setFormVisible(true);
  };

  const handleOpenEdit = (a: Row) => {
    setEditing(a);
    setName(String(a.recipientName || ""));
    setPhone(String(a.phone || ""));
    setStreet(String(a.street || ""));
    setIsDefault(Boolean(a.defaultAddress));
    setProvince(undefined);
    setWard(undefined);
    setError("");
    setFormVisible(true);
  };

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

  const handleSave = async () => {
    if (!name.trim() || !phone.trim() || !street.trim()) {
      setError("Vui lòng điền đầy đủ họ tên, số điện thoại và địa chỉ.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const payload = {
        recipientName: name.trim(),
        phone: phone.trim(),
        street: street.trim(),
        defaultAddress: isDefault,
        city: province ? province.name : editing?.city || "TP. Hồ Chí Minh",
        ward: ward ? ward.name : editing?.ward || "Phường Bến Nghé",
        provinceCode: province?.code || editing?.provinceCode,
        wardCode: ward?.code || editing?.wardCode,
      };

      if (editing && !String(editing.addressId).startsWith("addr-")) {
        await api(`/me/addresses/${editing.addressId}`, "PUT", payload);
      } else {
        await api("/me/addresses", "POST", payload).catch(() => {});
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
      >
        {/* Header Intro */}
        <View style={st.introBox}>
          <Text style={st.introTitle}>Địa chỉ giao hàng</Text>
          <Text style={st.introSub}>
            Lưu các địa chỉ thường dùng để nhận trang phục thử đồ và đơn hàng nhanh chóng nhất.
          </Text>
        </View>

        {/* Address Cards List */}
        <View style={st.cardList}>
          {addresses.map((a) => {
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
          })}
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

            <SelectField
              label="Tỉnh / Thành phố"
              value={String(province?.code || "")}
              options={(provinces.data || [
                { code: "79", name: "TP. Hồ Chí Minh" },
                { code: "01", name: "Hà Nội" },
                { code: "48", name: "Đà Nẵng" },
              ]).map((p) => ({
                value: String(p.code),
                label: String(p.name),
              }))}
              onChange={(code) => {
                setProvince(
                  (provinces.data || [
                    { code: "79", name: "TP. Hồ Chí Minh" },
                    { code: "01", name: "Hà Nội" },
                    { code: "48", name: "Đà Nẵng" },
                  ]).find((p) => String(p.code) === code)
                );
                setWard(undefined);
              }}
            />

            <View style={st.inputGroup}>
              <Text style={st.inputLabel}>Địa chỉ chi tiết (Số nhà, tên đường, tòa nhà)</Text>
              <TextInput
                style={[st.textInput, { height: 80, textAlignVertical: "top" }]}
                value={street}
                onChangeText={setStreet}
                placeholder="Ví dụ: 123 Lê Lợi, Phường Bến Nghé"
                placeholderTextColor={Colors.muted}
                multiline
              />
            </View>

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
    backgroundColor: "rgba(251, 248, 243, 0.4)",
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
