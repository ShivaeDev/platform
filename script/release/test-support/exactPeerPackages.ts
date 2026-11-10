import { join } from "node:path";
import { FileSystem } from "effect";
import { releasePullRequest } from "#release/test-support/pullRequest.ts";

export const exactPeerPackages = releasePullRequest.trait(
	"main",
	"npm packages declare vitest 5.0.5, better-auth 1.7.14, Effect 4.1.0, a named-catalog peer and a workspace dependency as published",
	function* ({ root, registry, git }) {
		const fs = yield* FileSystem.FileSystem;
		for (const [name, declared, published] of [
			["test-story", { peerDependencies: { vitest: "catalog:" } }, { peerDependencies: { vitest: "5.0.5" } }],
			["identity", { peerDependencies: { "better-auth": "catalog:" } }, { peerDependencies: { "better-auth": "1.7.14" } }],
			["errors", { peerDependencies: { effect: "catalog:" } }, { peerDependencies: { effect: "4.1.0" } }],
			[
				"agent",
				{ dependencies: { "@shivaedev/errors": "workspace:*" }, peerDependencies: { "@modelcontextprotocol/sdk": "catalog:claude-code" } },
				{ dependencies: { "@shivaedev/errors": "0.1.0" }, peerDependencies: { "@modelcontextprotocol/sdk": "1.0.0" } },
			],
		] as const) {
			const manifest = { ...declared, name: `@shivaedev/${name}`, version: "0.1.0" };
			yield* fs.makeDirectory(join(root, "packages", name), { recursive: true });
			yield* fs.writeFileString(join(root, "packages", name, "package.json"), JSON.stringify(manifest));
			yield* fs.writeFileString(
				join(root, "packages", name, "CHANGELOG.md"),
				"# Changelog\n\n## 0.1.0 - 2026-10-01\n\n### Changed\n\n- Released behavior.\n",
			);
			registry.frameworkPublished(manifest.name, manifest.version, published);
		}
		yield* fs.writeFileString(join(root, "pnpm-workspace.yaml"), exactPeerCatalog("5.0.5", "1.7.14"));
		git("add", ".");
		git("commit", "-m", "Released exact peer packages");
		git("push", "origin", "main");
	},
);

export function exactPeerCatalog(vitest: string, betterAuth: string) {
	return `packages:\n  - packages/*\ncatalog:\n  vitest: ${vitest}\n  better-auth: ${betterAuth}\n  effect: 4.1.0\ncatalogs:\n  claude-code:\n    "@modelcontextprotocol/sdk": 1.0.0\n`;
}
