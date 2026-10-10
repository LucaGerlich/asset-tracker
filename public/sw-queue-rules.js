// Rules for the service worker's offline mutation queue.
//
// Plain browser JS on purpose: sw.js loads it with importScripts() and
// src/lib/__tests__/sw-queue-rules.test.ts evaluates it with node:vm. It only
// assigns to `self` and touches no other global.

(function (scope) {
  var QUEUED_METHODS = ["POST", "PUT", "PATCH", "DELETE"];
  var REPLAY_HEADER = "x-offline-replay";
  var KEPT_HEADERS = ["content-type", "accept", "x-expected-version"];

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

  function isApiPath(pathname) {
    return pathname.indexOf("/api/") === 0;
  }

  function isAuthPath(pathname) {
    return pathname === "/api/auth" || pathname.indexOf("/api/auth/") === 0;
  }

  /**
   * True only for a mutating request to an app API route that the service
   * worker may keep for later. Auth endpoints carry credentials, multipart
   * bodies cannot be stored as text, and a request marked as a replay must go
   * straight to the network so it is never queued a second time.
   */
  scope.shouldQueue = function shouldQueue(method, pathname, headers) {
    if (QUEUED_METHODS.indexOf(String(method).toUpperCase()) === -1) {
      return false;
    }
    if (!isApiPath(pathname) || isAuthPath(pathname)) return false;
    if (readHeader(headers, REPLAY_HEADER) !== null) return false;
    var contentType = readHeader(headers, "content-type") || "";
    return contentType.toLowerCase().indexOf("multipart/") === -1;
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
