import { answers, containerPlan, daemonAnswers, publishedBy, unanswered } from "#test/containerPlans.ts";
import { postgres } from "#test/postgres.ts";
import { configureReadiness } from "#test/postgresEngine.ts";

const NEVER_ANSWERED = 64;

export function dockerHost(endpoint: string) {
	return postgres.trait("machine", `DOCKER_HOST is ${endpoint}`, (engine) => {
		engine.environment.DOCKER_HOST = endpoint;
	});
}

export function activeDockerContext(endpoint: string) {
	return postgres.trait("machine", `neither DOCKER_HOST nor DOCKER_CONTEXT is set, and Docker's active context points to ${endpoint}`, (engine) => {
		engine.environment.DOCKER_HOST = undefined;
		engine.environment.DOCKER_CONTEXT = undefined;
		engine.contextEndpoint = endpoint;
	});
}

export function namedDockerContext(name: string, endpoint: string) {
	return postgres.trait("machine", `DOCKER_CONTEXT names ${name}, which points to ${endpoint}`, (engine) => {
		engine.environment.DOCKER_CONTEXT = name;
		engine.contextEndpoint = endpoint;
	});
}

export function dockerDaemonAnswers() {
	return postgres.trait("machine", "the Docker daemon answers", (engine) => {
		engine.plan.push(daemonAnswers);
	});
}

export function dockerDaemonDown() {
	return postgres.trait("machine", "the Docker daemon is not running", (engine) => {
		engine.plan.push({
			args: ["info"],
			result: new Error("Cannot connect to the Docker daemon at unix:///var/run/docker.sock. Is the docker daemon running?"),
		});
	});
}

export function containerListingFails() {
	return postgres.trait("machine", "Docker answers but refuses to list containers", (engine) => {
		engine.plan.push(daemonAnswers, {
			args: ["container", "ls", "--all", "--filter", "name=^/development-postgres$", "--format", "{{.ID}}"],
			result: new Error("Cannot list containers"),
		});
	});
}

export function stoppedPinnedContainer() {
	return postgres.trait("machine", "the managed container exists, stopped, with the pinned image", (engine) => {
		engine.plan.push(...containerPlan("existing"));
	});
}

export function noContainer() {
	return postgres.trait("machine", "no managed container exists", (engine) => {
		engine.plan.push(...containerPlan("missing"));
	});
}

export function outdatedContainer() {
	return postgres.trait("machine", "the managed container exists with the older image postgres:17-alpine", (engine) => {
		engine.plan.push(...containerPlan("outdated"));
	});
}

export function noContainerPublishesPort() {
	return postgres.trait("machine", "no container publishes port 55432", (engine) => {
		engine.plan.push(...publishedBy(""));
	});
}

export function twoContainersPublishPort() {
	return postgres.trait("machine", "two containers publish port 55432", (engine) => {
		engine.plan.push(...publishedBy("first\nsecond\n"));
	});
}

export function unpinnedContainerPublishesPort() {
	return postgres.trait("machine", "the one container that publishes port 55432 runs postgres:17-alpine", (engine) => {
		engine.plan.push(...publishedBy("container-id\n", "postgres:17-alpine\n"));
	});
}

export function serviceAnswers() {
	return postgres.trait("machine", "PostgreSQL 18.6 answers in the pinned container on port 55432 and allows 500 connections", (engine) => {
		engine.plan.push(...answers("SHOW server_version", "18.6"), ...answers("SHOW max_connections", "500"));
	});
}

export function serviceStartsAnswering({ afterUnanswered }: { readonly afterUnanswered: number }) {
	return postgres.trait(
		"machine",
		`PostgreSQL does not answer; once its stopped pinned container starts, it answers 18.6 after ${afterUnanswered} unanswered readiness checks and allows 500 connections`,
		(engine) => {
			engine.plan.push(
				...unanswered(1 + afterUnanswered),
				...containerPlan("existing"),
				...answers("SHOW server_version", "18.6"),
				...answers("SHOW max_connections", "500"),
			);
		},
	);
}

export function serviceNeverAnswers() {
	return postgres.trait("machine", "PostgreSQL does not answer, not even after its stopped pinned container starts", (engine) => {
		engine.plan.push(...unanswered(NEVER_ANSWERED), ...containerPlan("existing"));
	});
}

export function readinessAttempts(attempts: number) {
	return postgres.trait("machine", `setup allows ${attempts} readiness attempts`, (engine) => {
		configureReadiness(engine, attempts);
	});
}

export function realPostgres() {
	return postgres.trait("machine", "the shared local PostgreSQL 18.6 service answers host psql", (engine) => {
		engine.mode = "real";
		engine.hostPsql = true;
	});
}

export function realPostgresWithoutHostPsql() {
	return postgres.trait("machine", "the shared local PostgreSQL 18.6 service runs, and the host has no psql", (engine) => {
		engine.mode = "real";
		engine.hostPsql = false;
	});
}
