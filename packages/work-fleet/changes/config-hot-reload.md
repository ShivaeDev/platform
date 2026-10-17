### Added

- The Fleet daemon watches its config file and applies valid edits to `concurrency`, `backlog`, `intervalSeconds`, `quota`, `launch`, `stallMinutes`, `areaMergeWaitMs` and worker or reviewer guidance on the next scheduler pass or launch, without a restart. Running turns keep their launch settings.
- Edits to restart-only settings such as `provider`, `database`, `namespace` or `cloud` keep their running values and are reported as needing a restart. An invalid or partly written file keeps the last good config and logs a `HostConfigRejected` warning naming the failing field.
- `work-fleet status` shows the config the daemon applies, when it was loaded, the settings waiting for a restart and the last rejected edit; `daemon.status` returns it as `config`.
