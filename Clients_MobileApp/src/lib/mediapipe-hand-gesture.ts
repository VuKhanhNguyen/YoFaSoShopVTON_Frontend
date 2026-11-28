import { NativeModules, Platform } from "react-native";

export interface GestureFrameResult {
  skipped?: boolean;
  gesture?: string;
  score?: number;
  handCount?: number;
  error?: string;
}

interface HandGestureNativeModule {
  recognizeRgba(
    base64Rgba: string,
    width: number,
    height: number,
    orientation: string,
    mirrored: boolean
  ): Promise<GestureFrameResult>;
  resetSession(): Promise<boolean>;
}

const nativeModule: HandGestureNativeModule | undefined =
  Platform.OS === "android"
    ? (NativeModules.HandGestureModule as HandGestureNativeModule | undefined)
    : undefined;

export function isHandGestureNativeAvailable(): boolean {
  return Boolean(nativeModule && typeof nativeModule.recognizeRgba === "function");
}

export async function recognizeRgbaFrame(
  base64Rgba: string,
  width: number,
  height: number,
  orientation: string,
  mirrored: boolean
): Promise<GestureFrameResult> {
  if (!nativeModule) {
    return { skipped: true };
  }
  return nativeModule.recognizeRgba(base64Rgba, width, height, orientation, mirrored);
}

export async function resetGestureSession(): Promise<void> {
  if (!nativeModule?.resetSession) return;
  try {
    await nativeModule.resetSession();
  } catch {
    // ignore cleanup error
  }
}

/**
 * Runs on VisionCamera's parallel worklet thread:
 * Downsamples an RGBA/BGRA camera frame (accounting for row-stride padding) to <= 192px
 * and Base64-encodes it for MediaPipe GestureRecognizer inference on Android.
 */
export function packFrameRgbaToBase64(
  pixelBuffer: ArrayBuffer,
  srcWidth: number,
  srcHeight: number,
  bytesPerRow: number,
  isBgra: boolean,
  maxSide = 192
): { base64: string; width: number; height: number } | null {
  "worklet";
  const B64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  if (srcWidth <= 0 || srcHeight <= 0 || pixelBuffer.byteLength < 16) {
    return null;
  }

  const longest = srcWidth > srcHeight ? srcWidth : srcHeight;
  const scale = longest > maxSide ? maxSide / longest : 1;
  const dstWidth = Math.max(16, Math.round(srcWidth * scale));
  const dstHeight = Math.max(16, Math.round(srcHeight * scale));
  const stride = bytesPerRow >= srcWidth * 4 ? bytesPerRow : srcWidth * 4;

  const src = new Uint8Array(pixelBuffer);
  const totalBytes = dstWidth * dstHeight * 4;
  const rgba = new Uint8Array(totalBytes);

  let outIdx = 0;
  for (let y = 0; y < dstHeight; y++) {
    const srcY = ((y * srcHeight) / dstHeight) | 0;
    const rowBase = srcY * stride;
    for (let x = 0; x < dstWidth; x++) {
      const srcX = ((x * srcWidth) / dstWidth) | 0;
      const inIdx = rowBase + srcX * 4;
      if (inIdx + 3 < src.length) {
        if (isBgra) {
          rgba[outIdx] = src[inIdx + 2];
          rgba[outIdx + 1] = src[inIdx + 1];
          rgba[outIdx + 2] = src[inIdx];
          rgba[outIdx + 3] = 255;
        } else {
          rgba[outIdx] = src[inIdx];
          rgba[outIdx + 1] = src[inIdx + 1];
          rgba[outIdx + 2] = src[inIdx + 2];
          rgba[outIdx + 3] = 255;
        }
      }
      outIdx += 4;
    }
  }

  let b64 = "";
  const mainLen = totalBytes - (totalBytes % 3);
  for (let i = 0; i < mainLen; i += 3) {
    const chunk = (rgba[i] << 16) | (rgba[i + 1] << 8) | rgba[i + 2];
    b64 +=
      B64_CHARS[(chunk >> 18) & 63] +
      B64_CHARS[(chunk >> 12) & 63] +
      B64_CHARS[(chunk >> 6) & 63] +
      B64_CHARS[chunk & 63];
  }

  const rem = totalBytes - mainLen;
  if (rem === 1) {
    const chunk = rgba[mainLen];
    b64 += B64_CHARS[(chunk >> 2) & 63] + B64_CHARS[(chunk << 4) & 63] + "==";
  } else if (rem === 2) {
    const chunk = (rgba[mainLen] << 8) | rgba[mainLen + 1];
    b64 +=
      B64_CHARS[(chunk >> 10) & 63] +
      B64_CHARS[(chunk >> 4) & 63] +
      B64_CHARS[(chunk << 2) & 63] +
      "=";
  }

  return { base64: b64, width: dstWidth, height: dstHeight };
}
