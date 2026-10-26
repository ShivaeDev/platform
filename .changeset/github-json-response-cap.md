---
"@shivaedev/effect-github": minor
---

### Added

- Configure JSON response caps with `GitHubConfig.responseByteLimit` or a trailing byte-limit argument on `read`, `list` and `write`, including their representation methods. The default remains 1 MiB; larger comparisons and listings can allow 16 MiB while retaining streaming size enforcement, typed `ResponseBodyTooLarge` failures and Schema decoding.
