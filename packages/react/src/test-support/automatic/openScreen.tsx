import { layerWebSocketConstructorWS } from "@effect/platform-node/NodeSocket";
import { Effect, Layer } from "effect";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import * as Socket from "effect/socket/Socket";
import { act } from "react";
import { queryCoalesceWindow } from "@shivaedev/contract/queryCoalesceWindow.ts";
import { render } from "@shivaedev/test-story/client/react.ts";
import { SessionBoundary } from "#client/sessionBoundary.ts";
import { connect } from "./connect.ts";
import { Notes, Read } from "./screen.tsx";

export async function openScreen(url: string) {
	window.location.href = url;
	const sockets: Socket.WebSocketLike[] = [];
	const addresses: string[] = [];
	const socketConstructor = Layer.effect(
		Socket.WebSocketConstructor,
		Effect.map(Socket.WebSocketConstructor, (make) => (address, options) => {
			const socket = make(address, options);
			sockets.push(socket);
			addresses.push(address);
			return socket;
		}),
	).pipe(Layer.provide(layerWebSocketConstructorWS));
	const client = connect(url, socketConstructor);
	const separate: Awaited<ReturnType<typeof render>>[] = [];
	let owner: AtomRegistry.AtomRegistry | undefined;
	const view = await render(
		<SessionBoundary
			connect={(_session, registry) => {
				owner = registry;
				return client;
			}}
			identify={(session) => session}
			recheck={() => undefined}
			session="alice"
		>
			{(current) => <Notes client={current} />}
		</SessionBoundary>,
	);
	function button(label: string) {
		const found = [...view.container.querySelectorAll("button")].find((candidate) => candidate.textContent === label);
		if (found === undefined) {
			throw new Error(`Missing button ${label}`);
		}
		return found;
	}
	return {
		...view,
		addresses,
		click: async (label: string) => {
			await act(() => button(label).click());
		},
		client,
		closePrimary: view.unmount,
		coalesce: (id: number, millis: number) => {
			if (owner === undefined) {
				throw new Error("The session registry is not mounted");
			}
			owner.set(queryCoalesceWindow((id === 1 ? client.api : client.preview).get.query({ id })), millis);
		},
		drop: async () => {
			await act(() => {
				for (const socket of sockets) {
					socket.close(4000);
				}
			});
		},
		openSeparate: async () => {
			separate.push(
				await render(
					<SessionBoundary connect={() => client} identify={(session) => session} recheck={() => undefined} session="alice">
						{() => <Read client={client} id={2} />}
					</SessionBoundary>,
				),
			);
		},
		query: (id: number) => {
			if (owner === undefined) {
				throw new Error("The session registry is not mounted");
			}
			return owner.get((id === 1 ? client.api : client.preview).get.query({ id }));
		},
		rename: async (title: string) => {
			await act(() => {
				const input = view.container.querySelector<HTMLInputElement>('[aria-label="Title"]');
				const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
				if (input === null || setter === undefined) {
					throw new Error("Missing title input");
				}
				setter.call(input, title);
				input.dispatchEvent(new Event("input", { bubbles: true }));
			});
			await act(() => button("Rename").click());
		},
		separateContainer: () => {
			const root = separate[0];
			if (root === undefined) {
				throw new Error("No separate screen is open");
			}
			return root.container;
		},
		unmount: async () => {
			for (const root of separate) {
				await root.unmount();
			}
			await view.unmount();
		},
	};
}
