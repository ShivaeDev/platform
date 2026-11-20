import { Schema } from "effect";
import { ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { defineModule } from "#defineModule.ts";
import { command } from "#operation.ts";

const Operation = command("listsAutomatic", {
	*run() {
		return yield* new ServiceUnavailable({ message: "Try again later" });
	},
});

defineModule({
	name: "listsAutomatic",
	operations: [Operation],
	requires: [],
	wire: { listsAutomatic: { rejections: { ServiceUnavailable }, success: Schema.Never } },
});
