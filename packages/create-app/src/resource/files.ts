import { MIGRATIONS_FOLDER } from "@shivaedev/sql/migration.ts";
import { resourceClientModule, resourceScreen, resourceScreenKit, resourceScreenStory } from "#resource/client.ts";
import { resourceModel, resourceModule } from "#resource/contract.ts";
import { resourceKit } from "#resource/kit.ts";
import type { ResourceNames } from "#resource/names.ts";
import { resourceCreate, resourceList } from "#resource/operations.ts";
import { resourceMigration, resourceRepository } from "#resource/persistence.ts";
import { resourceRegistration } from "#resource/registration.ts";
import { resourceStory } from "#resource/story.ts";

export function resourceFiles(names: ResourceNames, migration: string) {
	const root = `src/modules/${names.name}`;
	return {
		[`${root}/${names.pascal}.ts`]: resourceModule(names),
		[`${root}/client/Screen.tsx`]: resourceScreen(names),
		[`${root}/client/module.tsx`]: resourceClientModule(names),
		[`${root}/client/list.dom.spec.ts`]: resourceScreenStory(names),
		[`${root}/model.ts`]: resourceModel(names),
		[`${root}/server/Create.ts`]: resourceCreate(names),
		[`${root}/server/List.ts`]: resourceList(names),
		[`${root}/server/Repository.ts`]: resourceRepository(names),
		[`${root}/server/${MIGRATIONS_FOLDER}/${migration}_${names.table}.ts`]: resourceMigration(names),
		[`${root}/server/registration.ts`]: resourceRegistration(names),
		[`${root}/server/lifecycle.spec.ts`]: resourceStory(names),
		[`${root}/test-support/application.ts`]: resourceKit(names),
		[`${root}/test-support/screen.ts`]: resourceScreenKit(names),
	};
}
