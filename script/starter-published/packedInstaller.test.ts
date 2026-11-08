import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { app } from "#starter-published/test-support/app.ts";
import { existingOverrides } from "#starter-published/test-support/installerTraits.ts";
import { unpublishedContract } from "#starter-published/test-support/unpublishedContract.ts";

app.it(
	"nested setup and install commands keep one working tarball override per package",
	[unpublishedContract],
	function* ({ setup, install, workspace, installedQuery }) {
		yield* setup();
		yield* install();
		yield* outcomes([
			[
				"workspace",
				() => workspace(),
				'minimumReleaseAge: 10080\nminimumReleaseAgeStrict: false\npackages: []\n\noverrides:\n  "@shivaedev/contract": "file:../archives/contract.tgz"\n',
			],
			["installed query", () => installedQuery(), "42\n"],
		]);
	},
);

app.it(
	"replacing a tarball preserves other overrides and the same package's catalog entry",
	[unpublishedContract, existingOverrides],
	function* ({ workspace, installedQuery }) {
		yield* outcomes([
			[
				"workspace",
				() => workspace(),
				'minimumReleaseAge: 10080\nminimumReleaseAgeStrict: false\npackages: []\n\noverrides:\n  "@shivaedev/contract": "file:../archives/contract.tgz"\n  effect: 4.0.4\n\ncatalog:\n  "@shivaedev/contract": 0.9.0\n',
			],
			["installed query", () => installedQuery(), "42\n"],
		]);
	},
);
