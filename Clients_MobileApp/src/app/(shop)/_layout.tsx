import { Tabs } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { colors } from "@/components/shop/ui";
export default function ShopTabs() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: "#FFFFFFF5",
          borderTopColor: colors.border,
          minHeight: 72,
          paddingTop: 8,
          borderRadius: 32,
          marginHorizontal: 12,
          marginBottom: 8,
        },
        tabBarLabelStyle: { fontSize: 12, marginBottom: 8 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Khám phá",
          tabBarIcon: ({ color }) => (
            <Ionicons name="home-outline" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="catalog"
        options={{
          title: "Danh mục",
          tabBarIcon: ({ color }) => (
            <Ionicons name="grid-outline" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="wardrobe"
        options={{
          title: "Tủ đồ",
          tabBarIcon: ({ color }) => (
            <Ionicons name="shirt-outline" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: "Tài khoản",
          tabBarIcon: ({ color }) => (
            <Ionicons name="person-outline" size={24} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
