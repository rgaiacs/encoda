/**
 * Compiler for LaTeX
 */

import stencila from '@stencila/schema'
import * as pandoc from './pandoc'
import { VFile } from './vfile'

export const mediaTypes = ['application/x-latex']

export const extNames = ['latex', 'tex']

export async function parse(file: VFile): Promise<stencila.Node> {
  return pandoc.parse(file, pandoc.InputFormat.latex)
}

export async function unparse(
  node: stencila.Node,
  filePath?: string
): Promise<VFile> {
  return pandoc.unparse(node, filePath, pandoc.OutputFormat.latex)
}
