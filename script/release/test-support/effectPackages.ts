import { join } from "node:path";
import { FileSystem } from "effect";
import { releasePullRequest } from "#release/test-support/pullRequest.ts";

export const effectPackages = releasePullRequest.trait("main", "npm packages require Effect 4.1.0", function* ({ root, registry, git }) {
	const fs = yield* FileSystem.FileSystem;
	for (const [name, field, dependencies, extra] of [
		["platform", "peerDependencies", { effect: "catalog:" }, {}],
		["runtime", "dependencies", { "@effect/platform-node": "catalog:" }, {}],
		["testing", "optionalDependencies", { "@effect/vitest": "catalog:" }, {}],
		["form", "peerDependencies", { "@effect/atom-react": "catalog:", effect: "catalog:" }, {}],
		["private-app", "dependencies", { effect: "catalog:" }, { private: true }],
		["dev-only", "devDependencies", { effect: "catalog:" }, {}],
		["current", "peerDependencies", { effect: "4.1.1" }, {}],
	] as const) {
		const version = name === "platform" ? "0.15.0" : "0.1.0";
		const manifest = { [field]: dependencies, ...extra, name: `@shivaedev/${name}`, version };
		yield* fs.makeDirectory(join(root, "packages", name), { recursive: true });
		yield* fs.writeFileString(join(root, "packages", name, "package.json"), JSON.stringify(manifest));
		yield* fs.writeFileString(
			join(root, "packages", name, "CHANGELOG.md"),
			`# Changelog\n\n## ${version} - 2026-10-01\n\n### Changed\n\n- Released behavior.\n`,
		);
		registry.frameworkPublished(manifest.name, version, {
			[field]: Object.fromEntries(Object.entries(dependencies).map(([dependency, range]) => [dependency, range === "catalog:" ? "4.1.0" : range])),
		});
	}
	yield* fs.writeFileString(
		join(root, "pnpm-workspace.yaml"),
		'packages:\n  - packages/*\ncatalog:\n  effect: 4.1.0\n  "@effect/platform-node": 4.1.0\n  "@effect/vitest": 4.1.0\n  "@effect/atom-react": 4.1.0\n',
	);
	git("add", ".");
	git("commit", "-m", "Released Effect packages");
	git("push", "origin", "main");
});

export const awaitingPublication = releasePullRequest.trait("main", "main contains a release not yet on npm", function* ({ root, git }) {
	const fs = yield* FileSystem.FileSystem;
	yield* fs.writeFileString(
		join(root, "packages/runtime/package.json"),
		JSON.stringify({ dependencies: { "@effect/platform-node": "catalog:" }, name: "@shivaedev/runtime", version: "0.1.1" }),
	);
	yield* fs.writeFileString(
		join(root, "packages/runtime/CHANGELOG.md"),
		"# Changelog\n\n## 0.1.1 - 2026-11-07\n\n### Changed\n\n- Align the runtime requirements.\n",
	);
	git("add", ".");
	git("commit", "-m", "Merge a release before npm publication");
	git("push", "origin", "main");
});
