const http = require("node:http");
const path = require("node:path");
const fs = require("node:fs");
const crypto = require("node:crypto");
const { promisify } = require("node:util");

const scrypt = promisify(crypto.scrypt);
const port = Number(process.env.PORT) || 8000;
const root = __dirname;
const uploadDirectory = path.join(root, "uploads");
const authFile = path.join(root, "admin-auth.json");
const imageManifest = path.join(uploadDirectory, "images.json");
const maxImageBytes = 5 * 1024 * 1024;
const sessionLifetime = 8 * 60 * 60 * 1000;
const sessions = new Map();
const loginAttempts = new Map();
const publicFiles = new Set([
  "index.html", "connexion.html", "client.html", "agent.html", "chauffeur.html",
  "admin-login.html", "admin-setup.html",   "admin-login.html", "admin-setup.html",
  "styles.css", "portals.css", "futurist.css",
  "app.js", "portal.js", "auth.js", "admin.js"
]);
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8"
};
const allowedCategories = new Set(["bus", "travel", "agency"]);

fs.mkdirSync(uploadDirectory, { recursive: true });

function respond(response, status, body, headers = {}) {
  response.writeHead(status, {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "same-origin",
    "Content-Security-Policy": "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self'; base-uri 'self'; frame-ancestors 'none'",
    ...headers
  });
  response.end(body);
}

function json(response, status, value, headers = {}) {
  respond(response, status, JSON.stringify(value), {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...headers
  });
}

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(authFile, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

function getSession(request) {
  const cookie = request.headers.cookie || "";
  const match = cookie.match(/(?:^|;\s*)ft_admin=([A-Za-z0-9_-]+)/);
  const session = match ? sessions.get(match[1]) : null;
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    sessions.delete(match[1]);
    return null;
  }
  session.expiresAt = Date.now() + sessionLifetime;
  return { id: match[1], ...session };
}

function isLocalRequest(request) {
  const address = request.socket.remoteAddress || "";
  return address === "127.0.0.1" || address === "::1" || address === "::ffff:127.0.0.1";
}

function sameOrigin(request) {
const origin = request.headers.origin;
const host = request.headers.host || "";
const allowedHosts = ["localhost", "127.0.0.1", "192.168.56.10"];
const hostOk = allowedHosts.some((h) => host === h || host.startsWith(`${h}:`));
return hostOk && origin === `http://${host}`;
}

function readBody(request, maximumBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > maximumBytes) {
        reject(Object.assign(new Error("Le fichier dépasse la limite autorisée."), { status: 413 }));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => resolve(Buffer.concat(chunks)));
    request.on("error", reject);
  });
}

async function readJson(request) {
  const body = await readBody(request, 16 * 1024);
  try {
    return JSON.parse(body.toString("utf8"));
  } catch {
    throw Object.assign(new Error("Requête invalide."), { status: 400 });
  }
}

