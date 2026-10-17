### Fixed

- Stalled turns retain their recovery state when a brief edit replaces the current decision. Retry or dispatch of the revised brief abandons the stalled turn and starts a fresh session; late output and acknowledgements remain fenced out. Release can also abandon the stalled turn after a decision replacement.
