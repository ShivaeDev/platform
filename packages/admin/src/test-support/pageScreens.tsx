import { Effect, Predicate } from "effect";
import { hasPermission } from "@shivaedev/access/permission.ts";
import { PermissionBoundary } from "@shivaedev/react/adapters/permissionBoundary.ts";
import { expectNoReactWarnings, type Rendered, render } from "@shivaedev/test-story/client/react.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { matchAdminRoute } from "#adapters/matchAdminRoute.ts";
import { workspaceServer } from "./pageHost.ts";
import { WorkspaceScreen } from "./WorkspaceScreen.tsx";
import { WorkspaceAccess, type WorkspaceRole, workspaceRegistration } from "./workspaces.ts";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });

const warnings = expectNoReactWarnings();

export const pageScreens = storyKit({
	clock: "live",
	create: () => Effect.map(workspaceServer, ({ url }): { screen: Rendered | undefined; url: string } => ({ screen: undefined, url })),
	name: "admin page screen",
	stages: [],
	verbs: (engine, story) => ({
		openDocument: (path: string, role: WorkspaceRole) => {
			story.tell(`${role} opens ${path} on the server`);
			return Effect.promise(async () => {
				const response = await fetch(`${engine.url}${path}`, { headers: { authorization: role } });
				return { body: await response.text(), status: response.status };
			});
		},
		openScreen: (path: string, role: WorkspaceRole) =>
			Effect.gen(function* () {
				story.tell(`${role} opens ${path} on the client`);
				const { permissions } = yield* WorkspaceAccess.resolve(role);
				const required = matchAdminRoute(
					workspaceRegistration.pages.map((page) => page.route),
					path,
				)?.permission;
				const refused = required !== undefined && !hasPermission(permissions, required);
				const options = refused ? { onCaughtError: warnings.expectCaughtError((error) => Predicate.isTagged(error, "Forbidden")) } : undefined;
				const screen = yield* Effect.acquireRelease(
					Effect.promise(() => render(null, options)),
					(view) => Effect.promise(view.unmount),
				);
				engine.screen = screen;
				yield* Effect.promise(() =>
					screen.render(
						<PermissionBoundary fallback={<p>Permission denied</p>} session={{ user: { permissions } }}>
							<WorkspaceScreen path={path} permissions={permissions} />
						</PermissionBoundary>,
					),
				);
			}),
		shown: () => Effect.sync(() => engine.screen?.container.textContent),
	}),
});
