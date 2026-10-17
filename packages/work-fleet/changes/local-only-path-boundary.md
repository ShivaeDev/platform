### Fixed

- Cloud dispatch flags a criterion as local-only only when it names the local Board directory as a whole path segment. A criterion that names a longer path starting with the same letters, such as a `.worktrees` folder next to a `.work` Board, now launches.
