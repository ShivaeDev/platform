import { releasePullRequest } from "#release/test-support/pullRequest.ts";

export const CREATE_APP_BREAKING = "Replace `create --name` → `create <name>`.";
const LONG_NOTE = `- ${"Explain one more generated file. ".repeat(4000)}`;

export const shellRelease = releasePullRequest.trait(
	"main",
	`platform is a shell exporting only its package.json over create-app, which the starter also pins, and create-app ships the Breaking entry "${CREATE_APP_BREAKING}"`,
	function* ({ write, pushMain }) {
		yield* write(
			"packages/platform/package.json",
			JSON.stringify({
				dependencies: { "@shivaedev/create-app": "workspace:*" },
				exports: { "./package.json": "./package.json" },
				name: "@shivaedev/platform",
				version: "0.15.0",
			}),
		);
		yield* write("examples/starter/published-versions.json", '{"@shivaedev/create-app":"0.9.0","@shivaedev/platform":"0.15.0"}\n');
		yield* pushMain(".changeset/create-app.md", `---\n"@shivaedev/create-app": minor\n---\n\n### Breaking\n\n- ${CREATE_APP_BREAKING}\n`);
	},
);

export const oversizedRelease = releasePullRequest.trait(
	"main",
	`create-app ships the Breaking entry "${CREATE_APP_BREAKING}" beside a ${LONG_NOTE.length}-character Changed note, and platform a short fix`,
	function* ({ write, pushMain }) {
		yield* write(".changeset/platform.md", '---\n"@shivaedev/platform": patch\n---\n\n### Fixed\n\n- Keep a saved draft.\n');
		yield* pushMain(
			".changeset/create-app.md",
			`---\n"@shivaedev/create-app": minor\n---\n\n### Changed\n\n${LONG_NOTE}\n\n### Breaking\n\n- ${CREATE_APP_BREAKING}\n`,
		);
	},
);
