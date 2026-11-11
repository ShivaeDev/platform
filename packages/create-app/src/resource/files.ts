import { resourceModel, resourceModule } from "#resource/contract.ts";
import { resourceKit } from "#resource/kit.ts";
import type { ResourceNames } from "#resource/names.ts";
import { resourceCreate, resourceList } from "#resource/operations.ts";
import { resourceMigration, resourceRepository } from "#resource/persistence.ts";
import { resourceClient, resourceRegistration } from "#resource/registration.ts";
import { resourceStory } from "#resource/story.ts";

export function resourceFiles(names: ResourceNames, migration: string) {
	const root = `src/modules/${names.name}`;
	return {
		[`${root}/${names.pascal}.ts`]: resourceModule(names),
		[`${root}/model.ts`]: resourceModel(names),
		[`${root}/client/make.ts`]: resourceClient(names),
		[`${root}/server/Create.ts`]: resourceCreate(names),
		[`${root}/server/List.ts`]: resourceList(names),
		[`${root}/server/Repository.ts`]: resourceRepository(names),
		[`${root}/server/migrations/${migration}_${names.table}.ts`]: resourceMigration(names),
		[`${root}/server/registration.ts`]: resourceRegistration(names),
		[`${root}/server/lifecycle.spec.ts`]: resourceStory(names),
		[`${root}/test-support/application.ts`]: resourceKit(names),
	};
}
