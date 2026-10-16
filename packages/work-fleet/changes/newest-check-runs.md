### Fixed

- Validate only the newest run of each GitHub check name on the adopted head, using completion time or start time. Superseded cancelled or failed runs no longer trigger repairs.
- Revalidate check repairs that leave the PR head unchanged without repeating the approved review. Three completed repairs of the same failing checks exhaust the repair limit even when a repair submission failed between them.
