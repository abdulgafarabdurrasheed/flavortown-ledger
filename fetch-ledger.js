const fs = require('fs');
const path = require('path');

const SLACK_TOKEN = process.env.SLACK_BOT_TOKEN;
const CHANNEL_ID = process.env.SLACK_CHANNEL_ID;
const DATA_FILE = path.join(__dirname, 'public', 'data.json');

async function fetchSlackHistory(oldestTs) {
  let messages = [];
  let hasMore = true;
  let cursor = '';

  while (hasMore) {
    const url = new URL('https://slack.com/api/conversations.history');
    url.searchParams.append('channel', CHANNEL_ID);
    url.searchParams.append('limit', '200');
    if (oldestTs && oldestTs !== "0") url.searchParams.append('oldest', oldestTs);
    if (cursor) url.searchParams.append('cursor', cursor);

    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${SLACK_TOKEN}` }
    });
    const data = await res.json();
    
    if (!data.ok) {
      console.error('Slack API error:', data.error);
      break;
    }
    
    messages = messages.concat(data.messages || []);
    hasMore = data.has_more;
    cursor = data.response_metadata?.next_cursor || '';
    
    // Simple rate limiting
    await new Promise(r => setTimeout(r, 1500));
  }
  return messages;
}

async function main() {
  if (!SLACK_TOKEN || !CHANNEL_ID) {
    console.error("⚠️ Missing SLACK_BOT_TOKEN or SLACK_CHANNEL_ID environment variables.");
    console.error("Please add them to your GitHub Secrets!");
    process.exit(1);
  }

  // Ensure public directory exists
  if (!fs.existsSync(path.join(__dirname, 'public'))) {
    fs.mkdirSync(path.join(__dirname, 'public'));
  }

  let ledger = { users: {}, lastTs: "0" };
  if (fs.existsSync(DATA_FILE)) {
    try {
      ledger = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch(e) {
      console.error("Failed to parse data.json, starting fresh.");
    }
  }

  console.log(`Fetching messages newer than timestamp: ${ledger.lastTs}`);
  const messages = await fetchSlackHistory(ledger.lastTs);
  console.log(`Found ${messages.length} new messages.`);

  let maxTs = parseFloat(ledger.lastTs);

  // Process messages chronologically (oldest to newest)
  messages.sort((a, b) => parseFloat(a.ts) - parseFloat(b.ts)).forEach(msg => {
    const ts = parseFloat(msg.ts);
    if (ts > maxTs) maxTs = ts;

    const text = (msg.text || '').replace(/\*/g, '').replace(/\s+/g, ' ').trim();
    // Regex based on how Flavortown Slack outputs balances
    const match = text.match(/^@?([^\s:]+|<@[^>]+>)\s*:\s*Balance\s*([+-]?\d+)\s*(?:\(([^\)]+)\))?\s*(?:\u2192|->)\s*(\d+)\b/i);
    
    if (match) {
      let userRaw = match[1];
      let userId = userRaw;
      
      // Extract clean user ID if it's a Slack mention <@U12345>
      const mentionMatch = userRaw.match(/^<@([^>|]+)(?:\|([^>]+))?>$/);
      if (mentionMatch) {
        userId = mentionMatch[1];
      }
      
      const delta = parseInt(match[2], 10);
      const balance = parseInt(match[4], 10);

      if (!ledger.users[userId]) {
        ledger.users[userId] = { id: userId, earned: 0, spent: 0, balance: 0 };
      }

      if (delta > 0) {
        ledger.users[userId].earned += delta;
      } else if (delta < 0) {
        ledger.users[userId].spent += Math.abs(delta);
      }
      
      // Always update the balance to the latest known state
      ledger.users[userId].balance = balance;
    }
  });

  ledger.lastTs = maxTs.toString();
  
  fs.writeFileSync(DATA_FILE, JSON.stringify(ledger, null, 2));
  console.log("✅ Ledger successfully updated and saved to public/data.json!");
}

main();
