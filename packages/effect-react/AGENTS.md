# @shivaedev/effect-react

You are changing the React boundary between an application's native Effect atoms, its session and its editable drafts. Components should show useful data while a refresh runs or fails, keep the user's newer edits when a save responds, and discard a session's state when its identity changes. An application should get those rules without rebuilding them in every screen.

## Which way to lean

When goals conflict, they win in this order:

1. **Native owners stay visible.** Atoms own execution, identity, caching and scheduling; effect-form owns fields, validation and drafts; the application's auth owner decides whether a session ends. Extend those pieces instead of adding another cache, form model or auth policy.
2. **A draft belongs to one record and one session.** A changed query atom starts a new editor, and a changed session generation discards its client, registry and subtree. Convenience must not carry data or drafts between identities.
3. **A response does not erase newer work.** Refresh and save results merge through the form's per-field rules. Preserve typed failures and useful retained data so the application can decide what to tell the user.
4. **Shared state tells the truth.** An action atom describes the atom's current result, not the outcome of one dispatch. Keep native interruption and lifetime rules intact; use a real Effect when a caller needs its own completion result.
5. **Small call sites follow proven behavior.** Add a helper when it removes repeated application code and its observable behavior has a regression test. A shorter call site does not justify a new state owner.

Read [README.md](./README.md) for use, [docs/north-star.md](./docs/north-star.md) for the full boundary and trade-offs, and [docs/roadmap.md](./docs/roadmap.md) for implementation status and maintainer questions.
