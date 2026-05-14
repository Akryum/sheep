/**
 * User-facing options for the release command.
 */
export interface ReleaseOptions {
  /** dist-tag to use when publishing to npm (e.g. `next`, `beta`). */
  distTag?: string
  /** Required branch name; the release aborts if HEAD isn't on this branch. */
  expectedBranch?: string
  /** If true, skip the actual publish/commit/tag/push side effects. */
  dryRun?: boolean
  /** If true, bump packages even if they appear unchanged since the last tag. */
  force?: boolean
  /** Enable verbose debug output. */
  debug?: boolean
}

/**
 * Minimal shape of a `package.json` read from disk.
 *
 * Only fields the release logic actually reads are typed; everything else is
 * preserved at runtime but ignored by the type system.
 */
export interface PackageJson {
  name?: string
  version?: string
  private?: boolean
  dependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  publishConfig?: {
    access?: 'public' | 'restricted'
  }
  [key: string]: unknown
}

/**
 * A package discovered in the workspace that is a candidate for release.
 */
export interface Package {
  /** Absolute path to the package directory. */
  path: string
  /** Absolute path to the package's `package.json` file. */
  pkgFile: string
  /** Package name from `package.json`. */
  name: string
  /** Current version (kept in sync with `pkg.version`). */
  version: string
  /** Parsed `package.json` contents. */
  pkg: PackageJson
  /** True if the package has changed since the last released tag. */
  hasChanges: boolean
  /** True if this is the workspace root package. */
  isRoot: boolean
}
