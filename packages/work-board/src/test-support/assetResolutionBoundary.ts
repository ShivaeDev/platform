import { vi } from "vitest";

const assetResolutionBoundary = vi.hoisted(() => ({ missing: false }));
vi.mock("node:module", async (importOriginal) => {
	const actual = await importOriginal<typeof import("node:module")>();
	return {
		...actual,
		createRequire: (path: string | URL) => ({
			resolve: (id: string) => {
				if (assetResolutionBoundary.missing) {
					throw new Error("Missing dependency");
				}
				return actual.createRequire(path).resolve(id);
			},
		}),
	};
});

export { assetResolutionBoundary };
