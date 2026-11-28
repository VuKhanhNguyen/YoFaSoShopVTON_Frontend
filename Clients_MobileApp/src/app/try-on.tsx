import { useCallback, useEffect, useRef, useState } from "react";
import {
  Image,
  ImageBackground,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { File } from "expo-file-system";
import { Ionicons } from "@expo/vector-icons";
import { api, publicUrl, requestKey } from "@/lib/api";
import { formatVND } from "@/lib/catalog-data";
import { useSession } from "@/lib/session";
import { useResource } from "@/hooks/use-resource";
import { type Product } from "@/lib/models";
import {
  checkModelGenderLock,
  checkTryOnCompatibility,
  groupVariantsByColor,
  matchColor,
  normalizeGender,
  pickProductImageForColor,
  type FashionGender,
} from "@/lib/try-on";
import { Colors, Radii, Shadows } from "@/constants/theme";
import { Button, Notice, State } from "@/components/shop/ui";
import { PrivateImage } from "@/components/shop/PrivateImage";
import { CatalogPickerModal } from "@/components/shop/CatalogPickerModal";
import {
  LiveVtonCameraModal,
  type CapturedVtonPhoto,
} from "@/components/shop/LiveVtonCameraModal";
import { AnimatedToast, SlidingTabs } from "@/components/shop/MotionPrimitives";
import { SmartImage } from "@/components/shop/Skeleton";

const TRYON_MODE_OPTIONS = [
  { id: "shop" as const, label: "Mẫu của shop", icon: "person-outline" as const },
  { id: "photo" as const, label: "Ảnh của tôi", icon: "camera-outline" as const },
];

const portraits = {
  female: require("../../assets/humanModelVTON/FemaleModel.png"),
  male: require("../../assets/humanModelVTON/MaleModel.png"),
  female_upper: require("../../assets/humanModelVTON/FemaleModel_UpperBody.png"),
  male_upper: require("../../assets/humanModelVTON/MaleModel_UpperBody.png"),
};
const room = require("../../assets/humanModelVTON/RoomBackground.png");
const categories = [
  ["upper_body", "Áo", "Chụp chính diện, thấy rõ vai, thân trên và hai tay."],
  ["lower_body", "Quần / chân váy", "Chụp rõ từ eo đến mắt cá chân. Nên đứng thẳng tự nhiên."],
  ["dress", "Đầm liền", "Chụp toàn thân, đứng thẳng và để hai tay hơi tách khỏi thân."],
] as const;

type ChainedContext = {
  sessionId: string;
  category: string;
  frame?: string;
};

export default function TryOnScreen() {
  const params = useLocalSearchParams<{
    productId?: string;
    variantId?: string;
    category?: string;
    gender?: string;
    mode?: string;
    shopModelId?: string;
    personAssetId?: string;
    chainedFromSessionId?: string;
    chainedFromCategory?: string;
    chainedFromFrame?: string;
    seed?: string;
  }>();
  const { user } = useSession();

  const initialGender = normalizeGender(params.gender);
  const [productId, setProduct] = useState(params.productId || "");
  const [variantId, setVariant] = useState(params.variantId || "");
  const [category, setCategory] = useState(
    categories.some((c) => c[0] === params.category) ? params.category! : "upper_body"
  );
  const [mode, setMode] = useState<"shop" | "photo">(
    params.mode === "photo" || params.personAssetId ? "photo" : "shop"
  );
  const [modelGender, setModelGender] = useState<"female" | "male">(
    params.shopModelId?.startsWith("male")
      ? "male"
      : params.shopModelId?.startsWith("female")
      ? "female"
      : initialGender === "NAM"
      ? "male"
      : "female"
  );
  const [modelFrame, setModelFrame] = useState<"full" | "upper">(
    params.shopModelId?.includes("upper") ? "upper" : "full"
  );
  const [photoGender, setPhotoGender] = useState<FashionGender>(
    initialGender || normalizeGender(user?.gender) || "NU"
  );
  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset>();
  const [assetId, setAssetId] = useState(params.personAssetId);
  const [validatedPhotoFrame, setValidatedPhotoFrame] = useState<string | undefined>(
    params.chainedFromFrame || undefined
  );
  const [chainedContext, setChainedContext] = useState<ChainedContext | null>(
    params.chainedFromCategory
      ? {
          sessionId: params.chainedFromSessionId || "",
          category: params.chainedFromCategory,
          frame: params.chainedFromFrame || undefined,
        }
      : null
  );
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [liveCamOpen, setLiveCamOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sending = useRef(false);
  const attempt = useRef<{ input: string; key: string } | undefined>(undefined);
  const checkedPhoto = useRef<string | undefined>(undefined);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 3200);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const detail = useResource<Product>(
    productId ? "/catalog/products/" + encodeURIComponent(productId) : null
  );
  const product = detail.data?.productId === productId ? detail.data : undefined;
  const activeCategory = product?.vtonCategory || category;
  const productGender = normalizeGender(
    product?.gender || (productId === params.productId ? params.gender : undefined)
  );

  // Sync shop model gender to match selected product gender (NU -> female, NAM -> male)
  useEffect(() => {
    if (!productGender) return;
    setModelGender(productGender === "NAM" ? "male" : "female");
  }, [productGender]);

  const isUpperBodyAllowed = activeCategory === "upper_body";
  const activeModelKey = (
    modelFrame === "upper" && isUpperBodyAllowed ? `${modelGender}_upper` : modelGender
  ) as keyof typeof portraits;
  const catalogGender: FashionGender =
    mode === "shop" ? (modelGender === "male" ? "NAM" : "NU") : photoGender;

  const variants = (product?.variants ?? []).filter(
    (v) =>
      v.status === "DANG_BAN" &&
      v.stock > 0 &&
      product?.images?.some((i) => matchColor(i.colors, v.colors) && i.cutoutUrl)
  );
  const colorGroups = groupVariantsByColor(variants);
  const variant =
    variants.find((v) => v.variantId === variantId) ||
    (!variantId ? colorGroups[0]?.variants[0] : undefined);
  const activeColor = variant
    ? colorGroups.find((g) => g.variants.some((v) => v.variantId === variant.variantId))
    : undefined;
  const activeThumbUrl = pickProductImageForColor(product, activeColor?.hex);
  const guide = categories.find((c) => c[0] === activeCategory)?.[2];

  function handleSelectModelGender(target: "female" | "male") {
    const lock = checkModelGenderLock(productGender, target);
    if (!lock.allowed) {
      showToast(lock.reason);
      return;
    }
    setModelGender(target);
  }

  function handleSelectModelFrame(target: "full" | "upper") {
    if (target === "upper") {
      const compat = checkTryOnCompatibility({
        targetCategory: activeCategory,
        frame: "HALF_BODY",
      });
      if (!compat.allowed) {
        showToast(compat.reason);
        return;
      }
    }
    setModelFrame(target);
  }

  function handleModeChange(nextMode: "shop" | "photo") {
    setMode(nextMode);
    if (nextMode === "shop") {
      setChainedContext(null);
      setValidatedPhotoFrame(undefined);
    }
  }

  async function openSystemCamera() {
    setError("");
    try {
      if (!(await ImagePicker.requestCameraPermissionsAsync()).granted) {
        setError("Cần cấp quyền máy ảnh để chụp ảnh thử đồ.");
        return;
      }
      const selection = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        quality: 0.95,
      });
      if (!selection.canceled) {
        const captured = selection.assets[0];
        setPhoto(captured);
        setAssetId(undefined);
        setChainedContext(null);
        setValidatedPhotoFrame(undefined);
        checkedPhoto.current = undefined;
        if (variant) {
          void submit(captured);
        }
      }
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function pick(camera: boolean) {
    setError("");
    if (camera && Platform.OS === "android") {
      setLiveCamOpen(true);
      return;
    }
    if (camera) {
      await openSystemCamera();
      return;
    }
    try {
      const selection = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.95,
      });
      if (!selection.canceled) {
        setPhoto(selection.assets[0]);
        setAssetId(undefined);
        setChainedContext(null);
        setValidatedPhotoFrame(undefined);
        checkedPhoto.current = undefined;
      }
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function handleLiveCameraCapture(captured: CapturedVtonPhoto) {
    const asset: ImagePicker.ImagePickerAsset = {
      uri: captured.uri,
      width: captured.width,
      height: captured.height,
      fileName: captured.fileName,
      mimeType: captured.mimeType,
    };
    setLiveCamOpen(false);
    setPhoto(asset);
    setAssetId(undefined);
    setChainedContext(null);
    setValidatedPhotoFrame(undefined);
    checkedPhoto.current = undefined;
    setError("");

    if (!variant) {
      showToast("Đã chụp ảnh! Hãy chọn trang phục để bắt đầu thử đồ AI.");
      setCatalogOpen(true);
      return;
    }

    if (captured.trigger === "VICTORY") {
      showToast("Đã chụp bằng cử chỉ ✌️ — tự động bắt đầu thử đồ AI!");
    } else if (captured.trigger === "OPEN_PALM") {
      showToast("Đã chụp sau đếm ngược 🖐️ — tự động bắt đầu thử đồ AI!");
    } else {
      showToast("Đã chụp ảnh — tự động bắt đầu thử đồ AI!");
    }
    void submit(asset);
  }

  async function submit(overridePhoto?: ImagePicker.ImagePickerAsset) {
    if (!variant || sending.current) return;
    if (!user) {
      router.push({ pathname: "/auth", params: { returnToFitting: "1" } });
      return;
    }

    const activePhoto = overridePhoto ?? photo;
    const activeInitialAssetId = overridePhoto ? undefined : assetId;

    const preCompat = checkTryOnCompatibility({
      targetCategory: activeCategory,
      frame:
        mode === "shop"
          ? modelFrame === "upper"
            ? "HALF_BODY"
            : "FULL_BODY"
          : overridePhoto
          ? undefined
          : validatedPhotoFrame,
      shopModelId: mode === "shop" ? activeModelKey : undefined,
      chainedFromCategory: overridePhoto ? undefined : chainedContext?.category,
      chainedFromFrame: overridePhoto ? undefined : chainedContext?.frame,
    });
    if (!preCompat.allowed) {
      setError(preCompat.reason);
      showToast(preCompat.reason);
      return;
    }

    if (mode === "shop") {
      const genderLock = checkModelGenderLock(productGender, modelGender);
      if (!genderLock.allowed) {
        setError(genderLock.reason);
        showToast(genderLock.reason);
        return;
      }
    }

    sending.current = true;
    setBusy(true);
    setError("");
    try {
      let personAssetId = activeInitialAssetId;
      if (mode === "photo") {
        if (!personAssetId && activePhoto) {
          const form = new FormData();
          form.append("role", "person");
          form.append("consent", "true");
          if (Platform.OS === "web") {
            form.append(
              "file",
              activePhoto.file || (await (await fetch(activePhoto.uri)).blob()),
              activePhoto.fileName || "person.png"
            );
          } else {
            form.append(
              "file",
              new File(activePhoto.uri) as unknown as Blob,
              activePhoto.fileName || "person.png"
            );
          }
          personAssetId = (await api<{ assetId: string }>("/assets", "POST", form)).assetId;
          setAssetId(personAssetId);
        }
        if (!personAssetId) throw new Error("Chọn ảnh của bạn trước khi thử.");
        const checkKey = personAssetId + ":" + variant.variantId;
        if (checkedPhoto.current !== checkKey) {
          const check = await api<{
            accepted: boolean;
            personFrame?: string;
            warnings?: string[];
            route?: { personFrame?: string; warnings?: string[] };
          }>("/ai/persons/validate", "POST", {
            assetId: personAssetId,
            variantId: variant.variantId,
          });
          const detectedFrame = check.personFrame || check.route?.personFrame;
          if (detectedFrame) setValidatedPhotoFrame(detectedFrame);

          const postCompat = checkTryOnCompatibility({
            targetCategory: activeCategory,
            frame: detectedFrame,
            chainedFromCategory: chainedContext?.category,
            chainedFromFrame: chainedContext?.frame || detectedFrame,
          });
          if (!postCompat.allowed) {
            showToast(postCompat.reason);
            throw new Error(postCompat.reason);
          }
          if (!check.accepted) {
            const msg =
              check.route?.warnings?.[0] ||
              check.warnings?.[0] ||
              "Ảnh chưa đủ rõ để nhận diện tư thế. Hãy chọn ảnh khác.";
            showToast(msg);
            throw new Error(msg);
          }
          checkedPhoto.current = checkKey;
        }
      }
      const body = {
        variantId: variant.variantId,
        ...(mode === "photo" ? { personAssetId } : { shopModelId: activeModelKey }),
        consent: true,
        seed: /^\d{1,9}$/.test(params.seed || "") ? Number(params.seed) : 42,
        steps: 20,
        samples: 4,
      };
      const input = JSON.stringify(body);
      if (attempt.current?.input !== input) attempt.current = { input, key: requestKey() };
      const session = await api<{ resourceId: string }>(
        "/try-on/sessions",
        "POST",
        body,
        attempt.current.key
      );
      router.replace({ pathname: "/session/[id]", params: { id: session.resourceId } });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  const before = !!photo || (!!assetId && !!user);

  return (
    <View style={st.page}>
      <Stack.Screen
        options={{
          title: "Phòng thử đồ",
          headerStyle: { backgroundColor: Colors.canvas },
          headerTintColor: Colors.primary,
          headerTitleStyle: { fontFamily: "Editorial", fontSize: 19, color: Colors.primary },
          headerShadowVisible: false,
          headerRight: () => (
            <Pressable
              onPress={() => router.push("/(shop)/wardrobe")}
              style={st.headerWardrobeBtn}
              accessibilityLabel="Mở Tủ đồ VTON"
            >
              <Ionicons name="shirt-outline" size={16} color={Colors.primary} />
              <Text style={st.headerWardrobeText}>Tủ đồ</Text>
            </Pressable>
          ),
        }}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={st.scrollContent}
      >
        {/* Segmented Mode Control */}
        <SlidingTabs
          options={TRYON_MODE_OPTIONS}
          value={mode}
          onChange={handleModeChange}
          disabled={busy}
          variant="surface"
        />

        {/* Portrait / Model Stage */}
        {mode === "shop" ? (
          <ImageBackground source={room} style={st.stageCard} imageStyle={st.stageBgImage}>
            <Image
              source={portraits[activeModelKey]}
              style={st.personImage}
              resizeMode="contain"
              accessibilityLabel="Mẫu minh họa của shop"
            />
            <View style={st.stagePill}>
              <View style={st.goldDot} />
              <Text style={st.stagePillText}>
                {modelGender === "female" ? "Mẫu nữ" : "Mẫu nam"} ·{" "}
                {modelFrame === "upper" && isUpperBodyAllowed ? "Nửa thân trên" : "Toàn thân"}
              </Text>
            </View>
          </ImageBackground>
        ) : (
          <View style={st.stageCard}>
            {photo ? (
              <Image
                source={{ uri: photo.uri }}
                style={st.personImage}
                resizeMode="contain"
                accessibilityLabel="Ảnh gốc của bạn"
              />
            ) : assetId && user ? (
              <PrivateImage
                assetId={assetId}
                style={st.personImage}
                resizeMode="contain"
                accessibilityLabel="Ảnh gốc của bạn"
              />
            ) : (
              <View style={st.emptyPhoto}>
                <View style={st.emptyPhotoCircle}>
                  <Ionicons name="scan-outline" size={32} color={Colors.champagneDeep} />
                </View>
                <Text style={st.emptyPhotoTitle}>Tải ảnh chân dung của bạn</Text>
                <Text style={st.emptyPhotoSub}>{guide}</Text>
              </View>
            )}
            {before && (
              <View style={st.stagePill}>
                <View style={[st.goldDot, { backgroundColor: Colors.statusSuccess }]} />
                <Text style={st.stagePillText}>
                  {chainedContext ? "Ảnh kết quả VTON · Sẵn sàng" : "Ảnh của bạn · Sẵn sàng"}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Chained Try-On Banner */}
        {mode === "photo" && chainedContext && (
          <View style={st.chainedBanner}>
            <Ionicons name="layers-outline" size={18} color={Colors.champagneDeep} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={st.chainedTitle}>
                Đang thử tiếp từ ảnh kết quả #{chainedContext.sessionId || "VTON"}
              </Text>
              <Text style={st.chainedSub}>
                Ảnh kết quả đã được nạp sẵn làm ảnh gốc. Bạn vẫn có thể chọn ảnh khác từ thư viện hoặc chụp ảnh mới bên dưới.
              </Text>
            </View>
          </View>
        )}

        {/* Model Configuration or Photo Picker Card */}
        <View style={st.editorialCard}>
          {mode === "shop" ? (
            <>
              <View style={st.optionGroup}>
                <Text style={st.optionLabel}>Giới tính người mẫu</Text>
                <View style={st.chipRow}>
                  <Pressable
                    disabled={busy}
                    onPress={() => handleSelectModelGender("female")}
                    style={[
                      st.chip,
                      modelGender === "female" && st.chipActive,
                      productGender === "NAM" && st.chipDisabled,
                    ]}
                  >
                    <Text
                      style={[
                        st.chipText,
                        modelGender === "female" && st.chipTextActive,
                        productGender === "NAM" && st.chipTextDisabled,
                      ]}
                    >
                      Mẫu nữ
                    </Text>
                  </Pressable>
                  <Pressable
                    disabled={busy}
                    onPress={() => handleSelectModelGender("male")}
                    style={[
                      st.chip,
                      modelGender === "male" && st.chipActive,
                      productGender === "NU" && st.chipDisabled,
                    ]}
                  >
                    <Text
                      style={[
                        st.chipText,
                        modelGender === "male" && st.chipTextActive,
                        productGender === "NU" && st.chipTextDisabled,
                      ]}
                    >
                      Mẫu nam
                    </Text>
                  </Pressable>
                </View>
              </View>

              <View style={st.optionGroup}>
                <Text style={st.optionLabel}>Khung hình VTON</Text>
                <View style={st.chipRow}>
                  <Pressable
                    disabled={busy}
                    onPress={() => handleSelectModelFrame("full")}
                    style={[st.chip, (modelFrame === "full" || !isUpperBodyAllowed) && st.chipActive]}
                  >
                    <Text
                      style={[
                        st.chipText,
                        (modelFrame === "full" || !isUpperBodyAllowed) && st.chipTextActive,
                      ]}
                    >
                      Toàn thân (Full-body)
                    </Text>
                  </Pressable>
                  <Pressable
                    disabled={busy}
                    onPress={() => handleSelectModelFrame("upper")}
                    style={[
                      st.chip,
                      modelFrame === "upper" && isUpperBodyAllowed && st.chipActive,
                      !isUpperBodyAllowed && st.chipDisabled,
                    ]}
                  >
                    <Text
                      style={[
                        st.chipText,
                        modelFrame === "upper" && isUpperBodyAllowed && st.chipTextActive,
                        !isUpperBodyAllowed && st.chipTextDisabled,
                      ]}
                    >
                      Nửa thân (Chỉ Áo)
                    </Text>
                  </Pressable>
                </View>
              </View>

              {!isUpperBodyAllowed && (
                <View style={st.compatNote}>
                  <Ionicons name="information-circle-outline" size={16} color={Colors.champagneDeep} />
                  <Text style={st.compatNoteText}>
                    Quần / Đầm liền bắt buộc khung hình Toàn thân để AI dựng chính xác phần hông và chân.
                  </Text>
                </View>
              )}
            </>
          ) : (
            <View style={{ gap: 14 }}>
              <View style={st.photoBtnRow}>
                <Pressable
                  disabled={busy}
                  onPress={() => void pick(false)}
                  style={st.photoPickBtn}
                >
                  <Ionicons name="images-outline" size={18} color={Colors.primary} />
                  <Text style={st.photoPickText}>{before ? "Đổi ảnh thư viện" : "Chọn từ thư viện"}</Text>
                </Pressable>
                <Pressable
                  disabled={busy}
                  onPress={() => void pick(true)}
                  style={st.photoPickBtn}
                >
                  <Ionicons name="camera-outline" size={18} color={Colors.primary} />
                  <Text style={st.photoPickText}>Chụp ảnh mới</Text>
                </Pressable>
              </View>

              {/* Gender selector ONLY in personal photo mode — solely filters the Catalog Picker Dialog */}
              <View style={st.optionGroup}>
                <Text style={st.optionLabel}>Hiển thị danh mục trang phục theo giới tính</Text>
                <View style={st.chipRow}>
                  <Pressable
                    disabled={busy}
                    onPress={() => setPhotoGender("NU")}
                    style={[st.chip, photoGender === "NU" && st.chipActive]}
                  >
                    <Text style={[st.chipText, photoGender === "NU" && st.chipTextActive]}>
                      Thời trang Nữ
                    </Text>
                  </Pressable>
                  <Pressable
                    disabled={busy}
                    onPress={() => setPhotoGender("NAM")}
                    style={[st.chip, photoGender === "NAM" && st.chipActive]}
                  >
                    <Text style={[st.chipText, photoGender === "NAM" && st.chipTextActive]}>
                      Thời trang Nam
                    </Text>
                  </Pressable>
                </View>
              </View>

              <View style={st.compatNote}>
                <Ionicons name="shield-checkmark-outline" size={16} color={Colors.champagneDeep} />
                <Text style={st.compatNoteText}>
                  {guide} Ảnh cá nhân được bảo mật riêng tư trong Tủ đồ VTON của bạn.
                </Text>
              </View>
            </View>
          )}
        </View>

        {error ? <Notice error>{error}</Notice> : null}

        {/* Selected Product & Variant Card */}
        {!!productId && <State loading={detail.loading} error={detail.error} retry={detail.reload} />}
        {product && (
          <View style={st.editorialCard}>
            <View style={st.selectedProductHeader}>
              <SmartImage
                source={activeThumbUrl ? publicUrl(activeThumbUrl) : null}
                style={st.selectedProductThumb}
                contentFit="cover"
                borderRadius={Radii.md}
                iconSize={20}
              />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={st.selectedLabel}>TRANG PHỤC ĐANG CHỌN</Text>
                <Text style={st.selectedTitle} numberOfLines={2}>{product.name}</Text>
                {variant && (
                  <Text style={st.selectedPrice}>{formatVND(variant.salePrice ?? variant.price)}</Text>
                )}
              </View>
            </View>

            {!variants.length ? (
              <Notice>Sản phẩm hiện chưa có phiên bản bóc nền sẵn sàng để thử đồ.</Notice>
            ) : (
              <View style={st.variantSelectorStack}>
                <View style={st.optionGroup}>
                  <View style={st.colorHeaderRow}>
                    <Text style={st.optionLabel}>{activeColor ? "Màu sắc:" : "Màu sắc"}</Text>
                    {activeColor ? <Text style={st.colorSelectedName}>{activeColor.name}</Text> : null}
                  </View>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={st.swatchRow}
                  >
                    {colorGroups.map((group) => {
                      const active = activeColor?.key === group.key;
                      return (
                        <Pressable
                          key={group.key}
                          disabled={busy}
                          hitSlop={6}
                          accessibilityRole="button"
                          accessibilityLabel={`Màu ${group.name}`}
                          accessibilityState={{ selected: active }}
                          onPress={() => {
                            const next =
                              group.variants.find((v) => v.size === variant?.size) ?? group.variants[0];
                            if (next) setVariant(next.variantId);
                          }}
                          style={[st.swatchRing, active && st.swatchRingActive, busy && st.chipDisabled]}
                        >
                          <View
                            style={[
                              st.swatchColor,
                              { backgroundColor: group.primaryHex },
                            ]}
                          />
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>

                {activeColor && (
                  <View style={st.optionGroup}>
                    <Text style={st.optionLabel}>Kích cỡ</Text>
                    <View style={st.chipRow}>
                      {activeColor.variants.map((v) => {
                        const active = variant?.variantId === v.variantId;
                        return (
                          <Pressable
                            key={v.variantId}
                            disabled={busy}
                            hitSlop={4}
                            accessibilityRole="button"
                            accessibilityLabel={`Kích cỡ ${v.size}`}
                            accessibilityState={{ selected: active }}
                            onPress={() => setVariant(v.variantId)}
                            style={[st.chip, st.sizeChip, active && st.chipActive]}
                          >
                            <Text style={[st.chipText, active && st.chipTextActive]}>{v.size}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {/* Primary CTA */}
        <Button
          title={
            busy
              ? "Đang gửi yêu cầu…"
              : !user
              ? "Đăng nhập để thử đồ"
              : mode === "shop"
              ? "Bắt đầu ướm thử trên mẫu"
              : "Tạo ảnh thử đồ AI"
          }
          icon={<Ionicons name="sparkles" size={16} color={Colors.champagne} />}
          loading={busy}
          disabled={!variant || (mode === "photo" && !before)}
          onPress={() => void submit()}
        />

        {/* Button opening full 2-column Catalog Picker Dialog (Req 3) */}
        <Button
          title={product ? "Đổi trang phục khác" : "Chọn trang phục để thử"}
          secondary
          icon={<Ionicons name="grid-outline" size={17} color={Colors.primary} />}
          disabled={busy}
          onPress={() => setCatalogOpen(true)}
        />
      </ScrollView>

      {/* Catalog Picker Modal */}
      <CatalogPickerModal
        visible={catalogOpen}
        onClose={() => setCatalogOpen(false)}
        lockedGender={catalogGender}
        selectedProductId={productId}
        frame={
          mode === "shop"
            ? modelFrame === "upper"
              ? "HALF_BODY"
              : "FULL_BODY"
            : validatedPhotoFrame
        }
        shopModelId={mode === "shop" ? activeModelKey : undefined}
        chainedFromCategory={chainedContext?.category}
        chainedFromFrame={chainedContext?.frame}
        onSelect={(item) => {
          setProduct(item.id);
          setVariant("");
          setCategory(item.vtonCategory || "upper_body");
          setError("");
        }}
      />

      {/* Live AI Hand-Gesture Camera Modal (Android APK) */}
      <LiveVtonCameraModal
        visible={liveCamOpen}
        category={activeCategory}
        guideText={guide}
        onClose={() => setLiveCamOpen(false)}
        onCapture={handleLiveCameraCapture}
        onFallbackSystemCamera={() => void openSystemCamera()}
      />

      {/* Floating Blocking Toast */}
      <AnimatedToast message={toast} tone="warning" offset={24} />
    </View>
  );
}

const st = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: Colors.canvas,
  },
  headerWardrobeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radii.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderHairline,
  },
  headerWardrobeText: {
    fontFamily: "JakartaSemiBold",
    fontSize: 12,
    color: Colors.primary,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 48,
    gap: 16,
  },
  segmentedBar: {
    flexDirection: "row",
    backgroundColor: Colors.surfaceMuted,
    padding: 4,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.borderHairline,
    gap: 4,
  },
  segmentItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: Radii.md,
  },
  segmentActive: {
    backgroundColor: Colors.surface,
    ...Shadows.sm,
  },
  segmentText: {
    fontFamily: "JakartaSemiBold",
    fontSize: 13,
    color: Colors.textSecondary,
  },
  segmentTextActive: {
    color: Colors.primary,
  },
  stageCard: {
    height: 390,
    borderRadius: Radii.xl,
    overflow: "hidden",
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderHairline,
    justifyContent: "center",
    position: "relative",
    ...Shadows.sm,
  },
  stageBgImage: {
    borderRadius: Radii.xl,
  },
  personImage: {
    width: "100%",
    height: "100%",
  },
  stagePill: {
    position: "absolute",
    left: 12,
    bottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radii.full,
    borderWidth: 1,
    borderColor: Colors.borderHairline,
  },
  goldDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: Colors.champagneDeep,
  },
  stagePillText: {
    fontFamily: "JakartaSemiBold",
    fontSize: 12,
    color: Colors.primary,
  },
  emptyPhoto: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    gap: 8,
  },
  emptyPhotoCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: Colors.champagneSubtle,
    borderWidth: 1,
    borderColor: "rgba(197, 168, 128, 0.4)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyPhotoTitle: {
    fontFamily: "Editorial",
    fontSize: 17,
    color: Colors.primary,
    textAlign: "center",
  },
  emptyPhotoSub: {
    fontFamily: "Jakarta",
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 18,
  },
  chainedBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: Colors.champagneSubtle,
    borderRadius: Radii.lg,
    padding: 13,
    borderWidth: 1,
    borderColor: "rgba(197, 168, 128, 0.45)",
  },
  chainedTitle: {
    fontFamily: "JakartaSemiBold",
    fontSize: 12.5,
    color: Colors.primary,
  },
  chainedSub: {
    fontFamily: "Jakarta",
    fontSize: 11.5,
    color: Colors.textSecondary,
    lineHeight: 17,
  },
  editorialCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radii.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.borderHairline,
    gap: 14,
    ...Shadows.sm,
  },
  optionGroup: {
    gap: 8,
  },
  optionLabel: {
    fontFamily: "JakartaSemiBold",
    fontSize: 13,
    color: Colors.textSecondary,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: Radii.full,
    backgroundColor: Colors.surfaceMuted,
    borderWidth: 1,
    borderColor: Colors.borderHairline,
  },
  chipActive: {
    backgroundColor: Colors.champagneSubtle,
    borderColor: Colors.champagne,
  },
  chipDisabled: {
    opacity: 0.45,
  },
  chipText: {
    fontFamily: "JakartaSemiBold",
    fontSize: 12,
    color: Colors.textSecondary,
  },
  chipTextActive: {
    color: Colors.primary,
  },
  chipTextDisabled: {
    color: Colors.textMuted,
  },
  variantSelectorStack: {
    gap: 14,
  },
  colorHeaderRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
  },
  colorSelectedName: {
    fontFamily: "Jakarta",
    fontSize: 13,
    color: Colors.primary,
  },
  swatchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 2,
    paddingRight: 8,
  },
  swatchRing: {
    width: 38,
    height: 38,
    borderRadius: 19,
    padding: 2,
    borderWidth: 1,
    borderColor: Colors.borderHairline,
    alignItems: "center",
    justifyContent: "center",
  },
  swatchRingActive: {
    borderColor: Colors.primary,
    borderWidth: 2,
  },
  swatchColor: {
    width: "100%",
    height: "100%",
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(15, 23, 42, 0.14)",
  },
  sizeChip: {
    minWidth: 48,
    alignItems: "center",
  },
  compatNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: Colors.champagneSubtle,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: "rgba(197, 168, 128, 0.35)",
  },
  compatNoteText: {
    flex: 1,
    fontFamily: "Jakarta",
    fontSize: 12,
    color: Colors.primary,
    lineHeight: 17,
  },
  photoBtnRow: {
    flexDirection: "row",
    gap: 10,
  },
  photoPickBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: Radii.md,
    backgroundColor: Colors.surfaceMuted,
    borderWidth: 1,
    borderColor: Colors.borderHairline,
  },
  photoPickText: {
    fontFamily: "JakartaSemiBold",
    fontSize: 13,
    color: Colors.primary,
  },
  selectedProductHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  selectedProductThumb: {
    width: 64,
    height: 80,
    borderRadius: Radii.md,
    backgroundColor: Colors.surfaceMuted,
  },
  selectedLabel: {
    fontFamily: "Mono",
    fontSize: 10,
    color: Colors.champagneDeep,
    letterSpacing: 0.6,
  },
  selectedTitle: {
    fontFamily: "Editorial",
    fontSize: 17,
    color: Colors.primary,
  },
  selectedPrice: {
    fontFamily: "Mono",
    fontSize: 14,
    color: Colors.primary,
  },
  toastPopup: {
    position: "absolute",
    top: 14,
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#0F172A",
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: "rgba(197, 168, 128, 0.45)",
    zIndex: 999,
    ...Shadows.toast,
  },
  toastPopupText: {
    flex: 1,
    fontFamily: "JakartaSemiBold",
    fontSize: 12.5,
    color: "#FFFFFF",
    lineHeight: 17,
  },
});
