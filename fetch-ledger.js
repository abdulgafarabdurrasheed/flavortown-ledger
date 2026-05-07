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
      // If we failed to parse anything previously but saved a high timestamp, reset it to get everything again.
      if (Object.keys(ledger.users || {}).length === 0) {
        ledger.lastTs = "0";
      }
    } catch(e) {
      console.error("Failed to parse data.json, starting fresh.");
    }
  }
  ledger.userNames = ledger.userNames || {};

  console.log(`Fetching messages newer than timestamp: ${ledger.lastTs}`);
  const messages = await fetchSlackHistory(ledger.lastTs);
  console.log(`Found ${messages.length} new messages.`);

  let maxTs = parseFloat(ledger.lastTs);

  // Process messages chronologically (oldest to newest)
  const sortedMessages = messages.sort((a, b) => parseFloat(a.ts) - parseFloat(b.ts));
  for (const msg of sortedMessages) {
    const ts = parseFloat(msg.ts);
    if (ts > maxTs) maxTs = ts;

    const text = (msg.text || '')
      .replace(/\*/g, '')
      .replace(/:[a-z0-9_+-]+:/gi, '')
      .replace(/[\u{1F300}-\u{1F9FF}]|[\u{2700}-\u{27BF}]|[\u{2600}-\u{26FF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F700}-\u{1F77F}]|[\u{1F780}-\u{1F7FF}]|[\u{1F800}-\u{1F8FF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]|[\u{2B50}]|[\u{1F004}]|[\u{1F0CF}]|[\u{1F18E}]|[\u{1F191}-\u{1F19A}]|[\u{203C}]|[\u{2049}]|[\u{20E3}]|[\u{2122}]|[\u{2139}]|[\u{2194}-\u{2199}]|[\u{21A9}-\u{21AA}]|[\u{231A}-\u{231B}]|[\u{2328}]|[\u{23CF}]|[\u{23E9}-\u{23F3}]|[\u{23F8}-\u{23FA}]|[\u{24C2}]|[\u{25AA}-\u{25AB}]|[\u{25B6}]|[\u{25C0}]|[\u{25FB}-\u{25FE}]|[\u{2934}-\u{2935}]|[\u{2B05}-\u{2B07}]|[\u{2B1B}-\u{2B1C}]|[\u{3297}]|[\u{3299}]|[\u{1F201}-\u{1F202}]|[\u{1F21A}]|[\u{1F22F}]|[\u{1F232}-\u{1F23A}]|[\u{1F250}-\u{1F251}]|[\u{1F300}-\u{1F320}]|[\u{1F32D}-\u{1F335}]|[\u{1F337}-\u{1F37C}]|[\u{1F37E}-\u{1F393}]|[\u{1F3A0}-\u{1F3CA}]|[\u{1F3CF}-\u{1F3D3}]|[\u{1F3E0}-\u{1F3F0}]|[\u{1F3F4}]|[\u{1F3F8}-\u{1F43E}]|[\u{1F440}]|[\u{1F442}-\u{1F4FC}]|[\u{1F4FF}-\u{1F53D}]|[\u{1F54B}-\u{1F54E}]|[\u{1F550}-\u{1F567}]|[\u{1F57A}]|[\u{1F595}-\u{1F596}]|[\u{1F5A4}]|[\u{1F5FB}-\u{1F64F}]|[\u{1F680}-\u{1F6C5}]|[\u{1F6CC}]|[\u{1F6D0}-\u{1F6D2}]|[\u{1F6D5}-\u{1F6D7}]|[\u{1F6EB}-\u{1F6EC}]|[\u{1F6F4}-\u{1F6FC}]|[\u{1F7E0}-\u{1F7EB}]|[\u{1F90C}-\u{1F93A}]|[\u{1F93C}-\u{1F945}]|[\u{1F947}-\u{1F9FF}]|[\u{1FA70}-\u{1FA73}]|[\u{1FA78}-\u{1FA7A}]|[\u{1FA80}-\u{1FA82}]|[\u{1FA90}-\u{1FA95}]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();
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

      if ((userId.startsWith('U') || userId.startsWith('W')) && !ledger.userNames[userId]) {
        const userInfoUrl = new URL('https://slack.com/api/users.info');
        userInfoUrl.searchParams.append('user', userId);
        const userInfoRes = await fetch(userInfoUrl, {
          headers: { 'Authorization': `Bearer ${SLACK_TOKEN}` }
        });
        const userInfoData = await userInfoRes.json();
        if (userInfoData.ok && userInfoData.user) {
          ledger.userNames[userId] = userInfoData.user.profile?.display_name || userInfoData.user.profile?.real_name || userInfoData.user.name || userId;
        } else {
          ledger.userNames[userId] = userId;
        }
      }
      
      const delta = parseInt(match[2], 10);
      const balance = parseInt(match[4], 10);

      if (!ledger.users[userId]) {
        ledger.users[userId] = { id: userId, name: ledger.userNames[userId] || userId, earned: 0, spent: 0, balance: 0 };
      }

      ledger.users[userId].name = ledger.userNames[userId] || userId;

      if (delta > 0) {
        ledger.users[userId].earned += delta;
      } else if (delta < 0) {
        ledger.users[userId].spent += Math.abs(delta);
      }
      
      // Always update the balance to the latest known state
      ledger.users[userId].balance = balance;
    }
  }

  ledger.lastTs = maxTs.toString();
  
  fs.writeFileSync(DATA_FILE, JSON.stringify(ledger, null, 2));
  console.log("✅ Ledger successfully updated and saved to public/data.json!");
}

main();
