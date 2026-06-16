export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, X-API-Key",
          "Access-Control-Max-Age": "86400"
        }
      });
    }

    var url = new URL(request.url);
    var path = url.pathname;
    var response;

    try {
      // Public routes (no API key needed)
      if (path === "/api/generate" && request.method === "GET") {
        response = await handleGenerate(url, env);
      } else if (path === "/api/generate" && request.method === "POST") {
        response = await handleGenerateCustom(request, env);
      } else if (path.startsWith("/api/inbox/") && request.method === "GET") {
        response = await handleInbox(path, env);
      } else if (path.startsWith("/api/email/") && request.method === "GET") {
        response = await handleGetEmail(path, env);
      } else if (path.startsWith("/api/email/") && request.method === "DELETE") {
        response = await handleDeleteEmail(path, env);
      } else if (path.startsWith("/api/extract-code/") && request.method === "GET") {
        response = await handleExtractCode(path, env);
      } else if (path === "/api/key/generate" && request.method === "POST") {
        response = await handleGenerateApiKey(env);
      } else if (path === "/api/key/verify" && request.method === "GET") {
        response = await handleVerifyApiKey(request, env);
      }
      // API Key protected routes
      else if (path === "/api/v1/generate" && (request.method === "GET" || request.method === "POST")) {
        var authResult = await verifyApiKey(request, env);
        if (!authResult.valid) {
          response = jsonResponse({ error: "Invalid or missing API key", code: "UNAUTHORIZED" }, 401);
        } else {
          if (request.method === "POST") {
            response = await handleGenerateCustom(request, env);
          } else {
            response = await handleGenerate(url, env);
          }
        }
      } else if (path.startsWith("/api/v1/inbox/") && request.method === "GET") {
        var authResult2 = await verifyApiKey(request, env);
        if (!authResult2.valid) {
          response = jsonResponse({ error: "Invalid or missing API key", code: "UNAUTHORIZED" }, 401);
        } else {
          var inboxPath = path.replace("/api/v1/", "/api/");
          response = await handleInbox(inboxPath, env);
        }
      } else if (path.startsWith("/api/v1/extract-code/") && request.method === "GET") {
        var authResult3 = await verifyApiKey(request, env);
        if (!authResult3.valid) {
          response = jsonResponse({ error: "Invalid or missing API key", code: "UNAUTHORIZED" }, 401);
        } else {
          var extractPath = path.replace("/api/v1/", "/api/");
          response = await handleExtractCode(extractPath, env);
        }
      } else if (path.startsWith("/api/v1/wait-code/") && request.method === "GET") {
        var authResult4 = await verifyApiKey(request, env);
        if (!authResult4.valid) {
          response = jsonResponse({ error: "Invalid or missing API key", code: "UNAUTHORIZED" }, 401);
        } else {
          response = await handleWaitCode(path, url, env);
        }
      } else {
        response = jsonResponse({ error: "Not Found", code: "NOT_FOUND" }, 404);
      }
    } catch (error) {
      response = jsonResponse({ error: "Internal Server Error", code: "SERVER_ERROR" }, 500);
    }

    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, X-API-Key");
    return response;
  }
};

// === GENERATE EMAIL ===

async function handleGenerate(url, env) {
  var custom = url.searchParams.get("username");
  if (custom) {
    if (!isValidUsername(custom)) {
      return jsonResponse({ error: "Invalid username. Use 3-30 chars: letters, numbers, dots, underscores", code: "INVALID_USERNAME" }, 400);
    }
    var address = custom.toLowerCase() + "@mailtemp.web.id";
    return jsonResponse({
      success: true,
      email: address,
      username: custom.toLowerCase(),
      expires_in: 3600,
      created_at: Date.now()
    });
  }

  var username = generateUsername();
  var address = username + "@mailtemp.web.id";
  return jsonResponse({
    success: true,
    email: address,
    username: username,
    expires_in: 3600,
    created_at: Date.now()
  });
}

async function handleGenerateCustom(request, env) {
  var body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse({ error: "Invalid JSON body", code: "INVALID_BODY" }, 400);
  }

  var username = body.username;
  if (!username) {
    var generated = generateUsername();
    return jsonResponse({
      success: true,
      email: generated + "@mailtemp.web.id",
      username: generated,
      expires_in: 3600,
      created_at: Date.now()
    });
  }

  if (!isValidUsername(username)) {
    return jsonResponse({ error: "Invalid username. Use 3-30 chars: letters, numbers, dots, underscores", code: "INVALID_USERNAME" }, 400);
  }

  var address = username.toLowerCase() + "@mailtemp.web.id";
  return jsonResponse({
    success: true,
    email: address,
    username: username.toLowerCase(),
    expires_in: 3600,
    created_at: Date.now()
  });
}

