import { decode, encode } from './'
import { dump, load } from '../../util/vfile'

describe('encode', () => {
  test('Kitchen Sink', async () => {
    expect(await decode(await load(kitchenSink.md))).toEqual(kitchenSink.node)
  })

  test('Attributes', async () => {
    expect(await decode(await load(attrs.md))).toEqual(attrs.node)
  })

  test('Split Paragraphs', async () => {
    expect(await decode(await load(splitParas.from))).toEqual(splitParas.node)
  })
})

describe('encode', () => {
  test('', async () => {
    expect(await dump(await encode(kitchenSink.node))).toEqual(kitchenSink.md)
  })
  test('', async () => {
    expect(await dump(await encode(attrs.node))).toEqual(attrs.md)
  })

  test('', async () => {
    expect(await dump(await encode(emptyParas.node))).toEqual(emptyParas.to)
  })
  test('', async () => {
    expect(await dump(await encode(splitParas.node))).toEqual(splitParas.to)
  })
})

// An example intended for testing progressively added decoder/encoder pairs
const kitchenSink = {
  // Note: for bidi conversion, we're using expanded YAML frontmatter,
  // but most authors are likely to prefer using shorter variants e.g.
  //   - Joe James <joe@example.com>
  //   - Dr Jill Jones PhD
  // See other examples for this

  md: `---
title: Our article
authors:
  - type: Person
    givenNames:
      - Joe
    familyNames:
      - James
    emails:
      - joe@example.com
  - type: Person
    honorificPrefix: Dr
    givenNames:
      - Jill
    familyNames:
      - Jones
    honorificSuffix: PhD
---

# Heading one

## Heading two

### Heading three

A paragraph with _emphasis_, **strong**, ~~delete~~ and \`code\`.

A paragraph with [a _rich_ link](https://example.org).

A paragraph with !quote[quote](https://example.org).

A paragraph with an image ![alt text](https://example.org/image.png "title").

A paragraph with !true and !false boolean values.

A paragraph with a !null, a !number(42.2), an !array(1,2), and an !object(a:'1',b:'two').

> A block quote

\`\`\`python meta1 meta2=foo meta3="bar baz" meta4=qux
# A code block
x = {}
\`\`\`

chunk:
:::
\`\`\`r
# A code chunk
ans = 42
\`\`\`
:::

-   Unordered list item one
-   Unordered list item two
-   Unordered list item three

1.  Ordered list item one
2.  Ordered list item two
3.  Ordered list item three

-   [ ] First item
-   [x] Done
-   [ ] Not done

1.  [ ] One
2.  [x] Two
3.  [ ] Three

| A   | B   | C   |
| --- | --- | --- |
| 1   | 2   | 3   |
| 4   | 5   | 6   |

* * *
`,
  node: {
    type: 'Article',
    title: 'Our article',
    authors: [
      {
        type: 'Person',
        givenNames: ['Joe'],
        familyNames: ['James'],
        emails: ['joe@example.com']
      },
      {
        type: 'Person',
        honorificPrefix: 'Dr',
        givenNames: ['Jill'],
        familyNames: ['Jones'],
        honorificSuffix: 'PhD'
      }
    ],
    content: [
      {
        type: 'Heading',
        depth: 1,
        content: ['Heading one']
      },
      {
        type: 'Heading',
        depth: 2,
        content: ['Heading two']
      },
      {
        type: 'Heading',
        depth: 3,
        content: ['Heading three']
      },
      {
        type: 'Paragraph',
        content: [
          'A paragraph with ',
          {
            type: 'Emphasis',
            content: ['emphasis']
          },
          ', ',
          {
            type: 'Strong',
            content: ['strong']
          },
          ', ',
          {
            type: 'Delete',
            content: ['delete']
          },
          ' and ',
          {
            type: 'Code',
            value: 'code'
          },
          '.'
        ]
      },
      {
        type: 'Paragraph',
        content: [
          'A paragraph with ',
          {
            type: 'Link',
            target: 'https://example.org',
            content: [
              'a ',
              {
                type: 'Emphasis',
                content: ['rich']
              },
              ' link'
            ]
          },
          '.'
        ]
      },
      {
        type: 'Paragraph',
        content: [
          'A paragraph with ',
          {
            type: 'Quote',
            citation: 'https://example.org',
            content: ['quote']
          },
          '.'
        ]
      },
      {
        type: 'Paragraph',
        content: [
          'A paragraph with an image ',
          {
            type: 'ImageObject',
            contentUrl: 'https://example.org/image.png',
            title: 'title',
            text: 'alt text'
          },
          '.'
        ]
      },
      {
        type: 'Paragraph',
        content: ['A paragraph with ', true, ' and ', false, ' boolean values.']
      },
      {
        type: 'Paragraph',
        content: [
          'A paragraph with a ',
          null,
          ', a ',
          42.2,
          ', an ',
          [1, 2],
          ', and an ',
          { a: '1', b: 'two' },
          '.'
        ]
      },
      {
        type: 'QuoteBlock',
        content: [
          {
            type: 'Paragraph',
            content: ['A block quote']
          }
        ]
      },
      {
        type: 'CodeBlock',
        language: 'python',
        meta: {
          meta1: '',
          meta2: 'foo',
          meta3: 'bar baz',
          meta4: 'qux'
        },
        value: '# A code block\nx = {}'
      },
      {
        type: 'CodeChunk',
        programmingLanguage: 'r',
        text: '# A code chunk\nans = 42'
      },
      {
        type: 'List',
        order: 'unordered',
        items: [
          {
            type: 'ListItem',
            content: [
              {
                type: 'Paragraph',
                content: ['Unordered list item one']
              }
            ]
          },
          {
            type: 'ListItem',
            content: [
              {
                type: 'Paragraph',
                content: ['Unordered list item two']
              }
            ]
          },
          {
            type: 'ListItem',
            content: [
              {
                type: 'Paragraph',
                content: ['Unordered list item three']
              }
            ]
          }
        ]
      },
      {
        type: 'List',
        order: 'ascending',
        items: [
          {
            type: 'ListItem',
            content: [
              {
                type: 'Paragraph',
                content: ['Ordered list item one']
              }
            ]
          },
          {
            type: 'ListItem',
            content: [
              {
                type: 'Paragraph',
                content: ['Ordered list item two']
              }
            ]
          },
          {
            type: 'ListItem',
            content: [
              {
                type: 'Paragraph',
                content: ['Ordered list item three']
              }
            ]
          }
        ]
      },
      {
        type: 'List',
        order: 'unordered',
        items: [
          {
            type: 'ListItem',
            checked: false,
            content: [
              {
                type: 'Paragraph',
                content: ['First item']
              }
            ]
          },
          {
            type: 'ListItem',
            checked: true,
            content: [
              {
                type: 'Paragraph',
                content: ['Done']
              }
            ]
          },
          {
            type: 'ListItem',
            checked: false,
            content: [
              {
                type: 'Paragraph',
                content: ['Not done']
              }
            ]
          }
        ]
      },
      {
        type: 'List',
        order: 'ascending',
        items: [
          {
            type: 'ListItem',
            checked: false,
            content: [
              {
                type: 'Paragraph',
                content: ['One']
              }
            ]
          },
          {
            type: 'ListItem',
            checked: true,
            content: [
              {
                type: 'Paragraph',
                content: ['Two']
              }
            ]
          },
          {
            type: 'ListItem',
            checked: false,
            content: [
              {
                type: 'Paragraph',
                content: ['Three']
              }
            ]
          }
        ]
      },
      {
        type: 'Table',
        rows: [
          {
            type: 'TableRow',
            cells: [
              {
                content: ['A'],
                type: 'TableCell'
              },
              {
                content: ['B'],
                type: 'TableCell'
              },
              {
                content: ['C'],
                type: 'TableCell'
              }
            ]
          },
          {
            type: 'TableRow',
            cells: [
              {
                content: ['1'],
                type: 'TableCell'
              },
              {
                content: ['2'],
                type: 'TableCell'
              },
              {
                content: ['3'],
                type: 'TableCell'
              }
            ]
          },
          {
            type: 'TableRow',
            cells: [
              {
                content: ['4'],
                type: 'TableCell'
              },
              {
                content: ['5'],
                type: 'TableCell'
              },
              {
                content: ['6'],
                type: 'TableCell'
              }
            ]
          }
        ]
      },
      {
        type: 'ThematicBreak'
      }
    ]
  }
}

