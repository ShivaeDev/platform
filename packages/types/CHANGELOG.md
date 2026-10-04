# Changelog

## 0.1.1 - 2026-10-04

### Changed

- Declares the `#*.ts` alias in the `imports` field of `package.json`, which resolves to `src` under the `source` condition and to `dist` otherwise.

## 0.1.0 - 2026-10-04

### Added

- `Bivariant<Fn>`, a function type that keeps method bivariance for a member written as a property, where a list must hold functions with different parameter types.
