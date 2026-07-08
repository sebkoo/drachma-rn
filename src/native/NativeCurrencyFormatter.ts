/**
 * TurboModule spec for the native currency formatter — the codegen contract.
 *
 * At build time, React Native's codegen turns this file into the typed native
 * interfaces both platforms implement (an Objective-C++ protocol on iOS, a
 * Kotlin abstract class on Android), so the JS↔native boundary is checked by
 * the compiler on every platform instead of trusted at runtime.
 *
 * We use `get` (nullable), not `getEnforcing`: the module is optional by
 * design. Where it is absent — Jest, or any future platform before its native
 * side lands — the JS wrapper falls back instead of throwing.
 */
import type {TurboModule} from 'react-native';
import {TurboModuleRegistry} from 'react-native';

export interface Spec extends TurboModule {
  /** Locale-correct currency string, e.g. (151445.37, 'KRW') → "₩151,445". */
  format(amount: number, currencyCode: string): Promise<string>;
}

export default TurboModuleRegistry.get<Spec>('CurrencyFormatter');
