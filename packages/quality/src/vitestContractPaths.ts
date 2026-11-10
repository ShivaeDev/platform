import { posix } from "node:path";

function commandPaths(directory: string, command: string): readonly string[] {
	const paths: string[] = [];
	const words = (command.match(/(?:[^\s"']|"[^"]*"|'[^']*')+/gu) ?? []).map((word) => word.replaceAll(/["']/gu, ""));
	const tool = words.indexOf("vitest");
	if (tool < 0) {
		return [];
	}
	for (let index = tool + 1; index < words.length; index += 1) {
		const [flag, inline] = (words[index] ?? "").split("=", 2);
		if (flag !== "--config" && flag !== "--reporter") {
			continue;
		}
		const value = inline ?? words[index + 1];
		if (value !== undefined && !value.startsWith("-")) {
			paths.push(posix.join(directory, value));
		}
	}
	return paths;
}

export function vitestContractPaths(directory: string, scripts: Readonly<Record<string, string>>): readonly string[] {
	return Object.values(scripts).flatMap((script) => script.split(/[;&|]+/u).flatMap((command) => commandPaths(directory, command)));
}
