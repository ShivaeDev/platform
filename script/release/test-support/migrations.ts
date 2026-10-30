import { releasePullRequest } from "./pullRequest.ts";

export const migrationPlan = releasePullRequest.trait(
	"main",
	"three packages have breaking changes and a new quality rule needs adoption",
	function* ({ write, pushMain }) {
		yield* write("packages/quality/package.json", '{"name":"@shivaedev/quality","version":"0.8.0"}\n');
		yield* write("packages/quality/CHANGELOG.md", "# Changelog\n");
		yield* write(
			".changeset/platform.md",
			'---\n"@shivaedev/platform": minor\n---\n\n### Breaking\n\n- Replace `oldQuery` → `query`.\n  Pass the contract as the first argument.\n- Replace `oldAction` → `command`.\n',
		);
		yield* write(
			".changeset/create-app.md",
			'---\n"@shivaedev/create-app": minor\n---\n\n### Breaking\n\n- Replace `create --name` → `create <name>`.\n',
		);
		yield* pushMain(
			".changeset/quality.md",
			'---\n"@shivaedev/quality": minor\n---\n\n### Breaking\n\n- Replace `quality.config.js` → `quality.config.ts`.\n\n### Quality rules\n\n- `imports/aliased`: require aliases across folders. Record existing findings with `quality baseline write --rule imports/aliased`; fix them by replacing cross-folder relative imports with aliases.\n',
		);
	},
);

export const patchPlan = releasePullRequest.trait("main", "a patch fixes saved drafts without breaking changes or quality rules", ({ pushMain }) =>
	pushMain(".changeset/draft.md", '---\n"@shivaedev/platform": patch\n---\n\n### Fixed\n\n- Keep a saved draft.\n'),
);
