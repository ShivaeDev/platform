import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Cause, Effect, Schema } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { withExceptionConfig } from "#biome/exceptionConfig.ts";
import { services } from "#cli/runMain.ts";
import type { ExceptionDeclaration } from "#exceptions/declaration.ts";
import { linkPackage } from "./tree.ts";

interface Seen {
	readonly configPath: string | undefined;
	readonly files: readonly string[];
	readonly generated: string | undefined;
	readonly rootConfig: string | undefined;
}

interface MergeEngine {
	outcome: string | undefined;
	readonly root: string;
	rootConfig: string;
	seen: Seen | undefined;
}

const decodeJson = Schema.decodeUnknownSync(Schema.fromJsonString(Schema.Unknown));

function textOf(path: string): string | undefined {
	return existsSync(path) ? readFileSync(path, "utf8") : undefined;
}

function seen(engine: MergeEngine): Seen {
	if (engine.seen === undefined) {
		throw new Error("The command has not run");
	}
	return engine.seen;
}

// Paths inside the temporary repository read as <root>, so a story can name them.
function relocated(engine: MergeEngine, text: string | undefined): string | undefined {
	return text?.replaceAll(engine.root, "<root>");
}

function recording(engine: MergeEngine) {
	return (args: readonly string[]) =>
		Effect.sync(() => {
			const configPath = args[0]?.slice("--config-path=".length);
			engine.seen = {
				configPath,
				files: readdirSync(engine.root).toSorted(),
				generated: configPath === undefined ? undefined : textOf(configPath),
				rootConfig: textOf(join(engine.root, engine.rootConfig)),
			};
		});
}

function failureOf(cause: Cause.Cause<unknown>): string {
	const failure = Cause.squash(cause);
	return `failed: ${failure instanceof Error ? failure.message : String(failure)}`;
}

export const exceptionConfigStory = storyKit({
	create: () =>
		Effect.acquireRelease(
			Effect.sync(
				(): MergeEngine => ({ outcome: undefined, root: mkdtempSync(join(tmpdir(), "quality-merge-")), rootConfig: "biome.json", seen: undefined }),
			),
			(engine) => Effect.sync(() => rmSync(engine.root, { force: true, recursive: true })),
		),
	inspect: (engine) => ({ outcome: engine.outcome, seen: engine.seen }),
	layer: services,
	name: "Biome exception config",
	stages: ["repository"],
	verbs: (engine, story) => {
		function runs(declarations: readonly ExceptionDeclaration[]) {
			story.tell("quality runs a Biome command under the declared exceptions");
			return Effect.scoped(withExceptionConfig(engine.root, declarations, recording(engine))).pipe(
				Effect.as("ran"),
				Effect.catchCause((cause) => Effect.succeed(failureOf(cause))),
				Effect.flatMap((outcome) =>
					Effect.sync(() => {
						engine.outcome = outcome;
					}),
				),
			);
		}
		return {
			configPath: () => Effect.sync(() => relocated(engine, seen(engine).configPath)),
			files: () => Effect.sync(() => readdirSync(engine.root).toSorted()),
			filesDuringCommand: () => Effect.sync(() => seen(engine).files),
			generatedConfig: () => Effect.sync(() => decodeJson(relocated(engine, seen(engine).generated) ?? "null")),
			outcome: () => Effect.sync(() => engine.outcome),
			rootConfigDuringCommand: () => Effect.sync(() => seen(engine).rootConfig),
			runsCommand: runs,
		};
	},
});

export function rootConfig(path: string, text: string) {
	return exceptionConfigStory.trait("repository", `the repository's ${path} reads ${text}`, (engine) => {
		writeFileSync(join(engine.root, path), text);
		engine.rootConfig = path;
	});
}

export function qualityInstalled() {
	return exceptionConfigStory.trait("repository", "Quality is installed, so its Biome preset resolves", (engine) => linkPackage(engine.root));
}
