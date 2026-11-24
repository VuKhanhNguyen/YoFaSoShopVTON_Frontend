"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ImagePlus,
  Loader2,
  MessageCircle,
  Phone,
  RefreshCw,
  Search,
  Send,
  X,
} from "lucide-react";
import { api, catalogImage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge, PageHeading } from "./shared";

interface AdminChatCustomer {
  customerId: string;
  fullName: string;
  phone: string;
  email?: string | null;
  avatarUrl?: string | null;
  membership?: string | null;
  status?: string | null;
  unreadCount: number;
  lastMessage?: string | null;
  lastSenderRole?: string | null;
  lastMessageAt?: string | null;
}

interface ChatMessage {
  messageId: string;
  userId?: string | null;
  sessionId: string;
  channel: string;
  senderRole: "KHACH_HANG" | "TRO_LY_AI" | "CHU_SHOP" | string;
  staffId?: string | null;
  staffName?: string | null;
  content: string;
  imageKey?: string | null;
  imageUrl?: string | null;
  read: boolean;
  sentAt: string;
}

interface CustomerMessagesResponse {
  customer: {
    customerId: string;
    fullName: string;
    phone: string;
    email?: string | null;
    membership?: string | null;
    avatarUrl?: string | null;
  };
  sessionId: string;
  items: ChatMessage[];
}

