import { resourceContract } from "#resource/contract.ts";
import { resourceKit, resourceStory } from "#resource/kit.ts";
import type { ResourceNames } from "#resource/names.ts";
import { resourceCreate, resourceList, resourceUnavailable } from "#resource/operations.ts";
import { resourceMigration, resourceRepository, resourceService } from "#resource/persistence.ts";
import { resourceClient, resourceRegistration } from "#resource/registration.ts";

export function resourceFiles(names: ResourceNames, migration: string) {
	const root = `src/modules/${names.name}`;
	return {
		[`${root}/${names.name}.ts`]: resourceContract(names),
		[`${root}/client/make.ts`]: resourceClient(names),
		[`${root}/server/Repository.ts`]: resourceRepository(names),
		[`${root}/server/migrations/${migration}_${names.table}.ts`]: resourceMigration(names),
		[`${root}/server/registration.ts`]: resourceRegistration(names),
		[`${root}/server/create.ts`]: resourceCreate(names),
		[`${root}/server/list.ts`]: resourceList(names),
		[`${root}/server/unavailable.ts`]: resourceUnavailable(names),
		[`${root}/server/service.ts`]: resourceService(names),
		[`${root}/server/lifecycle.spec.ts`]: resourceStory(names),
		[`${root}/test-support/application.ts`]: resourceKit(names),
	};
}
