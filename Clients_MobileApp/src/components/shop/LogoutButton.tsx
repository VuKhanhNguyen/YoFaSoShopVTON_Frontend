import { useState } from "react";
import { Modal, View, Text } from "react-native";
import { useSession } from "@/lib/session";
import { Button, Heading, Notice, colors } from "./ui";
export function LogoutButton() {
  const { signOut } = useSession();
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false);
  return (
    <>
      <Button secondary title="Đăng xuất" onPress={() => setOpen(true)} />
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => !busy && setOpen(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "#0F172A80",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <View
            accessibilityViewIsModal
            style={{
              backgroundColor: colors.surface,
              borderRadius: 16,
              padding: 24,
              gap: 12,
            }}
          >
            <Heading small>Đăng xuất khỏi YoFaSo?</Heading>
            <Notice>
              Bạn sẽ cần đăng nhập lại để xem đơn hàng và phòng thử đồ của mình.
            </Notice>
            <Button
              secondary
              title="Ở lại"
              disabled={busy}
              onPress={() => setOpen(false)}
            />
            <Button
              title={busy ? "Đang đăng xuất…" : "Xác nhận đăng xuất"}
              disabled={busy}
              onPress={() => {
                setBusy(true);
                void signOut()
                  .catch(() => {})
                  .finally(() => {
                    setOpen(false);
                    setBusy(false);
                  });
              }}
            />
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              Phiên đã ghi nhớ trên thiết bị cũng được xóa.
            </Text>
          </View>
        </View>
      </Modal>
    </>
  );
}
