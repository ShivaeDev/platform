import type { Input } from "@shivaedev/agent/run.ts";

export function textOf(input: Input) {
	return input.parts.map((part) => part.text).join("\n");
}
