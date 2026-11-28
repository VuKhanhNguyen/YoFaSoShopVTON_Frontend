package com.yofaso.shop.mediapipe

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

class HandGesturePackage : BaseReactPackage() {
  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
    if (name == HandGestureModule.NAME) HandGestureModule(reactContext) else null

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider =
    ReactModuleInfoProvider {
      mapOf(
        HandGestureModule.NAME to ReactModuleInfo(
          HandGestureModule.NAME,
          HandGestureModule::class.java.name,
          false,
          false,
          false,
          false,
        )
      )
    }
}
