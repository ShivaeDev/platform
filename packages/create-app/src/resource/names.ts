import { Effect } from "effect";
import { CreateAppError } from "#CreateAppError.ts";

export const resourceNames = Effect.fn("CreateApp.resourceNames")(function* (name: string) {
	if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u.test(name) || name.length > 63) {
		return yield* new CreateAppError({ message: "Use a lowercase resource name with optional hyphens, at most 63 characters long." });
	}
	const words = name.split("-");
	const pascal = words.map((word) => word[0]?.toUpperCase() + word.slice(1)).join("");
	return { camel: pascal[0]?.toLowerCase() + pascal.slice(1), name, pascal, table: words.join("_") };
});

export type ResourceNames = Effect.Success<ReturnType<typeof resourceNames>>;
