import { Effect, Option, Schema } from "effect";
import { ChangesetError } from "@shivaedev/releases/error.ts";
import { PackageManifest } from "@shivaedev/releases/model.ts";
import { runCommand } from "@shivaedev/releases/runCommand.ts";

const MissingVersion = Schema.fromJsonString(
	Schema.Struct({
		error: Schema.Struct({ code: Schema.Literals(["E404", "ERR_PNPM_FETCH_404", "ERR_PNPM_NO_MATCHING_VERSION", "ERR_PNPM_PACKAGE_NOT_FOUND"]) }),
	}),
);

export const publishedManifest = Effect.fn("Release.publishedManifest")(function* (root: string, name: string, version: string) {
	const result = yield* runCommand(root, "pnpm", ["view", `${name}@${version}`, "--json"]);
	if (result.exitCode !== 0) {
		if (Option.isSome(Schema.decodeUnknownOption(MissingVersion)(result.stdout))) {
			return undefined;
		}
		return yield* new ChangesetError({
			message: `Cannot read published manifest for ${name}@${version}: ${result.stderr || result.stdout}`,
		});
	}
	return yield* Schema.decodeUnknownEffect(Schema.fromJsonString(PackageManifest))(result.stdout).pipe(
		Effect.mapError((cause) => new ChangesetError({ cause, message: `Cannot decode published manifest for ${name}@${version}.` })),
	);
});
