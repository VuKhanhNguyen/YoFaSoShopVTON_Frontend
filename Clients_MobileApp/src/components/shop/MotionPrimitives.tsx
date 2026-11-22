import { memo, useEffect, useState, type ReactNode } from "react";
import {
  AppState,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type PressableProps,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import Animated, {
  Easing,
  Extrapolation,
  FadeInDown,
  FadeOutDown,
  FadeInUp,
  FadeOutUp,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { useIsFocused } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Radii, Shadows } from "@/constants/theme";

export const SPRING_SNAPPY = { damping: 18, stiffness: 280, mass: 0.85 } as const;
export const SPRING_SOFT = { damping: 16, stiffness: 220, mass: 0.9 } as const;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface ScalePressableProps extends Omit<PressableProps, "style"> {
  style?: StyleProp<ViewStyle>;
  activeScale?: number;
  activeOpacity?: number;
  children: ReactNode;
}

/**
 * Tactile UI-thread spring pressable (no haptics, GPU transform/opacity only).
 */
export const ScalePressable = memo(function ScalePressable({
  style,
  activeScale = 0.965,
  activeOpacity = 0.92,
  disabled,
  onPressIn,
  onPressOut,
  children,
  ...props
}: ScalePressableProps) {
  const reducedMotion = useReducedMotion();
  const pressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => {
    if (reducedMotion) {
      return {
        opacity: interpolate(pressed.value, [0, 1], [1, activeOpacity]),
      };
    }
    return {
      transform: [
        {
          scale: interpolate(pressed.value, [0, 1], [1, activeScale]),
        },
      ],
      opacity: interpolate(pressed.value, [0, 1], [1, activeOpacity]),
    };
  });

  return (
    <AnimatedPressable
      {...props}
      disabled={disabled}
      onPressIn={(e) => {
        pressed.set(withTiming(1, { duration: 90, easing: Easing.out(Easing.quad) }));
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        pressed.set(withSpring(0, SPRING_SNAPPY));
        onPressOut?.(e);
      }}
      style={[style, animatedStyle]}
    >
      {children}
    </AnimatedPressable>
  );
});

const BounceChar = memo(function BounceChar({
  char,
  index,
  progress,
  textStyle,
}: {
  char: string;
  index: number;
  progress: SharedValue<number>;
  textStyle?: StyleProp<TextStyle>;
}) {
  const animStyle = useAnimatedStyle(() => {
    const t = progress.value - index;
    const opacity = interpolate(t, [0, 0.45, 1], [0, 1, 1], Extrapolation.CLAMP);
    const translateY = interpolate(
      t,
      [0, 0.55, 0.85, 1.2],
      [5, -2.5, 0.6, 0],
      Extrapolation.CLAMP
    );
    const scale = interpolate(
      t,
      [0, 0.55, 0.9, 1.2],
      [0.82, 1.1, 0.98, 1],
      Extrapolation.CLAMP
    );
    return {
      opacity,
      transform: [{ translateY }, { scale }],
    };
  });

  return <Animated.Text style={[st.badgeText, textStyle, animStyle]}>{char}</Animated.Text>;
});

export interface BounceTypingBadgeProps {
  text: string;
  containerStyle?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  holdMs?: number;
}

/**
 * Zero-reflow UI-thread bounce typing pill.
 * Uses a single SharedValue across all characters and pauses when unfocused/backgrounded.
 */
export const BounceTypingBadge = memo(function BounceTypingBadge({
  text,
  containerStyle,
  textStyle,
  holdMs = 4200,
}: BounceTypingBadgeProps) {
  const isFocused = useIsFocused();
  const reducedMotion = useReducedMotion();
  const [appActive, setAppActive] = useState(AppState.currentState === "active");

  const chars = Array.from(text);
  const totalSteps = chars.length + 2;
  const progress = useSharedValue(totalSteps);
  const groupOpacity = useSharedValue(1);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      setAppActive(next === "active");
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (reducedMotion || !isFocused || !appActive || chars.length === 0) {
      cancelAnimation(progress);
      cancelAnimation(groupOpacity);
      progress.value = totalSteps;
      groupOpacity.value = 1;
      return;
    }

    const typeDuration = Math.min(1800, Math.max(900, chars.length * 46));
    const fadeOutDuration = 240;

    progress.value = 0;
    groupOpacity.value = 1;

    progress.value = withRepeat(
      withSequence(
        withTiming(totalSteps, { duration: typeDuration, easing: Easing.linear }),
        withDelay(holdMs + fadeOutDuration, withTiming(0, { duration: 0 }))
      ),
      -1,
      false
    );

    groupOpacity.value = withRepeat(
      withSequence(
        withDelay(
          typeDuration + holdMs,
          withTiming(0, { duration: fadeOutDuration, easing: Easing.out(Easing.quad) })
        ),
        withTiming(1, { duration: 0 })
      ),
      -1,
      false
    );

    return () => {
      cancelAnimation(progress);
      cancelAnimation(groupOpacity);
    };
  }, [isFocused, appActive, reducedMotion, chars.length, totalSteps, holdMs, progress, groupOpacity]);

  const groupStyle = useAnimatedStyle(() => ({
    opacity: groupOpacity.value,
  }));

  if (reducedMotion) {
    return (
      <View style={[st.badgePill, containerStyle]}>
        <Text style={[st.badgeText, textStyle]} numberOfLines={1}>
          {text}
        </Text>
      </View>
    );
  }

  return (
    <View style={[st.badgePill, containerStyle]} accessible accessibilityLabel={text}>
      {/* Invisible ghost text locks exact pill width/height so Yoga never reflows */}
      <Text style={[st.badgeText, textStyle, st.ghostText]} numberOfLines={1} aria-hidden>
        {text}
      </Text>
      <Animated.View style={[st.charsOverlay, groupStyle]} pointerEvents="none">
        {chars.map((char, idx) => (
          <BounceChar
            key={`${idx}-${char}`}
            char={char}
            index={idx}
            progress={progress}
            textStyle={textStyle}
          />
        ))}
      </Animated.View>
    </View>
  );
});

