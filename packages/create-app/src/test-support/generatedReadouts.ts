import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, readlinkSync, realpathSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { Effect, Schema } from "effect";
import { databaseName } from "#appFiles.ts";
import { commitsIn, gitIn } from "./appReadouts.ts";
import type { Engine } from "./generate.ts";

const HOOK_MARK = "Installed by @shivaedev/quality";
const Observations = Schema.decodeUnknownSync(
	Schema.fromJsonString(Schema.Struct({ databases: Schema.Unknown, environment: Schema.Unknown, query: Schema.Unknown })),
);
const SetupRecord = Schema.decodeUnknownSync(Schema.fromJsonString(Schema.Struct({ head: Schema.Number, staged: Schema.String })));
const GateRecord = Schema.decodeUnknownSync(Schema.fromJsonString(Schema.Struct({ staged: Schema.String })));
const BaselineEntry = Schema.decodeUnknownSync(
	Schema.fromJsonString(Schema.Struct({ count: Schema.Number, path: Schema.String, rule: Schema.String })),
);

function lines(text: string) {
	return text.split("\n").filter((line) => line !== "");
}

function hookAt(path: string) {
	if (!existsSync(path)) {
		return "no hook";
	}
	return readFileSync(path, "utf8").includes(HOOK_MARK) ? "Quality's hook" : "another hook";
}

function contents(folder: string) {
	return new Map(appFiles(folder).map((path) => [path, readFileSync(join(folder, path), "utf8")]));
}

function appFiles(folder: string) {
	return readdirSync(folder, { recursive: true, withFileTypes: true })
		.filter((file) => file.isFile() && file.name !== "installation.json")
		.map((file) => relative(folder, join(file.parentPath, file.name)))
		.filter((path) => !/^(?:\.git|node_modules)\//u.test(path))
		.sort();
}

export function generatedReadouts(engine: Engine, target: () => string) {
	function at(path: string) {
		return join(target(), path);
	}
	return {
		authSecret: () =>
			Effect.sync(() => /^BETTER_AUTH_SECRET=(?<secret>.*)$/mu.exec(readFileSync(at(".env.local"), "utf8"))?.groups?.secret ?? "none"),
		baselineEntriesFor: (path: string) =>
			Effect.sync(() =>
				(existsSync(at("quality-baseline.jsonl")) ? lines(readFileSync(at("quality-baseline.jsonl"), "utf8")) : [])
					.map((line) => BaselineEntry(line))
					.filter((entry) => entry.path === path)
					.map(({ count, rule }) => ({ count, rule })),
			),
		closingMessage: () => Effect.sync(() => engine.printed.slice(engine.printed.lastIndexOf("Created ")).trimEnd()),
		databaseObservation: (key: "databases" | "environment" | "query") =>
			Effect.sync(() =>
				existsSync(at("database-observations.json"))
					? Observations(readFileSync(at("database-observations.json"), "utf8").replaceAll(databaseName(engine.app), "{app}"))[key]
					: `no observations: ${engine.scripts.at(-1) ?? "no test ran"}`,
			),
		destinationContents: () =>
			Effect.sync(() =>
				statSync(target()).isFile()
					? { ".": readFileSync(target(), "utf8") }
					: Object.fromEntries(readdirSync(target()).map((file) => [file, readFileSync(at(file), "utf8")])),
			),
		enclosingCommits: () => Effect.sync(() => commitsIn(engine.root)),
		enclosingHook: () => Effect.sync(() => hookAt(join(engine.root, ".git/hooks/pre-commit"))),
		enclosingStaged: () => Effect.sync(() => lines(gitIn(engine.root, ["diff", "--cached", "--name-only"]).stdout)),
		environmentSetting: (key: string) =>
			Effect.sync(() => new RegExp(`^${key}=(?<value>.*)$`, "mu").exec(readFileSync(at(".env.local"), "utf8"))?.groups?.value ?? "unset"),
		fileMode: (path: string) => Effect.sync(() => (statSync(at(path)).mode & 0o777).toString(8)),
		filesDifferingFrom: (folder: string) =>
			Effect.sync(() => {
				const here = contents(target());
				const there = contents(join(engine.root, folder));
				return [...here].filter(([path, content]) => there.has(path) && there.get(path) !== content).map(([path]) => path);
			}),
		filesMentioningStarter: () =>
			Effect.sync(() => appFiles(target()).filter((path) => /starter/iu.test(path) || /starter/iu.test(readFileSync(at(path), "utf8")))),
		filesMissingFrom: (folder: string) =>
			Effect.sync(() => {
				const there = new Set(appFiles(join(engine.root, folder)));
				return appFiles(target()).filter((path) => !there.has(path));
			}),
		filesOnlyIn: (folder: string) =>
			Effect.sync(() => {
				const here = new Set(appFiles(target()));
				const only = appFiles(join(engine.root, folder)).filter((path) => !here.has(path));
				return [...new Set(only.map((path) => /^src\/modules\/[^/]+\//u.exec(path)?.[0] ?? path))];
			}),
		guidanceLink: () => Effect.sync(() => readlinkSync(at("CLAUDE.md"))),
		modesOtherThan644: () =>
			Effect.sync(() =>
				Object.fromEntries(
					appFiles(target())
						.map((path) => [path, (statSync(at(path)).mode & 0o777).toString(8)] as const)
						.filter(([, mode]) => mode !== "644"),
				),
			),
		preCommitHook: () => Effect.sync(() => hookAt(at(".git/hooks/pre-commit"))),
		printedCdLeadsTo: () =>
			Effect.sync(() => {
				const cd = engine.printed.split("\n").find((line) => line.trimStart().startsWith("cd "));
				if (cd === undefined) {
					return "no cd line";
				}
				const moved = spawnSync("sh", ["-c", `${cd}\npwd`], { cwd: engine.root, encoding: "utf8" });
				return moved.status === 0 ? relative(realpathSync(engine.root), moved.stdout.trim()) : `cd failed: ${moved.stderr.trim()}`;
			}),
		qualityGateSaw: () =>
			Effect.sync(() =>
				existsSync(at(".git/initial-gate.json"))
					? lines(GateRecord(readFileSync(at(".git/initial-gate.json"), "utf8")).staged)
					: "the gate never ran",
			),
		setupSaw: () =>
			Effect.sync(() => {
				if (!existsSync(at(".git/setup-order.json"))) {
					return "setup never ran in the app's repository";
				}
				const record = SetupRecord(readFileSync(at(".git/setup-order.json"), "utf8"));
				return { commit: record.head === 0 ? "a commit" : "no commit", staged: lines(record.staged) };
			}),
		workspaceHas: (path: string) => Effect.sync(() => existsSync(join(engine.root, path))),
	};
}
