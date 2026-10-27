import { Effect } from "effect";
import { command, requireThat } from "#package-check/io.ts";
import type { Package } from "#package-check/model.ts";

export const checkUnhoisted = Effect.fn("Packed.checkUnhoisted")(function* (pkg: Package, consumer: string) {
	const outcome = yield* command(consumer, "pnpm", ["run", "typecheck:nodenext"]).pipe(
		Effect.match({ onFailure: (error) => error.message, onSuccess: () => "the typecheck passed" }),
	);
	yield* requireThat(
		outcome.includes("TS2307"),
		`${pkg.manifest.name}: a consumer without publicHoistPattern must fail to resolve the pieces it does not declare: ${outcome}`,
	);
});
