---
"@shivaedev/react": minor
---

### Fixed

- Keep mounted action controls pending when their command changes until the outgoing request settles. Show only the current command's result, data and cause for both native-atom and runtime actions.

### Breaking

- The runtime overload of `useAction` uses its `run` function as the command identity. Pass the stable bound command function directly, or memoize a wrapper with `useCallback` or `useMemo`, so rerenders of the same command retain its state. Completion callbacks still use the latest committed props.
