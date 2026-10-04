import type { Attempt, State, Work } from "./domain.ts";
import { within } from "./paths.ts";
export function activeAttempt(attempt: Attempt) {
	return ["prepared", "submitting", "accepted", "running", "uncertain"].includes(attempt.status);
}
export function putWork(state: State, work: Work): State {
	return {
		...state,
		works: state.works.map((item) => (item.spec.id === work.spec.id ? work : item)),
	};
}
export function putAttempt(state: State, attempt: Attempt): State {
	return {
		...state,
		attempts: state.attempts.map((item) => (item.id === attempt.id ? attempt : item)),
	};
}
export function authorized(state: State, workId: string, action: "approve" | "merge") {
	return state.decisions.some((d) => d.workId === workId && d.action === action);
}
export function lastWorker(state: State, workId: string) {
	return state.attempts.findLast((attempt) => attempt.workId === workId && attempt.role === "worker" && attempt.ref !== null);
}
export function question(work: Work, message: string, recommendation: string): Work {
	return {
		...work,
		question: {
			context: `${work.spec.id}: ${work.spec.instructions}`,
			link: work.outcome?.kind === "pull-request" ? work.outcome.url : `https://github.com/${work.spec.repository}`,
			question: message,
			recommendation,
		},
	};
}
function pathsOverlap(a: string, b: string) {
	return a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);
}
export function conflicts(a: Work, b: Work) {
	return (
		a.spec.repository.toLowerCase() === b.spec.repository.toLowerCase()
		&& a.spec.scope.some((left) =>
			b.spec.scope.some(
				(right) =>
					pathsOverlap(left.path, right.path) && (left.path !== right.path || left.key === null || right.key === null || left.key === right.key),
			),
		)
	);
}
export function writerReserved(state: State, work: Work) {
	return work.phase !== "completed" && state.attempts.some((a) => a.workId === work.spec.id && a.role === "worker");
}
export function sameCheckout(a: Work, b: Work) {
	return within(a.spec.checkout, b.spec.checkout) || within(b.spec.checkout, a.spec.checkout);
}
