import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { File as ExpoFile } from "expo-file-system";
import { Ionicons } from "@expo/vector-icons";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors, Fonts, Radii, Shadows } from "@/constants/theme";
import { api, chatImageSource, publicUrl } from "@/lib/api";
import { useChatModal, type ChatChannel } from "@/lib/chat-context";
import { useSession } from "@/lib/session";
import {
  SHOP_SUPPORT,
  openPhoneDialer,
  openSupportEmail,
  openZaloChat,
} from "@/lib/support-config";
import { SPRING_SNAPPY, ScalePressable, SlidingTabs } from "./MotionPrimitives";

const FAB_SIZE = 56;
const EDGE_MARGIN = 16;
const DOCK_HEIGHT = 68;
const DOCK_GAP = 14;
const PRODUCT_CARD_HEIGHT = 188;

interface ProductAttachment {
  productId: string;
  name: string;
  minPrice?: number;
  salePrice?: number | null;
  sizes?: string | null;
  colors?: string | null;
  totalStock?: number;
  coverUrl?: string | null;
}

interface VoucherAttachment {
  code: string;
  name: string;
  type?: string;
  value?: number;
}

interface OrderAttachment {
  orderId: string;
  status: string;
  paymentStatus?: string;
  total?: number;
}

interface ContactAttachment {
  hotline?: string;
  zalo?: string;
  email?: string;
  hours?: string;
  showroomName?: string;
  showroomAddress?: string;
}

interface ChatMessageItem {
  messageId: string;
  sessionId: string;
  channel: ChatChannel;
  senderRole: "KHACH_HANG" | "TRO_LY_AI" | "CHU_SHOP" | string;
  staffName?: string | null;
  content: string;
  imageUrl?: string | null;
  intent?: string | null;
  vtonSessionId?: string | null;
  sentAt?: string;
  attachments?: {
    products?: ProductAttachment[];
    vouchers?: VoucherAttachment[];
    orders?: OrderAttachment[];
    contactCard?: ContactAttachment;
    quickReplies?: string[];
    guardrailBlocked?: boolean;
  } | null;
}

const WELCOME_PROMPTS = [
  "Tìm áo sơ mi / polo đang bán",
  "Cao 1m62 nặng 55kg mặc size gì?",
  "Gợi ý phối đồ đi làm thanh lịch",
  "Mã giảm giá & liên hệ Chủ shop",
] as const;

function formatPrice(value?: number | null) {
  if (value === null || value === undefined) return "";
  return `${Number(value).toLocaleString("vi-VN")}đ`;
}

