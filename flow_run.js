/**
 * OpenAI OAuth (PKCE) flow -> refresh_token, using the user's normal Chrome for the
 * authorize step (passes Cloudflare) and a local loopback listener for the callback.
 *
 * usage: node flow_run.js [client_id] [redirect_uri]
 * defaults: ios-app client pdlLIX... with http://localhost:1455/auth/callback
 */
const http = require("http");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

const PORT = 1455;
const CLIENT_ID = process.argv[2] || "pdlLIX2Y72MIl2rhLhTE9VV9bN905kBh";
const REDIRECT_URI = process.argv[3] || `http://localhost:${PORT}/auth/callback`;
const SCOPE = "openid profile email offline_access";

const b64url = (b) => b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const verifier = b64url(crypto.randomBytes(48));
const challenge = b64url(crypto.createHash("sha256").update(verifier).digest());
const state = b64url(crypto.randomBytes(16));

const params = new URLSearchParams({
  response_type: "code",
  client_id: CLIENT_ID,
  redirect_uri: REDIRECT_URI,
  scope: "openid email profile offline_access",
  state: state,
  code_challenge: challenge,
  code_challenge_method: "S256",
  prompt: "login",
  id_token_add_organizations: "true",
  codex_cli_simplified_flow: "true",
});
const authUrl = `https://auth.openai.com/oauth/authorize?${params}`;

console.log("AUTH_URL=" + authUrl);

let resolveCode;
const codePromise = new Promise((r) => (resolveCode = r));

const server = http.createServer((req, res) => {
  const u = new URL(req.url, `http://localhost:${PORT}`);
  console.log("CALLBACK:", req.url);
  if (u.pathname !== "/auth/callback") {
    res.writeHead(404).end("nope");
    return;
  }
  const code = u.searchParams.get("code");
  const state = u.searchParams.get("state");
  const err = u.searchParams.get("error");
  res.writeHead(200, { "Content-Type": "text/html" });
  res.end(
    `<html><body style="font-family:sans-serif;padding:40px">
     <h2>${err ? "Authorization failed: " + err : "OK - you can close this tab"}</h2>
     <p>${code ? "Code captured. Returning to the setup script..." : "No code received."}</p>
     </body></html>`
  );
  if (err) {
    console.log("ERROR_PARAM=" + err);
    process.exit(4);
  }
  if (code) {
    require("fs").writeFileSync(
      require("path").join(__dirname, "auth_code.json"),
      JSON.stringify({ code, state, verifier, client_id: CLIENT_ID, redirect_uri: REDIRECT_URI }, null, 2)
    );
    resolveCode({ code, state });
  }
});

server.listen(PORT, "127.0.0.1", async () => {
  console.log("listening on 127.0.0.1:" + PORT);
  const { spawn } = require("child_process");
  const chrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  const cmd = `start "" "${authUrl}"`;
  exec(cmd, { shell: "cmd.exe" }, (e) => {
    if (e) console.error("start failed:", e.message);
  });
  if (fs.existsSync(chrome)) {
    spawn(chrome, [authUrl], { detached: true, stdio: "ignore" }).unref();
  }
  console.log("opened authorize URL in default browser");
});

(async () => {
  const t = setTimeout(() => {
    console.error("TIMEOUT: no callback received");
    process.exit(5);
  }, 45 * 60 * 1000);
  const { code } = await codePromise;
  clearTimeout(t);
  console.log("CODE=" + code);

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: CLIENT_ID,
    code,
    redirect_uri: REDIRECT_URI,
    code_verifier: verifier,
  });

  const UA =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36";

  const headers = {
    "Content-Type": "application/x-www-form-urlencoded",
    Accept: "*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "User-Agent": UA,
    Origin: "https://auth.openai.com",
    Referer: "https://auth.openai.com/",
  };

  async function exchange() {
    const res = await fetch("https://auth.openai.com/oauth/token", {
      method: "POST",
      headers,
      body: body.toString(),
    });
    const text = await res.text();
    console.log("TOKEN_ENDPOINT_STATUS=" + res.status);
    console.log("TOKEN_ENDPOINT_BODY=" + text.slice(0, 1200));
    try {
      return JSON.parse(text);
    } catch (_) {
      return null;
    }
  }

  let tok = await exchange();
  if (!tok || !tok.access_token) {
    console.log("plain exchange failed -> retrying with curl_cffi (chrome impersonation)");
    try {
      const { execFileSync } = require("child_process");
      const py = path.join(__dirname, ".venv", "Scripts", "python.exe");
      const pyCode = `
import json,sys
from curl_cffi import requests
d=json.loads(sys.argv[1])
r=requests.post("https://auth.openai.com/oauth/token",data=d,impersonate="chrome",timeout=60)
print(json.dumps({"status":r.status_code,"body":r.text[:1500]}))
`;
      const out = execFileSync(py, ["-c", pyCode, JSON.stringify(Object.fromEntries(body))], {
        encoding: "utf8",
      });
      console.log("CURL_CFFI=" + out.trim());
      const parsed = JSON.parse(out);
      tok = JSON.parse(parsed.body);
    } catch (e) {
      console.error("curl_cffi path failed:", e.message);
    }
  }

  if (tok && (tok.access_token || tok.refresh_token)) {
    fs.writeFileSync(path.join(__dirname, "oauth_tokens.json"), JSON.stringify(tok, null, 2));
    const rt = tok.refresh_token || "";
    try {
      const { execSync } = require("child_process");
      execSync("clip", { input: rt, stdio: ["pipe", "ignore", "ignore"] });
      console.log("COPIED_REFRESH_TOKEN_TO_CLIPBOARD");
    } catch (e) {
      console.log("clipboard copy failed:", e.message);
    }
    console.log("SAVED oauth_tokens.json");
    console.log("REFRESH_TOKEN=" + rt);
    // quick probe: who am I + can the access token talk to the chatgpt backend?
    try {
      const r2 = await fetch("https://chatgpt.com/backend-api/me", {
        headers: { Authorization: "Bearer " + tok.access_token, "User-Agent": UA },
      });
      console.log("ME_STATUS=" + r2.status);
      const t2 = await r2.text();
      console.log("ME_BODY=" + t2.slice(0, 600));
    } catch (e) {
      console.log("me probe failed:", e.message);
    }
  } else {
    console.log("NO TOKENS");
  }
  server.close();
  process.exit(0);
})().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
