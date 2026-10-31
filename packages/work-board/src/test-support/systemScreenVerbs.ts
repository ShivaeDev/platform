import { Effect } from "effect";
import { act } from "react";
import { vi } from "vitest";
import { screenDriver } from "@shivaedev/test-story/server/screenDriver.ts";
import type { ScreenEngine } from "./screenEngine.ts";
import { screenSettles } from "./screenSettle.ts";

const DIAGNOSTICS_POLL_MS = 15_000;
const STOPPED = /^Fleet isn't running/u;

function startDialog() {
	return [...document.querySelectorAll<HTMLElement>("[role='dialog']")].find((dialog) => dialog.textContent?.includes("Start Fleet"));
}

export function systemScreenVerbs(engine: ScreenEngine, tell: (line: string) => void) {
	const { accessible } = screenDriver({ root: () => document.body, tell: () => undefined });
	function reads<T>(line: string, read: () => T) {
		return Effect.sync(() => {
			tell(line);
			return read();
		});
	}
	function presses(line: string, target: () => HTMLElement | undefined) {
		return Effect.gen(function* () {
			tell(line);
			const element = target();
			if (!element) {
				throw new Error(`Nothing to press: ${line}`);
			}
			yield* Effect.promise(() => act(async () => element.click()));
			yield* screenSettles(engine, tell);
		});
	}
	function buttonNamed(name: string) {
		return [...document.querySelectorAll<HTMLElement>("button")].find((button) => accessible(button).name === name);
	}
	return {
		copyFleetStartCommand: () =>
			presses("the reader presses Copy beside the Fleet start command", () => buttonNamed("Copy the command to start Fleet")),
		diagnosticsPollPasses: () =>
			Effect.gen(function* () {
				tell("the 15-second diagnostics poll interval passes");
				yield* Effect.promise(() => act(() => vi.advanceTimersByTimeAsync(DIAGNOSTICS_POLL_MS)));
			}),
		diagnosticsPollTimer: () =>
			reads("the reader checks whether a diagnostics poll is still scheduled", () => (vi.getTimerCount() > 0 ? "scheduled" : "none")),
		fleetStartDialog: () =>
			reads("the reader reads the Start Fleet popover", () => {
				const dialog = startDialog();
				const field = dialog?.querySelector<HTMLTextAreaElement>("textarea[aria-label='Command to start Fleet']");
				if (!(dialog && field)) {
					return "closed";
				}
				return {
					command: field.value,
					copyStatus: dialog.querySelector("[data-copy-status]")?.textContent,
					field:
						document.activeElement === field && field.selectionStart === 0 && field.selectionEnd === field.value.length
							? "focused and selected"
							: "not selected",
				};
			}),
		fleetStoppedNotices: () =>
			reads("the reader reads every notice that Fleet isn't running", () =>
				[...document.querySelectorAll('[role="status"]')].map((status) => status.textContent ?? "").filter((text) => STOPPED.test(text)),
			),
		fleetStoppedPanels: () =>
			reads("the reader reads each panel that says Fleet isn't running", () =>
				[...document.querySelectorAll('[role="status"]')]
					.filter((status) => STOPPED.test(status.textContent ?? ""))
					.map((status) => {
						const parts = [...(status.parentElement?.children ?? [])].filter((part) => part !== status);
						return {
							explains: parts.filter((part) => part.tagName !== "BUTTON").map((part) => part.textContent),
							help: parts.filter((part) => part.tagName === "BUTTON").map((part) => accessible(part).name),
							notice: status.textContent,
						};
					}),
			),
		fleetWorkLane: () =>
			reads("the reader reads the Fleet work list on System", () => {
				const lane = document.querySelector<HTMLElement>('[aria-label="Fleet work"]');
				if (!lane) {
					return "no Fleet work list";
				}
				return {
					loading: lane.querySelector('[data-slot="skeleton"]') ? "shown" : "none",
					message: (lane.querySelector('[role="status"]:not([aria-busy])') ?? lane.querySelector('[data-slot="empty-title"]'))?.textContent ?? "none",
					rows: [...lane.querySelectorAll<HTMLElement>("[data-fleet-id]")].map((row) => ({
						id: row.dataset.fleetId,
						links: row.querySelectorAll("a").length,
						pr: row.querySelector('a[aria-label^="Pull request"]')?.getAttribute("href") ?? "none",
						stage: row.querySelector('[data-slot="badge"]')?.textContent,
						text: row.textContent,
						title: row.querySelector("a")?.textContent,
					})),
				};
			}),
		leavePollingView: () => presses("the reader leaves the polling view", () => buttonNamed("Stop")),
		openFleetStartHelp: () => presses("the reader presses How to start Fleet", () => buttonNamed("How to start Fleet")),
		polledReads: () =>
			reads("the reader reads how often diagnostics and Fleet were read", () => ({
				diagnostics: document.querySelector("[data-diagnostics]")?.textContent,
				fleet: document.querySelector("[data-fleet]")?.textContent,
			})),
		sourceProblemList: () =>
			reads("the reader reads the files with problems on System", () => {
				const section = document.querySelector("#source-problems");
				const rows = [...(section?.querySelectorAll<HTMLElement>("[data-source-problem]") ?? [])];
				if (rows.length === 0) {
					return section?.querySelector('[data-slot="empty-title"]')?.textContent ?? "nothing listed";
				}
				return rows.map((row) => {
					const link = row.querySelector("a");
					return {
						file: link?.textContent,
						href: link?.getAttribute("href"),
						line: row.querySelector("span")?.textContent,
						reason: row.lastElementChild?.textContent,
					};
				});
			}),
		systemCard: (source: string) =>
			reads(`the reader reads the ${source} card on System`, () => {
				const card = document.querySelector<HTMLElement>(`article[data-source="${source}"]`);
				if (!card) {
					return "no card";
				}
				return {
					facts: Object.fromEntries(
						[...card.querySelectorAll("dl > div")].map((fact) => [
							fact.querySelector("dt")?.textContent,
							fact.querySelector("dd strong")?.textContent ?? fact.querySelector("dd")?.textContent,
						]),
					),
					label: card.querySelector('[data-slot="badge"]')?.textContent,
					state: card.dataset.state,
				};
			}),
		systemHeader: () =>
			reads("the reader reads System's page header", () => document.querySelector("#doc [data-page-header]")?.textContent ?? "no header"),
	};
}
