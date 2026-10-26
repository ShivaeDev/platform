import { expect } from "vitest";
import { database } from "#test/database.ts";
import { idleClock, markedSessions } from "#test/databaseTraits.ts";

database.it(
	"idle fixtures need no admin session and scope close drops every database",
	[markedSessions, idleClock],
	function* ({ expireSharedConnections, inClone, readCurrentDatabaseName, readWorkerDatabaseNames, closeWorker, awaitIdleAdmin, readDatabases }) {
		const idleAdminConnections = yield* expireSharedConnections();
		const isolated = yield* inClone(readCurrentDatabaseName());
		const names = [...(yield* readWorkerDatabaseNames()), isolated];
		yield* closeWorker();
		const closedAdminConnections = yield* awaitIdleAdmin();
		expect({ closedAdminConnections, idleAdminConnections }).toEqual({ closedAdminConnections: 0, idleAdminConnections: 0 });
		expect(names.every((name) => name !== "")).toBe(true);
		expect(yield* readDatabases(names)).toEqual([]);
	},
);
