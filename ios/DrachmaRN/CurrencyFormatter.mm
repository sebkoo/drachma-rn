// The iOS side of the CurrencyFormatter TurboModule.
//
// codegen (from src/native/NativeCurrencyFormatter.ts) generates the
// NativeCurrencyFormatterSpec protocol and its JSI class; this ObjC++ module
// conforms to that spec and wires the JSI. It must be Objective-C++ (.mm),
// not .m: `getTurboModule` returns a C++ std::shared_ptr the New Architecture
// needs, and the actual formatting is done by the Swift CurrencyFormatting
// helper — native depth in Swift, codegen boundary in ObjC++.
#import <React/RCTBridgeModule.h>
#import <DrachmaRNSpec/DrachmaRNSpec.h>

// Minimal forward declaration of the Swift helper (CurrencyFormatter.swift,
// exposed to ObjC as DRCurrencyFormatting). We deliberately do NOT import the
// target umbrella "DrachmaRN-Swift.h": that header drags in every @objc Swift
// class in the app — including AppDelegate's ReactNativeDelegate, whose React
// superclass isn't visible here — and would fail to compile. Declaring just
// the one method we call keeps this module self-contained; the Swift symbol
// links from the same target at build time.
@interface DRCurrencyFormatting : NSObject
+ (nullable NSString *)stringForAmount:(double)amount
                          currencyCode:(NSString *)currencyCode;
@end

@interface CurrencyFormatter : NSObject <NativeCurrencyFormatterSpec>
@end

@implementation CurrencyFormatter

RCT_EXPORT_MODULE()

- (void)format:(double)amount
  currencyCode:(NSString *)currencyCode
       resolve:(RCTPromiseResolveBlock)resolve
        reject:(RCTPromiseRejectBlock)reject
{
  NSString *formatted = [DRCurrencyFormatting stringForAmount:amount
                                                 currencyCode:currencyCode];
  if (formatted != nil) {
    resolve(formatted);
  } else {
    reject(@"format_failed",
           [NSString stringWithFormat:@"Could not format %g as %@", amount, currencyCode],
           nil);
  }
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeCurrencyFormatterSpecJSI>(params);
}

@end