function formatTimeShort(raw?: string) {
  if (!raw) return "";
  const dt = new Date(raw);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

/**
 * Bong bóng Chat nổi kiểu Messenger (không thể ẩn/xóa):
 * - Luôn nằm phía trên FloatingGlassDock.
 * - Kéo thả tự do trên màn hình, thả tay ra dựa vào tâm màn hình (width/2)
 *   tự hút mượt về góc trên bên trái hoặc góc trên bên phải của FloatingGlassDock.
 */
export const FloatingChatBubble = memo(function FloatingChatBubble() {
  const { openChat, unreadShopCount } = useChatModal();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const dockBottom = Math.max(insets.bottom, Platform.OS === "ios" ? 16 : 12);
  const maxY = Math.max(insets.top + 80, height - (dockBottom + DOCK_HEIGHT + DOCK_GAP));
  const minY = Math.max(insets.top + 60, 68);
  const rightX = Math.max(EDGE_MARGIN, width - FAB_SIZE - EDGE_MARGIN);
  const leftX = EDGE_MARGIN;

  const [side, setSide] = useState<"left" | "right">("right");
  const posX = useSharedValue(rightX);
  const posY = useSharedValue(maxY);
  const startX = useSharedValue(rightX);
  const startY = useSharedValue(maxY);
  const scale = useSharedValue(1);

  useEffect(() => {
    const targetX = side === "left" ? leftX : rightX;
    posX.value = withSpring(targetX, SPRING_SNAPPY);
    posY.value = withSpring(maxY, SPRING_SNAPPY);
  }, [width, height, maxY, leftX, rightX, side, posX, posY]);

  const handleOpen = useCallback(() => {
    openChat();
  }, [openChat]);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(6)
        .onStart(() => {
          startX.value = posX.value;
          startY.value = posY.value;
          scale.value = withSpring(1.06, SPRING_SNAPPY);
        })
        .onUpdate((e) => {
          const nextX = startX.value + e.translationX;
          const nextY = startY.value + e.translationY;
          posX.value = Math.min(rightX, Math.max(leftX, nextX));
          posY.value = Math.min(maxY, Math.max(minY, nextY));
        })
        .onEnd(() => {
          scale.value = withSpring(1, SPRING_SNAPPY);
          const centerX = posX.value + FAB_SIZE / 2;
          const snapLeft = centerX < width / 2;
          posX.value = withSpring(snapLeft ? leftX : rightX, SPRING_SNAPPY);
          // Tự đưa về đúng vị trí phía trên bên trái/phải của FloatingGlassDock
          posY.value = withSpring(maxY, SPRING_SNAPPY);
          runOnJS(setSide)(snapLeft ? "left" : "right");
        }),
    [leftX, rightX, minY, maxY, width, posX, posY, startX, startY, scale],
  );

  const tapGesture = useMemo(
    () =>
      Gesture.Tap().onEnd((_e, success) => {
        if (success) {
          runOnJS(handleOpen)();
        }
      }),
    [handleOpen],
  );

  const gesture = useMemo(() => Gesture.Exclusive(panGesture, tapGesture), [panGesture, tapGesture]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: posX.value },
      { translateY: posY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <View pointerEvents="box-none" style={st.fabOverlay}>
      <GestureDetector gesture={gesture}>
        <Animated.View
          accessible
          accessibilityRole="button"
          accessibilityLabel="Mở Trợ lý AI và Live Chat Chủ shop YoFaSo"
          style={[st.fabCircle, animStyle]}
        >
          <Image
            source={require("../../../assets/brand/AIChatbox.png")} 
            style={{ width: 32, height: 32, borderRadius: 16 }}
            resizeMode="cover"
          />
          {unreadShopCount > 0 && (
            <View style={st.fabBadge}>
              <Text style={st.fabBadgeText}>
                {unreadShopCount > 9 ? "9+" : unreadShopCount}
              </Text>
            </View>
          )}
        </Animated.View>
      </GestureDetector>
    </View>
  );
});

