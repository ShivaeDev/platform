import type { ReleasePlan, Source } from "@shivaedev/releases/model.ts";

export function starterPinsInput(plan: ReleasePlan, pins: Readonly<Record<string, string>>): Source | undefined {
	if (
		!plan.releases.some((release) => Object.hasOwn(pins, release.name))
		|| plan.releases.some((release) => release.name === "@shivaedev/create-app")
	) {
		return undefined;
	}
	return {
		name: "release-starter-pins.md",
		text: '---\n"@shivaedev/create-app": patch\n---\n\n### Changed\n\n- Generated apps use the latest released starter dependencies.\n',
	};
}
