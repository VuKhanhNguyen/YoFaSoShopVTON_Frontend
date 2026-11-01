import React, { useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Fonts, Radii, Shadows, Spacing } from "@/constants/theme";

interface DatePickerFieldProps {
  label?: string;
  value?: string; // Format: "YYYY-MM-DD"
  onChange: (date: string) => void;
  error?: string;
  placeholder?: string;
}

const MONTHS = [
  "Tháng 1",
  "Tháng 2",
  "Tháng 3",
  "Tháng 4",
  "Tháng 5",
  "Tháng 6",
  "Tháng 7",
  "Tháng 8",
  "Tháng 9",
  "Tháng 10",
  "Tháng 11",
  "Tháng 12",
];

export function DatePickerField({
  label,
  value,
  onChange,
  error,
  placeholder = "Chọn ngày sinh (DD/MM/YYYY)",
}: DatePickerFieldProps) {
  const [modalVisible, setModalVisible] = useState(false);

  // Parse initial or fallback date
  const parsed = useMemo(() => {
    if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m, d] = value.split("-").map(Number);
      return { year: y, month: m, day: d };
    }
    return { year: 2000, month: 1, day: 1 };
  }, [value]);

  const [selectedYear, setSelectedYear] = useState(parsed.year);
  const [selectedMonth, setSelectedMonth] = useState(parsed.month);
  const [selectedDay, setSelectedDay] = useState(parsed.day);
  const [tab, setTab] = useState<"day" | "month" | "year">("day");

  // Generate Year range (1940 -> current year - 10)
  const currentYear = new Date().getFullYear();
  const years = useMemo(() => {
    const list: number[] = [];
    for (let y = currentYear - 10; y >= 1940; y--) {
      list.push(y);
    }
    return list;
  }, [currentYear]);

  // Days in selected month/year
  const daysInMonth = useMemo(() => {
    return new Date(selectedYear, selectedMonth, 0).getDate();
  }, [selectedYear, selectedMonth]);

  const days = useMemo(() => {
    return Array.from({ length: daysInMonth }, (_, i) => i + 1);
  }, [daysInMonth]);

  // Display text formatted DD/MM/YYYY
  const displayText = useMemo(() => {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
    const [y, m, d] = value.split("-");
    return `${d}/${m}/${y}`;
  }, [value]);

  const handleOpen = () => {
    if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m, d] = value.split("-").map(Number);
      setSelectedYear(y);
      setSelectedMonth(m);
      setSelectedDay(Math.min(d, new Date(y, m, 0).getDate()));
    }
    setTab("day");
    setModalVisible(true);
  };

  const handleConfirm = () => {
    const dStr = String(Math.min(selectedDay, daysInMonth)).padStart(2, "0");
    const mStr = String(selectedMonth).padStart(2, "0");
    const yStr = String(selectedYear);
    onChange(`${yStr}-${mStr}-${dStr}`);
    setModalVisible(false);
  };

  return (
    <View style={st.container}>
      {label && <Text style={st.label}>{label}</Text>}

      <Pressable
        style={({ pressed }) => [
          st.inputBox,
          !!error && st.inputBoxError,
          pressed && { opacity: 0.8 },
        ]}
        onPress={handleOpen}
      >
        <Ionicons
          name="calendar-outline"
          size={18}
          color={value ? Colors.champagneDeep : Colors.textMuted}
          style={st.icon}
        />
        <Text style={[st.valueText, !displayText && st.placeholderText]}>
          {displayText || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={16} color={Colors.textMuted} />
      </Pressable>

      {!!error && <Text style={st.errorText}>{error}</Text>}

      {/* Date Picker Modal Sheet */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={st.modalOverlay}>
          <Pressable style={st.modalBackdrop} onPress={() => setModalVisible(false)} />
          <View style={st.modalSheet}>
            {/* Header */}
            <View style={st.sheetHeader}>
              <View>
                <Text style={st.sheetTitle}>Chọn ngày sinh</Text>
                <Text style={st.sheetSub}>
                  Ngày {String(selectedDay).padStart(2, "0")} tháng {selectedMonth} năm {selectedYear}
                </Text>
              </View>
              <Pressable
                onPress={() => setModalVisible(false)}
                style={st.closeBtn}
              >
                <Ionicons name="close" size={20} color={Colors.primary} />
              </Pressable>
            </View>

            {/* Quick Segment Tabs (Ngày | Tháng | Năm) */}
            <View style={st.segmentRow}>
              <Pressable
                style={[st.segmentTab, tab === "day" && st.segmentTabActive]}
                onPress={() => setTab("day")}
              >
                <Text style={[st.segmentTabText, tab === "day" && st.segmentTabTextActive]}>
                  Ngày: {selectedDay}
                </Text>
              </Pressable>
              <Pressable
                style={[st.segmentTab, tab === "month" && st.segmentTabActive]}
                onPress={() => setTab("month")}
              >
                <Text style={[st.segmentTabText, tab === "month" && st.segmentTabTextActive]}>
                  Tháng: {selectedMonth}
                </Text>
              </Pressable>
              <Pressable
                style={[st.segmentTab, tab === "year" && st.segmentTabActive]}
                onPress={() => setTab("year")}
              >
                <Text style={[st.segmentTabText, tab === "year" && st.segmentTabTextActive]}>
                  Năm: {selectedYear}
                </Text>
              </Pressable>
            </View>

            {/* Content per tab */}
            <View style={st.pickerBody}>
              {tab === "day" && (
                <FlatList
                  data={days}
                  numColumns={7}
                  keyExtractor={(d) => `day-${d}`}
                  contentContainerStyle={st.gridContent}
                  renderItem={({ item: d }) => {
                    const isSelected = d === selectedDay;
                    return (
                      <Pressable
                        style={[st.gridItem, isSelected && st.gridItemSelected]}
                        onPress={() => setSelectedDay(d)}
                      >
                        <Text style={[st.gridItemText, isSelected && st.gridItemTextSelected]}>
                          {d}
                        </Text>
                      </Pressable>
                    );
                  }}
                />
              )}

              {tab === "month" && (
                <FlatList
                  data={MONTHS}
                  numColumns={3}
                  keyExtractor={(_, i) => `month-${i}`}
                  contentContainerStyle={st.gridContent}
                  renderItem={({ item: mName, index }) => {
                    const mNum = index + 1;
                    const isSelected = mNum === selectedMonth;
                    return (
                      <Pressable
                        style={[st.monthItem, isSelected && st.monthItemSelected]}
                        onPress={() => {
                          setSelectedMonth(mNum);
                          setTab("day");
                        }}
                      >
                        <Text style={[st.monthItemText, isSelected && st.monthItemTextSelected]}>
                          {mName}
                        </Text>
                      </Pressable>
                    );
                  }}
                />
              )}

              {tab === "year" && (
                <FlatList
                  data={years}
                  numColumns={4}
                  keyExtractor={(y) => `year-${y}`}
                  contentContainerStyle={st.gridContent}
                  initialNumToRender={24}
                  renderItem={({ item: y }) => {
                    const isSelected = y === selectedYear;
                    return (
                      <Pressable
                        style={[st.yearItem, isSelected && st.yearItemSelected]}
                        onPress={() => {
                          setSelectedYear(y);
                          setTab("month");
                        }}
                      >
                        <Text style={[st.yearItemText, isSelected && st.yearItemTextSelected]}>
                          {y}
                        </Text>
                      </Pressable>
                    );
                  }}
                />
              )}
            </View>

            {/* Confirm Actions */}
            <View style={st.actionsRow}>
              <Pressable
                style={st.cancelBtn}
                onPress={() => setModalVisible(false)}
              >
                <Text style={st.cancelBtnText}>Hủy</Text>
              </Pressable>
              <Pressable
                style={st.confirmBtn}
                onPress={handleConfirm}
              >
                <Text style={st.confirmBtnText}>Xác nhận ngày sinh</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const st = StyleSheet.create({
  container: {
    gap: 4,
  },
  label: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 12,
    color: Colors.primary,
  },
  inputBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderHairline,
    borderRadius: Radii.sm,
    paddingHorizontal: 14,
    height: 52,
    gap: 10,
  },
  inputBoxError: {
    borderColor: Colors.statusDanger,
  },
  icon: {
    marginRight: 2,
  },
  valueText: {
    flex: 1,
    fontFamily: Fonts.sans,
    fontSize: 14,
    color: Colors.primary,
  },
  placeholderText: {
    color: Colors.textMuted,
  },
  errorText: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    color: Colors.statusDanger,
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radii.xl,
    borderTopRightRadius: Radii.xl,
    padding: Spacing.lg,
    paddingBottom: 34,
    maxHeight: "80%",
    ...Shadows.sheet,
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  sheetTitle: {
    fontFamily: "Editorial",
    fontSize: 18,
    color: Colors.primary,
  },
  sheetSub: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: Colors.champagneDeep,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: Radii.full,
    backgroundColor: Colors.canvas,
  },
  segmentRow: {
    flexDirection: "row",
    backgroundColor: Colors.canvas,
    borderRadius: Radii.full,
    padding: 3,
    marginBottom: Spacing.md,
    gap: 4,
  },
  segmentTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: Radii.full,
  },
  segmentTabActive: {
    backgroundColor: Colors.primary,
  },
  segmentTabText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: Colors.muted,
  },
  segmentTabTextActive: {
    fontFamily: Fonts.sansSemiBold,
    color: Colors.canvas,
  },
  pickerBody: {
    height: 250,
  },
  gridContent: {
    paddingVertical: 4,
  },
  gridItem: {
    flex: 1,
    aspectRatio: 1,
    margin: 3,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radii.full,
  },
  gridItemSelected: {
    backgroundColor: Colors.champagne,
  },
  gridItemText: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: Colors.primary,
  },
  gridItemTextSelected: {
    fontFamily: Fonts.sansSemiBold,
    color: "#FFFFFF",
  },
  monthItem: {
    flex: 1,
    paddingVertical: 14,
    margin: 4,
    borderRadius: Radii.sm,
    backgroundColor: Colors.canvas,
    alignItems: "center",
  },
  monthItemSelected: {
    backgroundColor: Colors.champagne,
  },
  monthItemText: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: Colors.primary,
  },
  monthItemTextSelected: {
    fontFamily: Fonts.sansSemiBold,
    color: "#FFFFFF",
  },
  yearItem: {
    flex: 1,
    paddingVertical: 12,
    margin: 3,
    borderRadius: Radii.sm,
    backgroundColor: Colors.canvas,
    alignItems: "center",
  },
  yearItemSelected: {
    backgroundColor: Colors.champagne,
  },
  yearItemText: {
    fontFamily: Fonts.mono,
    fontSize: 13,
    color: Colors.primary,
  },
  yearItemTextSelected: {
    fontFamily: Fonts.sansSemiBold,
    color: "#FFFFFF",
  },
  actionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.borderHairline,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: Radii.sm,
    borderWidth: 1,
    borderColor: Colors.borderHairline,
    alignItems: "center",
  },
  cancelBtnText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 13,
    color: Colors.muted,
  },
  confirmBtn: {
    flex: 2,
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: Radii.sm,
    alignItems: "center",
  },
  confirmBtnText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 13,
    color: Colors.canvas,
  },
});
