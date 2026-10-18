### Changed

- Work Board serves its browser client in `/_board/react.js`; `/_board/native.js` is no longer served.

### Breaking

- Remove the repository-only `NATIVE_ROUTE`, `nativeAsset` and `checkNativeAsset` exports from `http/assets.ts`.
