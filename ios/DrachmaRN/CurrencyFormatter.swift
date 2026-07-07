import Foundation
import React

/// Custom native module: locale-correct currency formatting via Foundation's
/// NumberFormatter. Hermes ships partial Intl, so the JS side can't know that
/// KRW/JPY/VND take zero decimal places or which symbol to use — iOS does.
/// The JS wrapper falls back gracefully where this module isn't present
/// (Android for now, and Jest).
@objc(CurrencyFormatter)
class CurrencyFormatter: NSObject {

  // No UIKit state — safe to initialize off the main thread.
  @objc static func requiresMainQueueSetup() -> Bool { false }

  @objc(format:currencyCode:resolver:rejecter:)
  func format(
    _ amount: Double,
    currencyCode: String,
    resolver: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    let formatter = NumberFormatter()
    formatter.numberStyle = .currency
    formatter.currencyCode = currencyCode.uppercased()
    guard let formatted = formatter.string(from: NSNumber(value: amount)) else {
      rejecter("format_failed", "Could not format \(amount) as \(currencyCode)", nil)
      return
    }
    resolver(formatted)
  }
}
