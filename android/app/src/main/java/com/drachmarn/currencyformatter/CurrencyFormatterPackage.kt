package com.drachmarn.currencyformatter

import com.facebook.react.TurboReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

/**
 * Registers CurrencyFormatterModule as a TurboModule so the New Architecture
 * resolves it by name (`CurrencyFormatter`) and knows, ahead of time, that it
 * is a TurboModule rather than a legacy bridge module.
 */
class CurrencyFormatterPackage : TurboReactPackage() {

  override fun getModule(
    name: String,
    context: ReactApplicationContext,
  ): NativeModule? =
    if (name == CurrencyFormatterModule.NAME) {
      CurrencyFormatterModule(context)
    } else {
      null
    }

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider =
    ReactModuleInfoProvider {
      mapOf(
        CurrencyFormatterModule.NAME to
          ReactModuleInfo(
            CurrencyFormatterModule.NAME,
            CurrencyFormatterModule.NAME,
            false, // canOverrideExistingModule
            false, // needsEagerInit
            false, // isCxxModule
            true, // isTurboModule
          ),
      )
    }
}
