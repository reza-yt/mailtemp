export default {
  async email(message, env, ctx) {
    var to = message.to || "";
    var from = message.from || "";
    var subject = message.headers.get("subject") || "No Subject";
    var raw = await new Response(message.raw).text();
    var body = "";
    var sep = raw.indexOf("\r\n\r\n");
    if (sep > -1) {
      body = raw.substring(sep + 4);
    }
    var id = crypto.randomUUID();
    await env.DB.prepare(
      "INSERT INTO emails (id, address, sender, subject, body, html, received_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)"
    ).bind(id, to.toLowerCase(), from, subject, body, body, Date.now()).run();
  },

  async scheduled(event, env, ctx) {
    var cutoff = Date.now() - 3600000;
    await env.DB.prepare("DELETE FROM emails WHERE received_at < ?1").bind(cutoff).run();
  }
};
