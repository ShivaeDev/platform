import { SessionUser } from "@shivaedev/identity/identity.ts";
import { defineService } from "@shivaedev/service/defineService.ts";
import { initialize } from "./initialize.ts";
import { read } from "./read.ts";

export const roleView = defineService({
	id: "@shivaedev/server/test/RoleView",
	initialize,
	methods: (state) => ({ read: read(state) }),
	requires: [SessionUser],
});
