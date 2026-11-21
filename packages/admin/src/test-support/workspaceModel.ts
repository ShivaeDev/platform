import { Schema } from "effect";
import { Model } from "effect/schema";
import { bucket } from "@shivaedev/changes/buckets.ts";
import { collection } from "@shivaedev/changes/keys.ts";

export class Workspace extends Model.Class<Workspace>("AdminCollectionWorkspace")({
	id: Model.Field({ json: Schema.Int, select: Schema.Int, update: Schema.Int }),
	tenant: bucket(Schema.String),
	title: Schema.String,
}) {}

export const workspaces = collection("admin_workspaces", Schema.Int, { tenant: Schema.String });

// What the admin page shows of a stored workspace, as a Schema class the wire carries exactly.
export class WorkspaceRow extends Schema.Class<WorkspaceRow>("AdminWorkspaceRow")({ id: Schema.Int, tenant: Schema.String, title: Schema.String }) {}
