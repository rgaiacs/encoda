/**
 * @module rpng
 */

import * as stencila from '@stencila/schema'
import fs from 'fs-extra'
import path from 'path'
import pngText from 'png-chunk-text'
import pngEncode from 'png-chunks-encode'
import pngExtract, { Chunk } from 'png-chunks-extract'
import punycode from 'punycode'
import { dump, Encode, EncodeOptions } from '../../index'
import * as puppeteer from '../../util/puppeteer'
import bundle from '../../util/bundle'
import * as vfile from '../../util/vfile'

// A vendor media type similar to https://www.iana.org/assignments/media-types/image/vnd.mozilla.apng
// an custom extension to be able to refere to this format more easily.
export const mediaTypes = ['vnd.stencila.rpng']
export const extNames = ['rpng']

/**
 * The keyword to use for the PNG chunk containing the JSON
 */
const KEYWORD = 'JSON'

/**
 * Find a text chunk in an image
 *
 * @param keyword The keyword for the text chunk
 * @param chunks The image chunks to search through
 */
export function find(
  keyword: string,
  chunks: Array<Chunk>
): [number, string | undefined] {
  let index = 0
  for (let chunk of chunks) {
    if (chunk.name === 'tEXt') {
      const entry = pngText.decode(chunk.data)
      if (entry.keyword === keyword) {
        return [index, punycode.decode(entry.text)]
      }
    }
    index += 1
  }
  return [-1, undefined]
}

/**
 * Does an image have a text chunk with the given keyword?
 *
 * @param keyword The keyword for the text chunk
 * @param image The image `Buffer`
 */
export function has(keyword: string, image: Buffer): boolean {
  const chunks: Array<Chunk> = pngExtract(image)
  const [index, text] = find(keyword, chunks)
  return text ? true : false
}

/**
 * Extract a text chunk from an image
 *
 * @param keyword The keyword for the text chunk
 * @param image The image `Buffer`
 */
export function extract(keyword: string, image: Buffer): string {
  const chunks: Array<Chunk> = pngExtract(image)
  const [index, text] = find(keyword, chunks)
  if (!text) throw Error('No chunk found')
  return text
}

/**
 * Insert a text chunk into an image
 *
 * @param keyword The keyword for the text chunk
 * @param text The text to insert
 * @param image The image to insert into
 */
export function insert(keyword: string, text: string, image: Buffer): Buffer {
  const chunks: Array<Chunk> = pngExtract(image)
  const [index, current] = find(keyword, chunks)
  if (current) chunks.splice(index, 1)
  const chunk = pngText.encode(keyword, punycode.encode(text))
  chunks.splice(-1, 0, chunk)
  return Buffer.from(pngEncode(chunks))
}

/**
 * Sniff a PNG file to see if it is an rPNG
 *
 * @param content The content to sniff (a file path)
 */
export async function sniff(content: string): Promise<boolean> {
  if (path.extname(content) === '.png') {
    if (await fs.pathExists(content)) {
      const contents = await fs.readFile(content)
      return has(KEYWORD, contents)
    }
  }
  return false
}

/**
 * Synchronous version of `sniff()`.
 *
 * @see sniff
 *
 * @param content The content to sniff (a file path)
 */
export function sniffSync(content: string): boolean {
  if (path.extname(content) === '.png') {
    if (fs.existsSync(content)) {
      const contents = fs.readFileSync(content)
      return has(KEYWORD, contents)
    }
  }
  return false
}

/**
 * Decode a rPNG to a Stencila node.
 *
 * This is done by extracting the JSON
 * from the `tEXt` chunk and parsing it.
 *
 * @param file The `VFile` to decode
 * @returns The Stencila node
 */
export async function decode(file: vfile.VFile): Promise<stencila.Node> {
  return decodeSync(file)
}

/**
 * Synchronous version of `decode()`.
 *
 * @see decode
 *
 * @param content The content to sniff (a file path).
 */
export function decodeSync(file: vfile.VFile): stencila.Node {
  if (Buffer.isBuffer(file.contents)) {
    const json = extract(KEYWORD, file.contents)
    return JSON.parse(json)
  }
  return {}
}

/**
 * Sniff and decode a file if it is a rPNG.
 *
 * This function is like combining `sniffSync()` and `decodeSync()`
 * but is faster because it only reads the file contents once.
 *
 * @param filePath The file path to sniff.
 */
export function sniffDecodeSync(filePath: string): stencila.Node | undefined {
  if (path.extname(filePath) === '.png') {
    if (fs.existsSync(filePath)) {
      const image = fs.readFileSync(filePath)
      const chunks: Array<Chunk> = pngExtract(image)
      const [index, json] = find(KEYWORD, chunks)
      if (json) return JSON.parse(json)
    }
  }
}

/**
 * Encode a Stencila node to a rPNG.
 *
 * This is done by dumping the node to HTML,
 * "screen-shotting" the HTML to a PNG and then inserting the
 * node's JSON into the image's `tEXt` chunk.
 *
 * @param node The Stencila node to encode
 * @param options Object containing settings for the encoder. See type
 * definition for Encode<EncodeRPNGOptions>
 */
export const encode: Encode = async (
  node: stencila.Node,
  options: EncodeOptions = {}
): Promise<vfile.VFile> => {
  const { filePath, isStandalone = false } = options

  const bundled = await bundle(node)
  const html = await dump(bundled, {
    ...options,
    isStandalone: true,
    format: 'html'
  })

  const page = await puppeteer.page()
  await page.setContent(
    `<div id="target" style="${
      isStandalone ? '' : 'display: inline-block; padding: 0.1rem'
    }">${html}</div>`,
    {
      waitUntil: 'networkidle0'
    }
  )

  const elem = await page.$('#target')
  if (!elem) throw new Error('Element not found!')

  const buffer = isStandalone
    ? await page.screenshot({
        encoding: 'binary',
        fullPage: true
      })
    : await elem.screenshot({
        encoding: 'binary'
      })

  await page.close()

  // Insert JSON of the thing into the image
  const json = JSON.stringify(node)
  const image = insert(KEYWORD, json, buffer)

  const file = vfile.load(image)
  if (filePath) {
    file.path = filePath
    await vfile.write(file, filePath)
  }

  return file
}
