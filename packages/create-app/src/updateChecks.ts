import { Console, Effect } from "effect";
import { CreateAppError } from "./CreateAppError.ts";
import { checkedProcess, runProcess } from "./runProcess.ts";

const conflictMarkers = Effect.fn("CreateApp.conflictMarkers")(function* (target: string) {
	const result = yield* runProcess(target, "git", [
		"grep",
		"--untracked",
		"--exclude-standard",
		"-I",
		"-l",
		"-z",
		"-E",
		"^((<{7}|[|]{7}|>{7})( |$)|={7}$)",
		"--",
		".",
	]);
	if (result.code > 1) {
		return yield* new CreateAppError({ message: `Could not check conflict markers: ${result.stderr.trim()}` });
	}
	return result.stdout.split("\0").filter(Boolean);
});

export const updateChecks = Effect.fn("CreateApp.updateChecks")(function* (target: string) {
	const failures: string[] = [];
	for (const args of [["install"], ["run", "typecheck"]]) {
		yield* Console.log(`Running pnpm ${args.join(" ")}...`);
		const result = yield* runProcess(target, "pnpm", args);
		if (result.code !== 0) {
			failures.push(`pnpm ${args.join(" ")} failed (exit ${result.code}):\n${result.stdout}${result.stderr}`.trim());
			if (`${result.stdout}${result.stderr}`.includes("ERR_PNPM_TRUST_DOWNGRADE")) {
				failures.push(
					"To re-resolve transitive packages pinned by the old lockfile while keeping trustPolicy enabled, run pnpm update --depth Infinity, then pnpm run typecheck. If a flagged version is pinned exactly in the manifest or catalog, change that pin to a trusted version first.",
				);
			}
		}
	}
	const markers = yield* conflictMarkers(target);
	if (markers.length > 0) {
		failures.unshift(`Files with conflict markers:\n${markers.join("\n")}`);
	}
	const unresolved = (yield* checkedProcess(target, "git", ["diff", "--name-only", "--diff-filter=U", "--", "."])).trim();
	if (unresolved !== "") {
		failures.push(`Unresolved Git conflicts:\n${unresolved}`);
	}
	return failures;
});
