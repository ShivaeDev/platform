import { repositoryStory } from "#test/repositoryStory.ts";
import { syncSkillFixture } from "#test/skillDistribution.ts";

export function syncedSkills(directory = ".") {
	return repositoryStory.trait(
		"repository",
		`the skills tool synced a guide in ${directory} with unformatted JSX and a package manifest, including its Claude link`,
		(engine) => syncSkillFixture(engine, directory),
	);
}
