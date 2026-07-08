import Foundation

/// Locale-correct currency formatting, kept in Swift so the domain logic stays
/// on the native-strength side of the boundary. Foundation's NumberFormatter
/// knows that KRW/JPY/VND take zero decimals and which symbol each currency
/// uses — knowledge Hermes's partial Intl can't provide.
///
/// The TurboModule itself lives in CurrencyFormatter.mm: `getTurboModule`
/// returns a C++ `std::shared_ptr`, which Swift cannot express, so the module
/// boundary is Objective-C++ and forwards the actual work here. Domain logic
/// in Swift, the codegen conformance in ObjC++ — each language where it fits.
@objc(DRCurrencyFormatting)
final class CurrencyFormatting: NSObject {
  @objc(stringForAmount:currencyCode:)
  static func string(forAmount amount: Double, currencyCode: String) -> String? {
    let formatter = NumberFormatter()
    formatter.numberStyle = .currency
    formatter.currencyCode = currencyCode.uppercased()
    return formatter.string(from: NSNumber(value: amount))
  }
}
