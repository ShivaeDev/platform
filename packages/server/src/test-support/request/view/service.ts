import { Identity, SessionUser } from "@shivaedev/identity/identity.ts";
import { Subject } from "@shivaedev/identity/subject.ts";
import { defineService } from "@shivaedev/service/defineService.ts";
import { Shared } from "#test/request/Shared.ts";
import { initialize } from "./initialize.ts";
import { read } from "./read.ts";

export const requestViewService = defineService({
	id: "@shivaedev/server/test/requestViewService",
	initialize,
	methods: (state) => ({ read: read(state) }),
	requires: [Shared, SessionUser, Identity, Subject],
});
