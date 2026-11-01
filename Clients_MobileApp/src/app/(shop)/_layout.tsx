import { Platform, StyleSheet, View } from "react-native";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Radii, Shadows } from "@/constants/theme";

export default function ShopTabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: st.floatingDock,
        tabBarLabelStyle: st.tabLabel,
        tabBarItemStyle: st.tabItem,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Khám phá",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? "compass" : "compass-outline"} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="catalog"
        options={{
          title: "Danh mục",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? "grid" : "grid-outline"} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="wardrobe"
        options={{
          title: "Tủ đồ VTON",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? "shirt" : "shirt-outline"} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: "Tài khoản",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name={focused ? "person" : "person-outline"} color={color} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

function TabIcon({
  name,
  color,
  focused,
}: {
  name: any;
  color: any;
  focused: boolean;
}) {
  return (
    <View style={st.iconWrapper}>
      <Ionicons name={name} size={20} color={color} />
      {focused && <View style={st.activeDot} />}
    </View>
  );
}

const st = StyleSheet.create({
  floatingDock: {
    position: "absolute",
    left: 18,
    right: 18,
    bottom: Platform.OS === "ios" ? 20 : 16,
    height: 62,
    borderRadius: Radii.full,
    backgroundColor: "rgba(255, 255, 255, 0.94)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.75)",
    paddingTop: 6,
    paddingBottom: Platform.OS === "ios" ? 8 : 6,
    paddingHorizontal: 8,
    ...Shadows.dock,
  },
  tabItem: {
    paddingVertical: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  tabLabel: {
    fontSize: 10,
    fontFamily: "JakartaSemiBold",
    marginTop: 1,
    letterSpacing: -0.1,
  },
  iconWrapper: {
    alignItems: "center",
    justifyContent: "center",
    height: 24,
    position: "relative",
  },
  activeDot: {
    position: "absolute",
    bottom: -4,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.champagne,
  },
});
