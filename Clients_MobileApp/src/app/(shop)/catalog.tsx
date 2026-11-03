import { useLocalSearchParams } from "expo-router";
import { Catalog } from "@/components/shop/Catalog";

export default function CatalogPage() {
  const params = useLocalSearchParams<{
    gender?: string;
    sort?: string;
    category?: string;
    q?: string;
  }>();

  return (
    <Catalog
      initialGender={params.gender}
      initialSort={params.sort}
      initialCategory={params.category}
      initialSearch={params.q}
    />
  );
}
