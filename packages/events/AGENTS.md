# @shivaedev/events

Some features need a durable explanation of their state and a way to rebuild it. This optional package keeps versioned Schema events and repository projections in one PostgreSQL transaction; ordinary features stay on plain `sql`. Usage is in [README.md](README.md).

When trade-offs conflict, preserve native Effect and SQL transaction semantics first, then durable history and explicit stream concurrency, then rebuildable projections, then convenience. Extend `sql.transact` and its repository change publication instead of creating another transaction owner or notification path.

Request ids recognise completed commands; stream versions decide concurrent writes. Projection progress belongs to individual streams: a global maximum sequence can skip a transaction that commits late. Rebuild uses the same database-only projections and upcasters, with no command handler or external reaction. Read models must be independent of a total ordering across streams.

Keep the package focused on history, replay and projection progress. Applications own command decisions, authorization, event vocabulary, read-model schemas and external effects. Learn from [antumbra's journal](https://github.com/ShivaeDev/antumbra/tree/main/packages/server/journal) without inheriting its single-writer SQLite assumptions. PostgreSQL stories must exercise the real transaction and repository paths.
