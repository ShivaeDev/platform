# Roadmap

## Built

- [x] `make` derives encoded field state and decoded submission from `Schema.Struct`, with supplied atom-runtime services and typed result atoms.
- [x] Invalid submission reveals schema messages without calling the handler. Field rejections clear when input changes, and a late rejection does not attach to newer input.
- [x] `errorAt` reads nested Schema messages under a top-level field, including array entries, while field state stays top-level; `src/nestedErrors.spec.ts` covers independent messages and touch/submission visibility.
- [x] Tuple handler rejections share `errorAt`, with typed `arrayKeys` selectors keeping rejections with top-level array elements through insertion, removal, reorder and late save responses. `src/arrayErrors.spec.ts` and `src/arrayRejectionRaces.spec.ts` cover core behavior; `effect-react/src/arrayErrors.dom.spec.tsx` covers rendered element messages.
- [x] Encoded literal choices, including fields whose codec decodes to another type, and `emptyAsNull` for nullable domain values.
- [x] Debounced field checks show completed feedback only for their current input and use services from the supplied runtime.
- [x] Per-field received-value merging, optional-key removal, dirty state and explicit revert to the latest baseline.
- [x] Successful submission accepts its captured encoded values, retains edits made while saving, and preserves a refresh received during the save as the baseline.
- [x] Optional `useField`, `useSubmit` and `useDirty` hooks over the same form. React composition is exercised by the `effect-react` order and invoice-line fixtures.
- [x] Packed type fixtures check encoded input types, decoded handler values, field names and React field types.

## Next

Resolve the supported helper surface before planning additional form APIs. Nested values remain edited through top-level fields; error paths and optional top-level array keys provide element feedback.

Cross-package validation, host lifecycle and application adoption planning live in the [framework roadmap](https://github.com/ShivaeDev/platform/blob/main/docs/framework/roadmap.md). This roadmap owns form capabilities and form scope decisions.

## Open questions

- Is accepting encoded input while leaving normalized row receipt to the caller the enduring division between this package and `effect-react`? The form retains submitted input; the higher-level editor receives the saved row.
- The explicit export map exposes draft, message, path, status and rejection helpers as well as the application entry points. Which of those helpers should be treated as supported application API?
- Should independently editable nested fields or keys for arrays nested inside elements extend the present top-level editing model?