export interface SlidingTabOption<T extends string> {
  id: T;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
}

export interface SlidingTabsProps<T extends string> {
  options: readonly SlidingTabOption<T>[];
  value: T;
  onChange: (next: T) => void;
  disabled?: boolean;
  variant?: "surface" | "champagne" | "obsidian";
  containerStyle?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

/**
 * Reusable GPU-composited sliding segmented control (animates translateX only).
 */
export function SlidingTabs<T extends string>({
  options,
  value,
  onChange,
  disabled = false,
  variant = "surface",
  containerStyle,
  textStyle,
}: SlidingTabsProps<T>) {
  const reducedMotion = useReducedMotion();
  const [trackWidth, setTrackWidth] = useState(0);
  const padding = 3;
  const count = Math.max(1, options.length);
  const activeIndex = Math.max(
    0,
    options.findIndex((o) => o.id === value)
  );
  const innerWidth = Math.max(0, trackWidth - padding * 2);
  const segmentWidth = innerWidth / count;

  const translateX = useSharedValue(0);

  useEffect(() => {
    if (segmentWidth <= 0) return;
    const target = activeIndex * segmentWidth;
    if (reducedMotion) {
      translateX.value = target;
    } else {
      translateX.value = withSpring(target, SPRING_SNAPPY);
    }
  }, [activeIndex, segmentWidth, reducedMotion, translateX]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const handleLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && Math.abs(w - trackWidth) > 0.5) {
      setTrackWidth(w);
    }
  };

  const trackBg =
    variant === "champagne"
      ? "rgba(197, 168, 128, 0.16)"
      : variant === "obsidian"
      ? Colors.canvas
      : Colors.surfaceMuted;

  const pillStyle =
    variant === "surface"
      ? st.slidingPillSurface
      : variant === "champagne"
      ? st.slidingPillObsidian
      : st.slidingPillObsidian;

  const activeTextColor = variant === "surface" ? Colors.primary : "#FFFFFF";
  const inactiveTextColor = variant === "champagne" ? Colors.primary : Colors.textSecondary;

