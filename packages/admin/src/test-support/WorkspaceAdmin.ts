import { Effect, Schema } from "effect";
import { defineModule } from "@shivaedev/contract/defineModule.ts";
import { command, query } from "@shivaedev/contract/operation.ts";
import { adminWorkspacesWire } from "#generated/test-support/WorkspaceAdmin.ts";

const Read = query("read", {
	payload: { id: Schema.String },
	readPolicy: () => Effect.succeed(true),
	reads: () => [],
	*run({ id }) {
		return yield* Effect.succeed(`Workspace ${id}`);
	},
});

const Archive = command("archive", {
	invalidates: () => [],
	payload: { id: Schema.String },
	*run({ id }) {
		return yield* Effect.succeed(`Archived ${id}`);
	},
});

// Declares no middleware, so registration must add the page's permission to every operation.
export const WorkspaceAdmin = defineModule({ name: "admin.workspaces", operations: [Read, Archive], wire: adminWorkspacesWire });
