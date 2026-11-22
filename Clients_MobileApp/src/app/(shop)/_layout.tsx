import { memo, useEffect, useRef, useState, type RefObject } from "react";
import { Platform, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { BlurTargetView, BlurView } from "expo-blur";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Colors, Radii, Shadows } from "@/constants/theme";
import { SPRING_SNAPPY } from "@/components/shop/MotionPrimitives";

const SHOP_TABS = [
  {
    name: "explore",
    title: "Khám phá",
    icon: "compass-outline" as const,
    activeIcon: "compass" as const,
  },
  {
    name: "catalog",
    title: "Danh mục",
    icon: "grid-outline" as const,
    activeIcon: "grid" as const,
  },
  {
    name: "wardrobe",
    title: "Tủ đồ VTON",
    icon: "shirt-outline" as const,
    activeIcon: "shirt" as const,
  },
  {
    name: "account",
    title: "Tài khoản",
    icon: "person-outline" as const,
    activeIcon: "person" as const,
  },
] as const;

type ShopTabName = (typeof SHOP_TABS)[number]["name"];

interface TabNavSnapshot {
  activeName: ShopTabName;
  navigate: (name: ShopTabName, isFocused: boolean) => void;
}

/**
 * Syncs Tabs navigation state out to the sibling FloatingGlassDock
 * so Android BlurView stays outside BlurTargetView (preventing recursive blur errors).
 */
function TabBarBridge({
  state,
  navigation,
  onSync,
}: {
  state: any;
  navigation: any;
  onSync: (snapshot: TabNavSnapshot) => void;
}) {
  const navRef = useRef(navigation);
  const routesRef = useRef(state.routes);

  useEffect(() => {
    navRef.current = navigation;
    routesRef.current = state.routes;
  }, [navigation, state.routes]);

  const currentRoute = state.routes[state.index]?.name as ShopTabName | undefined;
  const activeName: ShopTabName = SHOP_TABS.some((t) => t.name === currentRoute)
    ? (currentRoute as ShopTabName)
    : "explore";

  useEffect(() => {
    onSync({
      activeName,
      navigate: (name, isFocused) => {
        const target = routesRef.current.find((r: any) => r.name === name);
        const event = navRef.current.emit({
          type: "tabPress",
          target: target?.key,
          canPreventDefault: true,
        });
        if (!isFocused && !event.defaultPrevented) {
          navRef.current.navigate(name);
        }
      },
    });
  }, [activeName, onSync]);

  return null;
}

export default function ShopTabsLayout() {
  const blurTargetRef = useRef<View | null>(null);
  const [navState, setNavState] = useState<TabNavSnapshot>({
    activeName: "explore",
    navigate: () => {},
  });

  return (
    <View style={st.root}>
      <BlurTargetView ref={blurTargetRef} style={st.root}>
        <Tabs
          initialRouteName="explore"
          tabBar={(props) => (
            <TabBarBridge
              state={props.state}
              navigation={props.navigation}
              onSync={setNavState}
            />
          )}
          screenOptions={{
            headerShown: false,
            animation: "shift",
            lazy: true,
          }}
        >
          {/* Hidden index redirect route */}
          <Tabs.Screen
            name="index"
            options={{
              href: null,
            }}
          />

          {SHOP_TABS.map((tab) => (
            <Tabs.Screen
              key={tab.name}
              name={tab.name}
              options={{
                title: tab.title,
              }}
            />
          ))}
        </Tabs>
      </BlurTargetView>

      <FloatingGlassDock
        activeName={navState.activeName}
        onSelect={navState.navigate}
        blurTarget={blurTargetRef}
      />
    </View>
  );
}

const FloatingGlassDock = memo(function FloatingGlassDock({
  activeName,
  onSelect,
  blurTarget,
}: {
  activeName: ShopTabName;
  onSelect: (name: ShopTabName, isFocused: boolean) => void;
  blurTarget: RefObject<View | null>;
}) {
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const [rowWidth, setRowWidth] = useState(0);

  const activeIndex = Math.max(
    0,
    SHOP_TABS.findIndex((t) => t.name === activeName)
  );
  const innerPad = 6;
  const usableWidth = Math.max(0, rowWidth - innerPad * 2);
  const tabWidth = usableWidth / SHOP_TABS.length;

  const pillX = useSharedValue(0);

  useEffect(() => {
    if (tabWidth <= 0) return;
    const target = activeIndex * tabWidth;
    if (reducedMotion) {
      pillX.value = target;
    } else {
      pillX.value = withSpring(target, SPRING_SNAPPY);
    }
  }, [activeIndex, tabWidth, reducedMotion, pillX]);

  const pillAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pillX.value }],
  }));

  const handleRowLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && Math.abs(w - rowWidth) > 0.5) {
      setRowWidth(w);
    }
  };

  const useIosLiquidGlass = Platform.OS === "ios" && isLiquidGlassAvailable();
  const bottomOffset = Math.max(insets.bottom, Platform.OS === "ios" ? 16 : 12);

  return (
    <View
      pointerEvents="box-none"
      style={[st.dockAnchor, { bottom: bottomOffset }]}
    >
      <View style={st.dockShadowShell}>
        <View style={st.dockGlassClip} onLayout={handleRowLayout}>
          {/* Milky White Frosted Glass Backdrop (never clear transparent glass) */}
          {useIosLiquidGlass ? (
            <>
              <GlassView
                glassEffectStyle="regular"
                colorScheme="light"
                tintColor="rgba(255, 255, 255, 0.72)"
                style={StyleSheet.absoluteFill}
              />
              <View pointerEvents="none" style={st.milkyOverlayIosGlass} />
            </>
          ) : Platform.OS === "ios" ? (
            <>
              <BlurView
                tint="systemChromeMaterialLight"
                intensity={55}
                style={StyleSheet.absoluteFill}
              />
              <View pointerEvents="none" style={st.milkyOverlayIosBlur} />
            </>
          ) : Platform.OS === "android" ? (
            <>
              <BlurView
                blurTarget={blurTarget}
                blurMethod="dimezisBlurViewSdk31Plus"
                tint="light"
                intensity={28}
                blurReductionFactor={5}
                style={StyleSheet.absoluteFill}
              />
              <View pointerEvents="none" style={st.milkyOverlayAndroid} />
            </>
          ) : (
            <View pointerEvents="none" style={st.milkyOverlayWeb} />
          )}

          {/* Subtle top specular glass highlight */}
          <View pointerEvents="none" style={st.topSpecularRim} />

          {/* Sliding Champagne-Alabaster Active Pill */}
          {tabWidth > 0 && (
            <Animated.View
              pointerEvents="none"
              style={[
                st.activePill,
                {
                  width: tabWidth - 4,
                  left: innerPad + 2,
                },
                pillAnimStyle,
              ]}
            />
          )}

          {/* 4 Tab Items */}
          <View style={[st.tabsRow, { paddingHorizontal: innerPad }]} accessibilityRole="tablist">
            {SHOP_TABS.map((tab) => {
              const focused = tab.name === activeName;
              return (
                <DockTabButton
                  key={tab.name}
                  title={tab.title}
                  iconName={focused ? tab.activeIcon : tab.icon}
                  focused={focused}
                  onPress={() => onSelect(tab.name, focused)}
                />
              );
            })}
          </View>
        </View>
      </View>
    </View>
  );
});

