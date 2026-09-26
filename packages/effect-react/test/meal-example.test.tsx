// @vitest-environment happy-dom
import { RegistryContext } from "@effect/atom-react";
import { Deferred, Effect, Result } from "effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { makeMealEditor } from "./meal-example/frontend.tsx";
import { startMealServer } from "./meal-example/http-test.ts";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const mountEditor = async (url: string, token?: string, id = 1) => {
	window.location.href = url;
	const { Client, api, Editor } = makeMealEditor({ url, token });
	const registry = AtomRegistry.make();
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	await act(async () => {
		root.render(createElement(RegistryContext.Provider, { value: registry }, createElement(Editor, { id })));
	});
	const input = (name: string) => {
		const label = [...container.querySelectorAll("label")].find((label) => label.textContent?.startsWith(name));
		const element = label?.htmlFor ? container.querySelector<HTMLInputElement>(`#${label.htmlFor}`) : label?.querySelector("input");
		if (!element) throw new Error(`Missing input ${name}`);
		return element;
	};
	return {
		container,
		input,
		edit: async (name: string, value: string) => {
			await act(async () => {
				const element = input(name);
				Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(element, value);
				element.dispatchEvent(new Event("input", { bubbles: true }));
				element.dispatchEvent(new Event("change", { bubbles: true }));
			});
		},
		click: async (name: string) => {
			const button = [...container.querySelectorAll("button")].find((button) => button.textContent === name);
			if (!button) throw new Error(`Missing button ${name}`);
			await act(async () => button.click());
		},
		save: (name: string) => {
			const independent = AtomRegistry.make();
			const result = Client.runtime.atom(api.save.run({ id, name, calories: 900 }).pipe(Effect.result));
			return Effect.runPromise(AtomRegistry.getResult(independent, result)).finally(() => independent.dispose());
		},
		read: () => {
			const independent = AtomRegistry.make();
			const result = Client.runtime.atom(api.get.run({ id }));
			return Effect.runPromise(AtomRegistry.getResult(independent, result)).finally(() => independent.dispose());
		},
		close: async () => {
			await act(async () => root.unmount());
			registry.dispose();
			container.remove();
		},
	};
};

const eventually = (assert: () => void) =>
	vi.waitFor(async () => {
		await act(async () => {});
		assert();
	});

const sessions = () =>
	new Map([
		["alice-session", { userId: "alice", expiresAt: Number.POSITIVE_INFINITY }],
		["bob-session", { userId: "bob", expiresAt: Number.POSITIVE_INFINITY }],
		["expired-session", { userId: "alice", expiresAt: 0 }],
	]);

test("real HTTP saves refetch the view, field rejection preserves storage, and refresh merges untouched fields beside dirty edits", async () => {
	const server = await startMealServer({ sessions: sessions() });
	const view = await mountEditor(server.url, "alice-session");
	try {
		await eventually(() => expect(view.input("Name").value).toBe("Oatmeal"));
		await view.edit("Name", "  Breakfast  ");
		await view.edit("Calories", "450");
		await view.click("Save");
		await eventually(() => {
			expect(view.container.querySelector('[data-testid="server-meal"]')?.textContent).toContain("Breakfast");
			expect(view.container.querySelector('[role="status"]')?.textContent).toBe("Saved");
			expect(view.input("Name").value).toBe("Breakfast");
		});
		expect(await view.read()).toMatchObject({
			name: "Breakfast",
			calories: 450,
		});
		await view.edit("Calories", "-1");
		await view.click("Save");
		await eventually(() =>
			expect(view.container.querySelector('[role="alert"]')?.textContent).toBe("Calories must be a whole number between 0 and 5000"),
		);
		expect(await view.read()).toMatchObject({
			name: "Breakfast",
			calories: 450,
		});
		await view.edit("Calories", "450");
		await view.edit("Name", "Unsubmitted local edit");
		expect(Result.isSuccess(await view.save("Remote update"))).toBe(true);
		await view.click("Refresh");
		await eventually(() => {
			expect(view.container.querySelector('[data-testid="server-meal"]')?.textContent).toContain("Remote update");
			expect(view.input("Name").value).toBe("Unsubmitted local edit");
			expect(view.input("Calories").value).toBe("900");
			expect(view.container.querySelector('[role="status"]')?.textContent).toBe("Unsaved changes");
		});
		await view.click("Revert");
		await eventually(() => expect(view.input("Name").value).toBe("Remote update"));
	} finally {
		await view.close();
		await server.close();
	}
});

