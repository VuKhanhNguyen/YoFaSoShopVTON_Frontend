import AsyncStorage from "@react-native-async-storage/async-storage";
import { useState } from "react";
import { Image, View } from "react-native";
import { router } from "expo-router";
import { login } from "@/lib/api";
import { useSession } from "@/lib/session";
import { Button, Heading, Logo, Notice, Screen } from "@/components/shop/ui";
import { ContractForm } from "@/components/shop/ContractForm";
export default function Auth() {
  const [register, setRegister] = useState(false);
  const { setUser } = useSession();
  return (
    <Screen>
      <View
        style={{
          height: 230,
          borderRadius: 24,
          overflow: "hidden",
          padding: 20,
        }}
      >
        <Image source={require("../../assets/editorial/onboard-1.jpg")} resizeMode="cover" style={{ position: 'absolute', width: '100%', height: 460, left: 0, top: 0 }} />
        <View
          style={{
            alignSelf: "flex-start",
            backgroundColor: "#FFFFFFEC",
            borderRadius: 16,
            padding: 8,
          }}
        >
          <Logo />
        </View>
      </View>
      <Heading>
        {register ? "Tạo tài khoản YoFaSo" : "Chào mừng trở lại"}
      </Heading>
      <Notice>
        {register
          ? "Lưu những lựa chọn và trải nghiệm phòng thử đồ riêng của bạn."
          : "Đăng nhập để tiếp tục phong cách của bạn."}
      </Notice>
      <ContractForm
        key={String(register)}
        schemaName={register ? "Register" : "Login"}
        title={register ? "Đăng ký" : "Đăng nhập"}
        onSubmit={async (value) => {
          const user = await login(value, register);
          await AsyncStorage.setItem("yofaso.onboarding.v1", "seen");
          setUser(user);
          router.replace("/(shop)");
        }}
      />
      <Button
        secondary
        title={
          register ? "Đã có tài khoản? Đăng nhập" : "Chưa có tài khoản? Đăng ký"
        }
        onPress={() => setRegister(!register)}
      />
      <Button
        secondary
        title="Quên mật khẩu"
        onPress={() => router.push("/reset-password")}
      />
      <Button
        secondary
        title="Khám phá với tư cách khách"
        onPress={() => router.replace("/(shop)")}
      />
    </Screen>
  );
}
