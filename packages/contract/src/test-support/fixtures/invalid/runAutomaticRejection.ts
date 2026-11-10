import { ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { command } from "#operation.ts";

command("listsAutomatic", {
	rejections: { ServiceUnavailable },
	*run() {
		return yield* new ServiceUnavailable({ message: "Try again later" });
	},
});