function safeEqual(first, second) {
  if (typeof first !== "string" || typeof second !== "string") return false;
  const left = Buffer.from(first);
  const right = Buffer.from(second);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function setSessionCookie(response, id) {
  response.setHeader("Set-Cookie", `ft_admin=${id}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${sessionLifetime / 1000}`);
}

function clearSessionCookie(response) {
  response.setHeader("Set-Cookie", "ft_admin=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0");
}

function createSession(response) {
  const id = crypto.randomBytes(32).toString("base64url");
  const csrfToken = crypto.randomBytes(24).toString("base64url");
  sessions.set(id, { csrfToken, expiresAt: Date.now() + sessionLifetime });
  setSessionCookie(response, id);
  return csrfToken;
}

function requireSession(request, response) {
  const session = getSession(request);
  if (!session) {
    json(response, 401, { error: "Connexion administrateur requise." });
    return null;
  }
  if (request.method !== "GET") {
    if (!sameOrigin(request)) {
      json(response, 403, { error: "Origine de requête refusée." });
      return null;
    }
    if (!safeEqual(request.headers["x-csrf-token"], session.csrfToken)) {
      json(response, 403, { error: "Jeton de sécurité invalide." });
      return null;
    }
  }
  return session;
}

function loadImages() {
  try {
    const images = JSON.parse(fs.readFileSync(imageManifest, "utf8"));
    return Array.isArray(images) ? images : [];
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

function detectImage(buffer) {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return { extension: ".png", mime: "image/png" };
  }
  if (buffer.length >= 3 && buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) {
    return { extension: ".jpg", mime: "image/jpeg" };
  }
  if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") {
    return { extension: ".webp", mime: "image/webp" };
  }
  return null;
}

function redirect(response, location) {
  respond(response, 302, "", { Location: location, "Cache-Control": "no-store" });
}

async function handle(request, response) {
  const url = new URL(request.url, "http://localhost");
  const pathname = url.pathname;
  const configured = Boolean(readConfig());

  if (request.method === "GET" && pathname === "/api/admin/status") {
    json(response, 200, { configured });
    return;
  }
  if (request.method === "GET" && pathname === "/admin-setup.html" && configured) {
    redirect(response, "/admin-login.html");
    return;
  }
  if (request.method === "GET" && pathname === "/admin-login.html" && getSession(request)) {
    redirect(response, "/index.html");
    return;
  }
  if (request.method === "POST" && pathname === "/api/admin/setup") {
    if (configured) {
      json(response, 409, { error: "Le compte administrateur a déjà été créé." });
      return;
    }
    if (!sameOrigin(request)) {
      json(response, 403, { error: "Configuration locale uniquement." });
      return;
    }
    const values = await readJson(request);
    const email = typeof values.email === "string" ? values.email.trim().toLowerCase() : "";
    const password = typeof values.password === "string" ? values.password : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || password.length < 12 || Buffer.byteLength(password, "utf8") > 256) {
      json(response, 400, { error: "Saisissez un e-mail valide et un mot de passe de 12 caractères minimum." });
      return;
    }
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = await scrypt(password, salt, 64);
    try {
      fs.writeFileSync(authFile, JSON.stringify({ email, salt, hash: hash.toString("hex") }), { flag: "wx", mode: 0o600 });
    } catch (error) {
      if (error.code === "EEXIST") {
        json(response, 409, { error: "Un compte administrateur existe déjà." });
        return;
      }
      throw error;
    }
    const csrfToken = createSession(response);
    json(response, 201, { csrfToken });
    return;
  }
  if (request.method === "POST" && pathname === "/api/admin/login") {
    if (!sameOrigin(request)) {
      json(response, 403, { error: "Origine de requête refusée." });
      return;
    }
    const ip = request.socket.remoteAddress || "local";
    const attempt = loginAttempts.get(ip) || { count: 0, lockedUntil: 0 };
    if (attempt.lockedUntil > Date.now()) {
      json(response, 429, { error: "Trop de tentatives. Réessayez dans quelques minutes." });
      return;
    }
    const values = await readJson(request);
    const config = readConfig();
    const email = typeof values.email === "string" ? values.email.trim().toLowerCase() : "";
    const password = typeof values.password === "string" ? values.password : "";
    const candidate = await scrypt(password.slice(0, 256), config ? config.salt : "fresneltravel-login", 64);
    const expectedHash = config ? config.hash : "0".repeat(128);
    const valid = Boolean(config) &&
      password.length <= 256 &&
      safeEqual(email, config.email) &&
      safeEqual(candidate.toString("hex"), expectedHash);
    if (!valid) {
      attempt.count += 1;
      if (attempt.count >= 5) {
        attempt.lockedUntil = Date.now() + 10 * 60 * 1000;
        attempt.count = 0;
      }
      loginAttempts.set(ip, attempt);
      json(response, 401, { error: "Adresse e-mail ou mot de passe incorrect." });
      return;
    }
    loginAttempts.delete(ip);
    const csrfToken = createSession(response);
    json(response, 200, { csrfToken });
    return;
  }
  if (request.method === "GET" && pathname === "/api/admin/session") {
    const session = getSession(request);
    if (!session) {
      json(response, 401, { error: "Connexion administrateur requise." });
      return;
    }
    json(response, 200, { csrfToken: session.csrfToken });
    return;
  }
  if (request.method === "POST" && pathname === "/api/admin/logout") {
    const session = requireSession(request, response);
    if (!session) return;
    sessions.delete(session.id);
    clearSessionCookie(response);
    json(response, 200, { ok: true });
    return;
  }
  if (pathname.startsWith("/api/admin/images")) {
    if (!requireSession(request, response)) return;
    if (request.method === "GET" && pathname === "/api/admin/images") {
      json(response, 200, { images: loadImages() });
      return;
    }
    if (request.method === "POST" && pathname === "/api/admin/images") {
      const category = url.searchParams.get("category") || "";
      const title = (url.searchParams.get("title") || "").trim().slice(0, 80);
      if (!allowedCategories.has(category)) {
        json(response, 400, { error: "Catégorie d’image invalide." });
        return;
      }
      const body = await readBody(request, maxImageBytes);
      const image = detectImage(body);
      if (!image || request.headers["content-type"] !== image.mime) {
        json(response, 415, { error: "Choisissez une vraie image JPG, PNG ou WebP." });
        return;
      }
      const id = crypto.randomUUID();
      const filename = `${id}${image.extension}`;
      fs.writeFileSync(path.join(uploadDirectory, filename), body, { flag: "wx" });
      const images = loadImages();
      const item = { id, filename, category, title: title || "FresnelTravel", createdAt: new Date().toISOString() };
      images.unshift(item);
      fs.writeFileSync(imageManifest, JSON.stringify(images, null, 2), { mode: 0o600 });
      json(response, 201, { image: item });
      return;
    }
    const imageId = pathname.match(/^\/api\/admin\/images\/([a-f0-9-]{36})$/)?.[1];
    if (request.method === "DELETE" && imageId) {
      const images = loadImages();
      const target = images.find((image) => image.id === imageId);
      if (!target) {
        json(response, 404, { error: "Image introuvable." });
        return;
      }
      fs.unlinkSync(path.join(uploadDirectory, path.basename(target.filename)));
      fs.writeFileSync(imageManifest, JSON.stringify(images.filter((image) => image.id !== imageId), null, 2), { mode: 0o600 });
      json(response, 200, { ok: true });
      return;
    }
    json(response, 404, { error: "Route introuvable." });
    return;
  }
  if (request.method === "GET" && pathname === "/api/public/images") {
    json(response, 200, { images: loadImages() });
    return;
  }
  if (request.method === "GET" && pathname.startsWith("/uploads/")) {
    const filename = path.basename(pathname);
    if (filename !== pathname.slice("/uploads/".length) || !/^[a-f0-9-]{36}\.(png|jpg|webp)$/.test(filename)) {
      respond(response, 404, "Not found");
      return;
    }
    const file = path.join(uploadDirectory, filename);
    fs.readFile(file, (error, content) => {
      if (error) {
        respond(response, 404, "Not found");
        return;
      }
      const extension = path.extname(filename);
      respond(response, 200, content, {
        "Content-Type": extension === ".jpg" ? "image/jpeg" : `image/${extension.slice(1)}`,
        "Cache-Control": "public, max-age=86400"
      });
    });
    return;
  }

  if (request.method === "GET" && (pathname === "/index.html" || pathname === "/app.js")) {
    if (!getSession(request)) {
      if (pathname.endsWith(".html")) redirect(response, "/admin-login.html");
      else respond(response, 401, "Unauthorized");
      return;
    }
  }
  if (request.method !== "GET" || pathname.includes("..") || !publicFiles.has(path.basename(pathname)) || pathname !== `/${path.basename(pathname)}`) {
    respond(response, 404, "Not found");
    return;
  }
  const filename = path.basename(pathname);
  fs.readFile(path.join(root, filename), (error, content) => {
    if (error) {
      respond(response, 404, "Not found");
      return;
    }
    respond(response, 200, content, {
      "Content-Type": contentTypes[path.extname(filename)],
      "Cache-Control": filename.endsWith(".html") ? "no-store" : "public, max-age=300"
    });
  });
}

http.createServer((request, response) => {
  handle(request, response).catch((error) => {
    console.error("Request failed:", error.message);
    if (response.headersSent || response.destroyed) return;
    json(response, error.status || 500, { error: error.status ? error.message : "Erreur interne du serveur." });
  });
}).listen(port, process.env.HOST || "0.0.0.0", () => {
  console.log(`FresnelTravel is ready at http://localhost:${port}/`);
});