// === INBOX ===

async function handleInbox(path, env) {
  var address = decodeURIComponent(path.replace("/api/inbox/", ""));
  if (!address || address.indexOf("@mailtemp.web.id") === -1) {
    return jsonResponse({ error: "Invalid email address", code: "INVALID_EMAIL" }, 400);
  }

  var result = await env.DB.prepare(
    "SELECT id, address, sender, subject, received_at FROM emails WHERE address = ?1 ORDER BY received_at DESC LIMIT 50"
  ).bind(address.toLowerCase()).all();

  return jsonResponse({
    success: true,
    email: address,
    messages: result.results || [],
    count: result.results ? result.results.length : 0
  });
}

// === GET EMAIL ===

async function handleGetEmail(path, env) {
  var id = path.replace("/api/email/", "");
  if (!id) {
    return jsonResponse({ error: "Email ID required", code: "MISSING_ID" }, 400);
  }

  var result = await env.DB.prepare(
    "SELECT * FROM emails WHERE id = ?1"
  ).bind(id).first();

  if (!result) {
    return jsonResponse({ error: "Email not found", code: "NOT_FOUND" }, 404);
  }

  return jsonResponse({ success: true, email: result });
}

// === DELETE EMAIL ===

async function handleDeleteEmail(path, env) {
  var id = path.replace("/api/email/", "");
  if (!id) {
    return jsonResponse({ error: "Email ID required", code: "MISSING_ID" }, 400);
  }

  await env.DB.prepare("DELETE FROM emails WHERE id = ?1").bind(id).run();
  return jsonResponse({ success: true, message: "Email deleted" });
}

// === EXTRACT VERIFICATION CODE ===

async function handleExtractCode(path, env) {
  var address = decodeURIComponent(path.replace("/api/extract-code/", ""));
  if (!address || address.indexOf("@mailtemp.web.id") === -1) {
    return jsonResponse({ error: "Invalid email address", code: "INVALID_EMAIL" }, 400);
  }

  var result = await env.DB.prepare(
    "SELECT id, sender, subject, body, html, received_at FROM emails WHERE address = ?1 ORDER BY received_at DESC LIMIT 5"
  ).bind(address.toLowerCase()).all();

  var messages = result.results || [];
  if (messages.length === 0) {
    return jsonResponse({
      success: true,
      found: false,
      message: "No emails found",
      codes: []
    });
  }

  var codes = [];
  for (var i = 0; i < messages.length; i++) {
    var msg = messages[i];
    var content = (msg.body || "") + " " + (msg.html || "") + " " + (msg.subject || "");
    var extracted = extractVerificationCodes(content);
    if (extracted.length > 0) {
      codes.push({
        email_id: msg.id,
        sender: msg.sender,
        subject: msg.subject,
        codes: extracted,
        received_at: msg.received_at
      });
    }
  }

  return jsonResponse({
    success: true,
    found: codes.length > 0,
    codes: codes,
    checked_emails: messages.length
  });
}

// === WAIT FOR CODE (polling helper for API) ===

async function handleWaitCode(path, url, env) {
  var address = decodeURIComponent(path.replace("/api/v1/wait-code/", ""));
  if (!address || address.indexOf("@mailtemp.web.id") === -1) {
    return jsonResponse({ error: "Invalid email address", code: "INVALID_EMAIL" }, 400);
  }

  var timeout = parseInt(url.searchParams.get("timeout")) || 30;
  if (timeout > 60) timeout = 60;
  if (timeout < 5) timeout = 5;

  var since = parseInt(url.searchParams.get("since")) || (Date.now() - 120000);

  var result = await env.DB.prepare(
    "SELECT id, sender, subject, body, html, received_at FROM emails WHERE address = ?1 AND received_at > ?2 ORDER BY received_at DESC LIMIT 5"
  ).bind(address.toLowerCase(), since).all();

  var messages = result.results || [];
  var codes = [];

  for (var i = 0; i < messages.length; i++) {
    var msg = messages[i];
    var content = (msg.body || "") + " " + (msg.html || "") + " " + (msg.subject || "");
    var extracted = extractVerificationCodes(content);
    if (extracted.length > 0) {
      codes.push({
        email_id: msg.id,
        sender: msg.sender,
        subject: msg.subject,
        codes: extracted,
        received_at: msg.received_at
      });
    }
  }

  return jsonResponse({
    success: true,
    found: codes.length > 0,
    codes: codes,
    address: address,
    since: since,
    checked_at: Date.now()
  });
}

