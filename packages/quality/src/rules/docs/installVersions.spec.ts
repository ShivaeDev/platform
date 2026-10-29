import { expect } from "vitest";
import { repositoryHas, ruleKit } from "#rule-story";
import { docsUnversionedInstalls } from "#rules/docs/unversionedInstalls.ts";
import { markdown } from "#test/docsRepository.ts";

ruleKit.it(
	"install commands in shell blocks and inline code name packages without versions, while tags, other code and changelogs pass",
	[
		repositoryHas(
			markdown(
				"README.md",
				"# Tools",
				"",
				"```sh",
				"pnpm add @acme/lib effect@4.0.5",
				"pnpm dlx @acme/create@latest my-app",
				"```",
				"",
				"Run `npm install -D vitest@^5 typescript` before `pnpm add @acme/lib`.",
				"",
				"```ts",
				'const command = "pnpm add effect@4.0.5";',
				"```",
			),
			markdown("CHANGELOG.md", "# Changelog", "", "- Install with `pnpm add effect@4.0.4`."),
		),
	],
	function* ({ checks, writes }) {
		const findings = yield* checks(docsUnversionedInstalls);
		expect(findings.map((finding) => [finding.line, finding.subject])).toEqual([
			[4, "effect@4.0.5"],
			[8, "vitest@^5"],
		]);
		expect(findings[0]?.message).toBe(
			'"effect@4.0.5" pins a version in an install command. Name the package alone, effect: its manifest\'s version ranges decide what installs, and a version written in documentation goes stale with the next release.',
		);
		yield* writes(markdown("README.md", "# Tools", "", "```sh", "pnpm add @acme/lib effect", "```", "", "Run `npm install -D vitest typescript`."));
		expect(yield* checks(docsUnversionedInstalls)).toEqual([]);
	},
);
