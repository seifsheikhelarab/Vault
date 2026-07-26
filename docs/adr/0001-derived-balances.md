# Derived balances over materialized balances

Balances in social Groups are always computed from the raw ledger (Expenses + Settlements), never stored in a separate `Balance` table.

The alternative — materializing balances after every mutation — introduces a consistency risk: a bug in the update logic corrupts the ledger, and recovery requires recalculating from scratch anyway. Derived balances make the Expenses and Settlements the single source of truth. With TanStack Query caching the result, the compute cost is negligible at portfolio scale (hundreds of expenses, not millions).

The trade-off is that every view of balances requires a full computation, but this is fast enough to be unnoticeable and eliminates an entire class of data-corruption bugs.
