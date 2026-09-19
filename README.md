# Splitwise Lite

Minimal Splitwise-style expense splitter. One HTML file, no backend to run, no account, no app.

**Live:** https://fernandollisboa.github.io/splitwise-lite/

## How it works

1. Open the page, create a group and type your name.
2. Press **Copy group link** and send it to your friends.
3. Everyone with the link sees the same expenses and can add their own. Changes sync every few seconds.

### Expense types

- **Split equally**: leave the payer checked among the participants (e.g. dinner for 3 → each owes a third).
- **Loan / one person owes**: uncheck the payer and keep only the debtor(s) checked (e.g. "Lia owes me R$ 12").

**Settle up** shows the minimal set of transfers to zero everyone out.

## Storage

Each group is a JSON document on [jsonblob.com](https://jsonblob.com) (free, no account, one random id per group; the link is the secret).
Clients merge by id, so concurrent edits from different phones don't overwrite each other.

Caveats:

- jsonblob deletes documents nobody has opened for 30 days. The page detects this and offers to restore from the local copy.
- Use **Export JSON** for a backup.

## Deploy

GitHub Pages deploys `main` automatically via `.github/workflows/pages.yml`.
