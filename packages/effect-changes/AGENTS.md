# @shivaedev/effect-changes

You are changing the boundary between a committed write and the notification that tells readers to refresh. Announcing a write before it commits can refresh readers for data that rolls back; announcing every write separately repeats work for the same subject. This package gives explicitly recorded changes one ordered buffer per transaction owner and lets the owner's real commit decide when they can leave it. It owns the after-commit boundary, not the database, the application's change vocabulary or the delivery transport.

## Which way to lean

When goals conflict, they win in this order:

1. **Preserve the native transaction's outcome and Effect semantics.** A successful body is not a successful commit. Interruption must not erase an announcement for a commit that landed, and typed failures, context and native transaction control must remain visible.
2. **Keep one boundary per job and the right boundary per owner.** Extend the channel instead of creating another after-commit mechanism. Independent owners must remain independent; nested work for the same owner belongs to its enclosing transaction.
3. **Keep recording explicit and behavior proven.** Write code names what needs refreshing. Do not infer application changes from arbitrary data, and test driver claims against the actual driver before documenting them.
4. **Keep the channel small and independent of drivers.** SQL and Prisma bindings belong in their packages. Durable delivery, cache policy and the meaning of a change belong outside the core channel.

The full purpose and trade-offs are in [docs/north-star.md](docs/north-star.md), package work and open questions in [docs/roadmap.md](docs/roadmap.md), and usage in [README.md](README.md). Follow the [repository guidance](../../AGENTS.md) for the shared engineering rules.
