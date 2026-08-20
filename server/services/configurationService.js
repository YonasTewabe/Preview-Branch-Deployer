import { Op } from "sequelize";
import { Configuration } from "../models/index.js";

const DEFINITIONS = {
  jenkins_base_url: {
    category: "jenkins",
    isSecret: false,
    envFallback: "JENKINS_BASE_URL",
    required: true,
  },
  jenkins_user: {
    category: "jenkins",
    isSecret: false,
    envFallback: "JENKINS_USER",
    required: true,
  },
  jenkins_password: {
    category: "jenkins",
    isSecret: true,
    envFallback: "JENKINS_PASSWORD",
    required: true,
  },
  jenkins_job_preview: {
    category: "jenkins",
    isSecret: false,
    envFallback: "JENKINS_JOB_PREVIEW",
    required: true,
  },
  jenkins_job_delete_domain: {
    category: "jenkins",
    isSecret: false,
    envFallback: "JENKINS_JOB_DELETE_DOMAIN",
    required: true,
  },
  jenkins_trigger_token: {
    category: "jenkins",
    isSecret: true,
    envFallback: "JENKINS_TRIGGER_TOKEN",
    required: false,
    defaultValue: "domain",
  },
  github_api_base: {
    category: "github",
    isSecret: false,
    envFallback: "GITHUB_API_BASE",
    required: true,
    defaultValue: "https://api.github.com",
  },
  github_org: {
    category: "github",
    isSecret: false,
    envFallback: "GITHUB_ORG",
    required: true,
  },
  github_token: {
    category: "github",
    isSecret: true,
    envFallback: "GITHUB_TOKEN",
    required: true,
  },
  stale_preview_node_days: {
    category: "system",
    isSecret: false,
    envFallback: "STALE_PREVIEW_NODE_DAYS",
    required: true,
    defaultValue: "5",
  },
  trash_retention_days: {
    category: "system",
    isSecret: false,
    envFallback: "TRASH_RETENTION_DAYS",
    required: false,
    defaultValue: "",
  },
};

function normalizeValue(v) {
  if (v == null) return "";
  return String(v).trim();
}

function trimBase(url) {
  return String(url || "").replace(/\/+$/, "");
}

async function loadKeys(keys) {
  const rows = await Configuration.findAll({
    where: { key_name: { [Op.in]: keys } },
  });
  const map = {};
  for (const row of rows) {
    map[row.key_name] = row.value_text ?? "";
  }
  return map;
}

function valueWithFallback(key, dbMap) {
  const spec = DEFINITIONS[key];
  const dbValue = normalizeValue(dbMap[key]);
  if (dbValue) return dbValue;
  const fromEnv = normalizeValue(process.env[spec.envFallback]);
  if (fromEnv) return fromEnv;
  return normalizeValue(spec.defaultValue);
}

async function getSettingsByCategory(
  category,
  { includeSecrets = false } = {},
) {
  const keys = Object.keys(DEFINITIONS).filter(
    (k) => DEFINITIONS[k].category === category,
  );
  const dbMap = await loadKeys(keys);
  return keys.map((key) => {
    const def = DEFINITIONS[key];
    const dbValue = normalizeValue(dbMap[key]);
    const effectiveValue = valueWithFallback(key, dbMap);
    return {
      key,
      category: def.category,
      isSecret: def.isSecret,
      // Form inputs should show only stored values; fallbacks stay server-side.
      value:
        includeSecrets || !def.isSecret
          ? dbValue
          : dbValue
            ? "********"
            : "",
      hasValue: Boolean(dbValue),
      effectiveValue: includeSecrets || !def.isSecret ? effectiveValue : "",
      required: Boolean(def.required),
    };
  });
}

async function upsertSettings(inputPairs = []) {
  for (const pair of inputPairs) {
    const key = String(pair?.key || "").trim();
    if (!DEFINITIONS[key]) continue;
    const spec = DEFINITIONS[key];
    const value = pair?.value == null ? "" : String(pair.value);
    if (spec.isSecret && value.trim() === "") {
      // Keep existing secret when UI submits an empty masked field.
      continue;
    }
    await Configuration.upsert({
      key_name: key,
      value_text: value,
      category: spec.category,
      is_secret: spec.isSecret,
    });
  }
}

async function getJenkinsConfig() {
  const keys = Object.keys(DEFINITIONS).filter((k) => k.startsWith("jenkins_"));
  const dbMap = await loadKeys(keys);
  const baseUrl = trimBase(valueWithFallback("jenkins_base_url", dbMap));
  return {
    baseUrl,
    user: valueWithFallback("jenkins_user", dbMap),
    password: valueWithFallback("jenkins_password", dbMap),
    jobPreview: valueWithFallback("jenkins_job_preview", dbMap),
    jobDeleteDomain: valueWithFallback("jenkins_job_delete_domain", dbMap),
    triggerToken: valueWithFallback("jenkins_trigger_token", dbMap) || "domain",
  };
}

async function getGitHubConfig() {
  const keys = Object.keys(DEFINITIONS).filter((k) => k.startsWith("github_"));
  const dbMap = await loadKeys(keys);
  return {
    apiBase:
      trimBase(valueWithFallback("github_api_base", dbMap)) ||
      "https://api.github.com",
    org: valueWithFallback("github_org", dbMap),
    token: valueWithFallback("github_token", dbMap),
  };
}

async function getSystemConfig() {
  const keys = Object.keys(DEFINITIONS).filter(
    (k) => k.startsWith("stale_") || k.startsWith("trash_"),
  );
  const dbMap = await loadKeys(keys);
  const stalePreviewNodeDays = Math.max(
    1,
    Number.parseInt(valueWithFallback("stale_preview_node_days", dbMap), 10) || 5,
  );

  // trash_retention_days is optional — empty/0 means disabled.
  const rawTrash = valueWithFallback("trash_retention_days", dbMap);
  const trashRetentionDays = rawTrash
    ? Math.max(1, Number.parseInt(rawTrash, 10) || 0)
    : 0;

  return {
    stalePreviewNodeDays,
    trashRetentionDays, // 0 = feature disabled
  };
}

export default {
  getJenkinsConfig,
  getGitHubConfig,
  getSystemConfig,
  getSettingsByCategory,
  upsertSettings,
};
