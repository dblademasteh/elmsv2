import { fileNameFromUrl, safeExternalUrl } from '../urls'

describe('safeExternalUrl', () => {
  it('accepts absolute http and https URLs', () => {
    expect(safeExternalUrl('https://example.com/work.zip')).toBe('https://example.com/work.zip')
    expect(safeExternalUrl('http://example.com/work.zip')).toBe('http://example.com/work.zip')
  })

  it('accepts a root-relative same-origin path', () => {
    expect(safeExternalUrl('/uploads/deadbeef.zip')).toBe('/uploads/deadbeef.zip')
  })

  it('trims surrounding whitespace', () => {
    expect(safeExternalUrl('  https://example.com/x.zip  ')).toBe('https://example.com/x.zip')
  })

  it.each([
    ['javascript:alert(document.cookie)'],
    ['JaVaScRiPt:alert(1)'],
    ['java\nscript:alert(1)'],
    ['java\tscript:alert(1)'],
    ['data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=='],
    ['file:///etc/passwd'],
    ['vbscript:msgbox(1)'],
    ['ftp://example.com/secret.txt'],
    ['//evil.example/payload.exe'],
    ['/\\evil.example/payload.exe'],
  ])('rejects %j', (url) => {
    expect(safeExternalUrl(url)).toBeNull()
  })

  it('returns null for an empty value', () => {
    expect(safeExternalUrl('')).toBeNull()
    expect(safeExternalUrl('   ')).toBeNull()
    expect(safeExternalUrl(null)).toBeNull()
    expect(safeExternalUrl(undefined)).toBeNull()
  })
})

describe('fileNameFromUrl', () => {
  it('takes the last path segment', () => {
    expect(fileNameFromUrl('https://example.com/path/work.zip')).toBe('work.zip')
  })

  it('ignores the query string', () => {
    expect(fileNameFromUrl('https://example.com/work.zip?token=abc')).toBe('work.zip')
  })

  it('falls back when there is nothing to use', () => {
    expect(fileNameFromUrl('')).toBe('submission')
    expect(fileNameFromUrl('https://example.com/')).toBe('submission')
  })
})
