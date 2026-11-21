import { Schema } from "effect";

export class OwnedModelsUncollected extends Schema.TaggedError<OwnedModelsUncollected>()("OwnedModelsUncollected", {}) {
	override get message() {
		return "No collector receives the owned models that repositories report, so identity cannot see what to export, erase or count as covered: provide collectRepositoryModels from @shivaedev/sql/RepositoryModels.ts before the repositories are built, as appHost does";
	}
}
