import type { CaptureTrigger } from "@/lib/hand-gesture-state";

export interface CapturedVtonPhoto {
  uri: string;
  width: number;
  height: number;
  fileName: string;
  mimeType: string;
  trigger: CaptureTrigger;
}

export interface LiveVtonCameraModalProps {
  visible: boolean;
  category?: string;
  guideText?: string;
  onClose: () => void;
  onCapture: (photo: CapturedVtonPhoto) => void;
  onFallbackSystemCamera?: () => void;
}

export function LiveVtonCameraModal(_props: LiveVtonCameraModalProps) {
  return null;
}