  return (
    <View
      onLayout={handleLayout}
      accessibilityRole="tablist"
      style={[st.slidingTrack, { backgroundColor: trackBg, padding }, containerStyle]}
    >
      {segmentWidth > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            st.slidingPillBase,
            pillStyle,
            {
              width: segmentWidth,
              top: padding,
              bottom: padding,
              left: padding,
            },
            indicatorStyle,
          ]}
        />
      )}

      {options.map((opt) => {
        const active = opt.id === value;
        return (
          <Pressable
            key={opt.id}
            disabled={disabled}
            accessibilityRole="tab"
            accessibilityState={{ selected: active, disabled }}
            onPress={() => onChange(opt.id)}
            style={st.slidingTabBtn}
          >
            {opt.icon && (
              <Ionicons
                name={opt.icon}
                size={14}
                color={active ? activeTextColor : inactiveTextColor}
              />
            )}
            <Text
              numberOfLines={1}
              style={[
                st.slidingTabText,
                { color: active ? activeTextColor : inactiveTextColor },
                active && st.slidingTabTextActive,
                textStyle,
              ]}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export interface AnimatedToastProps {
  message: string;
  tone?: "success" | "info" | "warning" | "error";
  position?: "bottom" | "top";
  offset?: number;
}

/**
 * Shared floating toast with smooth GPU FadeIn/FadeOut transition.
 */
export const AnimatedToast = memo(function AnimatedToast({
  message,
  tone = "info",
  position = "bottom",
  offset,
}: AnimatedToastProps) {
  const reducedMotion = useReducedMotion();

  if (!message) return null;

  const isTop = position === "top";
  const iconName: keyof typeof Ionicons.glyphMap =
    tone === "success"
      ? "checkmark-circle"
      : tone === "warning"
      ? "alert-circle"
      : tone === "error"
      ? "close-circle"
      : "information-circle";

  const iconColor =
    tone === "success"
      ? Colors.statusSuccess
      : tone === "warning"
      ? "#FDE68A"
      : tone === "error"
      ? "#FCA5A5"
      : Colors.champagne;

  const posStyle: ViewStyle = isTop
    ? { top: offset ?? 54 }
    : { bottom: offset ?? 96 };

  return (
    <Animated.View
      pointerEvents="none"
      entering={
        reducedMotion
          ? undefined
          : isTop
          ? FadeInUp.duration(220)
          : FadeInDown.duration(220)
      }
      exiting={
        reducedMotion
          ? undefined
          : isTop
          ? FadeOutUp.duration(160)
          : FadeOutDown.duration(160)
      }
      style={[st.toastContainer, posStyle]}
    >
      <Ionicons name={iconName} size={17} color={iconColor} />
      <Text style={st.toastText}>{message}</Text>
    </Animated.View>
  );
});

export interface AnimatedProgressBarProps {
  /** Progress ratio in range 0..100 */
  percent: number;
  fillColor?: string;
  trackColor?: string;
  height?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
  delayMs?: number;
}

/**
 * GPU-composited progress bar using translateX (zero layout reflows).
 */
export const AnimatedProgressBar = memo(function AnimatedProgressBar({
  percent,
  fillColor = Colors.champagne,
  trackColor = Colors.surfaceMuted,
  height = 6,
  borderRadius = 3,
  style,
  delayMs = 0,
}: AnimatedProgressBarProps) {
  const reducedMotion = useReducedMotion();
  const [trackWidth, setTrackWidth] = useState(0);
  const clamped = Math.min(100, Math.max(0, percent));
  const progress = useSharedValue(reducedMotion ? clamped / 100 : 0);

  useEffect(() => {
    const target = clamped / 100;
    if (reducedMotion) {
      progress.value = target;
      return;
    }
    const anim = withTiming(target, {
      duration: 560,
      easing: Easing.out(Easing.cubic),
    });
    progress.value = delayMs > 0 ? withDelay(delayMs, anim) : anim;
  }, [clamped, reducedMotion, delayMs, progress]);

  const fillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -(1 - progress.value) * trackWidth }],
  }));

  return (
    <View
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (w > 0 && Math.abs(w - trackWidth) > 0.5) setTrackWidth(w);
      }}
      style={[
        st.progressTrack,
        { height, borderRadius, backgroundColor: trackColor },
        style,
      ]}
    >
      {trackWidth > 0 && (
        <Animated.View
          style={[
            {
              width: trackWidth,
              height: "100%",
              borderRadius,
              backgroundColor: fillColor,
            },
            fillStyle,
          ]}
        />
      )}
    </View>
  );
});

const st = StyleSheet.create({
  badgePill: {
    backgroundColor: Colors.champagneSubtle,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: "rgba(197, 168, 128, 0.42)",
    position: "relative",
    overflow: "hidden",
    justifyContent: "center",
  },
  badgeText: {
    fontSize: 10,
    fontFamily: "Mono",
    color: Colors.champagneDeep,
    fontWeight: "700",
    letterSpacing: 0.25,
  },
  ghostText: {
    opacity: 0,
  },
  charsOverlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
  },
  slidingTrack: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: Colors.borderHairline,
    position: "relative",
  },
  slidingPillBase: {
    position: "absolute",
    borderRadius: Radii.full,
  },
  slidingPillSurface: {
    backgroundColor: Colors.surface,
    ...Shadows.sm,
  },
  slidingPillObsidian: {
    backgroundColor: Colors.primary,
    ...Shadows.sm,
  },
  slidingTabBtn: {
    flex: 1,
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 6,
    zIndex: 1,
  },
  slidingTabText: {
    fontSize: 12,
    fontFamily: "Jakarta",
  },
  slidingTabTextActive: {
    fontFamily: "JakartaSemiBold",
  },
  toastContainer: {
    position: "absolute",
    left: 20,
    right: 20,
    backgroundColor: Colors.primary,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: Radii.lg,
    zIndex: 99,
    ...Shadows.toast,
  },
  toastText: {
    fontSize: 12.5,
    fontFamily: "JakartaSemiBold",
    color: "#FFFFFF",
    flex: 1,
    lineHeight: 17,
  },
  progressTrack: {
    width: "100%",
    overflow: "hidden",
  },
});
