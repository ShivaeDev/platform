import { useId } from "react";

export function ReadoutsPage() {
	const destinationLabelId = useId();
	const notesId = useId();
	const deliveriesLabelId = useId();
	return (
		<main>
			<h1>Deliveries</h1>
			<section aria-label="Summary">
				Two <strong>ready</strong>
				<span hidden> secret</span>
			</section>
			<span id={destinationLabelId}>Destination</span>
			<section aria-labelledby={destinationLabelId}>London</section>
			<label htmlFor={notesId}>Notes</label>
			<output id={notesId}>Leave at reception</output>
			<h2 id={deliveriesLabelId}>Ready deliveries</h2>
			<table aria-labelledby={deliveriesLabelId}>
				<thead>
					<tr>
						<th>City</th>
						<th>Status</th>
						<th hidden>Internal</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<th scope="row">London</th>
						<td>
							<strong>Ready</strong>
							<span hidden> secret</span>
						</td>
					</tr>
					<tr hidden>
						<th>Hidden city</th>
						<td>Hidden status</td>
					</tr>
					<tr>
						<th scope="row">Paris</th>
						<td>In transit</td>
					</tr>
				</tbody>
			</table>
			<table aria-label="Archived deliveries">
				<tbody>
					<tr>
						<td>Rome</td>
					</tr>
				</tbody>
			</table>
			<section aria-label="Repeated">First</section>
			<section aria-label="Repeated">Second</section>
			<section aria-label="Hidden summary" hidden>
				Hidden
			</section>
		</main>
	);
}
