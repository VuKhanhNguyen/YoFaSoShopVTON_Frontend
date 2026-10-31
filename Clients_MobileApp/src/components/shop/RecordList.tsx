import { memo, useCallback, useState } from "react";
import { FlatList } from "react-native";
import { router } from "expo-router";
import { useResource } from "@/hooks/use-resource";
import { useSession } from "@/lib/session";
import { api } from "@/lib/api";
import type { Row } from "@/lib/models";
import { Button, Heading, Notice, Panel, Screen, State } from "./ui";
import { RequireAccount } from "./RequireAccount";
const Record = memo(function Record({
  row,
  kind,
  onRead,
}: {
  row: Row;
  kind: string;
  onRead: (row: Row) => void;
}) {
  const id = String(row.orderId || row.sessionId || row.notificationId || "");
  return (
    <Panel>
      <Heading small>{String(row.title || id)}</Heading>
      <Notice>{String(row.status || row.content || row.message || "")}</Notice>
      <Notice>
        {row.createdAt
          ? new Date(String(row.createdAt)).toLocaleString("vi-VN")
          : ""}
      </Notice>
      {kind === "orders" ? (
        <Button
          secondary
          title="Xem đơn hàng"
          onPress={() =>
            router.push({ pathname: "/order/[id]", params: { id } })
          }
        />
      ) : kind === "sessions" ? (
        <Button
          secondary
          title="Xem phiên thử đồ"
          onPress={() =>
            router.push({
              pathname: "/session/[id]",
              params: { id, variantId: String(row.variantId || "") },
            })
          }
        />
      ) : (
        <Button
          secondary
          title="Đánh dấu đã đọc"
          disabled={Boolean(row.readStatus)}
          onPress={() => onRead(row)}
        />
      )}
    </Panel>
  );
});
export function RecordList({
  kind,
}: {
  kind: "orders" | "sessions" | "notifications";
}) {
  return (
    <RequireAccount>
      <Content kind={kind} />
    </RequireAccount>
  );
}
function Content({ kind }: { kind: "orders" | "sessions" | "notifications" }) {
  const { user } = useSession(),
    [page, setPage] = useState(0),
    [message, setMessage] = useState("");
  const state = useResource<Row[]>(
    user
      ? `${kind === "sessions" ? "/try-on/sessions" : `/${kind}`}?page=${page}&size=20`
      : null,
  );
  const onRead = useCallback(
    (r: Row) => {
      void api(`/notifications/${r.notificationId}/read`, "POST")
        .then(state.reload)
        .catch((e) => setMessage(e.message));
    },
    [state.reload],
  );
  const render = useCallback(
    ({ item }: { item: Row }) => (
      <Record row={item} kind={kind} onRead={onRead} />
    ),
    [kind, onRead],
  );
  return (
    <Screen scroll={false}>
      <FlatList
        data={state.data || []}
        keyExtractor={(r) =>
          String(r.orderId || r.sessionId || r.notificationId)
        }
        renderItem={render}
        contentContainerStyle={{ padding: 24, gap: 16, paddingTop: 48 }}
        refreshing={state.loading}
        onRefresh={state.reload}
        ListHeaderComponent={
          <>
            <Heading>
              {kind === "orders"
                ? "Đơn hàng của tôi"
                : kind === "sessions"
                  ? "Tủ đồ thử của bạn"
                  : "Hộp thư YoFaSo"}
            </Heading>
            <State
              error={state.error}
              empty={!state.loading && state.data?.length === 0}
              retry={state.reload}
            />
            {!!message && <Notice error>{message}</Notice>}
          </>
        }
        ListFooterComponent={
          <>
            <Button
              title="Trang trước"
              secondary
              disabled={page === 0 || state.loading}
              onPress={() => setPage((p) => p - 1)}
            />
            <Button
              title="Trang sau"
              secondary
              disabled={state.loading || (state.data?.length || 0) < 20}
              onPress={() => setPage((p) => p + 1)}
            />
          </>
        }
      />
    </Screen>
  );
}
