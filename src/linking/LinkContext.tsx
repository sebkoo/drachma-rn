/**
 * Carries the parsed deep link to whatever screen wants it. The provider swap
 * and URL parsing stay at the composition root (App); screens read the link
 * from here rather than through navigation params, because it streams in over
 * time (getInitialURL, then every `url` event) rather than arriving once.
 */
import React, {createContext, useContext} from 'react';
import {ConvertLink} from './parseLink';

const LinkContext = createContext<ConvertLink | null>(null);

export function LinkScope(props: {
  link: ConvertLink | null;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <LinkContext.Provider value={props.link}>
      {props.children}
    </LinkContext.Provider>
  );
}

export function useConvertLink(): ConvertLink | null {
  return useContext(LinkContext);
}
