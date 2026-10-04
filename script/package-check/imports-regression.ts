import { join } from "node:path";
import { Cause, Console, Effect, Exit, FileSystem } from "effect";
import { checkPackedArchive } from "#package-check/archive.ts";
import { command, requireThat } from "#package-check/io.ts";
import type { Package } from "#package-check/model.ts";

const target = "./dist/error.js";

export function checkImportTargetRegression(packages: readonly Package[]) {
	return Effect.gen(function* () {
		const pkg = packages.find(({ manifest }) => manifest.name === "@shivaedev/heavy-lock");
		if (pkg === undefined) {
			return yield* Effect.fail(new Error("Imports target regression requires packed Heavy Lock"));
		}
		const fs = yield* FileSystem.FileSystem;
		const temporary = yield* fs.makeTempDirectoryScoped({ prefix: "platform-imports-regression-" });
		yield* command(temporary, "tar", ["-xzf", pkg.tarball]);
		yield* fs.remove(join(temporary, "package", target));
		const mutated: Package = { ...pkg, tarball: join(temporary, "missing-import-target.tgz") };
		yield* command(temporary, "tar", ["-czf", mutated.tarball, "package"]);
		const result = yield* Effect.exit(checkPackedArchive(mutated));
		yield* requireThat(Exit.isFailure(result), `Removing ${target} unexpectedly passed packed archive validation`);
		if (Exit.isFailure(result)) {
			const message = Cause.pretty(result.cause);
			yield* requireThat(
				message.includes(`whose target ${target} is not packed`),
				`Imports target mutation failed for an unrelated reason: ${message}`,
			);
			yield* Console.log(`Passed missing imports target regression: ${message}`);
		}
	});
}
