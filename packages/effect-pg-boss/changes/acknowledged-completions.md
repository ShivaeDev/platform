### Added

- `makePgBossTesting().completions(queue)` reads locally acknowledged worker completions, including each job's ID and retry count, without querying queue storage.
- `failNextSend(queue)` accepts queues with specific payload schemas under strict function variance checking.