/** Hộp thoại Chat hợp nhất có SlidingTabs (Trợ lý AI | Chủ shop). */
export const ChatSheetModal = memo(function ChatSheetModal() {
  const { user } = useSession();
  const {
    isOpen,
    channel,
    setChannel,
    closeChat,
    aiSessionId,
    resetAiSession,
    prefill,
    clearPrefill,
    attachedOrderId,
    attachedVtonSessionId,
    clearContextAttachment,
    unreadShopCount,
    setUnreadShopCount,
  } = useChatModal();
  const insets = useSafeAreaInsets();

  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [draft, setDraft] = useState("");
  const [pendingImageKey, setPendingImageKey] = useState<string | null>(null);
  const [pendingImageUri, setPendingImageUri] = useState<string | null>(null);
  const [errorText, setErrorText] = useState("");

  const listRef = useRef<FlatList<ChatMessageItem> | null>(null);
  const shouldAutoScrollRef = useRef(true);

  useEffect(() => {
    if (isOpen && prefill) {
      setDraft(prefill);
      clearPrefill();
    }
  }, [isOpen, prefill, clearPrefill]);

  const loadMessages = useCallback(
    async (silent = false) => {
      if (channel === "CHU_SHOP" && !user) {
        setMessages([]);
        return;
      }
      if (!silent) setLoading(true);
      try {
        const qs =
          channel === "TRO_LY_AI"
            ? `?channel=TRO_LY_AI&sessionId=${encodeURIComponent(aiSessionId)}&limit=60`
            : `?channel=CHU_SHOP&limit=80`;
        const res = await api<{ items: ChatMessageItem[]; unreadCount?: number }>(
          `/chat/messages${qs}`,
        );
        setMessages(res.items || []);
        if (channel === "CHU_SHOP" && user) {
          setUnreadShopCount(0);
          api("/chat/read", "POST").catch(() => {});
        }
      } catch (e: any) {
        if (!silent) {
          setErrorText(e?.message || "Chưa tải được lịch sử trò chuyện.");
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [channel, user, aiSessionId, setUnreadShopCount],
  );

  useEffect(() => {
    if (!isOpen) return;
    setErrorText("");
    shouldAutoScrollRef.current = true;
    void loadMessages(false);
  }, [isOpen, channel, aiSessionId, loadMessages]);

  // Smart polling 3.5s trên kênh Live Chat Chủ shop khi dialog đang mở
  useEffect(() => {
    if (!isOpen || channel !== "CHU_SHOP" || !user) return;
    const timer = setInterval(() => {
      void loadMessages(true);
    }, 3500);
    return () => clearInterval(timer);
  }, [isOpen, channel, user, loadMessages]);

  const handlePickImage = async () => {
    if (uploadingImage || sending) return;
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        setErrorText("Cần cấp quyền thư viện ảnh để gửi hình trong đoạn chat.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 0.85,
      });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      setUploadingImage(true);
      setErrorText("");

      const form = new FormData();
      const ext = (asset.uri.split(".").pop() || "").toLowerCase();
      const isPng = ext === "png" || asset.mimeType?.includes("png");
      const fileName = isPng ? "chat.png" : "chat.jpg";
      const mimeType = isPng ? "image/png" : "image/jpeg";

      if (Platform.OS === "web") {
        const resp = await fetch(asset.uri);
        const blob = await resp.blob();
        form.append("file", blob, fileName);
      } else {
        try {
          const file = new ExpoFile(asset.uri);
          form.append("file", file as unknown as Blob, fileName);
        } catch {
          form.append("file", { uri: asset.uri, type: mimeType, name: fileName } as any);
        }
      }
      if (!user) {
        form.append("sessionId", aiSessionId);
      }

      const uploaded = await api<{ imageKey: string }>("/chat/images", "POST", form);
      setPendingImageKey(uploaded.imageKey);
      setPendingImageUri(asset.uri);
    } catch (e: any) {
      setErrorText(e?.message || "Tải ảnh thất bại. Vui lòng thử ảnh PNG/JPEG ≤ 10MB.");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSend = useCallback(
    async (overrideText?: string) => {
      if (sending) return;
      if (channel === "CHU_SHOP" && !user) return;
      const text = (overrideText ?? draft).trim();
      const imgKey = overrideText ? null : pendingImageKey;
      if (!text && !imgKey) return;

      setSending(true);
      setErrorText("");
      if (!overrideText) {
        setDraft("");
        setPendingImageKey(null);
        setPendingImageUri(null);
      }

      const optimisticId = `tmp-${Date.now()}`;
      const optimistic: ChatMessageItem = {
        messageId: optimisticId,
        sessionId: channel === "TRO_LY_AI" ? aiSessionId : `shop-${user?.userId || ""}`,
        channel,
        senderRole: "KHACH_HANG",
        content: text || "Ảnh đính kèm",
        sentAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimistic]);
      shouldAutoScrollRef.current = true;
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 60);

      try {
        const res = await api<{
          userMessage: ChatMessageItem;
          replyMessage?: ChatMessageItem;
        }>("/chat/messages", "POST", {
          channel,
          sessionId: channel === "TRO_LY_AI" ? aiSessionId : undefined,
          content: text,
          imageKey: imgKey,
          vtonSessionId: attachedVtonSessionId || undefined,
          orderId: attachedOrderId || undefined,
        });
        setMessages((prev) => {
          const withoutTmp = prev.filter((m) => m.messageId !== optimisticId);
          const added = [res.userMessage, ...(res.replyMessage ? [res.replyMessage] : [])];
          return [...withoutTmp, ...added];
        });
        if (attachedOrderId || attachedVtonSessionId) {
          clearContextAttachment();
        }
        shouldAutoScrollRef.current = true;
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 120);
      } catch (e: any) {
        setMessages((prev) => prev.filter((m) => m.messageId !== optimisticId));
        setErrorText(e?.message || "Chưa gửi được tin nhắn. Vui lòng thử lại.");
      } finally {
        setSending(false);
      }
    },
    [
      sending,
      channel,
      user,
      draft,
      pendingImageKey,
      aiSessionId,
      attachedOrderId,
      attachedVtonSessionId,
      clearContextAttachment,
    ],
  );

  const tabOptions = useMemo(
    () => [
      { id: "TRO_LY_AI" as const, label: "Trợ lý AI", icon: "sparkles-outline" as const },
      {
        id: "CHU_SHOP" as const,
        label: unreadShopCount > 0 ? `Chủ shop (${unreadShopCount})` : "Chủ shop",
        icon: "chatbubbles-outline" as const,
      },
    ],
    [unreadShopCount],
  );

  const renderMessage = useCallback(
    ({ item }: { item: ChatMessageItem }) => {
      const isMine = item.senderRole === "KHACH_HANG";
      const isShop = item.senderRole === "CHU_SHOP";
      const att = item.attachments;

      return (
        <View style={[st.msgWrap, isMine ? st.msgWrapMine : st.msgWrapOther]}>
          {!isMine && (
            <Text style={st.senderTag}>
              {isShop
                ? `Chủ shop YoFaSo${item.staffName ? ` · ${item.staffName}` : ""}`
                : "Trợ lý AI YoFaSo"}
            </Text>
          )}
          <View style={[st.bubble, isMine ? st.bubbleMine : isShop ? st.bubbleShop : st.bubbleAi]}>
            {item.imageUrl && !item.messageId.startsWith("tmp-") && (
              <Image
                source={chatImageSource(item.messageId, aiSessionId)}
                style={st.msgImage}
                resizeMode="cover"
              />
            )}
            <Text style={[st.msgText, isMine && st.msgTextMine]}>{item.content}</Text>
            <Text style={[st.msgTime, isMine && st.msgTimeMine]}>{formatTimeShort(item.sentAt)}</Text>
          </View>

          {/* Rich Cards từ DuLieuDinhKem (JSON) */}
          {!isMine && att?.products && att.products.length > 0 && (
            <View style={st.cardsWrap}>
              <ScrollView
                horizontal
                nestedScrollEnabled
                showsHorizontalScrollIndicator={false}
                style={st.cardsScroll}
                contentContainerStyle={st.cardsRow}
              >
                {att.products.map((p) => (
                  <ScalePressable
                    key={p.productId}
                    onPress={() => {
                      closeChat();
                      router.push({ pathname: "/product/[id]", params: { id: p.productId } });
                    }}
                    style={st.productCard}
                  >
                    {p.coverUrl ? (
                      <Image
                        source={{ uri: publicUrl(p.coverUrl) }}
                        style={st.productThumb}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={[st.productThumb, st.productThumbPlaceholder]}>
                        <Ionicons name="shirt-outline" size={22} color={Colors.champagneDeep} />
                      </View>
                    )}
                    <Text style={st.productName} numberOfLines={2}>
                      {p.name}
                    </Text>
                    <Text style={st.productPrice} numberOfLines={1}>
                      {formatPrice(p.salePrice ?? p.minPrice)}
                    </Text>
                    {!!p.sizes && (
                      <Text style={st.productMeta} numberOfLines={1}>
                        Size: {p.sizes}
                      </Text>
                    )}
                  </ScalePressable>
                ))}
              </ScrollView>
            </View>
          )}

          {!isMine && att?.orders && att.orders.length > 0 && (
            <View style={st.richBlock}>
              {att.orders.map((o) => (
                <ScalePressable
                  key={o.orderId}
                  onPress={() => {
                    closeChat();
                    router.push({ pathname: "/order/[id]", params: { id: o.orderId } });
                  }}
                  style={st.orderCard}
                >
                  <Ionicons name="cube-outline" size={18} color={Colors.champagneDeep} />
                  <View style={{ flex: 1 }}>
                    <Text style={st.orderTitle}>Đơn {o.orderId}</Text>
                    <Text style={st.orderSub}>
                      {o.status} · {formatPrice(o.total)}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                </ScalePressable>
              ))}
            </View>
          )}

          {!isMine && att?.contactCard && (
            <View style={st.contactCard}>
              <Text style={st.contactTitle}>Liên hệ trực tiếp Chủ shop YoFaSo</Text>
              <Text style={st.contactSub}>
                {att.contactCard.showroomName || SHOP_SUPPORT.showroomName} ·{" "}
                {att.contactCard.hours || SHOP_SUPPORT.hours}
              </Text>
              <View style={st.contactBtns}>
                <ScalePressable
                  onPress={() => void openPhoneDialer(att.contactCard?.hotline)}
                  style={st.contactBtnPrimary}
                >
                  <Ionicons name="call-outline" size={14} color="#FFFFFF" />
                  <Text style={st.contactBtnPrimaryText}>Gọi ngay</Text>
                </ScalePressable>
                <ScalePressable
                  onPress={() => void openZaloChat(att.contactCard?.zalo)}
                  style={st.contactBtnOutline}
                >
                  <Ionicons name="chatbubble-outline" size={14} color={Colors.primary} />
                  <Text style={st.contactBtnOutlineText}>Zalo</Text>
                </ScalePressable>
                <ScalePressable
                  onPress={() => void openSupportEmail(att.contactCard?.email)}
                  style={st.contactBtnOutline}
                >
                  <Ionicons name="mail-outline" size={14} color={Colors.primary} />
                  <Text style={st.contactBtnOutlineText}>Email</Text>
                </ScalePressable>
              </View>
            </View>
          )}

          {!isMine && att?.quickReplies && att.quickReplies.length > 0 && (
            <View style={st.quickRow}>
              {att.quickReplies.map((qr, idx) => (
                <ScalePressable
                  key={`${item.messageId}-qr-${idx}`}
                  onPress={() => void handleSend(qr)}
                  style={st.quickChip}
                >
                  <Text style={st.quickChipText}>{qr}</Text>
                </ScalePressable>
              ))}
            </View>
          )}
        </View>
      );
    },
    [aiSessionId, closeChat, handleSend],
  );

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="slide"
      onRequestClose={closeChat}
    >
      <View style={st.modalRoot}>
        <Pressable style={st.backdrop} onPress={closeChat} />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={[st.sheet, { paddingBottom: Math.max(insets.bottom, 12) }]}
        >
          {/* Handle + Header */}
          <View style={st.handle} />
          <View style={st.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={st.sheetTitle}>Trò chuyện YoFaSo</Text>
              <Text style={st.sheetSub}>
                {channel === "TRO_LY_AI"
                  ? "Tư vấn thời trang 24/7"
                  : "Nhắn tin trực tiếp với Chủ shop (08:00 - 22:00)"}
              </Text>
            </View>

            {channel === "TRO_LY_AI" && (
              <ScalePressable
                accessibilityLabel="Tạo đoạn chat AI mới"
                onPress={() => {
                  resetAiSession();
                  setMessages([]);
                }}
                style={st.headerPillBtn}
              >
                <Ionicons name="add" size={16} color={Colors.primary} />
                <Text style={st.headerPillText}>Mới</Text>
              </ScalePressable>
            )}

            <ScalePressable
              accessibilityLabel="Đóng hộp thoại chat"
              onPress={closeChat}
              style={st.closeBtn}
            >
              <Ionicons name="close" size={20} color={Colors.primary} />
            </ScalePressable>
          </View>

          {/* SlidingTabs chuyển qua lại Trợ lý AI | Chủ shop */}
          <SlidingTabs<ChatChannel>
            options={tabOptions}
            value={channel}
            onChange={setChannel}
            variant="obsidian"
            containerStyle={st.tabsContainer}
          />

          {/* Ngữ cảnh Đơn hàng / VTON đang đính kèm (nếu mở từ Trung tâm Hỗ trợ) */}
          {(attachedOrderId || attachedVtonSessionId) && channel === "TRO_LY_AI" && (
            <View style={st.contextPill}>
              <Ionicons name="link-outline" size={14} color={Colors.champagneDeep} />
              <Text style={st.contextPillText} numberOfLines={1}>
                Đang hỏi theo ngữ cảnh:{" "}
                {attachedOrderId ? `Đơn ${attachedOrderId}` : `Phiên VTON ${attachedVtonSessionId}`}
              </Text>
              <Pressable onPress={clearContextAttachment} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
              </Pressable>
            </View>
          )}

          {!!errorText && (
            <View style={st.errorBanner}>
              <Text style={st.errorBannerText}>{errorText}</Text>
            </View>
          )}

          {/* Nội dung chính */}
          {channel === "CHU_SHOP" && !user ? (
            <View style={st.guestShopBox}>
              <View style={st.guestShopIcon}>
                <Ionicons name="chatbubbles-outline" size={30} color={Colors.champagneDeep} />
              </View>
              <Text style={st.guestShopTitle}>Đăng nhập để nhắn trực tiếp với Chủ shop</Text>
              <Text style={st.guestShopDesc}>
                Để Chủ shop lưu đúng lịch sử trao đổi theo tài khoản của bạn, vui lòng đăng nhập hoặc liên hệ nhanh qua Hotline/Zalo bên dưới.
              </Text>
              <ScalePressable
                onPress={() => {
                  closeChat();
                  router.push("/auth");
                }}
                style={st.guestLoginBtn}
              >
                <Text style={st.guestLoginBtnText}>Đăng nhập ngay</Text>
              </ScalePressable>
              <View style={st.contactBtns}>
                <ScalePressable onPress={() => void openPhoneDialer()} style={st.contactBtnOutline}>
                  <Ionicons name="call-outline" size={14} color={Colors.primary} />
                  <Text style={st.contactBtnOutlineText}>Gọi {SHOP_SUPPORT.hotlineDisplay}</Text>
                </ScalePressable>
                <ScalePressable onPress={() => void openZaloChat()} style={st.contactBtnOutline}>
                  <Ionicons name="chatbubble-outline" size={14} color={Colors.primary} />
                  <Text style={st.contactBtnOutlineText}>Nhắn Zalo</Text>
                </ScalePressable>
              </View>
            </View>
          ) : (
            <>
              <FlatList
                ref={listRef}
                data={messages}
                keyExtractor={(item) => item.messageId}
                renderItem={renderMessage}
                style={st.list}
                contentContainerStyle={[
                  st.listContent,
                  messages.length === 0 && st.listContentEmpty,
                ]}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled
                onScrollBeginDrag={() => {
                  shouldAutoScrollRef.current = false;
                }}
                onContentSizeChange={() => {
                  if (shouldAutoScrollRef.current && messages.length > 0) {
                    listRef.current?.scrollToEnd({ animated: true });
                    if (!sending) {
                      shouldAutoScrollRef.current = false;
                    }
                  }
                }}
                ListEmptyComponent={
                  loading ? (
                    <View style={st.centerBox}>
                      <ActivityIndicator color={Colors.champagneDeep} />
                      <Text style={st.emptySub}>Đang tải tin nhắn…</Text>
                    </View>
                  ) : (
                    <View style={st.emptyWrap}>
                      <View style={st.emptyIcon}>
                       <Image
  source={
    channel === "TRO_LY_AI"
      ? require("../../../assets/brand/AIChatbox.png")
      : require("../../../assets/brand/ShopChatbox.png") // Đổi lại đường dẫn ảnh shop
  }
  style={{ width: 40, height: 40, borderRadius: 13 }}
  resizeMode="cover"
/>
                      </View>
                      <Text style={st.emptyTitle}>
                        {channel === "TRO_LY_AI"
                          ? "Xin chào! Em là Trợ lý Thời trang YoFaSo"
                          : "Kênh trao đổi trực tiếp cùng Chủ shop"}
                      </Text>
                      <Text style={st.emptySub}>
                        {channel === "TRO_LY_AI"
                          ? "Hỏi em về sản phẩm, size, màu sắc, phối đồ VTON, voucher hoặc đơn hàng tại YoFaSo Shop nhé!"
                          : "Hãy để lại lời nhắn hoặc hình ảnh cần hỗ trợ. Chủ shop sẽ phản hồi ngay khi trực tuyến."}
                      </Text>
                      {channel === "TRO_LY_AI" && (
                        <View style={st.welcomeChips}>
                          {WELCOME_PROMPTS.map((q) => (
                            <ScalePressable
                              key={q}
                              onPress={() => void handleSend(q)}
                              style={st.quickChip}
                            >
                              <Text style={st.quickChipText}>{q}</Text>
                            </ScalePressable>
                          ))}
                        </View>
                      )}
                    </View>
                  )
                }
                ListFooterComponent={
                  sending && channel === "TRO_LY_AI" ? (
                    <View style={st.typingRow}>
                      <ActivityIndicator size="small" color={Colors.champagneDeep} />
                      <Text style={st.typingText}>Trợ lý AI đang chọn gợi ý cho bạn…</Text>
                    </View>
                  ) : null
                }
              />

              {/* Ảnh đang chờ gửi */}
              {pendingImageUri && (
                <View style={st.pendingRow}>
                  <Image source={{ uri: pendingImageUri }} style={st.pendingThumb} />
                  <Text style={st.pendingLabel}>Ảnh đính kèm sẵn sàng gửi</Text>
                  <Pressable
                    onPress={() => {
                      setPendingImageKey(null);
                      setPendingImageUri(null);
                    }}
                    hitSlop={8}
                  >
                    <Ionicons name="close-circle" size={20} color={Colors.textMuted} />
                  </Pressable>
                </View>
              )}

              {/* Thanh nhập tin nhắn */}
              <View style={st.composer}>
                <ScalePressable
                  accessibilityLabel="Đính kèm ảnh"
                  disabled={uploadingImage || sending}
                  onPress={() => void handlePickImage()}
                  style={st.iconActionBtn}
                >
                  {uploadingImage ? (
                    <ActivityIndicator size="small" color={Colors.primary} />
                  ) : (
                    <Ionicons name="image-outline" size={22} color={Colors.primary} />
                  )}
                </ScalePressable>

                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  placeholder={
                    channel === "TRO_LY_AI"
                      ? "Hỏi về sản phẩm, phối đồ..."
                      : "Nhắn tin cho Chủ shop..."
                  }
                  placeholderTextColor={Colors.textMuted}
                  multiline
                  maxLength={2000}
                  style={st.input}
                />

                <ScalePressable
                  accessibilityLabel="Gửi tin nhắn"
                  disabled={sending || uploadingImage || (!draft.trim() && !pendingImageKey)}
                  onPress={() => void handleSend()}
                  style={[
                    st.sendBtn,
                    (sending || uploadingImage || (!draft.trim() && !pendingImageKey)) &&
                      st.sendBtnDisabled,
                  ]}
                >
                  {sending ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Ionicons name="send" size={18} color="#FFFFFF" />
                  )}
                </ScalePressable>
              </View>
            </>
          )}
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
});

