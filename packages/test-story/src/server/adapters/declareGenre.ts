import type { EffectTest, EffectTestOptions } from "@shivaedev/test/types.ts";

function withTags(options: number | EffectTestOptions | undefined, tags: readonly string[]): EffectTestOptions {
	if (typeof options === "number") {
		return { tags: [...tags], timeout: options };
	}
	const own = options?.tags ?? [];
	return { ...options, tags: [...tags, ...(typeof own === "string" ? [own] : own)] };
}

// Vitest refuses a tag its config does not declare, so a genre the config leaves out names the test without tagging it.
export function declareGenre(
	declare: EffectTest<unknown, unknown>,
	title: string,
	story: Parameters<EffectTest<unknown, unknown>>[1],
	options: number | EffectTestOptions | undefined,
	tag: string,
) {
	try {
		declare(title, story, withTags(options, [tag]));
	} catch (error) {
		if (!(error instanceof Error && error.message.includes(`"${tag}"`))) {
			throw error;
		}
		declare(title, story, withTags(options, []));
	}
}
