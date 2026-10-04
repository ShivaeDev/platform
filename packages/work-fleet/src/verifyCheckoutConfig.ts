import { Effect, Schema } from "effect";
import type { WorkSpec } from "./domain.ts";
import { githubGit } from "./githubCommand.ts";
import { failure } from "./ports.ts";

const Entry = Schema.Struct({ key: Schema.String, value: Schema.String });
const booleans = new Set(["core.filemode", "core.logallrefupdates", "core.ignorecase", "core.precomposeunicode", "core.symlinks"]);
function allowed(entry: typeof Entry.Type): boolean {
	if (booleans.has(entry.key)) {
		return entry.value === "true" || entry.value === "false";
	}
	if (entry.key === "core.repositoryformatversion") {
		return entry.value === "0";
	}
	if (entry.key === "core.bare") {
		return entry.value === "false";
	}
	if (entry.key === "remote.origin.url") {
		return true;
	}
	if (entry.key === "remote.origin.fetch") {
		return entry.value === "+refs/heads/*:refs/remotes/origin/*";
	}
	if (/^branch\..+\.remote$/u.exec(entry.key) !== null) {
		return entry.value === "origin" || entry.value === ".";
	}
	if (/^branch\..+\.merge$/u.exec(entry.key) !== null) {
		return entry.value.startsWith("refs/heads/");
	}
	return false;
}
export function verifyCheckoutConfig(work: WorkSpec) {
	return Effect.gen(function* () {
		const output = yield* githubGit(work.checkout, ["config", "--local", "--no-includes", "--null", "--list"]);
		const entries = yield* Schema.decodeUnknownEffect(Schema.Array(Entry))(
			output
				.split("\0")
				.filter(Boolean)
				.map((line) => {
					const split = line.indexOf("\n");
					return { key: line.slice(0, split), value: line.slice(split + 1) };
				}),
		).pipe(Effect.mapError(() => failure("Local Git configuration has an invalid shape", "human")));
		if (entries.some((entry) => !allowed(entry)) || new Set(entries.map((entry) => entry.key)).size !== entries.length) {
			return yield* Effect.fail(failure("Local Git configuration contains unsupported executable or redirecting settings", "human"));
		}
	});
}