const st = StyleSheet.create({
  fabOverlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 80,
  },
  fabCircle: {
    position: "absolute",
    top: 0,
    left: 0,
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    backgroundColor: Colors.champagne,
    borderWidth: 2,
    borderColor: Colors.champagneDeep,
    alignItems: "center",
    justifyContent: "center",
    ...Shadows.lg,
  },
  fabBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.statusDanger,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  fabBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontFamily: Fonts.mono,
    fontWeight: "700",
  },
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(15, 23, 42, 0.48)",
  },
  sheet: {
    height: "86%",
    backgroundColor: Colors.canvas,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingTop: 10,
    paddingHorizontal: 16,
    ...Shadows.sheet,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.borderHairline,
    alignSelf: "center",
    marginBottom: 10,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  sheetTitle: {
    fontFamily: Fonts.editorial,
    fontSize: 19,
    color: Colors.primary,
  },
  sheetSub: {
    fontFamily: Fonts.sans,
    fontSize: 11.5,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  headerPillBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 10,
    height: 36,
    borderRadius: Radii.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderHairline,
  },
  headerPillText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 12,
    color: Colors.primary,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  tabsContainer: {
    marginBottom: 8,
  },
  contextPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.champagneSubtle,
    borderWidth: 1,
    borderColor: "rgba(197, 168, 128, 0.45)",
    borderRadius: Radii.md,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: 8,
  },
  contextPillText: {
    flex: 1,
    fontFamily: Fonts.sansSemiBold,
    fontSize: 12,
    color: Colors.champagneDeep,
  },
  errorBanner: {
    backgroundColor: Colors.statusDangerSubtle,
    borderRadius: Radii.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
  },
  errorBannerText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: Colors.statusDanger,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingVertical: 10,
    gap: 12,
  },
  listContentEmpty: {
    flexGrow: 1,
  },
  centerBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    gap: 8,
  },
  emptyWrap: {
    alignItems: "center",
    paddingVertical: 26,
    paddingHorizontal: 12,
    gap: 8,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.champagneSubtle,
    borderWidth: 1,
    borderColor: "rgba(197, 168, 128, 0.4)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: {
    fontFamily: Fonts.editorial,
    fontSize: 17,
    color: Colors.primary,
    textAlign: "center",
  },
  emptySub: {
    fontFamily: Fonts.sans,
    fontSize: 12.5,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 18,
  },
  welcomeChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    marginTop: 10,
  },
  msgWrap: {
    width: "100%",
    gap: 5,
  },
  msgWrapMine: {
    alignItems: "flex-end",
  },
  msgWrapOther: {
    alignItems: "flex-start",
  },
  senderTag: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 11,
    color: Colors.champagneDeep,
    marginLeft: 4,
  },
  bubble: {
    maxWidth: "88%",
    borderRadius: 18,
    paddingHorizontal: 13,
    paddingVertical: 10,
    gap: 5,
  },
  bubbleMine: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleAi: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderHairline,
    borderBottomLeftRadius: 4,
  },
  bubbleShop: {
    backgroundColor: Colors.champagneSubtle,
    borderWidth: 1,
    borderColor: "rgba(197, 168, 128, 0.55)",
    borderBottomLeftRadius: 4,
  },
  msgImage: {
    width: 190,
    height: 190,
    borderRadius: 12,
    marginBottom: 4,
    backgroundColor: Colors.surfaceMuted,
  },
  msgText: {
    fontFamily: Fonts.sans,
    fontSize: 13.5,
    lineHeight: 20,
    color: Colors.primary,
  },
  msgTextMine: {
    color: "#FFFFFF",
  },
  msgTime: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    color: Colors.textMuted,
    alignSelf: "flex-end",
  },
  msgTimeMine: {
    color: "rgba(255,255,255,0.68)",
  },
  cardsWrap: {
    width: "100%",
    height: PRODUCT_CARD_HEIGHT + 8,
    flexGrow: 0,
    flexShrink: 0,
    marginTop: 2,
  },
  cardsScroll: {
    flexGrow: 0,
    flexShrink: 0,
    height: PRODUCT_CARD_HEIGHT + 8,
  },
  cardsRow: {
    gap: 10,
    paddingVertical: 4,
    paddingRight: 8,
    alignItems: "flex-start",
  },
  productCard: {
    width: 136,
    height: PRODUCT_CARD_HEIGHT,
    backgroundColor: Colors.surface,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.borderHairline,
    padding: 7,
    gap: 3,
    overflow: "hidden",
    ...Shadows.sm,
  },
  productThumb: {
    width: "100%",
    height: 98,
    borderRadius: 8,
    backgroundColor: Colors.surfaceMuted,
  },
  productThumbPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  productName: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 11.5,
    color: Colors.primary,
    lineHeight: 15,
  },
  productPrice: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    color: Colors.champagneDeep,
    lineHeight: 16,
  },
  productMeta: {
    fontFamily: Fonts.sans,
    fontSize: 10,
    color: Colors.textMuted,
    lineHeight: 13,
  },
  richBlock: {
    width: "100%",
    gap: 6,
    marginTop: 2,
  },
  orderCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderHairline,
    borderRadius: Radii.md,
    padding: 10,
    minWidth: 230,
  },
  orderTitle: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    color: Colors.primary,
  },
  orderSub: {
    fontFamily: Fonts.sans,
    fontSize: 11.5,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  contactCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.champagne,
    borderRadius: Radii.md,
    padding: 12,
    gap: 6,
    minWidth: 250,
  },
  contactTitle: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 12.5,
    color: Colors.primary,
  },
  contactSub: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    color: Colors.textSecondary,
  },
  contactBtns: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  contactBtnPrimary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radii.full,
  },
  contactBtnPrimaryText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 12,
    color: "#FFFFFF",
  },
  contactBtnOutline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderHairline,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radii.full,
  },
  contactBtnOutlineText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 12,
    color: Colors.primary,
  },
  quickRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 2,
  },
  quickChip: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: "rgba(197, 168, 128, 0.55)",
    borderRadius: Radii.full,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  quickChipText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 11.5,
    color: Colors.primary,
  },
  typingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  typingText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  pendingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderHairline,
    borderRadius: Radii.md,
    padding: 8,
    marginBottom: 8,
  },
  pendingThumb: {
    width: 44,
    height: 44,
    borderRadius: 8,
  },
  pendingLabel: {
    flex: 1,
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.borderHairline,
  },
  iconActionBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderHairline,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 110,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderHairline,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: Fonts.sans,
    fontSize: 14,
    color: Colors.primary,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
  guestShopBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    gap: 12,
  },
  guestShopIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: Colors.champagneSubtle,
    borderWidth: 1,
    borderColor: Colors.champagne,
    alignItems: "center",
    justifyContent: "center",
  },
  guestShopTitle: {
    fontFamily: Fonts.editorial,
    fontSize: 19,
    color: Colors.primary,
    textAlign: "center",
  },
  guestShopDesc: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  guestLoginBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 26,
    paddingVertical: 13,
    borderRadius: Radii.full,
    marginTop: 4,
  },
  guestLoginBtnText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 14,
    color: "#FFFFFF",
  },
});
