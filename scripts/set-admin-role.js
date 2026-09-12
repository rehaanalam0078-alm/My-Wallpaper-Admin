/**
 * Server-Side Admin Role Management Tool
 * Uses Firebase CLI authentication to set, list, and revoke custom claims ({ admin: true, role: "admin" }).
 * 
 * Usage:
 *   node scripts/set-admin-role.js --email=admin@mywallpaper.dev
 *   node scripts/set-admin-role.js --email=rehaanalam0078@gmail.com
 *   node scripts/set-admin-role.js --list
 *   node scripts/set-admin-role.js --revoke=user@example.com
 */

import fs from "fs";
import path from "path";
import os from "os";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const PROJECT_ID = "my-wallpaper-c9bf1";

// 1. Get access token from local firebase-tools session
async function getAccessToken() {
  const configPath = path.join(os.homedir(), ".config", "configstore", "firebase-tools.json");
  if (!fs.existsSync(configPath)) {
    throw new Error(`Firebase CLI configuration not found at ${configPath}. Run 'firebase login' first.`);
  }

  const raw = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const tokens = raw.tokens;
  if (!tokens || !tokens.refresh_token) {
    throw new Error("No refresh_token found in firebase-tools configuration. Please run 'firebase login'.");
  }

  try {
    const firebaseAuth = require("firebase-tools/lib/auth.js");
    const tokenObj = await firebaseAuth.getAccessToken(tokens.refresh_token, tokens.scopes || []);
    return tokenObj.access_token;
  } catch {
    // Fallback directly to stored access_token if valid
    if (tokens.access_token && (!tokens.expires_at || tokens.expires_at > Date.now())) {
      return tokens.access_token;
    }
    throw new Error("Could not retrieve active access token from Firebase CLI.");
  }
}

// 2. Find user by email or UID
async function lookupUser(accessToken, identifier) {
  const isEmail = identifier.includes("@");
  const payload = isEmail ? { email: [identifier.trim()] } : { localId: [identifier.trim()] };

  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}/accounts:lookup`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`User lookup failed (${res.status}): ${err}`);
  }

  const data = await res.json();
  if (!data.users || data.users.length === 0) {
    return null;
  }
  return data.users[0];
}

// 3. List all accounts and their claims
async function listAllAccounts(accessToken) {
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}/accounts:batchGet?maxResults=100`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    }
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to list accounts (${res.status}): ${err}`);
  }

  const data = await res.json();
  return data.users || [];
}

// 4. Set custom claims on user
async function setCustomClaims(accessToken, uid, claims) {
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}/accounts:update`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      localId: uid,
      customAttributes: JSON.stringify(claims)
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to update custom claims (${res.status}): ${err}`);
  }

  return await res.json();
}

// 5. Record admin in Firestore 'admins' collection
async function syncAdminToFirestore(accessToken, uid, email, role = "admin") {
  const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/admins/${uid}`;
  
  const body = {
    fields: {
      email: { stringValue: email },
      role: { stringValue: role },
      updatedAt: { timestampValue: new Date().toISOString() }
    }
  };

  const res = await fetch(firestoreUrl, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  return res.ok;
}

// 6. Remove admin from Firestore 'admins' collection
async function removeAdminFromFirestore(accessToken, uid) {
  const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/admins/${uid}`;
  const res = await fetch(firestoreUrl, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });
  return res.ok;
}

// Main CLI Execution
async function main() {
  const args = process.argv.slice(2);
  const emailArg = args.find((a) => a.startsWith("--email="))?.split("=")[1];
  const uidArg = args.find((a) => a.startsWith("--uid="))?.split("=")[1];
  const revokeArg = args.find((a) => a.startsWith("--revoke="))?.split("=")[1];
  const listFlag = args.includes("--list");

  console.log(`[MyWallpaper Admin Manager] Connecting to project: ${PROJECT_ID}...`);
  const accessToken = await getAccessToken();

  if (listFlag) {
    console.log("\n=================== ACTIVE ACCOUNTS & ROLES ===================");
    const accounts = await listAllAccounts(accessToken);
    for (const acc of accounts) {
      let claims = {};
      try {
        if (acc.customAttributes) {
          claims = JSON.parse(acc.customAttributes);
        }
      } catch {
        claims = { raw: acc.customAttributes };
      }
      const role = (claims.admin || claims.role === "admin") ? "⭐ ADMIN [admin: true, role: 'admin']" : "👤 NORMAL USER";
      console.log(`- ${acc.email || "(no email)"} (UID: ${acc.localId})`);
      console.log(`  Role: ${role}`);
    }
    console.log("===============================================================\n");
    return;
  }

  if (revokeArg) {
    console.log(`Revoking admin role for: ${revokeArg}...`);
    const user = await lookupUser(accessToken, revokeArg);
    if (!user) {
      console.error(`Error: User '${revokeArg}' not found.`);
      process.exit(1);
    }
    await setCustomClaims(accessToken, user.localId, {});
    await removeAdminFromFirestore(accessToken, user.localId);
    console.log(`Successfully revoked admin privileges for ${user.email} (UID: ${user.localId}).`);
    return;
  }

  const targetIdentifier = emailArg || uidArg || process.env.INITIAL_ADMIN_EMAIL || "admin@mywallpaper.dev";
  console.log(`Looking up user: ${targetIdentifier}...`);
  const user = await lookupUser(accessToken, targetIdentifier);

  if (!user) {
    console.error(`Error: User '${targetIdentifier}' not found in Firebase Auth.`);
    process.exit(1);
  }

  console.log(`Found user: ${user.email} (UID: ${user.localId})`);
  console.log(`Assigning authoritative claims: { admin: true, role: "admin" }...`);
  
  await setCustomClaims(accessToken, user.localId, { admin: true, role: "admin" });
  await syncAdminToFirestore(accessToken, user.localId, user.email, "admin");

  console.log(`SUCCESS: User ${user.email} is now an AUTHORIZED ADMINISTRATOR.`);
  console.log(`Custom Claims set: { admin: true, role: "admin" }`);
  console.log(`Firestore record updated at 'admins/${user.localId}'.\n`);
}

main().catch((err) => {
  console.error("\nError executing admin role manager:", err.message);
  process.exit(1);
});
