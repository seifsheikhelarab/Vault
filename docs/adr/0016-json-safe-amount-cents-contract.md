# JSON-safe `amountCents` API contract

PostgreSQL stores `amountCents` as `bigint`, while the JSON API exposes it as an integer JavaScript `number`. Every monetary input boundary validates that the value is an integer and does not exceed `Number.MAX_SAFE_INTEGER`; Expense, Settlement, and Budget amounts must be positive, while a Split may be zero when a selected participant's allocation rounds to zero. The server converts database bigint values to safe numbers before serialization.

The alternative — exposing PostgreSQL bigint values as JSON strings — would preserve arbitrary magnitude but make the shared API and UI less ergonomic. Returning dollar-valued numbers would hide the unit and reintroduce dollars-versus-cents ambiguity. The safe-number boundary keeps the explicit unit while remaining JSON-native.

The trade-off is a finite maximum and the need for conversion code at the database/JSON boundary. That maximum is acceptable for the product as long as the domain also defines a sensible business maximum below the technical ceiling.
