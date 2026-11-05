import { defineService } from "@shivaedev/service/defineService.ts";
import { genericMethod } from "@shivaedev/service/genericMethod.ts";
import { initializeWorkerRelease } from "./initialize.ts";
import { registerWorkerRelease } from "./register.ts";
import { setActive } from "./setActive.ts";

export const WorkerRelease = defineService({
	id: "@shivaedev/sql/WorkerRelease",
	initialize: initializeWorkerRelease,
	methods: (state) => ({ register: genericMethod(registerWorkerRelease(state)), setActive: setActive(state) }),
	requires: [],
});
