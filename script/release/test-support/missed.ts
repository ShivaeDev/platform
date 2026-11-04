import { releasePullRequest } from "./pullRequest.ts";

export const missed = releasePullRequest.trait("main", "an earlier react release is on main but missing from npm", function* ({ pushMain, write }) {
	yield* write("packages/react/package.json", '{"name":"@shivaedev/react","version":"0.38.0"}\n');
	yield* write(
		"packages/react/CHANGELOG.md",
		"# Changelog\n\n## 0.38.0 - 2026-10-20\n\n### Fixed\n\n- Keep the editor draft during refresh.\n\n## 0.37.0 - 2026-10-01\n\n### Added\n\n- Older react behavior.\n",
	);
	yield* pushMain("README.md", "Workspace with a missed release.\n");
});
