import { expect } from "vitest";
import { app } from "#starter-published/test-support/app.ts";
import { existingOverrides, noPackedDependencies } from "#starter-published/test-support/installerTraits.ts";
import { unpublishedContract } from "#starter-published/test-support/unpublishedContract.ts";

app.it(
	"nested setup and install commands keep one working tarball override per package",
	[unpublishedContract],
	function* ({ setup, install, workspace, installedQuery }) {
		yield* setup();
		yield* install();
		expect(yield* workspace()).toBe('packages: []\n\noverrides:\n  "@shivaedev/contract": "file:../archives/effect-contract.tgz"\n');
		expect(yield* installedQuery()).toBe("42\n");
	},
);

app.it(
	"replacing a tarball preserves other overrides and the same package's catalog entry",
	[unpublishedContract, existingOverrides],
	function* ({ workspace, installedQuery }) {
		expect(yield* workspace()).toBe(
			'packages: []\n\noverrides:\n  "@shivaedev/contract": "file:../archives/effect-contract.tgz"\n  effect: 4.0.4\n\ncatalog:\n  "@shivaedev/contract": 0.9.0\n',
		);
		expect(yield* installedQuery()).toBe("42\n");
	},
);

app.it(
	"installing an app without tarballs leaves its workspace unchanged",
	[unpublishedContract, noPackedDependencies],
	function* ({ install, workspace }) {
		yield* install();
		expect(yield* workspace()).toBe("packages: []\n");
	},
);
