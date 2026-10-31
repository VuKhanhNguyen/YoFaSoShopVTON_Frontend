import AsyncStorage from "@react-native-async-storage/async-storage";
import { BASE_URL } from "./api";
const KEY = "yofaso.public-cache.v1";
type Entries = { path: string; base: string; value: unknown }[];
export async function cached<T>(path: string): Promise<T | undefined> {
  const entries: Entries = JSON.parse(
    (await AsyncStorage.getItem(KEY)) || "[]",
  );
  return entries.find((e) => e.path === path && e.base === BASE_URL)?.value as
    T | undefined;
}
export async function cache(path: string, value: unknown) {
  const entries: Entries = JSON.parse(
    (await AsyncStorage.getItem(KEY)) || "[]",
  );
  await AsyncStorage.setItem(
    KEY,
    JSON.stringify(
      [
        { path, base: BASE_URL, value },
        ...entries.filter((e) => e.path !== path || e.base !== BASE_URL),
      ].slice(0, 20),
    ),
  );
}
