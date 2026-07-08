package com.drachmarn.currencyformatter

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.annotations.ReactModule
import java.text.NumberFormat
import java.util.Currency
import java.util.Locale

/**
 * Android parity for the CurrencyFormatter TurboModule — a real codegen module
 * extending the generated NativeCurrencyFormatterSpec (from
 * src/native/NativeCurrencyFormatter.ts), so the app is genuinely two-platform
 * rather than iOS-with-a-JS-fallback.
 *
 * java.util.Currency knows each currency's default fraction digits, so KRW/JPY/
 * VND come out with zero decimals and the right symbol — the same locale
 * correctness Foundation's NumberFormatter gives iOS.
 */
// NativeCurrencyFormatterSpec is codegen-generated into this package
// (codegenConfig.android.javaPackageName), so it needs no import.
@ReactModule(name = CurrencyFormatterModule.NAME)
class CurrencyFormatterModule(context: ReactApplicationContext) :
  NativeCurrencyFormatterSpec(context) {

  override fun getName(): String = NAME

  override fun format(amount: Double, currencyCode: String, promise: Promise) {
    try {
      val currency = Currency.getInstance(currencyCode.uppercase(Locale.ROOT))
      val formatter = NumberFormat.getCurrencyInstance().apply {
        this.currency = currency
        maximumFractionDigits = currency.defaultFractionDigits
        minimumFractionDigits = currency.defaultFractionDigits
      }
      promise.resolve(formatter.format(amount))
    } catch (error: IllegalArgumentException) {
      promise.reject("format_failed", "Could not format $amount as $currencyCode", error)
    }
  }

  companion object {
    const val NAME = "CurrencyFormatter"
  }
}