function getInitials(name?: string | null) {
  if (!name) return "KH";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function formatChatTime(raw?: string | null) {
  if (!raw) return "";
  const dt = new Date(raw);
  if (Number.isNaN(dt.getTime())) return String(raw);
  const now = new Date();
  const sameDay =
    dt.getDate() === now.getDate() &&
    dt.getMonth() === now.getMonth() &&
    dt.getFullYear() === now.getFullYear();
  return sameDay
    ? dt.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
    : dt.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" }) +
        " " +
        dt.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

function formatMembership(tier?: string | null) {
  switch (tier) {
    case "KIM_CUONG":
      return "Kim cương";
    case "VANG":
      return "Vàng";
    case "BAC":
      return "Bạc";
    default:
      return "Đồng";
  }
}

export function LiveChatCSKH({
  isActive,
  onUnreadChange,
}: {
  isActive: boolean;
  onUnreadChange?: (totalUnread: number) => void;
}) {
  const [customers, setCustomers] = useState<AdminChatCustomer[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [search, setSearch] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [thread, setThread] = useState<ChatMessage[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);

  const [draft, setDraft] = useState("");
  const [pendingImageKey, setPendingImageKey] = useState<string | null>(null);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const prevCountRef = useRef<number>(0);

  const fetchCustomers = useCallback(
    async (silent = false) => {
      if (!silent) setLoadingCustomers(true);
      try {
        const params = new URLSearchParams();
        if (search.trim()) params.set("search", search.trim());
        if (unreadOnly) params.set("unreadOnly", "true");
        const qs = params.toString();
        const data = await api<AdminChatCustomer[]>(
          `/admin/chat/customers${qs ? `?${qs}` : ""}`,
        );
        setCustomers(data);
        const totalUnread = data.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
        if (!search.trim() && !unreadOnly) {
          onUnreadChange?.(totalUnread);
        }
        setSelectedId((prev) => {
          if (prev && data.some((c) => c.customerId === prev)) return prev;
          return data[0]?.customerId ?? null;
        });
      } catch (e) {
        if (!silent) {
          setError(e instanceof Error ? e.message : "Chưa tải được danh sách khách hàng.");
        }
      } finally {
        if (!silent) setLoadingCustomers(false);
      }
    },
    [search, unreadOnly, onUnreadChange],
  );

  const fetchThread = useCallback(
    async (customerId: string, silent = false) => {
      if (!silent) setLoadingThread(true);
      try {
        const res = await api<CustomerMessagesResponse>(
          `/admin/chat/customers/${encodeURIComponent(customerId)}/messages?limit=100`,
        );
        setThread(res.items || []);
        setCustomers((prev) =>
          prev.map((c) =>
            c.customerId === customerId ? { ...c, unreadCount: 0 } : c,
          ),
        );
      } catch (e) {
        if (!silent) {
          setError(e instanceof Error ? e.message : "Chưa tải được lịch sử hội thoại.");
        }
      } finally {
        if (!silent) setLoadingThread(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!isActive) return;
    let active = true;
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (unreadOnly) params.set("unreadOnly", "true");
    const qs = params.toString();
    api<AdminChatCustomer[]>(`/admin/chat/customers${qs ? `?${qs}` : ""}`)
      .then((data) => {
        if (!active) return;
        setCustomers(data);
        const totalUnread = data.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
        if (!search.trim() && !unreadOnly) {
          onUnreadChange?.(totalUnread);
        }
        setSelectedId((prev) => {
          if (prev && data.some((c) => c.customerId === prev)) return prev;
          return data[0]?.customerId ?? null;
        });
      })
      .catch((e) => {
        if (!active) return;
        setError(e instanceof Error ? e.message : "Chưa tải được danh sách khách hàng.");
      })
      .finally(() => {
        if (active) setLoadingCustomers(false);
      });
    return () => {
      active = false;
    };
  }, [isActive, search, unreadOnly, onUnreadChange]);

  useEffect(() => {
    if (!isActive || !selectedId) return;
    let active = true;
    prevCountRef.current = 0;
    api<CustomerMessagesResponse>(
      `/admin/chat/customers/${encodeURIComponent(selectedId)}/messages?limit=100`,
    )
      .then((res) => {
        if (!active) return;
        setThread(res.items || []);
        setCustomers((prev) =>
          prev.map((c) =>
            c.customerId === selectedId ? { ...c, unreadCount: 0 } : c,
          ),
        );
      })
      .catch((e) => {
        if (!active) return;
        setError(e instanceof Error ? e.message : "Chưa tải được lịch sử hội thoại.");
      })
      .finally(() => {
        if (active) setLoadingThread(false);
      });
    return () => {
      active = false;
    };
  }, [isActive, selectedId]);

  // Smart polling 3.5 giây khi đang mở tab Live Chat CSKH và trình duyệt hiển thị
  useEffect(() => {
    if (!isActive) return;
    const timer = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void fetchCustomers(true);
      if (selectedId) {
        void fetchThread(selectedId, true);
      }
    }, 3500);
    return () => clearInterval(timer);
  }, [isActive, selectedId, fetchCustomers, fetchThread]);

  useEffect(() => {
    if (thread.length > prevCountRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: prevCountRef.current === 0 ? "auto" : "smooth" });
    }
    prevCountRef.current = thread.length;
  }, [thread.length]);

  useEffect(() => {
    return () => {
      if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
    };
  }, [pendingPreviewUrl]);

  const activeCustomer = useMemo(
    () => customers.find((c) => c.customerId === selectedId) ?? null,
    [customers, selectedId],
  );

  const handleSelectImage = async (file?: File | null) => {
    if (!file) return;
    setUploadingImage(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await api<{ imageKey: string }>("/chat/images", "POST", form);
      if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
      setPendingImageKey(res.imageKey);
      setPendingPreviewUrl(URL.createObjectURL(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tải ảnh thất bại (chỉ hỗ trợ PNG/JPEG ≤ 10MB).");
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleClearImage = () => {
    if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
    setPendingImageKey(null);
    setPendingPreviewUrl(null);
  };

  const handleSend = async () => {
    if (!selectedId || sending) return;
    const text = draft.trim();
    if (!text && !pendingImageKey) return;
    setSending(true);
    setError(null);
    try {
      const res = await api<{ message: ChatMessage }>(
        `/admin/chat/customers/${encodeURIComponent(selectedId)}/messages`,
        "POST",
        {
          content: text,
          imageKey: pendingImageKey,
        },
      );
      setDraft("");
      handleClearImage();
      setThread((prev) => [...prev, res.message]);
      void fetchCustomers(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chưa gửi được tin nhắn.");
    } finally {
      setSending(false);
    }
  };

  return (
    <section>
      <PageHeading
        eyebrow="Chăm sóc khách hàng trực tuyến"
        title="Live Chat CSKH"
        detail="Trao đổi trực tiếp với khách hàng trên Mobile App theo từng tài khoản khách hàng (ROLE_CUSTOMER). Tự động đồng bộ mỗi 3,5 giây."
      >
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            void fetchCustomers(false);
            if (selectedId) void fetchThread(selectedId, false);
          }}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Làm mới
        </Button>
      </PageHeading>

      {error && (
        <div className="mb-4 flex items-center justify-between rounded-md border border-destructive/30 bg-danger-subtle px-4 py-2.5 text-xs text-destructive">
          <span>{error}</span>
          <button
            type="button"
            className="ml-3 text-destructive hover:opacity-70"
            onClick={() => setError(null)}
            aria-label="Đóng thông báo lỗi"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Bố cục 2 khung kiểu Messenger / Zalo: Trái = Danh sách khách hàng, Phải = Hội thoại */}
      <div className="grid min-h-[640px] max-h-[calc(100dvh-15rem)] grid-cols-1 overflow-hidden rounded-lg border border-border bg-surface shadow-xs lg:grid-cols-[320px_1fr]">
        {/* CỘT TRÁI: DANH SÁCH KHÁCH HÀNG (Gần sidebar nhất) */}
        <div className="flex flex-col border-b border-border bg-canvas/40 lg:border-b-0 lg:border-r">
          <div className="space-y-2.5 border-b border-border p-3.5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm tên, mã ND..., SĐT khách"
                className="h-9 w-full rounded-md border border-input bg-surface pl-9 pr-3 text-xs text-foreground outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setUnreadOnly(false)}
                className={`flex-1 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                  !unreadOnly
                    ? "bg-primary text-primary-foreground"
                    : "bg-surface text-muted-foreground hover:bg-muted"
                }`}
              >
                Tất cả ({customers.length})
              </button>
              <button
                type="button"
                onClick={() => setUnreadOnly(true)}
                className={`flex-1 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                  unreadOnly
                    ? "bg-primary text-primary-foreground"
                    : "bg-surface text-muted-foreground hover:bg-muted"
                }`}
              >
                Chưa đọc
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-border">
            {loadingCustomers ? (
              <div className="flex items-center justify-center gap-2 py-12 text-xs text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Đang tải danh sách khách hàng…
              </div>
            ) : customers.length === 0 ? (
              <div className="px-4 py-12 text-center text-xs text-muted-foreground">
                Không có khách hàng phù hợp bộ lọc.
              </div>
            ) : (
              customers.map((c) => {
                const active = c.customerId === selectedId;
                return (
                  <button
                    key={c.customerId}
                    type="button"
                    onClick={() => {
                      if (c.customerId !== selectedId) {
                        setLoadingThread(true);
                        setSelectedId(c.customerId);
                      }
                    }}
                    className={`flex w-full items-start gap-3 px-3.5 py-3 text-left transition-colors ${
                      active
                        ? "bg-accent-subtle border-l-2 border-l-accent-hover"
                        : "hover:bg-muted/60"
                    }`}
                  >
                    <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-border bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                      {c.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={catalogImage(c.avatarUrl)}
                          alt={c.fullName}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        getInitials(c.fullName)
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs font-semibold text-foreground">
                          {c.fullName}
                        </span>
                        <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                          {formatChatTime(c.lastMessageAt)}
                        </span>
                      </div>

                      <div className="mt-0.5 flex items-center gap-1.5">
                        <span className="font-mono text-[10px] text-accent-hover">
                          {c.customerId}
                        </span>
                        <span className="text-[10px] text-muted-foreground">· {c.phone}</span>
                      </div>

                      <div className="mt-1 flex items-center justify-between gap-2">
                        <p className="truncate text-[11px] text-muted-foreground">
                          {c.lastMessage
                            ? `${c.lastSenderRole === "CHU_SHOP" ? "Bạn: " : ""}${c.lastMessage}`
                            : "Chưa có tin nhắn trực tiếp"}
                        </p>
                        {c.unreadCount > 0 && (
                          <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-destructive px-1.5 font-mono text-[10px] font-bold text-white">
                            {c.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* CỘT PHẢI: KHUNG HỘI THOẠI GIỮA KHÁCH HÀNG VÀ CHỦ SHOP */}
        <div className="flex min-h-[480px] flex-col bg-surface">
          {!activeCustomer ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-subtle text-accent-hover">
                <MessageCircle className="h-7 w-7" />
              </div>
              <p className="font-editorial text-lg text-foreground">
                Chọn một khách hàng để bắt đầu trò chuyện
              </p>
              <p className="max-w-sm text-xs text-muted-foreground">
                Danh sách bên trái hiển thị toàn bộ khách hàng (ROLE_CUSTOMER). Người vừa nhắn tin sẽ tự động nổi lên đầu.
              </p>
            </div>
          ) : (
            <>
              {/* Header hội thoại */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-canvas/50 px-5 py-3.5">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-accent/40 bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                    {activeCustomer.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={catalogImage(activeCustomer.avatarUrl)}
                        alt={activeCustomer.fullName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      getInitials(activeCustomer.fullName)
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-semibold text-foreground">
                        {activeCustomer.fullName}
                      </h2>
                      <Badge tone="neutral">{activeCustomer.customerId}</Badge>
                      <Badge tone="warning">Hạng {formatMembership(activeCustomer.membership)}</Badge>
                    </div>
                    <p className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                      <Phone className="h-3 w-3" />
                      <span>{activeCustomer.phone}</span>
                      {activeCustomer.email && <span>· {activeCustomer.email}</span>}
                    </p>
                  </div>
                </div>
              </div>

              {/* Dòng thời gian tin nhắn */}
              <div className="flex-1 space-y-3 overflow-y-auto bg-canvas/30 p-5">
                {loadingThread ? (
                  <div className="flex items-center justify-center gap-2 py-12 text-xs text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Đang tải lịch sử tin nhắn…
                  </div>
                ) : thread.length === 0 ? (
                  <div className="py-16 text-center">
                    <p className="text-xs font-medium text-muted-foreground">
                      Chưa có tin nhắn trực tiếp nào với {activeCustomer.fullName}.
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Bạn có thể chủ động gửi lời chào hoặc hỗ trợ khách ngay bên dưới.
                    </p>
                  </div>
                ) : (
                  thread.map((msg) => {
                    const isShop = msg.senderRole === "CHU_SHOP";
                    return (
                      <div
                        key={msg.messageId}
                        className={`flex flex-col ${isShop ? "items-end" : "items-start"}`}
                      >
                        <div
                          className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-xs ${
                            isShop
                              ? "rounded-br-sm bg-primary text-primary-foreground"
                              : "rounded-bl-sm border border-border bg-surface text-foreground"
                          }`}
                        >
                          {msg.imageUrl && (
                            <button
                              type="button"
                              onClick={() => setLightboxUrl(catalogImage(msg.imageUrl))}
                              className="mb-2 block overflow-hidden rounded-lg border border-black/10"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={catalogImage(msg.imageUrl)}
                                alt="Ảnh đính kèm trong tin nhắn"
                                className="max-h-56 w-auto object-cover"
                              />
                            </button>
                          )}
                          <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                        </div>
                        <span className="mt-1 px-1 font-mono text-[10px] text-muted-foreground">
                          {isShop ? `Chủ shop${msg.staffName ? ` · ${msg.staffName}` : ""}` : activeCustomer.fullName}
                          {" · "}
                          {formatChatTime(msg.sentAt)}
                        </span>
                      </div>
                    );
                  })
                )}
                <div ref={bottomRef} />
              </div>

              {/* Khung soạn & gửi tin nhắn */}
              <div className="border-t border-border bg-surface p-3.5">
                {pendingPreviewUrl && (
                  <div className="mb-2.5 inline-flex items-center gap-2 rounded-md border border-border bg-canvas p-1.5 pr-2.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={pendingPreviewUrl}
                      alt="Ảnh sắp gửi"
                      className="h-12 w-12 rounded object-cover"
                    />
                    <span className="text-xs text-muted-foreground">Ảnh đính kèm (R2 private)</span>
                    <button
                      type="button"
                      onClick={handleClearImage}
                      className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label="Gỡ ảnh đính kèm"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}

                <div className="flex items-end gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg"
                    className="hidden"
                    onChange={(e) => void handleSelectImage(e.target.files?.[0])}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    disabled={uploadingImage || sending}
                    onClick={() => fileInputRef.current?.click()}
                    title="Gửi hình ảnh"
                    aria-label="Đính kèm hình ảnh"
                  >
                    {uploadingImage ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ImagePlus className="h-4 w-4" />
                    )}
                  </Button>

                  <textarea
                    rows={1}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void handleSend();
                      }
                    }}
                    placeholder={`Nhắn tin trực tiếp cho ${activeCustomer.fullName}…`}
                    className="max-h-28 min-h-10 flex-1 resize-none rounded-md border border-input bg-canvas px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                  />

                  <Button
                    type="button"
                    disabled={sending || uploadingImage || (!draft.trim() && !pendingImageKey)}
                    onClick={() => void handleSend()}
                  >
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Gửi
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Lightbox xem ảnh phóng to */}
      {lightboxUrl && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <div className="relative max-h-[90vh] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setLightboxUrl(null)}
              className="absolute -right-3 -top-3 flex h-8 w-8 items-center justify-center rounded-full bg-surface text-foreground shadow-md"
              aria-label="Đóng ảnh"
            >
              <X className="h-4 w-4" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightboxUrl}
              alt="Ảnh phóng to"
              className="max-h-[85vh] max-w-[88vw] rounded-lg object-contain"
            />
          </div>
        </div>
      )}
    </section>
  );
}
