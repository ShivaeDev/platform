export function dependencyManifest(section: string, version: string) {
	return { content: JSON.stringify({ [section]: { effect: version } }), path: "package.json" };
}

export function dependencyCatalog(version = "4.0.6", named = false) {
	return {
		content: named ? `catalogs:\n  runtime:\n    effect: ${version}\n` : `catalog:\n  effect: ${version}\n`,
		path: "pnpm-workspace.yaml",
	};
}
