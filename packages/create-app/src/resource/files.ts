import { resourceContract } from "./contract.ts";
import { resourceKit, resourceStory } from "./kit.ts";
import type { ResourceNames } from "./names.ts";
import { resourceMigration, resourceRepository, resourceService } from "./persistence.ts";
import { resourceClient, resourceRegistration } from "./registration.ts";

export function resourceFiles(names: ResourceNames, migration: string) {
	const root = `src/modules/${names.name}`;
	return {
		[`${root}/${names.name}.ts`]: resourceContract(names),
		[`${root}/client/make.ts`]: resourceClient(names),
		[`${root}/server/makeRepository.ts`]: resourceRepository(names),
		[`${root}/server/migrations/${migration}_${names.table}.ts`]: resourceMigration(names),
		[`${root}/server/registration.ts`]: resourceRegistration(names),
		[`${root}/server/Service.ts`]: resourceService(names),
		[`${root}/server/lifecycle.spec.ts`]: resourceStory(names),
		[`${root}/test-support/application.ts`]: resourceKit(names),
	};
}
