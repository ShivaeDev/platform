import { Exit } from "effect";
import { expect } from "vitest";
import { queries, queryFeedbackScreen } from "#test/queryStories.ts";

const offline = { _tag: "Unavailable", message: "Offline" } as const;

queries.it("Initial query rejection retries locally", [queryFeedbackScreen()], function* ({ query, finish, nextResponse, click }) {
	const { view, requests } = query();
	expect(view.container.querySelector('[role="status"]')?.textContent).toBe("Loading");
	yield* finish(requests.gate(), Exit.fail(offline));
	expect(view.container.querySelector('[role="alert"]')?.textContent).toBe("OfflineRetry");
	expect(view.container.querySelector('[role="status"]')).toBeNull();
	const retry = nextResponse();
	yield* click("Retry");
	expect(view.container.querySelector('[role="status"]')?.textContent).toBe("Loading");
	yield* finish(retry, Exit.succeed("Recovered"));
	expect(view.container.querySelector("output")?.textContent).toBe("Recovered");
	expect(view.container.querySelector('[role="alert"]')).toBeNull();
});

queries.it("Failed refresh keeps successful data", [queryFeedbackScreen()], function* ({ query, finish, nextResponse, refresh, click, type }) {
	const { view, requests } = query();
	yield* finish(requests.gate(), Exit.succeed("Last success"));
	const content = view.container.querySelector("article");
	yield* type("local", "Unsaved input");
	const failed = nextResponse();
	yield* refresh();
	expect(view.container.querySelector('[role="status"]')?.textContent).toBe("Refreshing");
	yield* finish(failed, Exit.fail(offline));
	expect(view.container.querySelector("output")?.textContent).toBe("Last success");
	expect(view.container.querySelector("article")).toBe(content);
	expect(view.container.querySelector<HTMLInputElement>('[name="local"]')?.value).toBe("Unsaved input");
	const retry = nextResponse();
	yield* click("Retry");
	expect(view.container.querySelector("article")).toBe(content);
	yield* finish(retry, Exit.succeed("Fresh success"));
	expect(view.container.querySelector("output")?.textContent).toBe("Fresh success");
	expect(view.container.querySelector("article")).toBe(content);
	expect(view.container.querySelector<HTMLInputElement>('[name="local"]')?.value).toBe("Unsaved input");
});

queries.it("Expected rejection does not crash the screen", [queryFeedbackScreen()], function* ({ query, finish, type, nextResponse, click }) {
	const { view, requests } = query();
	const shell = view.container.querySelector('[name="shell"]');
	yield* type("shell", "Shell draft");
	yield* finish(requests.gate(), Exit.fail(offline));
	expect(view.container.querySelector("[data-crash]")).toBeNull();
	expect(view.container.querySelector('[role="alert"]')?.textContent).toContain("Offline");
	const retry = nextResponse();
	yield* click("Retry");
	yield* finish(retry, Exit.succeed("Ready"));
	expect(view.container.querySelector('[name="shell"]')).toBe(shell);
	expect(view.container.querySelector<HTMLInputElement>('[name="shell"]')?.value).toBe("Shell draft");
	expect(view.container.querySelector("[data-crash]")).toBeNull();
});

const defect = new Error("Broken query");
queries.it("Query defects reach the unexpected-error boundary", [queryFeedbackScreen(defect)], function* ({ query, finish }) {
	const { view, requests } = query();
	yield* finish(requests.gate(), Exit.die(defect));
	expect(view.container.querySelector("[data-crash]")?.textContent).toBe("Unexpected failure");
	expect(view.container.querySelector('[role="alert"]')).toBeNull();
});
