export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age": "86400"
        }
      });
    }

    var url = new URL(request.url);
    var path = url.pathname;
    var response;

    try {
      if (path === "/api/generate" && request.method === "GET") {
        response = await handleGenerate(env);
      } else if (path.startsWith("/api/inbox/") && request.method === "GET") {
        var address = decodeURIComponent(path.replace("/api/inbox/", ""));
        response = await handleInbox(address, env);
      } else if (path.startsWith("/api/email/") && request.method === "GET") {
        var emailId = path.replace("/api/email/", "");
        response = await handleGetEmail(emailId, env);
      } else if (path.startsWith("/api/email/") && request.method === "DELETE") {
        var delId = path.replace("/api/email/", "");
        response = await handleDeleteEmail(delId, env);
      } else {
        response = jsonResponse({ error: "Not Found" }, 404);
      }
    } catch (error) {
      response = jsonResponse({ error: "Internal Server Error" }, 500);
    }

    response.headers.set("Access-Control-Allow-Origin", "*");
    return response;
  }
};

async function handleGenerate(env) {
  var adjectives = ["quick", "lazy", "happy", "dark", "bright", "cool", "warm", "fast", "wild", "calm", "bold", "free", "blue", "red", "green", "gold"];
  var nouns = ["fox", "wolf", "bear", "hawk", "deer", "crow", "pike", "crab", "moth", "frog", "owl", "bat", "elk", "ram", "eel", "cod"];
  var adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  var noun = nouns[Math.floor(Math.random() * nouns.length)];
  var num = Math.floor(Math.random() * 999) + 1;
  var username = adj + "." + noun + num;
  var address = username + "@mailtemp.web.id";

  return jsonResponse({
    success: true,
    email: address,
    username: username,
    expires_in: 3600,
    created_at: Date.now()
  });
}

async function handleInbox(address, env) {
  if (!address || address.indexOf("@mailtemp.web.id") === -1) {
    return jsonResponse({ error: "Invalid email address" }, 400);
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

async function handleGetEmail(id, env) {
  if (!id) {
    return jsonResponse({ error: "Email ID required" }, 400);
  }

  var result = await env.DB.prepare(
    "SELECT * FROM emails WHERE id = ?1"
  ).bind(id).first();

  if (!result) {
    return jsonResponse({ error: "Email not found" }, 404);
  }

  return jsonResponse({ success: true, email: result });
}

async function handleDeleteEmail(id, env) {
  if (!id) {
    return jsonResponse({ error: "Email ID required" }, 400);
  }

  await env.DB.prepare("DELETE FROM emails WHERE id = ?1").bind(id).run();
  return jsonResponse({ success: true, message: "Email deleted" });
}

function jsonResponse(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { "Content-Type": "application/json" }
  });
}
