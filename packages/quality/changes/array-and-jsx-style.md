### Changed

- The Biome preset reports `useConsistentArrayType` and `useConsistentCurlyBraces` at error again. Their automatic fixes stay off: array shorthand can change locally defined types, and removing JSX string braces can change rendered text.
