import { Schema } from "effect";
import { defineModule } from "#defineModule.ts";
import { query } from "#operation.ts";
import { SessionUser } from "#test/runNotes.ts";

const Operation = query("titles", {
	reads: () => [],
	*run() {
		const { id } = yield* SessionUser;
		const titles: string[] = [`Groceries of ${id}`];
		return titles;
	},
});

defineModule({
	name: "titles",
	operations: [Operation],
	wire: { titles: { rejections: {}, success: Schema.Array(Schema.String) } },
});
