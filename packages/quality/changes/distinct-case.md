### Added

- `files/distinct-case` reports two files or folders in one folder whose names, or the files they build to, differ only by case, such as `ReadingHistory.tsx` and `readingHistory.ts`. On macOS or Windows such a pair is one path, so a checkout or a build fails. A repository that upgrades records its existing findings with `quality baseline write --rule files/distinct-case`.
