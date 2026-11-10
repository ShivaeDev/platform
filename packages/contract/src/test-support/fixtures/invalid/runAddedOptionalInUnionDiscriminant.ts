import { Schema } from "effect";
import { query } from "#operation.ts";
import { SessionUser } from "#test/runNotes.ts";

const Moved = Schema.Struct({ kind: Schema.Literal("moved"), note: Schema.optionalKey(Schema.String) });
const Renamed = Schema.Struct({ kind: Schema.Literal("renamed"), note: Schema.optionalKey(Schema.String) });

query("changesWithExtra", {
	reads: () => [],
	*run() {
		const { id } = yield* SessionUser;
		const change: { readonly extra?: number; readonly kind: "moved" | "renamed"; readonly note?: string } = { kind: "renamed", note: id };
		return change;
	},
	success: Schema.Union([Moved, Renamed]),
});
