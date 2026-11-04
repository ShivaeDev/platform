import { nonEffectFolderPath } from "#config/nonEffectFolders.ts";

const EFFECT_PLUGINS: ReadonlySet<string> = new Set([
	"ambient-runtime.grit",
	"effect-fn-spans.grit",
	"effect-fn-functions.grit",
	"effect-test-bodies.grit",
	"schema-names.grit",
	"schema-struct-keys.grit",
	"service-layers.grit",
]);

type Plugin = string | { readonly path: string; readonly includes?: readonly string[] };

export function nonEffectPlugins(plugins: readonly Plugin[], folders: readonly string[]) {
	return plugins.map((plugin) => {
		const path = typeof plugin === "string" ? plugin : plugin.path;
		if (!EFFECT_PLUGINS.has(path.replaceAll("\\", "/").split("/").at(-1) ?? "") || folders.length === 0) {
			return plugin;
		}
		const includes = typeof plugin === "string" ? ["**"] : (plugin.includes ?? ["**"]);
		return {
			...(typeof plugin === "string" ? { path } : plugin),
			includes: [...includes, ...folders.map((folder) => `!${nonEffectFolderPath(folder)}/**`)],
		};
	});
}
