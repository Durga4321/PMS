import { jsxDEV as reactJsxDEV } from 'react/jsx-dev-runtime'
import { localizeType } from './jsx-runtime.js'

export { Fragment } from 'react/jsx-runtime'
export function jsxDEV(type, props, key, isStaticChildren, source, self) {
  return reactJsxDEV(localizeType(type), props, key, isStaticChildren, source, self)
}
