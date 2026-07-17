import axios from "axios";

function trimBase(url) {
  return String(url || "").replace(/\/+$/, "");
}

/** Basic auth object for axios Jenkins requests. */
export function jenkinsAuth(config) {
  return {
    username: config.user,
    password: config.password,
  };
}

/** Build a `Cookie` header value from axios `set-cookie` response headers. */
function cookieHeaderFromSetCookie(setCookie) {
  if (!setCookie) return undefined;
  const list = Array.isArray(setCookie) ? setCookie : [setCookie];
  const pairs = list
    .map((entry) => String(entry).split(";")[0].trim())
    .filter(Boolean);
  return pairs.length > 0 ? pairs.join("; ") : undefined;
}

/**
 * Fetch Jenkins CSRF crumb and session cookies from the same request.
 * Jenkins validates crumbs against the session that issued them.
 * @returns {Promise<{ crumbRequestField: string, crumb: string, cookie?: string } | null>}
 */
export async function fetchJenkinsCrumbContext(config) {
  if (!config?.baseUrl || !config?.user) return null;

  const url = `${trimBase(config.baseUrl)}/crumbIssuer/api/json`;
  try {
    const response = await axios.get(url, {
      auth: jenkinsAuth(config),
      timeout: 10_000,
      validateStatus: (status) => status === 200 || status === 404,
    });

    if (response.status === 404) return null;

    const { crumbRequestField, crumb } = response.data || {};
    if (!crumbRequestField || !crumb) return null;

    const cookie = cookieHeaderFromSetCookie(response.headers["set-cookie"]);
    if (!cookie) {
      console.warn(
        "Jenkins crumb fetched but no session cookie was returned; POST may fail with 403.",
      );
    }

    return { crumbRequestField, crumb, cookie };
  } catch (error) {
    console.warn(
      "Failed to fetch Jenkins CSRF crumb:",
      error?.message || error,
    );
    return null;
  }
}

/** @deprecated Use fetchJenkinsCrumbContext — kept for callers that only need the crumb fields. */
export async function fetchJenkinsCrumb(config) {
  const ctx = await fetchJenkinsCrumbContext(config);
  if (!ctx) return null;
  return {
    crumbRequestField: ctx.crumbRequestField,
    crumb: ctx.crumb,
  };
}

/**
 * Headers for mutating Jenkins API calls (POST): CSRF crumb + session cookie when available.
 */
export async function jenkinsPostHeaders(config, extraHeaders = {}) {
  const headers = { ...extraHeaders };
  const ctx = await fetchJenkinsCrumbContext(config);
  if (ctx) {
    headers[ctx.crumbRequestField] = ctx.crumb;
    if (ctx.cookie) {
      headers.Cookie = ctx.cookie;
    }
  }
  return headers;
}
