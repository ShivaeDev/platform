import { Schema } from "effect";

export class DelegationRuleMissing extends Schema.TaggedError<DelegationRuleMissing>()("DelegationRuleMissing", { service: Schema.String }) {
	override get message() {
		return `A served module names a delegated subject whose rule is the service "${this.service}", and the host's services do not provide it. Add the Layer of the service defined with id "${this.service}" to the host's services.`;
	}
}
