/**
 * @module dir
 */

import { getLogger } from '@stencila/logga'
import stencila from '@stencila/schema'
import { range } from 'fp-ts/lib/Array'
import fs from 'fs-extra'
import globby from 'globby'
import path from 'path'
import tempy from 'tempy'
// @ts-ignore
import unixify from 'unixify'
import { Encode, EncodeOptions, read, write } from '../..'
import { isCreativeWork } from '../../util'
import * as vfile from '../../util/vfile'

const log = getLogger('encoda:dir')

export const mediaTypes = []

export const extNames = ['dir']

interface DirDecodeOptions {
  /**
   * Minimatch patterns to use to select only some of the included
   * files. Defaults to `['**/ /*']` (i.e. everything, including in
   * nested directories)
   */
  patterns?: string[]

  /**
   * The file base names (i.e. without extension) that should
   * be considered to be the "main" file in a directory.
   * Defaults to `['main', 'index', 'README']`
   */
  mainNames?: string[]
}

/**
 * Decode a directory into a Stencila `Collection`, that may include
 * other `CreativeWork`s, such as `Article`s or other `Collection`s.
 */
export async function decode(
  file: vfile.VFile,
  options: DirDecodeOptions = {}
): Promise<stencila.Collection> {
  const patterns = options.patterns || ['**/*']
  const mainNames = options.mainNames || ['main', 'index', 'README']

  const root: stencila.Collection = {
    type: 'Collection',
    parts: []
  }

  const dirPath = file.path
  if (!dirPath) {
    log.error('Path to a directory is required')
    return root
  }

  const stat = await fs.stat(dirPath)
  if (!stat.isDirectory()) {
    log.error('Path is not a directory')
    return root
  }

  const { name } = path.parse(dirPath)
  root.name = name

  // Get a list of matching files
  const filePaths = await globby(patterns, {
    cwd: dirPath
  })

  // Decompose file paths into parts so that they
  // can be sorted by depth AND name
  const routes = filePaths
    .map(filePath => unixify(filePath).split('/'))
    .sort((a, b) => {
      return (
        a.length - b.length || a[a.length - 1].localeCompare(b[b.length - 1])
      )
    })

  // Read files into nodes in parallel
  const nodes = (await Promise.all(
    routes.map(async route => {
      const node = await read(path.join(dirPath, ...route))
      if (isCreativeWork(node)) {
        const { name } = path.parse(route[route.length - 1])
        return { route, node: { name, ...node } }
      }
    })
  ))
    // Remove files that were not decoded as creative works
    // (using reduce instead of filter to keep Typescript happy)
    .reduce(
      (prev: { route: string[]; node: stencila.CreativeWork }[], curr) =>
        curr ? [...prev, curr] : prev,
      []
    )

  // Organize nodes into nested collections of CreativeWorks
  const collections = new Map<string, stencila.Collection>()
  collections.set('', root)
  for (const { route, node } of nodes) {
    let parent = root
    for (const depth of range(0, route.length - 2)) {
      const level = route.slice(0, depth + 1).join('/')
      let collection = collections.get(level)
      if (!collection) {
        collection = {
          type: 'Collection',
          name: route[depth],
          parts: []
        }
        collections.set(level, collection)
        parent.parts.push(collection)
      }
      parent = collection
    }
    parent.parts.push(node)
  }

  // For each collection determine the main node, if any
  mainNames.reverse()
  for (const collection of collections.values()) {
    const rankings = collection.parts
      .map((node, index) => ({
        which: index,
        rank: mainNames.indexOf(node.name || '')
      }))
      .filter(item => item.rank > -1)
      .sort((a, b) => b.rank - a.rank)
    const first = rankings[0]
    if (first) {
      collection.parts[first.which].meta = {
        main: true
      }
    }
  }

  return root
}

interface DirEncodeOptions {
  /**
   * The format to decode parts of the `Collection` as.
   * Defaults to `html`.
   */
  format?: string
}

export const encode: Encode<DirEncodeOptions> = async (
  node: stencila.Node,
  options: EncodeOptions<DirEncodeOptions> = {}
): Promise<vfile.VFile> => {
  const dirPath = options.filePath || tempy.directory()
  const format = options.format || 'html'

  // Wrap to a collection as necessary
  const cw: stencila.CreativeWork = isCreativeWork(node)
    ? node
    : { type: 'Article', content: [node] }

  const coll: stencila.Collection =
    cw.type === 'Collection'
      ? (node as stencila.Collection)
      : { type: 'Collection', parts: [cw] }

  // Create a flattened list of nodes and their routes
  const nodes = walk(coll)
  function walk(
    node: stencila.CreativeWork,
    route: string[] = []
  ): {
    route: string[]
    node: stencila.CreativeWork
  }[] {
    if (node.type === 'Collection') {
      const coll = node as stencila.Collection
      return coll.parts
        .map(child => walk(child, [...route, node.name || '']))
        .reduce((prev, curr) => [...prev, ...curr], [])
    } else {
      return [
        {
          route: [...route, node.name || 'unnamed'],
          node
        }
      ]
    }
  }

  // Ensure all the necessary directories are made
  // TODO: this could be optimized to avoid lots of ensureDir calls
  for (const node of nodes) {
    const routePath = path.join(dirPath, ...node.route.slice(1, -1))
    await fs.ensureDir(routePath)
  }

  // Generate the output file in 'parallel'
  await Promise.all(
    nodes.map(async ({ route, node }) => {
      const fileName =
        node.meta && node.meta.main
          ? 'index.html'
          : route[route.length - 1] + '.html'
      const filePath = path.join(dirPath, ...route.slice(1, -1), fileName)
      return await write(node, filePath)
    })
  )

  return vfile.create(dirPath)
}