// === API KEY MANAGEMENT ===

async function handleGenerateApiKey(env) {
  var key = "mt_" + generateRandomString(32);
  var id = crypto.randomUUID();

  await env.DB.prepare(
    "INSERT INTO api_keys (id, key_hash, created_at, last_used) VALUES (?1, ?2, ?3, ?4)"
  ).bind(id, key, Date.now(), Date.now()).run();

  return jsonResponse({
    success: true,
    api_key: key,
    message: "Save this key! It won't be shown again.",
    usage: {
      header: "X-API-Key: " + key,
      endpoints: [
        "GET /api/v1/generate",
        "POST /api/v1/generate",
        "GET /api/v1/inbox/:address",
        "GET /api/v1/extract-code/:address",
        "GET /api/v1/wait-code/:address"
      ]
    }
  });
}

async function handleVerifyApiKey(request, env) {
  var authResult = await verifyApiKey(request, env);
  if (!authResult.valid) {
    return jsonResponse({ success: false, valid: false, error: "Invalid API key" }, 401);
  }
  return jsonResponse({ success: true, valid: true, message: "API key is valid" });
}

async function verifyApiKey(request, env) {
  var key = request.headers.get("X-API-Key") || "";
  if (!key || key.indexOf("mt_") !== 0) {
    return { valid: false };
  }

  var result = await env.DB.prepare(
    "SELECT id FROM api_keys WHERE key_hash = ?1"
  ).bind(key).first();

  if (!result) {
    return { valid: false };
  }

  // Update last used
  await env.DB.prepare(
    "UPDATE api_keys SET last_used = ?1 WHERE key_hash = ?2"
  ).bind(Date.now(), key).run();

  return { valid: true, keyId: result.id };
}

// === HELPERS ===

function extractVerificationCodes(text) {
  var codes = [];
  if (!text) return codes;

  // Match 4-8 digit codes
  var digitMatches = text.match(/\b\d{4,8}\b/g);
  if (digitMatches) {
    for (var i = 0; i < digitMatches.length; i++) {
      var num = digitMatches[i];
      // Filter out years and common non-code numbers
      if (num.length >= 4 && num.length <= 8) {
        var numInt = parseInt(num);
        if (numInt < 1900 || numInt > 2100) {
          if (codes.indexOf(num) === -1) {
            codes.push(num);
          }
        }
      }
    }
  }

  // Match alphanumeric codes like ABC-123 or ABC123
  var alphaMatches = text.match(/\b[A-Z0-9]{3,4}[-][A-Z0-9]{3,4}\b/g);
  if (alphaMatches) {
    for (var j = 0; j < alphaMatches.length; j++) {
      if (codes.indexOf(alphaMatches[j]) === -1) {
        codes.push(alphaMatches[j]);
      }
    }
  }

  return codes.slice(0, 5);
}

function isValidUsername(username) {
  if (!username) return false;
  if (username.length < 3 || username.length > 30) return false;
  var valid = "abcdefghijklmnopqrstuvwxyz0123456789._";
  var lower = username.toLowerCase();
  for (var i = 0; i < lower.length; i++) {
    if (valid.indexOf(lower[i]) === -1) return false;
  }
  return true;
}

function generateUsername() {
  var adjectives = ["quick", "lazy", "happy", "dark", "bright", "cool", "warm", "fast", "wild", "calm", "bold", "free", "blue", "red", "green", "gold", "swift", "sharp", "smart", "brave"];
  var nouns = ["fox", "wolf", "bear", "hawk", "deer", "crow", "pike", "crab", "moth", "frog", "owl", "bat", "elk", "ram", "eel", "cod", "lynx", "puma", "duck", "bee"];
  var adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  var noun = nouns[Math.floor(Math.random() * nouns.length)];
  var num = Math.floor(Math.random() * 999) + 1;
  return adj + "." + noun + num;
}

function generateRandomString(length) {
  var chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  var result = "";
  var bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  for (var i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

function jsonResponse(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { "Content-Type": "application/json" }
  });
}
