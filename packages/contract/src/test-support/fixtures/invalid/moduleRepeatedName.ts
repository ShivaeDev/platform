import { defineModule } from "#defineModule.ts";
import { query } from "#operation.ts";
import { SessionUser } from "#test/runNotes.ts";

const reading = {
	reads: () => [],
	*run() {
		const { id } = yield* SessionUser;
		return id;
	},
};

defineModule({
	name: "lists",
	operations: [query("list", reading), query("list", { ...reading })],
	requires: [SessionUser],
});
