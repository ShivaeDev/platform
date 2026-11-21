import { Schema } from "effect";

function owner(name: string | undefined, adminPage: string | undefined) {
	if (name !== undefined) {
		return `"${name}"`;
	}
	return adminPage === undefined ? "a registration with no name" : `the registration of admin page "${adminPage}"`;
}

// A registration without a name is found by its first admin page, and one with neither is only described.
export class DuplicateModuleQueue extends Schema.TaggedError<DuplicateModuleQueue>()("DuplicateModuleQueue", {
	firstAdminPage: Schema.optional(Schema.String),
	firstModule: Schema.optional(Schema.String),
	queue: Schema.String,
	secondAdminPage: Schema.optional(Schema.String),
	secondModule: Schema.optional(Schema.String),
}) {
	override get message() {
		const first = owner(this.firstModule, this.firstAdminPage);
		const second = owner(this.secondModule, this.secondAdminPage);
		const unfound = [first, second].includes("a registration with no name")
			? " Give the registration with no name a `name` so this message can name it."
			: "";
		return `Queue "${this.queue}" is declared by both ${first} and ${second}.${unfound}`;
	}
}
