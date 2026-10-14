### Added

- The typed Inbox query and headless `attention.projection(snapshot)` expose `you`, `agents`, `resolved` and `parked` lanes, with audience labels and separate source diagnostics.

### Fixed

- Inbox, Overview and navigation badges share the maintainer lane count. Open requests for other labels remain visible under Waiting on agents, including requests without a registered question. Invalid managed requests remain source diagnostics rather than counted asks.
