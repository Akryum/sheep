import { execa } from 'execa'
import fs from 'fs-extra'
import glob from 'fast-glob'
import path from 'pathe'
import type { Package, PackageJson } from './types'

const ROOT_PKG_FILE = 'package.json'
const PACKAGES_GLOB = './packages/**/package.json'

/**
 * Discover all publishable packages in the workspace, including the root.
 *
 * Filters out private packages and scoped packages that aren't explicitly
 * marked public via `publishConfig.access`.
 */
export async function getPackages(cwd: string = process.cwd()): Promise<Package[]> {
  const lastTag = await getLastTag(cwd)

  const pkgFiles = await glob(path.join(cwd, PACKAGES_GLOB), {
    onlyFiles: true,
    ignore: ['**/node_modules/**'],
  })
  // Always consider the workspace root as the first candidate.
  pkgFiles.unshift(path.join(cwd, ROOT_PKG_FILE))

  const result = await Promise.all(
    pkgFiles.map(pkgFile => readPackage(pkgFile, cwd, lastTag)),
  )
  // Type predicate keeps the array statically narrowed to Package[].
  return result.filter((p): p is Package => p !== undefined)
}

/**
 * Read a single `package.json` and decide whether it should be released.
 * Returns undefined when the package is private or not publishable.
 */
async function readPackage(
  pkgFile: string,
  cwd: string,
  lastTag: string | null,
): Promise<Package | undefined> {
  const pkg = (await fs.readJSON(pkgFile)) as PackageJson
  if (!isPublishable(pkg)) return undefined

  const folder = path.dirname(pkgFile)
  const isRoot = folder === cwd
  return {
    path: folder,
    pkgFile,
    name: pkg.name as string, // narrowed by isPublishable
    version: pkg.version ?? '0.0.0',
    pkg,
    hasChanges: await hasPackageChanged(folder, lastTag, { cwd, isRoot }),
    isRoot,
  }
}

/**
 * A package is publishable when it has a name, isn't marked private, and
 * (for scoped packages) explicitly opts into public access.
 */
function isPublishable(pkg: PackageJson): boolean {
  if (pkg.private || !pkg.name) return false
  if (pkg.name.startsWith('@') && pkg.publishConfig?.access !== 'public') return false
  return true
}

/**
 * Return the most recent semver tag, or null when no tags exist.
 */
export async function getLastTag(cwd: string = process.cwd()): Promise<string | null> {
  try {
    const { stdout } = await execa('git', ['describe', '--tags', '--abbrev=0'], { cwd })
    return stdout
  }
  catch {
    return null
  }
}

/**
 * Determine whether a package directory has changes since the given tag.
 *
 * - For sub-packages we diff `<folder>/src` and `<folder>/package.json`.
 * - For the workspace root we diff everything outside `packages/` and
 *   `node_modules/`, so changes to root-level configs, scripts, README, etc.
 *   still trigger a release. (The previous behaviour only diffed `<root>/src`
 *   which rarely exists in a monorepo, so the root was effectively never
 *   detected as changed.)
 */
export async function hasPackageChanged(
  folder: string,
  lastTag: string | null,
  { cwd = process.cwd(), isRoot = false }: { cwd?: string, isRoot?: boolean } = {},
): Promise<boolean> {
  if (!lastTag) return true

  const pathArgs = isRoot
    ? ['.', ':(exclude)packages', ':(exclude)node_modules']
    : [path.join(folder, 'src'), path.join(folder, 'package.json')]

  const { stdout } = await execa(
    'git',
    ['diff', '--name-only', lastTag, '--', ...pathArgs],
    { cwd },
  )
  return !!stdout
}

/**
 * Persist every package's `package.json` back to disk.
 */
export async function writePackages(packages: Package[]): Promise<void> {
  await Promise.all(
    packages.map(({ pkgFile, pkg }) => fs.writeJSON(pkgFile, pkg, { spaces: 2 })),
  )
}
