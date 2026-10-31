import type { SeedFile } from "./tree.ts";

export const blocked = {
	"./*.ts": "./src/*.ts",
	"./bundle/*": null,
};

export function bundleManifest(exports: object = blocked, bin?: unknown): SeedFile {
	return {
		content: JSON.stringify({ bin, devDependencies: { "plain-kit": "workspace:*" }, exports, name: "@acme/app" }),
		path: "modules/app/package.json",
	};
}
