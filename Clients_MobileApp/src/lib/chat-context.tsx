import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api } from "./api";
import { useSession } from "./session";

export type ChatChannel = "TRO_LY_AI" | "CHU_SHOP";

export interface OpenChatOptions {
  channel?: ChatChannel;
  prefill?: string;
  orderId?: string;
  vtonSessionId?: string;
}

interface ChatContextValue {
  isOpen: boolean;
  channel: ChatChannel;
  setChannel: (ch: ChatChannel) => void;
  openChat: (opts?: OpenChatOptions) => void;
  closeChat: () => void;
  aiSessionId: string;
  resetAiSession: () => void;
  prefill: string;
  clearPrefill: () => void;
  attachedOrderId: string | null;
  attachedVtonSessionId: string | null;
  clearContextAttachment: () => void;
  unreadShopCount: number;
  setUnreadShopCount: (count: number) => void;
}

const GUEST_SESSION_KEY = "yofaso.chat.guest_ai_session";
const ChatContext = createContext<ChatContextValue | null>(null);

function makeSessionId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const { user } = useSession();
  const userId = user?.userId ?? null;
  const [isOpen, setIsOpen] = useState(false);
  const [channel, setChannel] = useState<ChatChannel>("TRO_LY_AI");
  const [guestSessionId, setGuestSessionId] = useState<string>(() => makeSessionId("guest"));
  const [userSessionOverride, setUserSessionOverride] = useState<{
    ownerId: string;
    sessionId: string;
  } | null>(null);
  const [prefill, setPrefill] = useState("");
  const [attachedOrderId, setAttachedOrderId] = useState<string | null>(null);
  const [attachedVtonSessionId, setAttachedVtonSessionId] = useState<string | null>(null);
  const [unreadState, setUnreadState] = useState<{ ownerId: string; count: number }>({
    ownerId: "",
    count: 0,
  });

  const aiSessionId = userId
    ? userSessionOverride?.ownerId === userId
      ? userSessionOverride.sessionId
      : `ai-${userId}`
    : guestSessionId;

  const unreadShopCount = userId && unreadState.ownerId === userId ? unreadState.count : 0;

  const setUnreadShopCount = useCallback(
    (count: number) => {
      if (userId) setUnreadState({ ownerId: userId, count });
    },
    [userId],
  );

  // Khôi phục mã phiên AI của khách vãng lai từ AsyncStorage (async callback)
  useEffect(() => {
    if (userId) return;
    let active = true;
    AsyncStorage.getItem(GUEST_SESSION_KEY)
      .then((saved) => {
        if (!active) return;
        if (saved && /^[A-Za-z0-9_-]{4,36}$/.test(saved)) {
          setGuestSessionId(saved);
        } else {
          const fresh = makeSessionId("guest");
          setGuestSessionId(fresh);
          void AsyncStorage.setItem(GUEST_SESSION_KEY, fresh).catch(() => {});
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [userId]);

  // Kiểm tra nhẹ tin chưa đọc từ Chủ shop khi người dùng đã đăng nhập
  useEffect(() => {
    if (!userId) return;
    let mounted = true;
    const checkUnread = () => {
      api<{ unreadCount: number }>("/chat/messages?channel=CHU_SHOP&limit=1")
        .then((res) => {
          if (mounted) setUnreadState({ ownerId: userId, count: res.unreadCount || 0 });
        })
        .catch(() => {});
    };
    checkUnread();
    const timer = setInterval(checkUnread, 15000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [userId]);

  const openChat = useCallback((opts?: OpenChatOptions) => {
    if (opts?.channel) setChannel(opts.channel);
    if (opts?.prefill !== undefined) setPrefill(opts.prefill);
    if (opts?.orderId !== undefined) setAttachedOrderId(opts.orderId || null);
    if (opts?.vtonSessionId !== undefined) setAttachedVtonSessionId(opts.vtonSessionId || null);
    setIsOpen(true);
  }, []);

  const closeChat = useCallback(() => {
    setIsOpen(false);
  }, []);

  const resetAiSession = useCallback(() => {
    if (userId) {
      setUserSessionOverride({
        ownerId: userId,
        sessionId: makeSessionId(`ai-${userId.slice(-4)}`),
      });
    } else {
      const fresh = makeSessionId("guest");
      setGuestSessionId(fresh);
      void AsyncStorage.setItem(GUEST_SESSION_KEY, fresh).catch(() => {});
    }
    setAttachedOrderId(null);
    setAttachedVtonSessionId(null);
  }, [userId]);

  const clearPrefill = useCallback(() => setPrefill(""), []);
  const clearContextAttachment = useCallback(() => {
    setAttachedOrderId(null);
    setAttachedVtonSessionId(null);
  }, []);

  const value = useMemo<ChatContextValue>(
    () => ({
      isOpen,
      channel,
      setChannel,
      openChat,
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
    }),
    [
      isOpen,
      channel,
      openChat,
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
    ],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChatModal() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChatModal must be used inside ChatProvider");
  return ctx;
}
