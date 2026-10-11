### Changed

- Run Biome 2.5.15. It reports `useArraySortCompare`, `noBaseToString` and GritQL formatting findings that 2.5.14 missed, so an upgrading repository can see new findings. It no longer flags a regular expression's `.test(value)` call under `useValidTestTitle`, so the report bridge stops correcting that case itself.
