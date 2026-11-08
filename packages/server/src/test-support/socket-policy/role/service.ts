import { SessionUser } from "@shivaedev/identity/identity.ts";
import { defineService } from "@shivaedev/service/defineService.ts";
import { initialize } from "#test/socket-policy/role/initialize.ts";
import { read } from "#test/socket-policy/role/read.ts";

export const roleView = defineService({
	id: "@shivaedev/server/test/RoleView",
	initialize,
	methods: (state) => ({ read: read(state) }),
	requires: [SessionUser],
});
