import { Effect, Schema } from "effect";
import { command, requireThat } from "#package-check/io.ts";

const decodeVersion = Schema.decodeUnknownSync(Schema.fromJsonString(Schema.String));
const stableVersion = /^\d+\.\d+\.\d+$/u;

function newerVersion(version: string, other: string) {
	if (!(stableVersion.test(version) && stableVersion.test(other))) {
		return false;
	}
	const candidate = version.split(".").map(Number);
	const published = other.split(".").map(Number);
	for (const [index, value] of candidate.entries()) {
		if (value !== published[index]) {
			return value > (published[index] ?? 0);
		}
	}
	return false;
}

export function currentPin(pin: string, latest: string, workspace: string) {
	return pin === (newerVersion(workspace, latest) ? workspace : latest);
}

export function latestVersion(root: string, name: string) {
	return command(root, "pnpm", ["view", name, "version", "--json", "--registry=https://registry.npmjs.org"]).pipe(Effect.map(decodeVersion));
}

export const checkPins = Effect.fn("Published.checkPins")(function* (
	pins: Readonly<Record<string, string>>,
	workspace: Readonly<Record<string, string>>,
	latest: (name: string) => Effect.Effect<string, Error>,
) {
	for (const [name, pin] of Object.entries(pins)) {
		const published = yield* latest(name);
		yield* requireThat(
			currentPin(pin, published, workspace[name] ?? ""),
			`${name}: generated app pins ${pin}, but npm latest is ${published}. Pin the latest release or the workspace version released with this change.`,
		);
	}
});
