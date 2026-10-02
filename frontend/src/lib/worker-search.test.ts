import { describe, expect, it } from 'vitest'
import { hasMoreResults, searchStatus, SEARCH_STATUS_TEXT } from './worker-search'

const base = { textLength: 3, searching: false, failed: false, found: 2, offered: 1 }

describe('searchStatus', () => {
  it('asks for more letters while the text is short', () => {
    expect(searchStatus({ ...base, textLength: 1 })).toBe('short')
  })

  it('says it is searching while the text typed is ahead of the search', () => {
    expect(searchStatus({ ...base, searching: true })).toBe('searching')
  })

  it('shows the error of the search', () => {
    expect(searchStatus({ ...base, failed: true })).toBe('failed')
  })

  it('says "no results" only when the search returned nothing', () => {
    expect(searchStatus({ ...base, found: 0, offered: 0 })).toBe('none')
  })

  it('says everything found is already chosen when the search returned workers but none can be offered', () => {
    expect(searchStatus({ ...base, found: 3, offered: 0 })).toBe('taken')
  })

  it('has no status when there is something to offer', () => {
    expect(searchStatus(base)).toBeNull()
  })

  it('has a text for each status', () => {
    expect(SEARCH_STATUS_TEXT.none).toBe('Sin resultados')
    expect(SEARCH_STATUS_TEXT.taken).toBe('Ya están elegidos')
  })
})

describe('hasMoreResults', () => {
  it('is true when the API has more workers than the page it sent', () => {
    expect(hasMoreResults(20, 8)).toBe(true)
  })

  it('is false when the page holds everything', () => {
    expect(hasMoreResults(8, 8)).toBe(false)
    expect(hasMoreResults(0, 0)).toBe(false)
  })
})
