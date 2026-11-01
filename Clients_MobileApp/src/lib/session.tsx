import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { router } from "expo-router";
import { AppState, Platform, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  setExpiryHandler,
  logout,
  restoreSession,
  noteActivity,
  setForeground,
  saveTokens,
} from "./api";
import type { User } from "./models";
const Context = createContext<{
  user: User | null;
  setUser: (u: User | null) => void;
  signOut: () => Promise<void>;
}>({ user: null, setUser: () => {}, signOut: async () => {} });
export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    setExpiryHandler(() => {
      setUser(null);
      router.replace("/auth");
    });
    // Keychain iOS có thể còn sau reinstall; cờ onboarding mất thì không tự khôi phục.
    void AsyncStorage.getItem("yofaso.onboarding.v1")
      .then((seen) =>
        seen ? restoreSession() : saveTokens(null).then(() => null),
      )
      .catch(() => null)
      .then((u) => {
        if (active) setUser(u);
      })
      .finally(() => {
        if (active) setReady(true);
      });
    const update = () => {
      if (AppState.currentState)
        setForeground(AppState.currentState === "active");
    };
    update();
    const subscription = AppState.addEventListener("change", update);
    const activity = (event: Event) => {
      if (event.isTrusted) noteActivity();
    };
    const visibility = () =>
      setForeground(document.visibilityState === "visible");
    if (Platform.OS === "web") {
      visibility();
      document.addEventListener("visibilitychange", visibility);
      ["pointerdown", "keydown", "wheel", "touchmove"].forEach((e) =>
        document.addEventListener(e, activity, { passive: true }),
      );
    }
    return () => {
      active = false;
      subscription.remove();
      setExpiryHandler(() => {});
      if (Platform.OS === "web") {
        document.removeEventListener("visibilitychange", visibility);
        ["pointerdown", "keydown", "wheel", "touchmove"].forEach((e) =>
          document.removeEventListener(e, activity),
        );
      }
    };
  }, []);
  const signOut = async () => {
    try {
      await logout();
    } finally {
      setUser(null);
      router.replace("/auth");
    }
  };
  return (
    <Context.Provider value={{ user, setUser, signOut }}>
      {ready && (
        <View
          style={{ flex: 1 }}
          onTouchStart={noteActivity}
          onTouchMove={noteActivity}
        >
          {children}
        </View>
      )}
    </Context.Provider>
  );
}
export const useSession = () => useContext(Context);
