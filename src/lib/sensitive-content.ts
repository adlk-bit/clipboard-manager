export type SensitiveKind = 'phone' | 'id-card' | 'email' | 'bank-card' | 'secret'

export interface SensitivePreview {
  text: string
  kinds: SensitiveKind[]
  isSensitive: boolean
}

const MASK = '•'

function maskCharacters(value: string, prefixLength: number, suffixLength: number): string {
  if (value.length <= prefixLength + suffixLength) return MASK.repeat(Math.max(value.length, 4))
  const hiddenLength = Math.min(Math.max(value.length - prefixLength - suffixLength, 4), 10)
  return `${value.slice(0, prefixLength)}${MASK.repeat(hiddenLength)}${value.slice(value.length - suffixLength)}`
}

function maskDigits(value: string, prefixDigits: number, suffixDigits: number): string {
  const digitCount = (value.match(/\d/g) || []).length
  let digitIndex = 0
  return value.replace(/\d/g, (digit) => {
    const visible = digitIndex < prefixDigits || digitIndex >= digitCount - suffixDigits
    digitIndex += 1
    return visible ? digit : MASK
  })
}

function passesLuhnCheck(value: string): boolean {
  const digits = value.replace(/\D/g, '')
  if (digits.length < 13 || digits.length > 19) return false

  let sum = 0
  let shouldDouble = false
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = Number(digits[index])
    if (shouldDouble) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
    shouldDouble = !shouldDouble
  }
  return sum % 10 === 0
}

export function maskSensitivePreview(value: string): SensitivePreview {
  const kinds = new Set<SensitiveKind>()
  let text = value

  const mark = (kind: SensitiveKind) => kinds.add(kind)

  text = text.replace(
    /\b(password|passwd|pwd|token|secret|api[\s_-]?key|access[\s_-]?key|authorization)(\s*[:=]\s*)(["']?)([A-Za-z0-9_./+~-]{4,})(["']?)/gi,
    (_match, label: string, separator: string, openingQuote: string, secret: string, closingQuote: string) => {
      mark('secret')
      const quote = openingQuote && closingQuote === openingQuote ? openingQuote : ''
      return `${label}${separator}${quote}${maskCharacters(secret, 0, 2)}${quote}`
    }
  )

  text = text.replace(/\b(Bearer\s+)([A-Za-z0-9._~+/=-]{8,})/gi, (_match, prefix: string, secret: string) => {
    mark('secret')
    return `${prefix}${maskCharacters(secret, 0, 3)}`
  })

  text = text.replace(/\bAKIA[0-9A-Z]{16}\b/g, (secret) => {
    mark('secret')
    return maskCharacters(secret, 4, 4)
  })

  text = text.replace(/\b([A-Z0-9._%+-]+)@([A-Z0-9.-]+\.[A-Z]{2,})\b/gi, (_match, localPart: string, domain: string) => {
    mark('email')
    const visible = localPart.length > 1 ? 2 : 0
    return `${maskCharacters(localPart, visible, 0)}@${domain}`
  })

  text = text.replace(/(^|[^\d])((?:\+?86[-\s]?)?1[3-9]\d{9})(?!\d)/g, (_match, boundary: string, phone: string) => {
    mark('phone')
    const internationalPrefixDigits = phone.replace(/\D/g, '').length > 11 ? 2 : 0
    return `${boundary}${maskDigits(phone, internationalPrefixDigits + 3, 4)}`
  })

  text = text.replace(/(^|[^\d])(\d{17}[\dXx])(?![\dXx])/g, (_match, boundary: string, idCard: string) => {
    mark('id-card')
    return `${boundary}${maskCharacters(idCard, 3, 4)}`
  })

  text = text.replace(/(^|[^\d])((?:\d[ -]?){12,18}\d)(?!\d)/g, (_match, boundary: string, card: string) => {
    if (!passesLuhnCheck(card)) return `${boundary}${card}`
    mark('bank-card')
    return `${boundary}${maskDigits(card, 4, 4)}`
  })

  return {
    text,
    kinds: [...kinds],
    isSensitive: kinds.size > 0,
  }
}
