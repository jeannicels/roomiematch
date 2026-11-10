// Demo build only: React's UMD files have no JSX runtime, so this maps JSX onto createElement.
import { createElement, Fragment, type ElementType } from 'react';

export { Fragment };
export const jsx = (type: ElementType, props: Record<string, unknown>, key?: string) =>
  createElement(type, key === undefined ? props : { ...props, key });
export const jsxs = jsx;
