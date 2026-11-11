import { Schema } from "effect";
import { SqlClient } from "effect/sql";
import { defineModule } from "@shivaedev/contract/defineModule.ts";
import { command, query } from "@shivaedev/contract/operation.ts";
import { identitySessionsWire } from "#generated/Sessions.ts";
import { listSessions, revokeSession } from "#server/better-auth/sessionAdministration.ts";
import { SessionsPermission } from "#sessionPermissions.ts";
import { SessionListInput, sessionKeys } from "#signedInSessions.ts";

const ListSessions = query("list", {
	payload: SessionListInput.fields,
	reads: () => [sessionKeys.list],
	*run(input) {
		return yield* listSessions(input);
	},
});

const RevokeSession = command("revoke", {
	invalidates: () => [sessionKeys.list],
	payload: { id: Schema.String },
	*run({ id }) {
		yield* revokeSession(id);
	},
});

export const Sessions = defineModule({
	middleware: SessionsPermission,
	name: "identity.sessions",
	operations: [ListSessions, RevokeSession],
	requires: [SqlClient.SqlClient],
	wire: identitySessionsWire,
});
