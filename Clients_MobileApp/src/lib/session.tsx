import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { router } from "expo-router";
import { setExpiryHandler, logout } from "./api";
import type { User } from "./models";
const Context = createContext<{
  user: User | null;
  setUser: (u: User | null) => void;
  signOut: () => Promise<void>;
}>({ user: null, setUser: () => {}, signOut: async () => {} });
export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => {
    setExpiryHandler(() => {
      setUser(null);
      router.replace("/auth");
    });
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
      {children}
    </Context.Provider>
  );
}
export const useSession = () => useContext(Context);
