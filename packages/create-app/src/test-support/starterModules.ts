import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

export function starterModules() {
	const modules = fileURLToPath(new URL("../../../../examples/starter/node_modules", import.meta.url));
	if (!existsSync(modules)) {
		throw new Error("Install workspace dependencies before linking examples/starter/node_modules");
	}
	return modules;
}
