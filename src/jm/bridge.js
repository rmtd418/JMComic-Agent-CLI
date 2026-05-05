import { createRequire } from "node:module";
import { createHash, createDecipheriv, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { bundlePath } from "../shared/paths.js";

const require = createRequire(import.meta.url);
const cacheStore = new Map();
let jmApi = null;

function installCompatGlobals() {
  globalThis.console = console;
  globalThis.fetch = globalThis.fetch;
  globalThis.Headers = globalThis.Headers;
  globalThis.Request = globalThis.Request;
  globalThis.Response = globalThis.Response;
  globalThis.AbortController = globalThis.AbortController;
  globalThis.AbortSignal = globalThis.AbortSignal;
  globalThis.URL = globalThis.URL;
  globalThis.URLSearchParams = globalThis.URLSearchParams;
  globalThis.Blob = globalThis.Blob;
  globalThis.File = globalThis.File;
  globalThis.FormData = globalThis.FormData;
  globalThis.TextEncoder = globalThis.TextEncoder;
  globalThis.TextDecoder = globalThis.TextDecoder;
  globalThis.Buffer = Buffer;
  globalThis.fs = fs;
  globalThis.path = path;
  globalThis.FSError = Error;
  globalThis.wasi = {};
  globalThis.pluginConfig = {};
  globalThis.plugin = {};
  globalThis.uuidv4 = () => randomUUID();
  globalThis.native = {
    async put() {
      return 0;
    },
  };
  globalThis.cache = {
    get(key, fallbackValue = "") {
      return cacheStore.has(key) ? cacheStore.get(key) : fallbackValue;
    },
    set(key, value) {
      cacheStore.set(key, value);
    },
    delete(key) {
      cacheStore.delete(key);
    },
  };
  globalThis.nodeCryptoCompat = require("node:crypto");
  globalThis.bridge = {
    call(name, ...args) {
      if (name === "crypto.md5_hex") {
        return createHash("md5").update(String(args[0] ?? ""), "utf8").digest("hex");
      }
      if (name === "crypto.aes_ecb_pkcs7_decrypt_b64") {
        const payload = Buffer.from(String(args[0] ?? ""), "base64");
        const key = Buffer.from(String(args[1] ?? ""), "utf8");
        const decipher = createDecipheriv("aes-256-ecb", key, null);
        decipher.setAutoPadding(true);
        return Buffer.concat([decipher.update(payload), decipher.final()]).toString("utf8");
      }
      throw new Error(`Unsupported bridge call: ${name}`);
    },
    async gzipDecompress(bytes) {
      const source = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
      return new Uint8Array(zlib.gunzipSync(source));
    },
  };
}

function loadApi() {
  if (jmApi) {
    return jmApi;
  }
  installCompatGlobals();
  const bundleModule = require(bundlePath());
  jmApi = bundleModule.default ?? bundleModule;
  return jmApi;
}

export async function jmRequest({ method = "GET", baseUrl, requestPath, params = {}, data = null, formData = null, cache = false, useJwt = false, jwtToken = "" }) {
  const api = loadApi();
  return api.jmRequest({
    method: String(method).toUpperCase(),
    path: `${baseUrl}${requestPath}`,
    params,
    data,
    formData,
    cache: Boolean(cache),
    useJwt: Boolean(useJwt),
    jwtToken,
  });
}
