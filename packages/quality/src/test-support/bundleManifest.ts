export const blocked = {
	"./*.ts": "./src/*.ts",
	"./bundle/*": null,
};

export function manifest(exports: object = blocked, bin?: string) {
	return {
		content: JSON.stringify({ bin, devDependencies: { "plain-kit": "workspace:*" }, exports, name: "@acme/app" }),
		path: "modules/app/package.json",
	};
}
