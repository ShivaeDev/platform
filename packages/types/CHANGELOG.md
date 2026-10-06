# Changelog

## Unreleased

### Changed

- Build package JavaScript, declarations and source maps with TypeScript 7.

## 0.2.0 - 2026-10-04

### Changed

- Breaking: no root entry and no module that re-exports another. `exports` maps one `"./*.ts"` pattern to every module (`src` under the `source` condition, `dist` otherwise), so you import the module that defines a name, and a bundler sees only the modules you use. Where each name now lives:
  - `@shivaedev/types`: `@shivaedev/types/bivariant.ts` (`Bivariant`)

## 0.1.1 - 2026-10-04

### Changed

- Declares the `#*.ts` alias in the `imports` field of `package.json`, which resolves to `src` under the `source` condition and to `dist` otherwise.

## 0.1.0 - 2026-10-04

### Added

- `Bivariant<Fn>`, a function type that keeps method bivariance for a member written as a property, where a list must hold functions with different parameter types.
