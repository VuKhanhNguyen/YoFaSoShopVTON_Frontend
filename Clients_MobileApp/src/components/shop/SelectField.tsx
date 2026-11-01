import { useCallback, useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Fonts, Radii, Shadows, Spacing } from "@/constants/theme";

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
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const choose = useCallback(
    (next: string) => {
      onChange(next);
      setOpen(false);
      setQuery("");
    },
    [onChange]
  );

  const selectedLabel = options.find((o) => o.value === value)?.label;

  const render = useCallback(
    ({ item }: { item: SelectOption }) => {
      const isSelected = item.value === value;
      return (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={item.label}
          onPress={() => choose(item.value)}
          style={({ pressed }) => [
            st.optionRow,
            isSelected && st.optionRowSelected,
            pressed && { opacity: 0.7 },
          ]}
        >
          <Text
            style={[
              st.optionText,
              isSelected && st.optionTextSelected,
            ]}
          >
            {item.label}
          </Text>
          {isSelected && (
            <Ionicons
              name="checkmark"
              size={18}
              color={Colors.champagneDeep}
            />
          )}
        </Pressable>
      );
    },
    [choose, value]
  );

  return (
    <View style={st.container}>
      <Text style={st.label}>{label}</Text>
      <Pressable
        style={({ pressed }) => [
          st.trigger,
          !!error && st.triggerError,
          pressed && { opacity: 0.8 },
        ]}
        onPress={() => setOpen(true)}
      >
        <Text
          style={[
            st.triggerText,
            !selectedLabel && { color: Colors.muted },
          ]}
        >
          {selectedLabel || `Chọn ${label.toLowerCase()}`}
        </Text>
        <Ionicons name="chevron-down" size={16} color={Colors.muted} />
      </Pressable>
      {!!error && <Text style={st.errorText}>{error}</Text>}

      <Modal
        visible={open}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setOpen(false)}
      >
        <View style={st.modalContainer}>
          <View style={st.modalHeader}>
            <Text style={st.modalTitle}>Chọn {label}</Text>
            <Pressable onPress={() => setOpen(false)} style={st.closeBtn}>
              <Ionicons name="close" size={22} color={Colors.primary} />
            </Pressable>
          </View>

          <View style={st.searchBarWrap}>
            <Ionicons name="search-outline" size={18} color={Colors.muted} />
            <TextInput
              style={st.searchInput}
              placeholder={`Tìm kiếm ${label.toLowerCase()}...`}
              placeholderTextColor={Colors.muted}
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
            />
            {query.length > 0 && (
              <Pressable onPress={() => setQuery("")}>
                <Ionicons name="close-circle" size={16} color={Colors.muted} />
              </Pressable>
            )}
          </View>

          <FlatList
            data={options.filter((o) =>
              o.label.toLowerCase().includes(query.toLowerCase())
            )}
            renderItem={render}
            keyExtractor={(o) => o.value}
            contentContainerStyle={st.optionsList}
            keyboardShouldPersistTaps="handled"
          />
        </View>
      </Modal>
    </View>
  );
}

const st = StyleSheet.create({
  container: {
    gap: 6,
  },
  label: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 12,
    color: Colors.primary,
  },
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.hairline,
    borderRadius: Radii.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  triggerError: {
    borderColor: "#DC2626",
  },
  triggerText: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    color: Colors.primary,
  },
  errorText: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    color: "#DC2626",
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
  closeBtn: {
    padding: 6,
  },
  searchBarWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.hairline,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: Fonts.sans,
    fontSize: 14,
    color: Colors.primary,
  },
  optionsList: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.hairline,
  },
  optionRowSelected: {
    backgroundColor: Colors.champagneSubtle,
    marginHorizontal: -Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radii.sm,
  },
  optionText: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    color: Colors.primary,
  },
  optionTextSelected: {
    fontFamily: Fonts.sansSemiBold,
    color: Colors.champagneDeep,
  },
});
