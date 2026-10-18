### Fixed

- Answer links open the item’s answer card directly. Existing `/_board/respond` links retain the server redirect.

### Breaking

- Remove the `work-board.respond` query from `workContract` / `workRpcs` and the browser client API, and remove `RespondProjection`. Read the item document or use the response `question` query instead.
