// Rules for the service worker's offline mutation queue.
//
// Plain browser JS on purpose: sw.js loads it with importScripts() and
// src/lib/__tests__/sw-queue-rules.test.ts evaluates it with node:vm. It only
// assigns to `self` and touches no other global.

(function (scope) {
  var QUEUED_METHODS = ["POST", "PUT", "PATCH", "DELETE"];
  var REPLAY_HEADER = "x-offline-replay";
  // The optimistic-lock token the app sends travels in the JSON body as
  // `_expectedVersion` (see src/lib/concurrency.ts), and the body is stored
  // as is. The x-expected-version header is kept for API clients that send it
  // there instead.
  var KEPT_HEADERS = ["content-type", "accept", "x-expected-version"];

  // Routes whose bodies carry credentials or setup secrets. A request to one of
  // them is never kept, so a password cannot end up in IndexedDB. Matched per
  // path segment: "/api/setup" covers "/api/setup/x" but not "/api/setupx".
  var NEVER_QUEUE_PATHS = [
    "/api/user/addUser",
    "/api/setup",
    "/api/admin/settings",
    "/api/scim",
    "/api/team/invite",
  ];

  // Body fields that hold a credential. Compared without case, "_" and "-", so
  // api_key, apiKey and API-KEY are the same field.
  var SECRET_FIELDS = [
    "password",
    "newpassword",
    "currentpassword",
    "oldpassword",
    "confirmpassword",
    "bindpassword",
    "clientsecret",
    "secretkey",
    "secretaccesskey",
    "secret",
    "apikey",
    "token",
    "accesstoken",
    "refreshtoken",
    "invitetoken",
  ];
  var SECRET_FIELD_SUFFIXES = [
    "password",
    "passphrase",
    "secret",
    "token",
    "apikey",
  ];
  var MAX_BODY_DEPTH = 20;

  // Reads a header from a Headers instance or a plain object, ignoring case.
  function readHeader(headers, name) {
    if (!headers) return null;
    if (typeof headers.get === "function") return headers.get(name);
    var keys = Object.keys(headers);
    for (var i = 0; i < keys.length; i++) {
      if (keys[i].toLowerCase() === name) return String(headers[keys[i]]);
    }
    return null;
  }

  // Decodes %xx and folds repeated slashes so an encoded or doubled path cannot
  // slip past the prefix checks. Returns null for a path that cannot be decoded.
  function normalizePath(pathname) {
    try {
      return decodeURIComponent(pathname).replace(/\/{2,}/g, "/");
    } catch (error) {
      return null;
    }
  }

  function isApiPath(pathname) {
    return pathname.indexOf("/api/") === 0;
  }

  function isNeverQueuedPath(pathname) {
    for (var i = 0; i < NEVER_QUEUE_PATHS.length; i++) {
      var base = NEVER_QUEUE_PATHS[i];
      if (pathname === base || pathname.indexOf(base + "/") === 0) return true;
    }
    return false;
  }

  function isAuthPath(pathname) {
    return pathname === "/api/auth" || pathname.indexOf("/api/auth/") === 0;
  }

  /**
   * True only for a mutating request to an app API route that the service
   * worker may keep for later. Auth, user creation, setup, admin settings,
   * SCIM and invite endpoints carry credentials, multipart bodies cannot be
   * stored as text, and a request marked as a replay must go straight to the
   * network so it is never queued a second time. The body is checked
   * separately by bodyHasSecrets once it has been read.
   */
  scope.shouldQueue = function shouldQueue(method, rawPathname, headers) {
    if (QUEUED_METHODS.indexOf(String(method).toUpperCase()) === -1) {
      return false;
    }
    var pathname = normalizePath(String(rawPathname));
    if (pathname === null) return false;
    if (!isApiPath(pathname) || isAuthPath(pathname)) return false;
    if (isNeverQueuedPath(pathname)) return false;
    if (readHeader(headers, REPLAY_HEADER) !== null) return false;
    var contentType = readHeader(headers, "content-type") || "";
    return contentType.toLowerCase().indexOf("multipart/") === -1;
  };

  function isSecretField(name) {
    var key = String(name)
      .toLowerCase()
      .replace(/[_\-\s]/g, "");
    if (SECRET_FIELDS.indexOf(key) !== -1) return true;
    for (var i = 0; i < SECRET_FIELD_SUFFIXES.length; i++) {
      var suffix = SECRET_FIELD_SUFFIXES[i];
      if (key.length > suffix.length && key.slice(-suffix.length) === suffix) {
        return true;
      }
    }
    return false;
  }

  function hasSecretField(value, depth) {
    // Too deep to inspect, so refuse rather than assume it is clean.
    if (depth > MAX_BODY_DEPTH) return true;
    if (value === null || typeof value !== "object") return false;
    var names = Object.keys(value);
    for (var i = 0; i < names.length; i++) {
      if (!Array.isArray(value) && isSecretField(names[i])) return true;
      if (hasSecretField(value[names[i]], depth + 1)) return true;
    }
    return false;
  }

  function hasSecretFormField(bodyText) {
    var pairs = bodyText.split("&");
    for (var i = 0; i < pairs.length; i++) {
      var name = pairs[i].split("=")[0].replace(/\+/g, " ");
      try {
        name = decodeURIComponent(name);
      } catch (error) {
        return true;
      }
      if (isSecretField(name)) return true;
    }
    return false;
  }

  /**
   * True when a request body may hold a credential and must not be stored.
   * JSON is parsed whatever the declared content type (a bare fetch() of a
   * JSON string is sent as text/plain) and any field named like a password,
   * secret, token or API key at any depth counts. JSON that cannot be parsed
   * cannot be inspected, so it counts too. Form-encoded bodies are checked by
   * field name. Anything else (plain text, no body) is not a secret carrier.
   */
  scope.bodyHasSecrets = function bodyHasSecrets(contentType, bodyText) {
    if (!bodyText) return false;
    var type = String(contentType || "").toLowerCase();
    try {
      return hasSecretField(JSON.parse(bodyText), 0);
    } catch (error) {
      if (type.indexOf("json") !== -1) return true;
    }
    return type.indexOf("application/x-www-form-urlencoded") !== -1
      ? hasSecretFormField(bodyText)
      : false;
  };

  /**
   * Keeps only the headers a replay needs. Cookies and authorization are never
   * stored: the browser attaches the current session when the request is sent.
   */
  scope.pickHeaders = function pickHeaders(headers) {
    var picked = {};
    for (var i = 0; i < KEPT_HEADERS.length; i++) {
      var value = readHeader(headers, KEPT_HEADERS[i]);
      if (value !== null) picked[KEPT_HEADERS[i]] = value;
    }
    return picked;
  };
})(self);
