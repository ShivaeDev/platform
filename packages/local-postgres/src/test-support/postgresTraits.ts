import { clientPlan, containerPlan, readinessPlan } from "./containerPlans.ts";
import { postgres } from "./postgres.ts";

export function dockerEndpoint(endpoint: string) {
	return postgres.trait("machine", `Docker uses ${endpoint}`, (engine) => {
		engine.environment.DOCKER_HOST = endpoint;
	});
}

export function dockerContext(context: string | undefined, endpoint = "unix:///var/run/docker.sock") {
	return postgres.trait("machine", `Docker's ${context ?? "active"} context points to ${endpoint}`, (engine) => {
		engine.environment.DOCKER_CONTEXT = context;
		engine.environment.DOCKER_HOST = context ? "ssh://remote.example" : undefined;
		engine.contextEndpoint = endpoint;
	});
}

export function containerIs(state: "existing" | "missing" | "outdated") {
	return postgres.trait("machine", `the managed container is ${state}`, (engine) => {
		engine.plan = containerPlan(state);
	});
}

export function dockerIsAvailable() {
	return postgres.trait("machine", "Docker answers its daemon check", (engine) => {
		engine.plan = [{ args: ["info"], result: "local Docker" }];
	});
}

export function dockerIsUnavailable() {
	return postgres.trait("machine", "the Docker daemon is unavailable", (engine) => {
		engine.plan = [
			{ args: ["info"], result: new Error("Cannot connect to the Docker daemon at unix:///var/run/docker.sock. Is the docker daemon running?") },
		];
	});
}

export function clientContainers(ids: string, image?: string) {
	return postgres.trait("machine", `Docker discovers client containers ${JSON.stringify(ids)}${image ? ` with image ${image}` : ""}`, (engine) => {
		engine.plan = clientPlan(ids, image);
	});
}

export function realPostgres() {
	return postgres.trait("machine", "a real local PostgreSQL service is available", (engine) => {
		engine.mode = "real";
	});
}

export function discoveryFails(count: number) {
	return postgres.trait("machine", `Docker cannot discover PostgreSQL for ${count} probes before reaching the real service`, (engine) => {
		engine.environment.DOCKER_HOST = undefined;
		engine.mode = "readiness";
		engine.unavailableProbes = count;
	});
}

export function readyAfter(count: number) {
	return postgres.trait("machine", `PostgreSQL becomes ready after ${count} failed discovery probes`, (engine) => {
		engine.plan = readinessPlan(count);
	});
}
