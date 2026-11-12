import { createElement } from 'react'
import { jsx as reactJsx, jsxs as reactJsxs, Fragment } from 'react/jsx-runtime'
import { translate, useLanguage } from './language.js'

export { Fragment }

const elements = new Map()
const ignored = new Set(['script', 'style', 'code', 'pre'])
const displayAttributes = ['placeholder', 'title', 'aria-label', 'alt', 'aria-description']

function translateChildren(children, language) {
  if (typeof children === 'string') return translate(children, language)
  if (Array.isArray(children)) return children.map((child) => translateChildren(child, language))
  return children
}

function sourceText(children) {
  if (typeof children === 'string') return children
  if (Array.isArray(children)) return children.map(sourceText).join(' ')
  return children?.props ? sourceText(children.props.children) : ''
}

function localizedElement(tag) {
  if (!elements.has(tag)) {
    function LocalizedElement(props) {
      const language = useLanguage()
      if (props.translate === 'no' || ignored.has(tag)) return createElement(tag, props)
      const next = { ...props }
      // Validation identifies fields from their original labels, independently
      // of the display language. Never include input values in this metadata.
      if (tag === 'label') next['data-pms-source-text'] = sourceText(props.children)
      if (tag === 'input' || tag === 'textarea') {
        next['data-pms-source-placeholder'] = props.placeholder
        next['data-pms-source-label'] = props['aria-label']
      }
      for (const attribute of displayAttributes) {
        if (typeof next[attribute] === 'string') next[attribute] = translate(next[attribute], language)
      }
      // An option without an explicit value uses its text as the form value.
      // Preserve that original value while translating only the displayed label.
      if (tag === 'option' && next.value === undefined && typeof props.children === 'string') next.value = props.children
      next.children = tag === 'textarea' ? props.children : translateChildren(props.children, language)
      return createElement(tag, next)
    }
    LocalizedElement.displayName = `Localized(${tag})`
    elements.set(tag, LocalizedElement)
  }
  return elements.get(tag)
}

export function localizeType(type) {
  return typeof type === 'string' ? localizedElement(type) : type
}

export function jsx(type, props, key) { return reactJsx(localizeType(type), props, key) }
export function jsxs(type, props, key) { return reactJsxs(localizeType(type), props, key) }
