import { database } from "#test/database.ts";
import { idleClock, markedSessions } from "#test/databaseTraits.ts";

database.it(
	"idle fixtures need no admin session and scope close drops every database",
	[markedSessions, idleClock],
	function* ({ idleConnectionsAndDatabasesAreReleased }) {
		yield* idleConnectionsAndDatabasesAreReleased();
	},
);
