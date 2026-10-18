import type { EngineInterface } from "claude-code";
import { workFolder } from "./rpc.ts";

function ancestors(cwd: string): string[] {
	const parts = cwd.split("/").filter((part) => part !== "");
	const directories: string[] = [];
	for (let depth = parts.length; depth >= 0; depth -= 1) {
		directories.push(`/${parts.slice(0, depth).join("/")}`);
	}
	return directories;
}

export async function findBoard($: EngineInterface, cwd: string): Promise<string | null> {
	for (const directory of ancestors(cwd)) {
		const stat = await $.fs.stat(workFolder(directory)).catch(() => undefined);
		if (stat?.kind === "dir") {
			return directory;
		}
	}
	return null;
}
