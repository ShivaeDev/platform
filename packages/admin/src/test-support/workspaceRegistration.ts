import { registerAdmin } from "#server/registerAdmin.ts";
import { ExportReads } from "#test/ExportReads.ts";
import { FakeUsers } from "#test/FakeUsers.ts";
import { WorkspaceAdmin } from "#test/WorkspaceAdmin.ts";
import { WorkspacePages } from "#test/workspaces.ts";

export const workspaceRegistration = registerAdmin(WorkspacePages, {
	exports: ExportReads,
	users: FakeUsers,
	workspaces: WorkspaceAdmin,
});
