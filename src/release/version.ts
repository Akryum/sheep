import pc from 'picocolors'
import prompts from 'prompts'
import semver from 'semver'
import type { Package } from './types'

/**
 * A version-bump choice presented to the user.
 */
export interface VersionChoice {
  /** Semver release type (e.g. 'patch', 'minor'). */
  type: semver.ReleaseType
  /** Resulting version string after applying the bump. */
  version: string
}

/**
 * Compute the list of automatic version-bump choices for a given version.
 *
 * Prerelease bump types are only included when the current version is itself
 * a prerelease.
 */
export function computeVersionChoices(oldVersion: string): VersionChoice[] {
  const prerelease = semver.prerelease(oldVersion)
  const preId = prerelease && prerelease[0]

  const types: semver.ReleaseType[] = [
    'patch',
    'minor',
    'major',
    ...(preId
      ? (['prepatch', 'preminor', 'premajor', 'prerelease'] as semver.ReleaseType[])
      : []),
  ]
  return types.map(type => ({
    type,
    version: semver.inc(oldVersion, type) ?? oldVersion,
  }))
}

/**
 * Determine whether bumping from `oldVersion` to `newVersion` is a "partial"
 * release where only changed packages need to be bumped.
 *
 * - For 0.x versions, only patch/prepatch/prerelease bumps are partial.
 * - For 1.x+ versions, minor and patch bumps (and their pre-variants) are
 *   also partial.
 * - Equal versions are treated as partial (no full-tree bump warranted).
 */
export function isPartialRelease(oldVersion: string, newVersion: string): boolean {
  const diff = semver.diff(oldVersion, newVersion)
  // semver.diff returns null when versions are identical.
  if (!diff) return true

  if (semver.major(newVersion) === 0) {
    return ['patch', 'prepatch', 'prerelease'].includes(diff)
  }
  return ['minor', 'preminor', 'patch', 'prepatch', 'prerelease'].includes(diff)
}

/**
 * Decide which packages should receive the version bump.
 *
 * On a full release, every package is bumped. On a partial release only
 * packages with detected changes are bumped, unless `force` is true.
 */
export function selectPackagesToBump(
  packages: Package[],
  partial: boolean,
  force: boolean,
): Package[] {
  if (!partial || force) return packages.slice()
  return packages.filter(p => p.hasChanges)
}

/** Sentinel value used to distinguish the "Custom" choice in the prompt. */
const CUSTOM_VERSION_SENTINEL = '_custom'

/**
 * Prompt the user to select a new version, offering automatic semver bumps
 * and a "Custom" entry. Exits the process if the user cancels confirmation.
 */
export async function selectNewVersion(oldVersion: string): Promise<string> {
  const choices = computeVersionChoices(oldVersion)

  const responses = await prompts([
    {
      name: 'newVersion',
      type: 'select',
      message: 'Select new version',
      choices: [
        ...choices.map(c => ({ title: `${c.type} (${c.version})`, value: c.version })),
        { title: 'Custom', value: CUSTOM_VERSION_SENTINEL },
      ],
    },
    {
      name: 'customVersion',
      type: prev => (prev === CUSTOM_VERSION_SENTINEL ? 'text' : null),
      message: 'Enter new custom version',
      validate: value => {
        if (value === '') return 'Version is required'
        if (!semver.valid(value)) return 'Invalid version'
        return true
      },
    },
    {
      name: 'confirm',
      type: 'confirm',
      message: (_prev, values) =>
        `Confirm new version: ${values.customVersion || values.newVersion}`,
    },
  ])

  if (!responses.confirm) {
    console.log(pc.red('Aborted!'))
    process.exit(1)
  }

  return responses.customVersion ?? responses.newVersion
}
