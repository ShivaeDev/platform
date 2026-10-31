import { DateTime, Schema } from "effect";
import { Model } from "effect/schema";
import { bucket } from "@shivaedev/changes/buckets.ts";
import { jsonb } from "#jsonb.ts";

export const Details = Schema.NullOr(
	Schema.Struct({
		amount: Schema.NumberFromString.check(Schema.isFinite()),
		routes: Schema.Array(Schema.Struct({ routeKey: Schema.String })),
	}),
);

export class Profile extends Model.Class<Profile>("Profile")({
	details: jsonb(Details),
	firstSeen: Schema.DateTimeUtcFromDate,
	id: Schema.NumberFromString,
	name: Schema.String,
	note: Schema.optionalKey(Schema.NullOr(Schema.String)),
	owner: bucket(Schema.String),
	updatedAt: Model.DateTimeUpdateFromDate,
}) {}

export const original = {
	details: { amount: 7, routes: [{ routeKey: "home" }] },
	firstSeen: DateTime.makeUnsafe("2026-10-01T00:00:00Z"),
	id: 1,
	name: "Draft",
	note: null,
	owner: "alice",
	updatedAt: Model.Override(DateTime.makeUnsafe("2026-10-02T00:00:00Z")),
};

export function printed(row: Profile) {
	return { ...row, firstSeen: DateTime.formatIso(row.firstSeen), updatedAt: DateTime.formatIso(row.updatedAt) };
}
