import type { Path } from "effect";

export const BIN = "shivaedev-skills";
export const PACKAGE = "@shivaedev/skills";
export const SELECTION_FIELD = "shivaedevSkills";
export const AGENTS_SKILLS = ".agents/skills";
export const CLAUDE_SKILLS = ".claude/skills";
export const MANIFEST = `${AGENTS_SKILLS}/.shivaedev-skills.json`;

export interface SkillPaths {
	readonly copy: string;
	readonly link: string;
	readonly linkTarget: string;
}

export function skillPaths(path: Path.Path, repo: string, name: string): SkillPaths {
	const copy = path.join(repo, AGENTS_SKILLS, name);
	const link = path.join(repo, CLAUDE_SKILLS, name);
	return { copy, link, linkTarget: path.relative(path.dirname(link), copy) };
}
