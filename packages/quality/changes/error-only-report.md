### Breaking

- Remove `quality lint --warnings`; `Level` and `ActiveLevel` are `"error"` only. Remove `Outcome.warnings`, `ReportContext.warnings` and the `WarningDetail` export. The `lint` function takes only `cwd` and `config`.
