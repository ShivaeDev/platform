export function outsideLibrary(name: string, declarations: string) {
	return [
		{ content: JSON.stringify({ name, types: "index.d.ts" }), path: `node_modules/${name}/package.json` },
		{ content: declarations, path: `node_modules/${name}/index.d.ts` },
	];
}