const DockTabButton = memo(function DockTabButton({
  title,
  iconName,
  focused,
  onPress,
}: {
  title: string;
  iconName: keyof typeof Ionicons.glyphMap;
  focused: boolean;
  onPress: () => void;
}) {
  const reducedMotion = useReducedMotion();
  const iconScale = useSharedValue(1);
  const iconLift = useSharedValue(focused ? -1.5 : 0);
  const dotScale = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    if (reducedMotion) {
      iconScale.value = 1;
      iconLift.value = focused ? -1.5 : 0;
      dotScale.value = focused ? 1 : 0;
      return;
    }

    if (focused) {
      iconScale.value = withSequence(
        withTiming(0.88, { duration: 75 }),
        withSpring(1.08, { damping: 12, stiffness: 320 }),
        withSpring(1, SPRING_SNAPPY)
      );
      iconLift.value = withSpring(-1.5, SPRING_SNAPPY);
      dotScale.value = withSpring(1, { damping: 14, stiffness: 300 });
    } else {
      iconScale.value = withTiming(1, { duration: 140 });
      iconLift.value = withTiming(0, { duration: 140 });
      dotScale.value = withTiming(0, { duration: 120 });
    }
  }, [focused, reducedMotion, iconScale, iconLift, dotScale]);

  const iconAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: iconLift.value }, { scale: iconScale.value }],
  }));

  const dotAnimStyle = useAnimatedStyle(() => ({
    opacity: dotScale.value,
    transform: [{ scale: dotScale.value }],
  }));

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={title}
      accessibilityState={{ selected: focused }}
      onPress={onPress}
      style={st.tabItem}
    >
      <Animated.View style={[st.iconWrapper, iconAnimStyle]}>
        <Ionicons
          name={iconName}
          size={20}
          color={focused ? Colors.primary : Colors.textMuted}
        />
      </Animated.View>
      <Text
        numberOfLines={1}
        style={[
          st.tabLabel,
          { color: focused ? Colors.primary : Colors.textMuted },
        ]}
      >
        {title}
      </Text>
      <Animated.View style={[st.activeDot, dotAnimStyle]} />
    </Pressable>
  );
});

const st = StyleSheet.create({
  root: {
    flex: 1,
  },
  dockAnchor: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 50,
  },
  dockShadowShell: {
    width: "90%",
    maxWidth: 460,
    height: 68,
    borderRadius: Radii.full,
    ...Shadows.dock,
  },
  dockGlassClip: {
    flex: 1,
    borderRadius: Radii.full,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.08)",
    justifyContent: "center",
  },
  milkyOverlayIosGlass: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(255, 255, 255, 0.34)",
  },
  milkyOverlayIosBlur: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(255, 255, 255, 0.68)",
  },
  milkyOverlayAndroid: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(255, 255, 255, 0.80)",
  },
  milkyOverlayWeb: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(255, 255, 255, 0.86)",
  },
  topSpecularRim: {
    position: "absolute",
    top: 0,
    left: 20,
    right: 20,
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
  },
  activePill: {
    position: "absolute",
    top: 6,
    bottom: 6,
    borderRadius: Radii.full,
    backgroundColor: "rgba(251, 248, 243, 0.95)",
    borderWidth: 1,
    borderColor: "rgba(197, 168, 128, 0.38)",
  },
  tabsRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  tabItem: {
    flex: 1,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 4,
    paddingBottom: 4,
  },
  iconWrapper: {
    alignItems: "center",
    justifyContent: "center",
    height: 22,
  },
  tabLabel: {
    fontSize: 10,
    fontFamily: "JakartaSemiBold",
    marginTop: 2,
    letterSpacing: -0.1,
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.champagne,
    marginTop: 2,
  },
});
