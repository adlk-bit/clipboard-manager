export const MAX_COPY_TEXT_LENGTH = 10000
export const TEXT_TRANSFORMS = ['trimLines', 'removeBlankLines', 'deduplicateLines', 'singleLine', 'uppercase', 'lowercase', 'formatJson', 'minifyJson'] as const
export type TextTransform = typeof TEXT_TRANSFORMS[number]
export type TextSeparator = 'newline' | 'blankLine' | 'comma' | 'tab'

const separators: Record<TextSeparator, string> = { newline: '\n', blankLine: '\n\n', comma: ', ', tab: '\t' }

function formatJson(text: string, pretty: boolean): string {
  JSON.parse(text) // Validate syntax, but never serialize parsed numbers or keys.
  const tokens = text.match(/"(?:\\.|[^"\\])*"|[{}\[\],:]|[^\s{}\[\],:]+/g) || []
  if (!pretty) return tokens.join('')
  let depth = 0
  let output = ''
  const newline = () => '\n' + '  '.repeat(depth)
  tokens.forEach((token, index) => {
    if (token === '{' || token === '[') {
      output += token
      depth += 1
      if (tokens[index + 1] !== '}' && tokens[index + 1] !== ']') output += newline()
    } else if (token === '}' || token === ']') {
      depth -= 1
      if (tokens[index - 1] !== '{' && tokens[index - 1] !== '[') output += newline()
      output += token
    } else if (token === ',') output += ',' + newline()
    else if (token === ':') output += ': '
    else output += token
  })
  return output
}

export function mergeText(items: readonly string[], separator: TextSeparator, reverse = false): string {
  return (reverse ? [...items].reverse() : items).join(separators[separator])
}

export function transformText(text: string, transform: TextTransform): string {
  const lines = text.split(/\r\n|\n|\r/)
  switch (transform) {
    case 'trimLines': return lines.map((line) => line.trim()).join('\n')
    case 'removeBlankLines': return lines.filter((line) => line.trim() !== '').join('\n')
    case 'deduplicateLines': return [...new Set(lines)].join('\n')
    case 'singleLine': return text.replace(/\s+/gu, ' ').trim()
    case 'uppercase': return text.toUpperCase()
    case 'lowercase': return text.toLowerCase()
    case 'formatJson': return formatJson(text, true)
    case 'minifyJson': return formatJson(text, false)
  }
}
