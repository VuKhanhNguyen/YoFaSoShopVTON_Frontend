/**
 * Pure state machine & timing parameters for MediaPipe Hand Gesture VTON Camera.
 * - Score threshold: >= 0.75
 * - Hold-time / debounce: 700ms (0.6-0.8s) with 180ms single-frame flicker tolerance
 * - Victory (2 fingers ✌️): 1250ms (1.0-1.5s) "lower hand" delay so hand does not block chest/garment
 * - Open_Palm (5 fingers 🖐️): 3 -> 2 -> 1 countdown for full-body posing
 */

export const GESTURE_SCORE_THRESHOLD = 0.75;
export const GESTURE_HOLD_MS = 700;
export const GESTURE_FLICKER_GRACE_MS = 180;
export const VICTORY_LOWER_HAND_MS = 1250;
export const PALM_COUNTDOWN_SECONDS = 3;

export type TargetGesture = "Victory" | "Open_Palm";
export type CaptureTrigger = "VICTORY" | "OPEN_PALM" | "MANUAL";
export type GestureCameraPhase =
  | "IDLE"
  | "VICTORY_LOWER_HAND"
  | "PALM_COUNTDOWN"
  | "CAPTURING";

export interface GestureHoldState {
  gesture: TargetGesture | null;
  startedAtMs: number;
  lastValidAtMs: number;
  holdProgress: number;
}

export const EMPTY_GESTURE_HOLD: GestureHoldState = {
  gesture: null,
  startedAtMs: 0,
  lastValidAtMs: 0,
  holdProgress: 0,
};

export function isTargetGesture(name?: string | null): name is TargetGesture {
  return name === "Victory" || name === "Open_Palm";
}

export function stepGestureHold(
  prev: GestureHoldState,
  rawGesture: string | undefined | null,
  score: number,
  nowMs: number
): { next: GestureHoldState; triggered: TargetGesture | null } {
  const validTarget =
    Number.isFinite(score) &&
    score >= GESTURE_SCORE_THRESHOLD &&
    isTargetGesture(rawGesture)
      ? rawGesture
      : null;

  if (validTarget) {
    if (prev.gesture === validTarget) {
      const elapsed = Math.max(0, nowMs - prev.startedAtMs);
      if (elapsed >= GESTURE_HOLD_MS) {
        return { next: EMPTY_GESTURE_HOLD, triggered: validTarget };
      }
      return {
        next: {
          gesture: validTarget,
          startedAtMs: prev.startedAtMs,
          lastValidAtMs: nowMs,
          holdProgress: Math.min(0.99, Math.max(0.08, elapsed / GESTURE_HOLD_MS)),
        },
        triggered: null,
      };
    }

    return {
      next: {
        gesture: validTarget,
        startedAtMs: nowMs,
        lastValidAtMs: nowMs,
        holdProgress: 0.08,
      },
      triggered: null,
    };
  }

  if (prev.gesture && nowMs - prev.lastValidAtMs <= GESTURE_FLICKER_GRACE_MS) {
    const elapsed = Math.max(0, nowMs - prev.startedAtMs);
    return {
      next: {
        ...prev,
        holdProgress: Math.min(0.95, Math.max(0.08, elapsed / GESTURE_HOLD_MS)),
      },
      triggered: null,
    };
  }

  return { next: EMPTY_GESTURE_HOLD, triggered: null };
}
