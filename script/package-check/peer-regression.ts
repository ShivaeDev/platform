import { join } from "node:path";
import { Cause, Console, Effect, Exit, FileSystem, Schema } from "effect";
import { checkPackedArchive } from "#package-check/archive.ts";
import { command, requireThat, writeJson } from "#package-check/io.ts";
import { decodeManifest, type Package } from "#package-check/model.ts";

const sharedPeer = "@effect/platform-node-shared";
const decodeObject = Schema.decodeUnknownSync(Schema.fromJsonString(Schema.Record(Schema.String, Schema.Unknown)));
const withoutShared = (peers: Readonly<Record<string, string>> | undefined) =>
	Object.fromEntries(Object.entries(peers ?? {}).filter(([name]) => name !== sharedPeer));

export const checkSharedPeerRegression = (packages: readonly Package[]) =>
	Effect.gen(function* () {
		const pkg = packages.find(({ manifest }) => manifest.name === "@shivaedev/heavy-lock");
		if (pkg === undefined) return yield* Effect.fail(new Error("Shared Effect peer regression requires packed Heavy Lock"));
		const fs = yield* FileSystem.FileSystem;
		const temporary = yield* fs.makeTempDirectoryScoped({ prefix: "platform-peer-regression-" });
		yield* command(temporary, "tar", ["-xzf", pkg.tarball]);
		const manifestPath = join(temporary, "package/package.json");
		const source = yield* fs.readFileString(manifestPath);
		yield* writeJson(manifestPath, {
			...decodeObject(source),
			peerDependencies: withoutShared(decodeManifest(source).peerDependencies),
		});
		const mutated: Package = {
			...pkg,
			tarball: join(temporary, "missing-peer.tgz"),
		};
		yield* command(temporary, "tar", ["-czf", mutated.tarball, "package"]);
		const result = yield* Effect.exit(checkPackedArchive(mutated));
		yield* requireThat(Exit.isFailure(result), "Removing the shared Effect peer unexpectedly passed packed archive validation");
		if (Exit.isFailure(result)) {
			const message = Cause.pretty(result.cause);
			yield* requireThat(
				message.includes(`${pkg.manifest.name}: executable needs ${sharedPeer} as an exact peer`),
				`Shared Effect peer mutation failed for an unrelated reason: ${message}`,
			);
			yield* Console.log(`Passed missing shared Effect peer regression: ${message}`);
		}
	});
