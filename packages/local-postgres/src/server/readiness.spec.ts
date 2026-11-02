import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { postgres } from "#test/postgres.ts";
import { readinessAttempts, serviceAnswers, serviceNeverAnswers, serviceStartsAnswering } from "#test/postgresTraits.ts";

const ATTEMPTS = 3;
const DEFAULT_ATTEMPTS = 30;

postgres.it(
	"when PostgreSQL 18.6 already answers, setup starts without changing any container",
	[serviceAnswers()],
	function* ({ containerChanges, outcome, start }) {
		yield* start();

		yield* outcomes([
			["container changes", () => containerChanges(), []],
			["setup", () => outcome(), "started"],
		]);
	},
);

postgres.it(
	"when PostgreSQL does not answer, setup starts its stopped container and waits through two unanswered readiness checks until it answers",
	[serviceStartsAnswering({ afterUnanswered: 2 })],
	function* ({ containerChanges, outcome, start }) {
		yield* start();

		yield* outcomes([
			["container changes", () => containerChanges(), ["docker start development-postgres"]],
			["setup", () => outcome(), "started"],
		]);
	},
);

postgres.it(
	`with ${ATTEMPTS} readiness attempts, setup gives up on a service that never answers after ${ATTEMPTS} checks, with the final readiness command failure`,
	[serviceNeverAnswers(ATTEMPTS), readinessAttempts(ATTEMPTS)],
	function* ({ failureKind, outcome, readinessChecks, start }) {
		yield* start();

		yield* outcomes([
			["failure", () => failureKind(), "setup command failed"],
			["readiness checks", () => readinessChecks(), ATTEMPTS],
			["setup", () => outcome(), "failed: Install psql or start the shared PostgreSQL service with Docker."],
		]);
	},
);

postgres.it(
	`by default, setup gives up on a service that never answers after ${DEFAULT_ATTEMPTS} readiness checks`,
	[serviceNeverAnswers()],
	function* ({ readinessChecks, start }) {
		yield* start();

		expect(yield* readinessChecks()).toBe(DEFAULT_ATTEMPTS);
	},
);
