export default {
  async email(message, env, ctx) {
    var to = message.to || "";
    var from = message.from || "";
    var subject = message.headers.get("subject") || "No Subject";
    var raw = await new Response(message.raw).text();
    var body = "";
    var html = "";
    var sep = raw.indexOf("\r\n\r\n");
    if (sep > -1) {
      body = raw.substring(sep + 4);
    }

    // Try to extract text/html parts from multipart
    var ctHeader = getHeader(raw, "Content-Type");
    if (ctHeader.indexOf("multipart") !== -1) {
      var boundary = getBoundary(ctHeader);
      if (boundary) {
        var parts = raw.split("--" + boundary);
        for (var i = 0; i < parts.length; i++) {
          var part = parts[i];
          if (part.indexOf("text/plain") !== -1) {
            body = getBodyFromSection(part);
          } else if (part.indexOf("text/html") !== -1) {
            html = getBodyFromSection(part);
          }
        }
      }
    }

    if (!html) html = body;

    var id = crypto.randomUUID();
    await env.DB.prepare(
      "INSERT INTO emails (id, address, sender, subject, body, html, received_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)"
    ).bind(id, to.toLowerCase(), from, subject, body, html, Date.now()).run();
  },

  async scheduled(event, env, ctx) {
    var cutoff = Date.now() - 3600000;
    await env.DB.prepare("DELETE FROM emails WHERE received_at < ?1").bind(cutoff).run();
  }
};

function getHeader(raw, name) {
  var lines = raw.split("\n");
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    if (line.toLowerCase().indexOf(name.toLowerCase() + ":") === 0) {
      return line.substring(name.length + 1).trim();
    }
  }
  return "";
}

function getBoundary(contentType) {
  var parts = contentType.split(";");
  for (var i = 0; i < parts.length; i++) {
    var p = parts[i].trim();
    if (p.indexOf("boundary=") === 0 || p.indexOf("boundary =") === 0) {
      var val = p.split("=")[1] || "";
      val = val.trim();
      if (val.charAt(0) === '"') {
        val = val.substring(1, val.length - 1);
      }
      return val;
    }
  }
  return "";
}

function getBodyFromSection(section) {
  var idx = section.indexOf("\r\n\r\n");
  if (idx === -1) {
    idx = section.indexOf("\n\n");
    if (idx === -1) return "";
    return decodeSection(section, section.substring(idx + 2).trim());
  }
  return decodeSection(section, section.substring(idx + 4).trim());
}

function decodeSection(header, content) {
  if (header.indexOf("base64") !== -1) {
    try {
      var cleaned = content.split(/\s/).join("");
      return atob(cleaned);
    } catch (e) {
      return content;
    }
  }
  return content;
}
