import { database } from "#test/database.ts";
import { exhaustedRole, roleLimit } from "#test/databaseTraits.ts";

database.it("other PostgreSQL failures keep their original identity through both test wrappers", [], function* ({ otherSqlErrorsKeepIdentity }) {
	yield* otherSqlErrorsKeepIdentity();
});

database.it(
	"connection exhaustion during setup names the limit and a worker count to try",
	[roleLimit(), exhaustedRole],
	function* ({ setupExplainsConnectionLimit }) {
		yield* setupExplainsConnectionLimit();
	},
);

database.it(
	"a worker releases its admin connection before migrations, tests and clone creation",
	[roleLimit(2)],
	function* ({ adminConnectionIsReleased }) {
		yield* adminConnectionIsReleased();
	},
);

database.it(
	"connection exhaustion during a rollback transaction retains SQLSTATE and adds worker guidance",
	[roleLimit()],
	function* ({ rollbackExplainsConnectionLimit }) {
		yield* rollbackExplainsConnectionLimit();
	},
);

database.it(
	"connection exhaustion in an isolated body retains SQLSTATE and adds worker guidance",
	[roleLimit()],
	function* ({ cloneExplainsConnectionLimit }) {
		yield* cloneExplainsConnectionLimit();
	},
);
