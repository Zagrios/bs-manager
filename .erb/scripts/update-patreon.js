import fetch from "node-fetch";
import fs from "fs";
import path from "path";

const API_BASE = "https://www.patreon.com/api/oauth2/v2";

function requireEnv(name) {
    const value = process.env[name];
    if (!value) {
      throw new Error(`Missing required env var: ${name}`);
    }
    return value;
  }

function mapTierTitleToType(tierTitle) {
  if (!tierTitle) return undefined;
  const normalized = String(tierTitle).toLowerCase();
  if (normalized.includes("diamond")) return "diamond";
  if (normalized.includes("gold")) return "gold";
  return undefined;
}

function extractPreferredLink(userAttributes) {
  if (!userAttributes || !userAttributes.social_connections) return undefined;
  const sc = userAttributes.social_connections;
  // Prefer Twitch, then YouTube, then Twitter/X
  const providers = ["twitch", "youtube", "twitter"];
  for (const provider of providers) {
    const entry = sc[provider];
    if (entry && entry.url) return entry.url;
  }
  return undefined;
}

async function fetchAllMembers(accessToken, campaignId) {
  let url =
    `${API_BASE}/campaigns/${encodeURIComponent(
      campaignId
    )}/members` +
    "?include=user,currently_entitled_tiers" +
    "&fields[member]=patron_status,full_name,pledge_relationship_start,last_charge_date" +
    "&fields[user]=full_name,vanity,url,social_connections" +
    "&fields[tier]=title" +
    "&page[count]=100";

  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "User-Agent": process.env.PATREON_USER_AGENT || "BSManager - Patreon Sync",
  };

  const allMembers = [];
  const usersById = new Map();
  const tiersById = new Map();

  while (url) {
    const res = await fetch(url, { headers });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to fetch members (${res.status}): ${text}`);
    }
    const json = await res.json();

    if (Array.isArray(json.included)) {
      for (const inc of json.included) {
        if (inc.type === "user") {
          usersById.set(inc.id, inc);
        } else if (inc.type === "tier") {
          tiersById.set(inc.id, inc);
        }
      }
    }

    if (Array.isArray(json.data)) {
      allMembers.push(...json.data);
    }

    url = json.links && json.links.next ? json.links.next : undefined;
  }

  return { members: allMembers, usersById, tiersById };
}

function buildPatreonsList({ members, usersById, tiersById, existingLinkByUsername }) {
  const uniqueByUsername = new Map();

  for (const member of members) {
    const attrs = member.attributes || {};
    if (attrs.patron_status !== "active_patron") continue;

    const userRel = member.relationships && member.relationships.user && member.relationships.user.data;
    const user = userRel ? usersById.get(userRel.id) : undefined;
    const userAttrs = (user && user.attributes) || {};

    const tiersRel =
      member.relationships &&
      member.relationships.currently_entitled_tiers &&
      member.relationships.currently_entitled_tiers.data;
    let type;
    if (Array.isArray(tiersRel) && tiersRel.length > 0) {
      // Use first tier title match to determine type
      const tier = tiersById.get(tiersRel[0].id);
      type = mapTierTitleToType(tier && tier.attributes && tier.attributes.title);
    }

    const username = (userAttrs.vanity || userAttrs.full_name || user?.id || "[ ]").trim();
    const link = type === "diamond" ? extractPreferredLink(userAttrs) : undefined;

    // Determine first payment/relationship start date (fallback to last_charge_date)
    const firstDateStr = attrs.pledge_relationship_start || attrs.last_charge_date || null;
    let ts = Number.MAX_SAFE_INTEGER;
    if (firstDateStr) {
      const parsed = Date.parse(firstDateStr);
      ts = Number.isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed;
    }

    const entry = { username };
    if (type) entry.type = type;
    // Preserve link from existing JSON if present; otherwise use new link
    const preservedLink = existingLinkByUsername && existingLinkByUsername.get(username);
    if (preservedLink) entry.link = preservedLink;
    else if (link) entry.link = link;

    // Ensure uniqueness by username
    if (!uniqueByUsername.has(username)) {
      uniqueByUsername.set(username, { entry, ts });
    }
  }

  return Array.from(uniqueByUsername.values())
    .sort((a, b) => a.ts - b.ts)
    .map((x) => x.entry);
}

async function main() {
  const ACCESS_TOKEN = requireEnv("PATREON_ACCESS_TOKEN");
  const CAMPAIGN_ID = requireEnv("PATREON_CAMPAIGN_ID");

  const jsonPath = path.resolve(process.cwd(), "assets", "jsons", "patreons.json");
  let existing = [];
  try {
    if (fs.existsSync(jsonPath)) {
      const raw = fs.readFileSync(jsonPath, "utf8");
      existing = JSON.parse(raw);
    }
  } catch (_) {
    existing = [];
  }
  const existingLinkByUsername = new Map();
  if (Array.isArray(existing)) {
    for (const e of existing) {
      if (e && e.username && e.link) existingLinkByUsername.set(e.username, e.link);
    }
  }

  const { members, usersById, tiersById } = await fetchAllMembers(ACCESS_TOKEN, CAMPAIGN_ID);
  const patreons = buildPatreonsList({ members, usersById, tiersById, existingLinkByUsername });
  const output = `${JSON.stringify(patreons, null, "\t")}\n`;
  fs.writeFileSync(jsonPath, output, "utf8");

  // eslint-disable-next-line no-console
  console.log(`Updated ${jsonPath} with ${patreons.length} active patrons.`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});


