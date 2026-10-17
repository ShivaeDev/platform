### Added

- `storyKit` accepts `outbound: Readonly<Record<string, string>>` to route selected hostnames from Node's built-in `fetch` to fake server origins for each story, then restore the previous dispatcher after success or failure. Other hosts pass through unchanged.
