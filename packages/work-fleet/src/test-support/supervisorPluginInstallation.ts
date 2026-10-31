import { cpSync, existsSync, readdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export function supervisorPluginInstallation(root: string) {
	const source = fileURLToPath(new URL("../../../work-board-plugin/", import.meta.url));
	const plugin = join(root, "work-board-plugin");
	cpSync(source, plugin, {
		filter: (file) => !["node_modules", "dist", "generated"].includes(file.split("/").at(-1) ?? ""),
		recursive: true,
	});
	symlinkSync(join(source, "node_modules"), join(plugin, "node_modules"));
}

export function supervisorPluginFiles(root: string) {
	const plugin = join(root, "work-board-plugin");
	const generated = join(plugin, "src/adapters/generated");
	return {
		bundle: () =>
			existsSync(generated)
				? readdirSync(generated)
						.map((file) => readFileSync(join(generated, file), "utf8"))
						.join("\n")
				: undefined,
		edit: (text: string) => {
			const file = join(plugin, "src/register.tsx");
			writeFileSync(file, readFileSync(file, "utf8").replace(/^const TITLE = .*;$/mu, text));
		},
		registerExists: () => existsSync(join(generated, "register.js")),
	};
}
