import process from "node:process";
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Config, Effect } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { ChangesetError } from "@shivaedev/releases/error.ts";
import { checkPlatform } from "./check.ts";

export const publishPackages = Effect.fn("Release.publishPackages")(function* (root: string, base: string) {
	const plan = yield* checkPlatform(root, base);
	if (plan.releases.length === 0) {
		return;
	}
	const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
	const status = yield* spawner.exitCode(
		ChildProcess.make("pnpm", ["--recursive", ...plan.releases.flatMap(({ name }) => ["--filter", name]), "publish", "--no-git-checks"], {
			cwd: root,
			stderr: "inherit",
			stdout: "inherit",
		}),
	);
	if (status !== 0) {
		return yield* new ChangesetError({ message: `Publishing the release failed with exit ${status}.` });
	}
});

if (import.meta.main) {
	NodeRuntime.runMain(
		Effect.gen(function* () {
			yield* publishPackages(process.cwd(), yield* Config.String("CHANGELOG_BASE_REF"));
		}).pipe(Effect.provide(NodeServices.layer)),
	);
}