test("edits made while a save is in flight survive its response and query refresh", async () => {
	const entered = await Effect.runPromise(Deferred.make<void>());
	const resumed = await Effect.runPromise(Deferred.make<void>());
	const release = () => Effect.runPromise(Deferred.succeed(resumed, undefined));
	const server = await startMealServer({
		sessions: sessions(),
		beforeSave: () => Deferred.succeed(entered, undefined).pipe(Effect.andThen(Deferred.await(resumed))),
	});
	const view = await mountEditor(server.url, "alice-session");
	try {
		await eventually(() => expect(view.input("Name").value).toBe("Oatmeal"));
		await view.edit("Name", "Submitted meal");
		await view.click("Save");
		await Effect.runPromise(Deferred.await(entered));
		await view.edit("Name", "Newer local edit");
		await release();
		await eventually(() => {
			expect(view.container.querySelector('[data-testid="server-meal"]')?.textContent).toContain("Submitted meal");
			expect(view.input("Name").value).toBe("Newer local edit");
			expect(view.container.querySelector('[role="status"]')?.textContent).toBe("Unsaved changes");
		});
		expect(await view.read()).toMatchObject({ name: "Submitted meal" });
	} finally {
		await release();
		await view.close();
		await server.close();
	}
});

test("HTTP sessions isolate owners and a revoked session cannot save", async () => {
	const activeSessions = sessions();
	const server = await startMealServer({ sessions: activeSessions });
	const alice = await mountEditor(server.url, "alice-session");
	const bob = await mountEditor(server.url, "bob-session", 2);
	const stranger = await mountEditor(server.url, "bob-session", 1);
	const anonymous = await mountEditor(server.url);
	const expired = await mountEditor(server.url, "expired-session");
	try {
		await eventually(() => {
			expect(alice.input("Name").value).toBe("Oatmeal");
			expect(bob.input("Name").value).toBe("Soup");
			expect(stranger.container.querySelector('[role="alert"]')?.textContent).toBeTruthy();
			expect(anonymous.container.querySelector('[role="alert"]')?.textContent).toBeTruthy();
		});
		expect(stranger.container.textContent).not.toContain("Oatmeal");
		expect(anonymous.container.textContent).not.toContain("Oatmeal");
		const [crossOwnerSave, anonymousSave, expiredSave] = await Promise.all([
			stranger.save("Cross-owner overwrite"),
			anonymous.save("Anonymous overwrite"),
			expired.save("Expired overwrite"),
		]);
		expect(Result.isFailure(crossOwnerSave) && crossOwnerSave.failure._tag).toBe("MealNotFound");
		expect(Result.isFailure(anonymousSave) && anonymousSave.failure._tag).toBe("Unauthorized");
		expect(Result.isFailure(expiredSave) && expiredSave.failure._tag).toBe("Unauthorized");
		expect(await alice.read()).toMatchObject({
			name: "Oatmeal",
			calories: 300,
		});
		await alice.edit("Name", "Must not persist");
		activeSessions.delete("alice-session");
		await alice.click("Save");
		await eventually(() => expect(alice.container.querySelector('[role="alert"]')?.textContent).toBeTruthy());
		activeSessions.set("alice-session", {
			userId: "alice",
			expiresAt: Number.POSITIVE_INFINITY,
		});
		expect(await alice.read()).toMatchObject({
			name: "Oatmeal",
			calories: 300,
		});
		expect(await bob.read()).toMatchObject({ name: "Soup", calories: 200 });
	} finally {
		await alice.close();
		await bob.close();
		await stranger.close();
		await anonymous.close();
		await expired.close();
		await server.close();
	}
});

test("saving one meal refreshes it and the list without refetching another mounted meal", async () => {
	const gets = new Map<number, number>();
	const server = await startMealServer({
		sessions: sessions(),
		beforeGet: (id) =>
			Effect.sync(() => {
				gets.set(id, (gets.get(id) ?? 0) + 1);
			}),
	});
	window.location.href = server.url;
	const { Editor, MealList } = makeMealEditor({
		url: server.url,
		token: "alice-session",
	});
	const registry = AtomRegistry.make();
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	const editor = (index: number) => {
		const section = container.querySelectorAll("section")[index];
		if (!section) throw new Error(`Missing editor ${index}`);
		return section;
	};
	const list = () => [...container.querySelectorAll('[data-testid="meal-list"] li')].map((item) => item.textContent);
	try {
		await act(async () => {
			root.render(
				createElement(
					RegistryContext.Provider,
					{ value: registry },
					createElement(MealList),
					createElement(Editor, { id: 1 }),
					createElement(Editor, { id: 3 }),
				),
			);
		});
		await eventually(() => {
			expect(list()).toEqual(["Oatmeal / 300", "Toast / 150"]);
			expect(editor(1).querySelector("input")?.value).toBe("Toast");
		});
		expect(gets).toEqual(
			new Map([
				[1, 1],
				[3, 1],
			]),
		);
		await act(async () => {
			const input = editor(1).querySelector("input");
			if (!input) throw new Error("Missing name input");
			Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, "Rye toast");
			input.dispatchEvent(new Event("input", { bubbles: true }));
		});
		await act(async () => {
			editor(1).querySelector<HTMLButtonElement>('button[type="submit"]')?.click();
		});
		await eventually(() => {
			expect(list()).toEqual(["Oatmeal / 300", "Rye toast / 150"]);
			expect(editor(1).querySelector('[data-testid="server-meal"]')?.textContent).toBe("Rye toast / 150");
		});
		expect(gets).toEqual(
			new Map([
				[1, 1],
				[3, 2],
			]),
		);
	} finally {
		await act(async () => root.unmount());
		registry.dispose();
		container.remove();
		await server.close();
	}
});
