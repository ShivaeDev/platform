### Changed

- The React shell browser modules ship only inside the prebuilt bundles and are not importable from the package. Keep the router, UI helpers, icons, React atoms and Platform React/form adapters in development dependencies so installing the Board does not install them. The native bundle entry, session, reconciliation and form helpers are also excluded from package exports; the native client, document view and shared schemas remain available. Packed consumers start the command and serve both browser bundles without installing the bundle-only libraries.

### Added

- `checkBrowserAssets()` in `http/assets.ts` checks the native and React browser assets and logs each missing asset's build hint through Effect at startup. `checkNativeAsset()` retains its native-only check.

### Fixed

- Missing `assets/react.js` and `assets/react.css` return the build command in a plain-text HTTP 500 response, like `assets/native.js`. Building the assets restores serving without restarting the Board.
