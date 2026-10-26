import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, renameSync, symlinkSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Effect, FileSystem, Redacted } from "effect";
import { PostgresTestDatabase } from "@shivaedev/effect-test-sql/server/database.ts";
import { codexServer } from "#test/codex.ts";

export const supervisorInstallation = Effect.fn("FleetTest.supervisorInstallation")(function* (delayedLive = false) {
	const database = yield* PostgresTestDatabase;
	const provider = yield* codexServer(() => ({}));
	const fs = yield* FileSystem.FileSystem;
	const root = yield* fs.makeTempDirectoryScoped({ prefix: "fleet-up-" });
	const boardDir = join(root, "notes");
	const installed = join(root, "fleet");
	const modules = join(root, "node_modules/@shivaedev");
	mkdirSync(modules, { recursive: true });
	symlinkSync(installed, join(modules, "work-fleet"));
	const source = fileURLToPath(new URL("../../", import.meta.url));
	mkdirSync(boardDir);
	mkdirSync(installed, { recursive: true });
	cpSync(join(source, "src"), join(installed, "src"), { recursive: true });
	cpSync(join(source, "package.json"), join(installed, "package.json"));
	symlinkSync(join(source, "node_modules"), join(installed, "node_modules"));
	const boardPackage = createRequire(join(installed, "package.json")).resolve("@shivaedev/work-board/package.json");
	const boardCli = join(dirname(boardPackage), "src/server/cli.ts");
	const cli = join(installed, "src/cli.ts");
	writeFileSync(
		join(boardDir, "question.md"),
		"---\nid: decision.operator\nkind: question\nscope: task\nurgency: whenever\nattention:\n  - id: direction\n    kind: decision\n    state: open\n    reason: Choose the launch\n    response_from: [operator]\n    unblocks: [decision.operator]\n---\n# Choose the launch\n",
	);
	writeFileSync(join(root, "README.md"), "# Consumer repository\n");
	writeFileSync(join(boardDir, "home.md"), "# Supervisor home\n\nConsumer board content.\n");
	writeFileSync(
		join(boardDir, "fleet.config.json"),
		JSON.stringify({
			database: { url: Redacted.value(database.url) },
			intervalSeconds: 1,
			local: { endpoint: provider.endpoint },
			namespace: "supervised_fleet",
			provider: "local",
			quota: "unlimited",
		}),
	);
	execFileSync("git", ["init", "--quiet", "--initial-branch=main", root]);
	execFileSync("git", [
		"-C",
		root,
		"-c",
		"user.name=Fixture",
		"-c",
		"user.email=fixture@example.test",
		"commit",
		"--quiet",
		"--allow-empty",
		"-m",
		"Consumer fixture",
	]);
	const daemonFile = join(installed, "src/host/daemon.ts");
	if (delayedLive) {
		writeFileSync(
			daemonFile,
			readFileSync(daemonFile, "utf8")
				.replace("HttpRouter, HttpServerResponse", "HttpRouter, HttpServerRequest, HttpServerResponse")
				.replace(
					"HttpServerResponse.empty({ status: 204 })",
					'Effect.gen(function* () { const request = yield* HttpServerRequest.HttpServerRequest; if (request.url.includes("?slow")) { yield* Effect.logInfo("slow live request started"); yield* Effect.sleep("22 seconds"); } return HttpServerResponse.empty({ status: 204 }); })',
				),
		);
	}

	return {
		boardCli,
		boardDir,
		changeCode: () => writeFileSync(daemonFile, readFileSync(daemonFile, "utf8").replace("status: 204", "status: 201")),
		cli,
		daemonFile,
		root,
		upgrade: () => {
			const next = join(root, "fleet-next");
			cpSync(installed, next, { recursive: true });
			const nextDaemon = join(next, "src/host/daemon.ts");
			writeFileSync(nextDaemon, readFileSync(nextDaemon, "utf8").replace("status: 204", "status: 201"));
			const link = join(modules, "work-fleet");
			symlinkSync(next, `${link}.next`);
			renameSync(`${link}.next`, link);
		},
	};
});
