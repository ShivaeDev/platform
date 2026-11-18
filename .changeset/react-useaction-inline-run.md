---
"@shivaedev/react": patch
---

### Changed

- `useAction(runtime, run)` with a `run` function written inline in the component fails its next render with an error that names `useAction`, says `run` is the action's identity and gives the fix: pass a bound command such as `api.rename.run`, or wrap the function in `useCallback` or `useMemo`. Such a component used to fail with React's `Too many re-renders`. Replacing a mounted control's command with another stable function works as before.