/**
 * Example for testing attributes on
 * `Link`, `Code` and `CodeBlock` nodes.
 */
const attrs = {
  md: `---
title: Our article
authors: []
---

A [link](url){attr1=foo attr2="bar baz" attr3}.

A \`code\`{lang=r}.

\`\`\`r attr1=foo attr2="bar baz" attr3
# A code block
\`\`\`
`,
  node: {
    type: 'Article',
    title: 'Our article',
    authors: [],
    content: [
      {
        type: 'Paragraph',
        content: [
          'A ',
          {
            type: 'Link',
            target: 'url',
            meta: {
              attr1: 'foo',
              attr2: 'bar baz',
              attr3: ''
            },
            content: ['link']
          },
          '.'
        ]
      },
      {
        type: 'Paragraph',
        content: [
          'A ',
          {
            type: 'Code',
            language: 'r',
            value: 'code'
          },
          '.'
        ]
      },
      {
        type: 'CodeBlock',
        language: 'r',
        meta: {
          attr1: 'foo',
          attr2: 'bar baz',
          attr3: ''
        },
        value: '# A code block'
      }
    ]
  }
}

// Example for testing that empty paragraphs
// are not represented in Markdown
const emptyParas = {
  to: `Paragraph one.

Paragraph three.

Paragraph five.
`,
  node: {
    type: 'Article',
    content: [
      {
        type: 'Paragraph',
        content: ['Paragraph one.']
      },
      {
        type: 'Paragraph',
        content: []
      },
      {
        type: 'Paragraph',
        content: ['Paragraph three.']
      },
      {
        type: 'Paragraph',
        content: ['']
      },
      {
        type: 'Paragraph',
        content: ['Paragraph five.']
      },
      {
        type: 'Paragraph',
        content: ['\n']
      }
    ]
  }
}

// Example for testing that paragraphs that are split
// across lines are decoded into a single line.
const splitParas = {
  from: `Line1\nline2\nline3\n`,
  to: `---\nauthors: []\ntitle: Untitled\n---\n\nLine1 line2 line3\n`,
  node: {
    type: 'Article',
    authors: [],
    title: 'Untitled',
    content: [
      {
        type: 'Paragraph',
        content: ['Line1 line2 line3']
      }
    ]
  }
}
