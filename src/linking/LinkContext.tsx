/**
 * Carries the parsed deep link to whatever screen wants it, and a way to set a
 * convert pair from anywhere. The URL parsing and provider swap stay at the
 * composition root (App); screens read the link here rather than through
 * navigation params, because it streams in over time (getInitialURL, then every
 * `url` event) rather than arriving once.
 *
 * `applyConvert` is the seam the WebView bridge writes to — a tap inside the web
 * explainer drives the exact same converter state a deep link does.
 */
import React, {createContext, useContext} from 'react';
import {ConvertLink} from './parseLink';

interface LinkContextValue {
  link: ConvertLink | null;
  applyConvert: (from: string, to: string) => void;
}

const LinkContext = createContext<LinkContextValue>({
  link: null,
  applyConvert: () => {},
});

export function LinkScope(props: {
  link: ConvertLink | null;
  onConvert: (from: string, to: string) => void;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <LinkContext.Provider value={{link: props.link, applyConvert: props.onConvert}}>
      {props.children}
    </LinkContext.Provider>
  );
}

export function useConvertLink(): ConvertLink | null {
  return useContext(LinkContext).link;
}

export function useApplyConvert(): (from: string, to: string) => void {
  return useContext(LinkContext).applyConvert;
}
