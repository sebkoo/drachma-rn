// Bridge declaration for the Swift CurrencyFormatter module (classic module,
// served to JS through the New Architecture's interop layer).
#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE (CurrencyFormatter, NSObject)

RCT_EXTERN_METHOD(format:(double)amount
                  currencyCode:(NSString *)currencyCode
                  resolver:(RCTPromiseResolveBlock)resolver
                  rejecter:(RCTPromiseRejectBlock)rejecter)

@end
