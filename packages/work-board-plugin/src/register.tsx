import type { EngineInterface, Register, UiOpenResult } from "claude-code";
import { atom, read, update } from "claude-code";
import { connection } from "#connect.ts";
import { clip, updatedLabel } from "#lines.ts";
import { paneView } from "#pane.tsx";
import { registerTools } from "#registerTools.ts";
import { serveTools } from "#serveTools.ts";
import { bandLine, needsYou } from "#summary.ts";
import type { WorkboardAsk, WorkboardBoard } from "#types/index.d.ts";

const PANE = "workboard";
const TITLE = "Work Board";
const OPEN_LABEL = "Open board";

const board = atom({ key: "board", plugin: "workboard" } as const, { kind: "loading" });
const seenAsks = atom({ key: "seenAsks", plugin: "workboard" } as const, null);
const updatedAt = atom({ key: "updatedAt", plugin: "workboard" } as const, null);
const achievedOpen = atom({ key: "achievedOpen", plugin: "workboard" } as const, false);

async function receive($: EngineInterface, next: WorkboardBoard): Promise<void> {
	if (next.kind === "ready") {
		const now = await $.clock.now();
		await update($, updatedAt, () => now);
	}
	await update($, board, () => next);
	if (next.kind === "ready" && next.asks.problem === null) {
		await announce($, next.asks.items);
	}
}

async function refresh($: EngineInterface): Promise<void> {
	try {
		(await connection($, (next) => void receive($, next))).refresh();
	} catch (cause) {
		await receive($, { kind: "error", message: cause instanceof Error ? cause.message : String(cause) });
	}
}

function openUrl($: EngineInterface, url: string | null): void {
	if (url === null) {
		$.ui.toast("The Work Board did not say where it is served.");
		return;
	}
	void $.process.run(["open", "-g", url]).catch(() => $.ui.toast(`Could not open ${url}`));
}

async function announce($: EngineInterface, asks: readonly WorkboardAsk[]): Promise<void> {
	let fresh: WorkboardAsk[] = [];
	await update($, seenAsks, (seen) => {
		fresh = seen === null ? [] : asks.filter((ask) => !seen.includes(ask.key));
		return asks.map((ask) => ask.key);
	});
	const [first] = fresh;
	if (first === undefined) {
		return;
	}
	$.ui.toast(fresh.length === 1 ? `New decision: ${first.title}` : `${fresh.length} new decisions`);
}

async function openPane($: EngineInterface): Promise<UiOpenResult> {
	const opened = await $.ui.open({ focus: true, id: PANE, title: TITLE });
	await refresh($);
	return opened;
}

export const register: Register = (on) => {
	serveTools(on);

	on("session.start", async ($, e, next) => {
		await $.command.register({
			description: "Open the Work Board pane: what needs you, what is in flight, goal progress",
			name: "workboard",
		});
		await registerTools($);
		void refresh($);

		return next(e);
	});

	on("command.run", { command: "workboard" }, async ($) => {
		const opened = await openPane($);

		return { text: opened.isPlaced ? "Work Board pane opened." : `Work Board pane is waiting: ${opened.reason}` };
	});

	on("ui.render", { component: "Pane", requestId: PANE }, async ($, e) => {
		const state = await read($, board);
		const stamp = await read($, updatedAt);

		return paneView($.ui.resolve(e), {
			achievedOpen: await read($, achievedOpen),
			board: state,
			columns: Math.max(16, e.props.bodyColumns),
			onOpen: (ask) => openUrl($, ask.url),
			onRefresh: () => void refresh($),
			onToggleAchieved: () => void update($, achievedOpen, (open) => !open),
			surface: e.surface,
			updated: updatedLabel(stamp, await $.clock.now()),
		});
	});

	on("ui.render", { component: "AbovePrompt" }, async ($, e, next) => {
		if (e.props.hasSurvey) {
			return next(e);
		}
		const state = await read($, board);
		if (state.kind !== "ready") {
			return next(e);
		}

		const { Box, Button, Text } = $.ui.resolve(e);
		const room = Math.max(1, e.props.bodyColumns - OPEN_LABEL.length - 5);

		return (
			<Box flexDirection="row" gap={1}>
				<Text dimColor={needsYou(state) === 0} key="band">
					{clip(bandLine(state), room)}
				</Text>
				<Button key="open-board" label={OPEN_LABEL} onPress={() => void openPane($)} />
			</Box>
		);
	});
};
