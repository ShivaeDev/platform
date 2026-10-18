import { database } from "#test/database.ts";

database.it(
	"application finalizers finish while the isolated database scope is still open",
	[],
	function* ({ applicationFinalizersKeepDatabaseOpen }) {
		yield* applicationFinalizersKeepDatabaseOpen();
	},
);
