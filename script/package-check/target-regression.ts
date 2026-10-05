import { join } from "node:path";
import { Cause, Console, Effect, Exit, FileSystem } from "effect";
import { checkPackedArchive } from "#package-check/archive.ts";
import { command, requireThat } from "#package-check/io.ts";
import type { Package } from "#package-check/model.ts";

export function checkMissingTargetRegression(packages: readonly Package[], target: string, expected: string) {
	return Effect.gen(function* () {
		const pkg = packages.find(({ manifest }) => manifest.name === "@shivaedev/heavy-lock");
		if (pkg === undefined) {
			return yield* Effect.fail(new Error("Missing target regression requires packed Heavy Lock"));
		}
		const fs = yield* FileSystem.FileSystem;
		const temporary = yield* fs.makeTempDirectoryScoped({ prefix: "platform-target-regression-" });
		yield* command(temporary, "tar", ["-xzf", pkg.tarball]);
		yield* fs.remove(join(temporary, "package", target));
		const mutated: Package = { ...pkg, tarball: join(temporary, "missing-target.tgz") };
		yield* command(temporary, "tar", ["-czf", mutated.tarball, "package"]);
		const result = yield* Effect.exit(checkPackedArchive(mutated));
		yield* requireThat(Exit.isFailure(result), `Removing ${target} unexpectedly passed packed archive validation`);
		if (Exit.isFailure(result)) {
			const message = Cause.pretty(result.cause);
			yield* requireThat(message.includes(expected), `Removing ${target} failed for an unrelated reason: ${message}`);
			yield* Console.log(`Passed missing ${target} regression: ${message}`);
		}
	});
}
