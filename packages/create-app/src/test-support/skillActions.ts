import { appendFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Effect, Schema } from "effect";

const selection = Schema.decodeUnknownSync(Schema.fromJsonString(Schema.Struct({ shivaedevSkills: Schema.optional(Schema.Array(Schema.String)) })));

export function skillActions(target: () => string, story: { tell: (line: string) => void }) {
	return {
		editSkill: (name: string) =>
			Effect.sync(() => {
				story.tell(`the app edits its managed ${name} skill`);
				appendFileSync(join(target(), ".agents/skills", name, "SKILL.md"), "\nApp-specific instructions.\n");
			}),
		installedSkill: (name: string) =>
			Effect.sync(() => readFileSync(join(target(), "node_modules/@shivaedev/skills/skills", name, "SKILL.md"), "utf8")),
		skillSelection: () => Effect.sync(() => selection(readFileSync(join(target(), "package.json"), "utf8")).shivaedevSkills ?? []),
	};
}
