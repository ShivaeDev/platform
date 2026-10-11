### Fixed

- Board context checks cover the worker's own brief. Linked documents and unrelated bookkeeping leave preparation, execution and review running. Approved brief edits refresh preparation or continue the existing worker after its turn ends, with the changed brief; removed approval and done or superseded work still stop execution.
- Worker answers survive Board edits and reach the existing thread with the current brief. Provider queue retries retain the pending prompt, role, session, settings and backoff across approved brief edits, including host admission before initial launch retries, appending the brief update on retry. Responses from the same author use the newest response; competing authors still require explicit resolution.
- Retry prepares the current approved brief, and released work can dispatch again under the same item identity while retaining its previous cycle and known PR reservations.
- CLI-watch tests await the first daemon snapshot before editing its selected work, removing a startup race.
