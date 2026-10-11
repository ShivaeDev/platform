### Breaking

- Config rejects `warn` and `off` rule levels, raised line/comment limits, `exclude`, and `structure/max-lines.testFiles`; `testProjects()` rejects suite-exclusion options. Remove these settings, keep the shared limits (or lower them), and record existing findings with `quality baseline write --rule <id>`. Keep only reasoned Biome exceptions for individual rules on explicit files or named directory exclusions; whole-check, group and blanket declarations are rejected.
