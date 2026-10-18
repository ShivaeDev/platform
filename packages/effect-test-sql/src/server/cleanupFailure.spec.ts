import { database } from "#test/database.ts";
import { roleLimit } from "#test/databaseTraits.ts";

database.it("an isolated database drop failure ends its scope with a SQL defect", [roleLimit(2)], function* ({ failedDatabaseDropIsDefect }) {
	yield* failedDatabaseDropIsDefect();
});
