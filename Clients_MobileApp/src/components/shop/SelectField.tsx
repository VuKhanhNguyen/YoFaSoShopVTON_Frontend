import { useCallback, useState } from "react";
import { FlatList, Modal, Pressable, Text, View } from "react-native";
import { Button, Field, Heading, Screen, s } from "./ui";
export type SelectOption = { value: string; label: string };
export function SelectField({
  label,
  value,
  options,
  onChange,
  error,
}: {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  error?: string;
}) {
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState("");
  const choose = useCallback(
    (next: string) => {
      onChange(next);
      setOpen(false);
      setQuery("");
    },
    [onChange],
  );
  const render = useCallback(
    ({ item }: { item: SelectOption }) => (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={item.label}
        onPress={() => choose(item.value)}
        style={{
          minHeight: 64,
          padding: 16,
          borderBottomWidth: 1,
          borderBottomColor: "#E2E8F0",
          justifyContent: "center",
        }}
      >
        <Text style={{ color: "#0F172A", fontSize: 16 }}>{item.label}</Text>
      </Pressable>
    ),
    [choose],
  );
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <Button
        title={
          options.find((o) => o.value === value)?.label ||
          `Chọn ${label.toLowerCase()}`
        }
        secondary
        onPress={() => setOpen(true)}
      />
      {!!error && <Text style={s.error}>{error}</Text>}
      <Modal
        visible={open}
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <Screen scroll={false}>
          <View style={{ padding: 24, paddingTop: 48 }}>
            <Heading small>{label}</Heading>
            <Field
              label="Tìm nhanh"
              value={query}
              onChangeText={setQuery}
              maxLength={100}
            />
            <Button title="Đóng" secondary onPress={() => setOpen(false)} />
          </View>
          <FlatList
            data={options.filter((o) =>
              o.label.toLowerCase().includes(query.toLowerCase()),
            )}
            renderItem={render}
            keyExtractor={(o) => o.value}
            getItemLayout={(_, index) => ({
              index,
              length: 64,
              offset: index * 64,
            })}
            keyboardShouldPersistTaps="handled"
          />
        </Screen>
      </Modal>
    </View>
  );
}
