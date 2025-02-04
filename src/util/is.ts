/**
 * @module util
 */

import type from './type'

/**
 * Is a node of a particular type or types
 *
 * @param node The node to check
 * @param types The type names to check against
 */
export default function is(node: any, types: string | string[]): boolean {
  if (typeof types === 'string') return type(node) === types
  else return types.includes(type(node))
}
