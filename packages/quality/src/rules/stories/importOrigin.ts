function moduleOrigin(from: string | undefined) {
	if (from === "vitest" || from === "@effect/vitest") {
		return "vitest";
	}
	return from === "@shivaedev/test-story" || from === "@shivaedev/test-story/server/storyKit.ts" ? "stories" : undefined;
}

export function importOrigin(from: string | undefined, name?: string) {
	const namespace = moduleOrigin(from);
	if (name === undefined) {
		return namespace;
	}
	if (name === "storyKit" && namespace === "stories") {
		return "factory";
	}
	if ((name === "describe" || name === "suite") && namespace === "vitest") {
		return "suite";
	}
	return (name === "it" || name === "test") && namespace === "vitest" ? "plain" : undefined;
}
