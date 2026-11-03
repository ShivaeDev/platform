# @shivaedev/test-kits

This package gives application story kits reusable preconditions and observations without making production packages ship test infrastructure. Email delivery, signed-in identities, SQL change coverage and native contract subscriptions use their real runtime owners; this package supplies only the test composition. Read the [README](README.md) for usage.

Preserve native Effect scope, clocks, failures and transaction ownership first. Keep the real runtime engine running next: fake only the outside provider boundary, and let specs assert on observations. Keep each helper under its runtime domain so applications import only the building blocks their local kit needs. Test runners and PostgreSQL isolation stay in test-story and test-sql.

Follow the [repository guidance](../../AGENTS.md) and the [story-testing skill](../skills/skills/story-testing/SKILL.md). The jobs controller remains owned by jobs.
