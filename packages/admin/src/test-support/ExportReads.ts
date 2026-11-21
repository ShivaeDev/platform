import { Effect } from "effect";
import { defineModule } from "@shivaedev/contract/defineModule.ts";
import { query } from "@shivaedev/contract/operation.ts";
import { adminExportsWire } from "#generated/test-support/ExportReads.ts";

const Read = query("read", {
	readPolicy: () => Effect.succeed(true),
	reads: () => [],
	*run() {
		return yield* Effect.succeed("exports");
	},
});

export const ExportReads = defineModule({ name: "admin.exports", operations: [Read], wire: adminExportsWire });
