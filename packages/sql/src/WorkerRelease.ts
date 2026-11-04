import { defineService } from "@shivaedev/service/defineService.ts";
import { genericMethod } from "@shivaedev/service/genericMethod.ts";
import { initializeWorkerRelease } from "./initializeWorkerRelease.ts";
import { registerWorkerRelease } from "./registerWorkerRelease.ts";

export const WorkerRelease = defineService({
	id: "@shivaedev/sql/WorkerRelease",
	initialize: initializeWorkerRelease,
	methods: (state) => ({ register: genericMethod(registerWorkerRelease(state)) }),
	requires: [],
});
