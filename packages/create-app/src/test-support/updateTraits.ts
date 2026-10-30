import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Effect } from "effect";
import { cliAnswer } from "./answers.ts";
import { gitIn } from "./appReadouts.ts";
import { updates } from "./updates.ts";

export const AS_RELEASED = { from: "the starter as released today" } as const;
export type Change = Readonly<Record<string, string | null | typeof AS_RELEASED | ((current: string) => string)>>;

const RELEASED_STARTER = fileURLToPath(new URL("../../../../examples/starter", import.meta.url));

function applyTo(folder: string, change: Change) {
	for (const [path, content] of Object.entries(change)) {
		const file = join(folder, path);
		if (content === null) {
			rmSync(file);
		} else if (typeof content === "object") {
			writeFileSync(file, readFileSync(join(RELEASED_STARTER, path)));
		} else {
			mkdirSync(dirname(file), { recursive: true });
			writeFileSync(file, typeof content === "function" ? content(readFileSync(file, "utf8")) : content);
		}
	}
}

function checked(folder: string, args: readonly string[]) {
	const result = gitIn(folder, args);
	if (result.status !== 0) {
		throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
	}
}

export function starterAt010(described: string, change: Change) {
	return updates.trait("previous", `the 0.1.0 starter ${described}`, (engine) => Effect.sync(() => applyTo(engine.source.starter, change)));
}

export function createdWith010(...flags: readonly "--minimal"[]) {
	return updates.trait("created", `create-app 0.1.0 created ${["my-app", ...flags].join(" ")}`, function* (engine) {
		engine.generator("0.1.0");
		const result = yield* engine.run(["my-app", ...flags], engine.root);
		const answer = cliAnswer(result, engine.root, () => "created");
		if (answer !== "created") {
			return yield* Effect.die(new Error(`create-app 0.1.0 did not create my-app: ${answer}`));
		}
	});
}

export const published010 = updates.trait("created", "create-app 0.1.0 is published, so update can fetch the release my-app records", (engine) =>
	Effect.sync(() => engine.publish("0.1.0")),
);

export function appCommits(described: string, change: Change) {
	return updates.trait("customized", `my-app ${described} and commits it`, (engine) =>
		Effect.sync(() => {
			applyTo(engine.target, change);
			checked(engine.target, ["add", "--all"]);
			checked(engine.target, ["-c", "user.name=App", "-c", "user.email=app@example.com", "commit", "-qm", described]);
		}),
	);
}

export function appEditsWithoutCommitting(described: string, change: Change) {
	return updates.trait("customized", `my-app ${described} without committing`, (engine) => Effect.sync(() => applyTo(engine.target, change)));
}

export function starterAt020(described: string, change: Change = {}) {
	return updates.trait("current", `create-app 0.2.0's starter ${described}`, (engine) =>
		Effect.sync(() => {
			engine.generator("0.2.0");
			applyTo(engine.source.starter, change);
		}),
	);
}
