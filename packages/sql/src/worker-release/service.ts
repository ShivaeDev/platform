import { defineService } from "@shivaedev/service/adapters/defineService.ts";
import { genericMethod } from "@shivaedev/service/genericMethod.ts";
import { initializeWorkerRelease } from "#worker-release/initialize.ts";
import { registerWorkerRelease } from "#worker-release/register.ts";
import { setActive } from "#worker-release/setActive.ts";

export const WorkerRelease = defineService({
	id: "@shivaedev/sql/WorkerRelease",
	initialize: initializeWorkerRelease,
	methods: (state) => ({ register: genericMethod(registerWorkerRelease(state)), setActive: setActive(state) }),
	requires: [],
});
