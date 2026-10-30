import { DateTime, Schema } from "effect";
import { Model } from "effect/schema";

export class PullRequest extends Model.Class<PullRequest>("PullRequest")({
	id: Schema.Int,
	title: Schema.String,
	updatedAt: Schema.DateTimeUtcFromDate,
}) {}

export function revision(hour: number, id = 1) {
	return { id, title: `Revision ${hour}`, updatedAt: DateTime.makeUnsafe(`2026-10-25T${String(hour).padStart(2, "0")}:00:00Z`) };
}
