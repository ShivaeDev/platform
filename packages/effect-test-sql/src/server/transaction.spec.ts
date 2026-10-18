import { database } from "#test/database.ts";

database.it("parallel transactions write the same rows without seeing each other", [], function* ({ parallelWritesStayPrivate }) {
	yield* parallelWritesStayPrivate();
});

database.it("nested transact uses savepoints and the outer rollback suppresses invalidations", [], function* ({ savepointsSuppressInvalidations }) {
	yield* savepointsSuppressInvalidations();
});

database.it("typed failures, defects and interruption roll back and preserve their exits", [], function* ({ rollbackPreservesExits }) {
	yield* rollbackPreservesExits();
});
