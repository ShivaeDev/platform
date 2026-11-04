import { expect } from "@effect/vitest";
import { dependencyCatalog, dependencyManifest } from "#test/dependencyPinFiles.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";
import { manifestsDependencyPins } from "./manifestsDependencyPins.ts";

for (const section of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]) {
	for (const version of ["4.0.6", "4.0.6-rc.1+build.2", "npm:@effect/core@4.0.6", "workspace:*", "file:../effect", "link:../effect"]) {
		ruleStory.it(
			`dependency pins accepts ${version} in ${section} without catalogs`,
			[repositoryHas(dependencyManifest(section, version))],
			function* ({ check }) {
				const findings = yield* check(manifestsDependencyPins);

				expect(findings).toEqual([]);
			},
		);
	}
	for (const version of ["^4.0.6", "~4.0.6", ">=4.0.6", "*", "latest", "4.0", "npm:effect@^4.0.6", "git+https://example.com/effect.git"]) {
		ruleStory.it(`dependency pins reports ${version} in ${section}`, [repositoryHas(dependencyManifest(section, version))], function* ({ check }) {
			const findings = yield* check(manifestsDependencyPins);

			expect(findings).toEqual([
				{
					file: "package.json",
					message: `${section} entry "effect: ${version}" must pin an exact version, including for npm aliases. Workspace, file and link dependencies stay local.`,
					subject: `${section}.effect`,
				},
			]);
		});
	}
}

for (const [named, version] of [
	[false, "catalog:"],
	[true, "catalog:runtime"],
] as const) {
	ruleStory.it(
		`dependency pins accepts ${version} with an exact catalog entry`,
		[repositoryHas(dependencyManifest("dependencies", version), dependencyCatalog("4.0.6", named))],
		function* ({ check }) {
			const findings = yield* check(manifestsDependencyPins);

			expect(findings).toEqual([]);
		},
	);
	ruleStory.it(
		`dependency pins reports a range in ${version}`,
		[repositoryHas(dependencyManifest("dependencies", version), dependencyCatalog("^4.0.6", named))],
		function* ({ check }) {
			const findings = yield* check(manifestsDependencyPins);

			expect(findings).toEqual([
				{
					file: "pnpm-workspace.yaml",
					line: named ? 3 : 2,
					message: 'Catalog entry "effect: ^4.0.6" is not an exact version. Pin one version, including for npm aliases.',
				},
			]);
		},
	);
}

for (const version of ["4.0.6", "catalog:missing"]) {
	ruleStory.it(
		`dependency pins reports ${version} when the workspace has a catalog`,
		[repositoryHas(dependencyManifest("dependencies", version), dependencyCatalog())],
		function* ({ check }) {
			const findings = yield* check(manifestsDependencyPins);

			expect(findings).toEqual([
				{
					file: "package.json",
					message: `dependencies entry "effect: ${version}" must use "catalog:" (or a named catalog) with an entry for this dependency in pnpm-workspace.yaml. Workspace, file and link dependencies stay local.`,
					subject: "dependencies.effect",
				},
			]);
		},
	);
}

ruleStory.it(
	"dependency pins reports a catalog reference without the dependency's entry",
	[repositoryHas(dependencyManifest("dependencies", "catalog:"))],
	function* ({ check, messages }) {
		yield* check(manifestsDependencyPins);

		expect(yield* messages()).toEqual([
			'dependencies entry "effect: catalog:" must use "catalog:" (or a named catalog) with an entry for this dependency in pnpm-workspace.yaml. Workspace, file and link dependencies stay local.',
		]);
	},
);

for (const content of ["catalog: { effect: ^4.0.6 }", "catalogs:\n  runtime: { effect: ^4.0.6 }", "catalog:\n  <<: *shared"]) {
	ruleStory.it(
		`dependency pins asks for a block mapping for ${content}`,
		[repositoryHas({ content, path: "pnpm-workspace.yaml" })],
		function* ({ check, messages }) {
			yield* check(manifestsDependencyPins);

			expect(yield* messages()).toEqual([expect.stringMatching(/(?:indented block mapping|not an exact version)/u)]);
		},
	);
}

ruleStory.it(
	"dependency pins checks manifests outside source folders and preserves quoted aliases and catalog comments",
	[
		repositoryHas(
			{ content: 'packages: [packages/*]\n"catalog":\n  "effect": "npm:effect@4.0.6" # pinned\n', path: "pnpm-workspace.yaml" },
			{ content: '{"name":"app","dependencies":{"effect":"^4.0.6"}}', path: "packages/app/package.json" },
		),
	],
	function* ({ check, locations }) {
		yield* check(manifestsDependencyPins);

		expect(yield* locations()).toEqual(["packages/app/package.json"]);
	},
);

ruleStory.it(
	"dependency pins uses the parent workspace catalog for a nested Quality root",
	[repositoryHas(dependencyCatalog(), { content: '{"dependencies":{"effect":"catalog:"}}', path: "packages/app/package.json" })],
	function* ({ check }) {
		const findings = yield* check(manifestsDependencyPins, undefined, "packages/app");

		expect(findings).toEqual([]);
	},
);

ruleStory.it(
	"dependency pins reports a parent catalog range at the workspace file",
	[repositoryHas(dependencyCatalog("^4.0.6"), { content: '{"dependencies":{"effect":"catalog:"}}', path: "packages/app/package.json" })],
	function* ({ check }) {
		const findings = yield* check(manifestsDependencyPins, undefined, "packages/app");

		expect(findings).toEqual([
			{
				file: "../../pnpm-workspace.yaml",
				line: 2,
				message: 'Catalog entry "effect: ^4.0.6" is not an exact version. Pin one version, including for npm aliases.',
			},
		]);
	},
);

ruleStory.it(
	"dependency pins stops at the nearest workspace even when its parent has a catalog",
	[
		repositoryHas(
			dependencyCatalog("^4.0.6"),
			{ content: "packages: []\n", path: "packages/app/pnpm-workspace.yaml" },
			{ content: '{"dependencies":{"effect":"4.0.6"}}', path: "packages/app/package.json" },
		),
	],
	function* ({ check }) {
		const findings = yield* check(manifestsDependencyPins, undefined, "packages/app");

		expect(findings).toEqual([]);
	},
);

ruleStory.it(
	"dependency pins accepts quoted and commented catalog headings",
	[
		repositoryHas(dependencyManifest("dependencies", "catalog:runtime"), {
			content: '"catalog": # default versions\n  unused: 1.0.0\n"catalogs": # named versions\n  runtime:\n    effect: 4.0.6\n',
			path: "pnpm-workspace.yaml",
		}),
	],
	function* ({ check }) {
		const findings = yield* check(manifestsDependencyPins);

		expect(findings).toEqual([]);
	},
);
