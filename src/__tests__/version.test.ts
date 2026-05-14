import { describe, expect, it } from 'vitest'
import {
  computeVersionChoices,
  isPartialRelease,
  selectPackagesToBump,
} from '../release/version'
import type { Package } from '../release/types'

describe('isPartialRelease', () => {
  it('returns true for patch bumps on 1.x', () => {
    expect(isPartialRelease('1.0.0', '1.0.1')).toBe(true)
  })

  it('returns true for minor bumps on 1.x', () => {
    expect(isPartialRelease('1.0.0', '1.1.0')).toBe(true)
  })

  it('returns false for major bumps on 1.x', () => {
    expect(isPartialRelease('1.0.0', '2.0.0')).toBe(false)
  })

  it('returns true for patch bumps on 0.x', () => {
    expect(isPartialRelease('0.1.0', '0.1.1')).toBe(true)
  })

  it('returns false for minor bumps on 0.x', () => {
    expect(isPartialRelease('0.1.0', '0.2.0')).toBe(false)
  })

  it('returns false for major bumps on 0.x', () => {
    expect(isPartialRelease('0.1.0', '1.0.0')).toBe(false)
  })

  it('returns true for prerelease bumps', () => {
    expect(isPartialRelease('1.0.0-beta.0', '1.0.0-beta.1')).toBe(true)
  })

  it('returns true when versions are equal (no diff)', () => {
    expect(isPartialRelease('1.0.0', '1.0.0')).toBe(true)
  })
})

describe('computeVersionChoices', () => {
  it('returns patch/minor/major for a stable version', () => {
    const choices = computeVersionChoices('1.2.3')
    expect(choices).toEqual([
      { type: 'patch', version: '1.2.4' },
      { type: 'minor', version: '1.3.0' },
      { type: 'major', version: '2.0.0' },
    ])
  })

  it('includes prerelease bumps when the current version is a prerelease', () => {
    const choices = computeVersionChoices('1.2.3-beta.0')
    expect(choices.map(c => c.type)).toEqual([
      'patch',
      'minor',
      'major',
      'prepatch',
      'preminor',
      'premajor',
      'prerelease',
    ])
  })
})

describe('selectPackagesToBump', () => {
  /** Factory that builds a minimal Package shape for tests. */
  const pkg = (name: string, hasChanges: boolean, isRoot = false): Package => ({
    path: `/${name}`,
    pkgFile: `/${name}/package.json`,
    name,
    version: '1.0.0',
    pkg: { name, version: '1.0.0' },
    hasChanges,
    isRoot,
  })

  it('returns every package on a full release', () => {
    const packages = [pkg('a', false), pkg('b', false)]
    expect(selectPackagesToBump(packages, false, false)).toEqual(packages)
  })

  it('returns only changed packages on a partial release', () => {
    const a = pkg('a', true)
    const b = pkg('b', false)
    expect(selectPackagesToBump([a, b], true, false)).toEqual([a])
  })

  it('returns every package on a partial release when force=true', () => {
    const a = pkg('a', false)
    const b = pkg('b', false)
    expect(selectPackagesToBump([a, b], true, true)).toEqual([a, b])
  })

  it('returns an empty array on a partial release with no changes', () => {
    const packages = [pkg('a', false), pkg('b', false)]
    expect(selectPackagesToBump(packages, true, false)).toEqual([])
  })
})
