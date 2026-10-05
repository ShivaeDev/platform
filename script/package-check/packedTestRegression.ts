import { join } from "node:path";
import { Cause, Console, Effect, Exit, FileSystem } from "effect";
import { checkPackedArchive } from "#package-check/archive.ts";
import { command, requireThat } from "#package-check/io.ts";
import type { Package } from "#package-check/model.ts";

export function checkPackedTestRegression(packages: readonly Package[], path: string) {
	return Effect.gen(function* () {
		const pkg = packages.find(({ manifest }) => manifest.name === "@shivaedev/heavy-lock");
		if (pkg === undefined) {
			return yield* Effect.fail(new Error("Packed test regression requires packed Heavy Lock"));
		}
		const fs = yield* FileSystem.FileSystem;
		const temporary = yield* fs.makeTempDirectoryScoped({ prefix: "platform-test-regression-" });
		yield* command(temporary, "tar", ["-xzf", pkg.tarball]);
		yield* fs.writeFileString(join(temporary, "package", path), "export {};\n");
		const mutated: Package = { ...pkg, tarball: join(temporary, "packed-test.tgz") };
		yield* command(temporary, "tar", ["-czf", mutated.tarball, "package"]);
		const result = yield* Effect.exit(checkPackedArchive(mutated));
		yield* requireThat(Exit.isFailure(result), `Packing ${path} unexpectedly passed packed archive validation`);
		if (Exit.isFailure(result)) {
			const message = Cause.pretty(result.cause);
			yield* requireThat(message.includes(`packed test file package/${path}`), `Packing ${path} failed for an unrelated reason: ${message}`);
			yield* Console.log(`Passed packed ${path} regression: ${message}`);
		}
	});
}
