import { DateTime } from "effect";
import { type AppUser, type ChangeRoleInput, UserRole } from "@shivaedev/platform/rpc/userRoles.ts";
import type { UsersList } from "#users/page.ts";

interface RoleControls {
	readonly dispatch: (input: typeof ChangeRoleInput.Type) => void;
	readonly pending: boolean;
}

function UserHeaders() {
	return (
		<tr>
			{["Name", "Email", "Roles", "Signed up"].map((label) => (
				<th className="whitespace-nowrap p-3" key={label} scope="col">
					{label}
				</th>
			))}
		</tr>
	);
}

function RoleCheckbox({ user, role, pending, dispatch }: RoleControls & { readonly user: typeof AppUser.Type; readonly role: typeof UserRole.Type }) {
	return (
		<label className="mr-3 inline-flex gap-1">
			<input
				aria-label={`${role} for ${user.email}`}
				checked={user.roles.includes(role)}
				disabled={pending}
				onChange={(event) => dispatch({ grant: event.target.checked, role, userId: user.id })}
				type="checkbox"
			/>
			{role}
		</label>
	);
}

function UserRoles({
	user,
	canChangeRoles,
	dispatch,
	pending,
}: RoleControls & {
	readonly user: typeof AppUser.Type;
	readonly canChangeRoles: boolean;
}) {
	return (
		<div>
			<p>{user.roles.join(", ") || "No roles"}</p>
			{canChangeRoles
				? UserRole.literals.map((role) => <RoleCheckbox dispatch={dispatch} key={role} pending={pending} role={role} user={user} />)
				: null}
		</div>
	);
}

function UserRow({
	user,
	...controls
}: RoleControls & {
	readonly user: typeof AppUser.Type;
	readonly canChangeRoles: boolean;
}) {
	return (
		<tr className="border-b">
			<td className="p-3">{user.name}</td>
			<td className="p-3">{user.email}</td>
			<td className="p-3">
				<UserRoles {...controls} user={user} />
			</td>
			<td className="whitespace-nowrap p-3">
				<time dateTime={DateTime.formatIso(user.createdAt)}>{DateTime.formatIso(user.createdAt)}</time>
			</td>
		</tr>
	);
}

function UserRows({ data, ...controls }: RoleControls & { readonly data: typeof UsersList.Type }) {
	return (
		<div className="overflow-x-auto rounded-md border">
			<table className="w-full text-left text-sm">
				<caption className="sr-only">App users and roles</caption>
				<thead className="bg-muted">
					<UserHeaders />
				</thead>
				<tbody>
					{data.users.map((user) => (
						<UserRow {...controls} canChangeRoles={data.canChangeRoles} key={user.id} user={user} />
					))}
				</tbody>
			</table>
		</div>
	);
}

export function UsersTable({ data, ...controls }: RoleControls & { readonly data: typeof UsersList.Type }) {
	return (
		<div className="space-y-4">
			{data.canChangeRoles ? null : <p>Only owners can change roles.</p>}
			{data.users.length === 0 ? <p>No users.</p> : <UserRows {...controls} data={data} />}
		</div>
	);
}
