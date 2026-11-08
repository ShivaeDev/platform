import { expect, it } from "vitest";
import { matchingWorkspaceTarballs } from "#package-check/adapters/matchingWorkspaceTarballs.ts";
import type { Package } from "#package-check/model.ts";

it("selects workspace archives that match the starter's package pins", () => {
	const packages: Package[] = [
		{
			directory: "/workspace/deploy",
			manifest: { name: "@shivaedev/deploy", version: "0.5.1" },
			tarball: "/archives/deploy.tgz",
		},
		{
			directory: "/workspace/platform",
			manifest: { name: "@shivaedev/platform", version: "0.40.13" },
			tarball: "/archives/platform.tgz",
		},
	];

	const tarballs = matchingWorkspaceTarballs(packages, { "@shivaedev/deploy": "0.5.1" });

	expect(tarballs).toEqual({ "@shivaedev/deploy": "/archives/deploy.tgz" });
});
