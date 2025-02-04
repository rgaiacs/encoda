/**
 * @module txt
 */

import stencila from '@stencila/schema'
import { Encode } from '../..'
import * as vfile from '../../util/vfile'

/**
 * Media types that this codec can decode/encode.
 */
export const mediaTypes = ['text/plain']

/**
 * File extension names that this codec will match.
 */
export const extNames = ['txt', 'text']

/**
 * Decode a `VFile` with text content to a primitive node.
 *
 * @param file The `VFile` to decode
 * @returns A promise that resolves to a Stencila `Node`
 */
export async function decode(
  file: vfile.VFile
): Promise<null | boolean | number | string> {
  const content = await vfile.dump(file)
  if (content === 'null') return null
  if (content === 'true') return true
  if (content === 'false') return false
  if (/^-?\d+\.?\d*$/.test(content)) return parseFloat(content)
  return content
}

/**
 * Encode a Stencila `Node` to a `VFile` with text content.
 *
 * @param node The Stencila `Node` to encode
 * @returns A promise that resolves to a `VFile`
 */
export const encode: Encode = async (
  node: stencila.Node
): Promise<vfile.VFile> => {
  const encode = (node: stencila.Node): string => {
    if (node === null) return 'null'
    if (typeof node === 'string') return node
    if (Array.isArray(node)) return node.map(node => encode(node)).join(' ')
    if (typeof node == 'object')
      return Object.entries(node)
        .map(([key, value]) => `${key} ${encode(value)}`)
        .join(' ')
    return node.toString()
  }
  return vfile.load(encode(node))
}
