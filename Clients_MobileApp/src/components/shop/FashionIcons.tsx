import React from "react";
import Svg, { Path, G, Rect, Circle } from "react-native-svg";

interface IconProps {
  size?: number;
  color?: string;
}

/**
 * Bespoke Upper Body (Shirt / Top) Silhouette
 * Quiet Luxury tailored collar and sleeves contour
 */
export function ShirtIcon({ size = 22, color = "#0F172A" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6.5 4L9 6.5C10 7.5 14 7.5 15 6.5L17.5 4L21.5 7.5L18.5 10.5V20H5.5V10.5L2.5 7.5L6.5 4Z"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M12 7.2V20M9 6.5C10 7.5 14 7.5 15 6.5"
        stroke={color}
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </Svg>
  );
}

/**
 * Bespoke Lower Body (Pants & Skirt) Silhouette
 * Tailored trouser legs with flowing A-line contour
 */
export function PantsSkirtIcon({ size = 22, color = "#0F172A" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Trousers + Skirt hybrid fashion silhouette */}
      <Path
        d="M6 4H18L19.5 20H13.8L12 11.5L10.2 20H4.5L6 4Z"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M6 7.5H18M12 4V9"
        stroke={color}
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </Svg>
  );
}

/**
 * Bespoke Dress Silhouette
 * Elegant evening / slip dress with refined waist taper & flared hem
 */
export function DressIcon({ size = 22, color = "#0F172A" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M8.5 3.5V6.5M15.5 3.5V6.5"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <Path
        d="M7.5 6.5C9 8 15 8 16.5 6.5L15 12C14.5 13.5 18 19 19.5 20.5H4.5C6 19 9.5 13.5 9 12L7.5 6.5Z"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M9 12H15"
        stroke={color}
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </Svg>
  );
}

/**
 * Minimalist Gender Female Symbol
 */
export function FemaleIcon({ size = 16, color = "#0F172A" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="9" r="6" stroke={color} strokeWidth="1.8" />
      <Path d="M12 15V22M9 18.5H15" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}

/**
 * Minimalist Gender Male Symbol
 */
export function MaleIcon({ size = 16, color = "#0F172A" }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="10" cy="14" r="6" stroke={color} strokeWidth="1.8" />
      <Path d="M14.5 9.5L20 4M20 4H15.5M20 4V8.5" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
