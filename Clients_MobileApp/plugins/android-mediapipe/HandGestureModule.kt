package com.yofaso.shop.mediapipe

import android.graphics.Bitmap
import android.graphics.Matrix
import android.os.SystemClock
import android.util.Base64
import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.vision.core.RunningMode
import com.google.mediapipe.tasks.vision.gesturerecognizer.GestureRecognizer
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

class HandGestureModule(
  private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {

  private val executor = Executors.newSingleThreadExecutor { runnable ->
    Thread(runnable, "YoFaSo-MediaPipe-Gesture").apply { isDaemon = true }
  }
  private val busy = AtomicBoolean(false)

  private var recognizer: GestureRecognizer? = null
  private var initError: String? = null
  private var lastTimestampMs: Long = 0L

  private var reusableBitmap: Bitmap? = null
  private var reusableBuffer: ByteBuffer? = null

  override fun getName(): String = NAME

  private fun ensureRecognizer(): GestureRecognizer {
    recognizer?.let { return it }
    initError?.let { throw IllegalStateException(it) }

    return try {
      val baseOptions = try {
        BaseOptions.builder()
          .setModelAssetPath(MODEL_ASSET_NAME)
          .build()
      } catch (_: Throwable) {
        val bytes = reactContext.assets.open(MODEL_ASSET_NAME).use { it.readBytes() }
        val direct = ByteBuffer.allocateDirect(bytes.size).order(ByteOrder.nativeOrder())
        direct.put(bytes)
        direct.rewind()
        BaseOptions.builder()
          .setModelAssetBuffer(direct)
          .build()
      }

      val options = GestureRecognizer.GestureRecognizerOptions.builder()
        .setBaseOptions(baseOptions)
        .setRunningMode(RunningMode.VIDEO)
        .setNumHands(2)
        .setMinHandDetectionConfidence(0.5f)
        .setMinHandPresenceConfidence(0.5f)
        .setMinTrackingConfidence(0.5f)
        .build()

      GestureRecognizer.createFromOptions(reactContext, options).also {
        recognizer = it
      }
    } catch (e: Throwable) {
      val msg = e.message ?: "Failed to initialize MediaPipe GestureRecognizer"
      initError = msg
      Log.e(NAME, msg, e)
      throw e
    }
  }

  private fun obtainBitmap(width: Int, height: Int): Bitmap {
    val existing = reusableBitmap
    if (existing != null && !existing.isRecycled && existing.width == width && existing.height == height) {
      return existing
    }
    existing?.recycle()
    return Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888).also {
      reusableBitmap = it
    }
  }

  private fun obtainBuffer(byteCount: Int): ByteBuffer {
    val existing = reusableBuffer
    if (existing != null && existing.capacity() >= byteCount) {
      existing.clear()
      existing.limit(byteCount)
      return existing
    }
    return ByteBuffer.allocateDirect(byteCount).order(ByteOrder.nativeOrder()).also {
      reusableBuffer = it
    }
  }

  @ReactMethod
  fun recognizeRgba(
    base64Rgba: String,
    width: Int,
    height: Int,
    orientation: String,
    mirrored: Boolean,
    promise: Promise,
  ) {
    if (width <= 0 || height <= 0 || base64Rgba.isEmpty()) {
      val empty = Arguments.createMap().apply {
        putBoolean("skipped", true)
      }
      promise.resolve(empty)
      return
    }

    // Drop frame immediately if MediaPipe is still processing the previous frame (~8-14ms)
    if (!busy.compareAndSet(false, true)) {
      val dropped = Arguments.createMap().apply {
        putBoolean("skipped", true)
      }
      promise.resolve(dropped)
      return
    }

    executor.execute {
      try {
        val decoded = Base64.decode(base64Rgba, Base64.NO_WRAP)
        val expectedBytes = width * height * 4
        if (decoded.size < expectedBytes) {
          val invalid = Arguments.createMap().apply {
            putBoolean("skipped", true)
          }
          promise.resolve(invalid)
          return@execute
        }

        val buffer = obtainBuffer(expectedBytes)
        buffer.put(decoded, 0, expectedBytes)
        buffer.rewind()

        val rawBitmap = obtainBitmap(width, height)
        rawBitmap.copyPixelsFromBuffer(buffer)

        val rotationDeg = when (orientation) {
          "right" -> 90f
          "down" -> 180f
          "left" -> 270f
          else -> 0f
        }

        val finalBitmap = if (rotationDeg != 0f || mirrored) {
          val matrix = Matrix().apply {
            if (rotationDeg != 0f) postRotate(rotationDeg)
            if (mirrored) postScale(-1f, 1f)
          }
          Bitmap.createBitmap(rawBitmap, 0, 0, rawBitmap.width, rawBitmap.height, matrix, false)
        } else {
          rawBitmap
        }

        val activeRecognizer = ensureRecognizer()
        val nowMs = SystemClock.uptimeMillis()
        val monotonicTs = if (nowMs > lastTimestampMs) nowMs else lastTimestampMs + 1L
        lastTimestampMs = monotonicTs

        val mpImage = BitmapImageBuilder(finalBitmap).build()
        val result = try {
          activeRecognizer.recognizeForVideo(mpImage, monotonicTs)
        } finally {
          mpImage.close()
          if (finalBitmap !== rawBitmap && !finalBitmap.isRecycled) {
            finalBitmap.recycle()
          }
        }

        val hands = result.gestures()
        var bestTargetName: String? = null
        var bestTargetScore = 0f
        var fallbackName = "None"
        var fallbackScore = 0f

        for (handCategories in hands) {
          for (cat in handCategories) {
            val name = cat.categoryName() ?: continue
            val score = cat.score()
            if (score > fallbackScore && name != "None") {
              fallbackName = name
              fallbackScore = score
            }
            if ((name == "Victory" || name == "Open_Palm") && score > bestTargetScore) {
              bestTargetName = name
              bestTargetScore = score
            }
          }
        }

        val out = Arguments.createMap().apply {
          putBoolean("skipped", false)
          putString("gesture", bestTargetName ?: fallbackName)
          putDouble("score", (if (bestTargetName != null) bestTargetScore else fallbackScore).toDouble())
          putInt("handCount", hands.size)
        }
        promise.resolve(out)
      } catch (e: Throwable) {
        Log.w(NAME, "Gesture frame inference error: ${e.message}")
        val errMap = Arguments.createMap().apply {
          putBoolean("skipped", false)
          putString("gesture", "None")
          putDouble("score", 0.0)
          putInt("handCount", 0)
          putString("error", e.message ?: "Inference error")
        }
        promise.resolve(errMap)
      } finally {
        busy.set(false)
      }
    }
  }

  @ReactMethod
  fun resetSession(promise: Promise) {
    executor.execute {
      try {
        recognizer?.close()
      } catch (_: Throwable) {
      } finally {
        recognizer = null
        initError = null
        promise.resolve(true)
      }
    }
  }

  override fun invalidate() {
    super.invalidate()
    executor.execute {
      try {
        recognizer?.close()
        recognizer = null
        reusableBitmap?.recycle()
        reusableBitmap = null
        reusableBuffer = null
      } catch (_: Throwable) {
      }
    }
  }

  companion object {
    const val NAME = "HandGestureModule"
    private const val MODEL_ASSET_NAME = "gesture_recognizer.task"
  }
}
