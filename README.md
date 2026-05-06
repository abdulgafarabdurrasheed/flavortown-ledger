# 🍪 Flavortown Public Ledger

This repository automatically scrapes the Slack channel where Flavortown cookie transactions are posted, tallies up the total earned and spent cookies per user, and displays it on a public leaderboard.

## Setup Instructions

To get this working, you need to configure two things:

### 1. Set up GitHub Secrets
The scraper needs access to the Hack Club Slack to read the transaction history. You need to add two secrets to this repository.

1. Go to your repository's **Settings** tab.
2. Under "Security" on the left, click **Secrets and variables** -> **Actions**.
3. Click **New repository secret**.
4. Add the following secrets:
   * **`SLACK_BOT_TOKEN`**: A Slack User or Bot token (e.g. starting with `xoxp-` or `xoxb-`) that has access to view the channel history.
   * **`SLACK_CHANNEL_ID`**: The ID of the Slack channel where transactions are posted (e.g. `C0AFB0JU00P` or whichever channel holds the ledger history).

### 2. Enable GitHub Pages
This hosts the actual `public/index.html` frontend UI.

1. Go to your repository's **Settings** tab.
2. Click on **Pages** in the left sidebar.
3. Under "Build and deployment", set the **Source** to **Deploy from a branch**.
4. Set the **Branch** to `main` and the folder drop-down to `/public`.
5. Click **Save**.

Within a few minutes, your ledger will be live at `https://abdulgafarabdurrasheed.github.io/flavortown-ledger/`!

### How it works
There is a GitHub Actions workflow (`.github/workflows/update-ledger.yml`) that runs at the top of every hour. It triggers the `fetch-ledger.js` script, which fetches new messages from Slack, aggregates the totals, updates `public/data.json`, and automatically commits the changes back to this repository. The frontend then dynamically loads that JSON file to render the leaderboard.
