import { Schema } from "effect";

export class OwnedTableCycle extends Schema.TaggedError<OwnedTableCycle>()("OwnedTableCycle", {
	tables: Schema.Array(Schema.String),
}) {
	override get message() {
		return `Owned tables reference each other through RESTRICT or NO ACTION foreign keys in a cycle, so no order can erase them: ${this.tables.join(", ")}`;
	}
}
