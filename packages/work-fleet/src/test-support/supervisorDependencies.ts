import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export function supervisorDependencies(root: string) {
	const manifest = join(root, "package.json");
	const lock = join(root, "pnpm-lock.yaml");
	const snapshots = new Map<string, { manifest: string; lock: string }>();
	for (const version of ["one", "two"]) {
		const dependency = join(root, "dependencies", version);
		mkdirSync(dependency, { recursive: true });
		writeFileSync(join(dependency, "package.json"), JSON.stringify({ main: "index.js", name: "fleet-supervisor-dependency", version: "1.0.0" }));
		writeFileSync(join(dependency, "index.js"), `exports.title = "${version}";\n`);
		writeFileSync(manifest, JSON.stringify({ dependencies: { "fleet-supervisor-dependency": `file:dependencies/${version}` }, private: true }));
		execFileSync("pnpm", ["install", "--lockfile-only", "--no-frozen-lockfile", "--offline", "--ignore-scripts"], { cwd: root, stdio: "pipe" });
		snapshots.set(version, { lock: readFileSync(lock, "utf8"), manifest: readFileSync(manifest, "utf8") });
	}
	function change(version: string) {
		const snapshot = snapshots.get(version);
		if (snapshot === undefined) {
			throw new Error(`Unknown fixture dependency ${version}`);
		}
		writeFileSync(manifest, snapshot.manifest);
		writeFileSync(lock, snapshot.lock);
	}
	change("one");
	execFileSync("pnpm", ["install", "--frozen-lockfile", "--offline", "--ignore-scripts"], { cwd: root, stdio: "pipe" });
	const build = join(root, "work-board-plugin/script/build-client.ts");
	writeFileSync(
		build,
		`import { title } from "fleet-supervisor-dependency";\nconsole.log(\`building with dependency \${title}\`);\n${readFileSync(build, "utf8")}`,
	);
	return {
		change: () => change("two"),
		fail: () => writeFileSync(lock, `${readFileSync(lock, "utf8")}\ninvalid: [\n`),
	};
}
