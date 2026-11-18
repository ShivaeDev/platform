---
"@shivaedev/build": minor
---

### Added

- `buildPlugin` and the fourth argument of `appViteConfig` take `oldFormFolders`, a list of folders, as paths or globs from the project's root, whose features are still on the old operation form. A file under a listed folder may import `query` or `command` and reach the browser bundle; the bundle check still follows its imports, so server code reached through it fails the build, and so does an old-form contract in a folder that is not listed. An application that set `bundleCheck: false` only because of its old-form contracts can list their folders instead and keep the check on for the features it has moved to `defineModule`. An entry whose folder the bundle no longer imports an old-form file from fails the build and names the entry. The option is temporary and goes away with the old operation form.
- `bundleCheck` from `@shivaedev/build/adapters/bundleCheck.ts` takes the same list as an optional second argument.

### Breaking

- `serverCodeIn` from `@shivaedev/build/serverCode.ts` reads `oldFormFolders` from its options and from each `BundleModule`. A caller that builds the graph itself passes `oldFormFolders: []` in both places; `buildPlugin`, `appViteConfig` and `bundleCheck` need no change.
