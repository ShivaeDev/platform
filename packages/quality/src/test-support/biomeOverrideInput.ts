export function biomeOverrideInput(rules: unknown) {
	return {
		content: JSON.stringify({ extends: ["@shivaedev/quality/biome"], overrides: [{ includes: ["src/vitest.ts"], linter: { rules } }] }),
		path: "biome.json",
	};
}
