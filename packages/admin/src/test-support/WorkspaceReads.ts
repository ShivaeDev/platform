import { Effect, Schema } from "effect";
import { defineModule } from "@shivaedev/contract/defineModule.ts";
import { query } from "@shivaedev/contract/operation.ts";
import { adminWorkspacesWire } from "#generated/test-support/WorkspaceReads.ts";

const Read = query("read", {
	payload: { id: Schema.String },
	readPolicy: () => Effect.succeed(true),
	reads: () => [],
	*run({ id }) {
		return yield* Effect.succeed(`Workspace ${id}`);
	},
});

export const WorkspaceReads = defineModule({ name: "admin.workspaces", operations: [Read], wire: adminWorkspacesWire });
