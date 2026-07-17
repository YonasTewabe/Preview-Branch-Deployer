import express from "express";
import axios from "axios";
import { Op } from "sequelize";
import { sequelize } from "../config/database.js";
import { Node, NodeBuild } from "../models/index.js";
import { deletePreviewDomainViaJenkins } from "../services/jenkinsDeletePreviewDomain.js";
import { refreshStatsAfterMutation } from "../services/statsService.js";
import configurationService from "../services/configurationService.js";
import { jenkinsAuth, jenkinsPostHeaders } from "../services/jenkinsClient.js";

/** Must match Jenkins job `parameters { string… }` — only these are sent to buildWithParameters. */
const JENKINS_PREVIEW_JOB_PARAM_NAMES = [
  "TAG",
  "REPO_URL",
  "BRANCH_NAME",
  "PORT",
  "DOMAIN_NAME",
  "ENV_JSON",
];

function buildPreviewJobJenkinsForm({
  tag,
  repoUrl,
  branchName,
  port,
  domainName,
  envJsonArray,
}) {
  const form = new URLSearchParams();
  const jsonStr = JSON.stringify(envJsonArray ?? []);
  const values = {
    TAG: String(tag),
    REPO_URL: String(repoUrl),
    BRANCH_NAME: String(branchName),
    PORT: String(port),
    DOMAIN_NAME: String(domainName),
    ENV_JSON: jsonStr,
  };
  for (const name of JENKINS_PREVIEW_JOB_PARAM_NAMES) {
    form.set(name, values[name]);
  }
  return form;
}

const router = express.Router();
router.use(refreshStatsAfterMutation);

function trimBase(url) {
  return String(url || "").replace(/\/+$/, "");
}

function jenkinsApiJsonUrl(baseUrl) {
  return `${trimBase(baseUrl)}/api/json`;
}

function jenkinsBuildWithParamsUrl(baseUrl, jobName) {
  return `${trimBase(baseUrl)}/job/${jobName}/buildWithParameters`;
}

function jenkinsQueueItemUrl(baseUrl, queueId) {
  return `${trimBase(baseUrl)}/queue/item/${queueId}/api/json`;
}

function jenkinsBuildApiUrl(baseUrl, jobName, buildNumber) {
  return `${trimBase(baseUrl)}/job/${jobName}/${buildNumber}/api/json`;
}

function jenkinsArtifactUrl(baseUrl, jobName, buildNumber, relativePath) {
  return `${trimBase(baseUrl)}/job/${jobName}/${buildNumber}/artifact/${relativePath}`;
}

function normalizeFrontendBuildStatus(jenkinsOrInternal) {
  if (jenkinsOrInternal === "SUCCESS") return "success";
  // Jenkins sometimes leaves result null on failed/aborted runs; never treat as success.
  if (jenkinsOrInternal == null || jenkinsOrInternal === "") return "failed";
  const r = String(jenkinsOrInternal).toUpperCase();
  if (r === "FAILURE") return "failed";
  if (r === "ABORTED") return "cancelled";
  if (r === "UNSTABLE") return "unstable";
  if (r === "ERROR") return "failed";
  return "failed";
}

/** Timestamp when a preview deploy/rebuild was initiated (Jenkins trigger accepted). */
async function setPreviewNodeLastBuildAtNow(nodeId) {
  const fid = String(nodeId ?? "").trim();
  if (!fid) return;
  try {
    await Node.update({ last_build_at: new Date() }, { where: { id: fid } });
  } catch (upErr) {
    console.warn(
      "⚠️ Failed to update nodes.last_build_at (trigger time):",
      upErr?.message || upErr,
    );
  }
}

async function persistPreviewNodeDeploymentResult(nodeId, data = {}) {
  const fid = String(nodeId ?? "").trim();
  if (!fid) return;
  try {
    await Node.update(data, { where: { id: fid } });
  } catch (upErr) {
    console.warn(
      "⚠️ Failed to persist preview node deployment result:",
      upErr?.message || upErr,
    );
  }
}

/**
 * Persist a row in node_builds (success or failure).
 * build_number = per-node sequence; jenkins_build_number = Jenkins job run #.
 * Does not change nodes.last_build_at — that is set when the job is triggered.
 * @returns {{ localBuildNumber: number|null, jenkinsBuildNumber: number|null }}
 */
async function recordPreviewNodeBuild(
  nodeId,
  jenkinsBuildNumber,
  builtAt,
  rawStatus,
) {
  const fid =
    String(nodeId ?? "").trim();
  const at =
    builtAt instanceof Date && !Number.isNaN(builtAt.getTime())
      ? builtAt
      : new Date();

  const jenk = parseInt(jenkinsBuildNumber, 10);
  if (!fid || !Number.isFinite(jenk)) {
    if (!fid) {
      console.warn(
        "⚠️ Build history skipped: could not resolve preview node for this deploy",
      );
    }
    return { localBuildNumber: null, jenkinsBuildNumber: Number.isFinite(jenk) ? jenk : null };
  }
  const statusValue = normalizeFrontendBuildStatus(rawStatus);

  let localBn = null;
  try {
    await sequelize.transaction(async (transaction) => {
      await sequelize.query(`SELECT id FROM nodes WHERE id = ? FOR UPDATE`, {
        replacements: [fid],
        transaction,
      });
      const [[agg]] = await sequelize.query(
        `SELECT COALESCE(MAX(build_number), 0) + 1 AS next_local FROM node_builds WHERE node_id = ?`,
        { replacements: [fid], transaction },
      );
      localBn = parseInt(agg?.next_local, 10);
      if (!Number.isFinite(localBn)) localBn = 1;

      await NodeBuild.create(
        {
          node_id: fid,
          build_number: localBn,
          jenkins_build_number: jenk,
          built_at: at,
          status: statusValue,
        },
        { transaction },
      );
    });
  } catch (bhErr) {
    const msg = String(
      bhErr?.parent?.sqlMessage ||
        bhErr?.original?.sqlMessage ||
        bhErr?.message ||
        "",
    );
    const unknownStatusCol =
      /unknown column ['`]?status['`]?/i.test(msg) ||
      (msg.includes("Unknown column") && msg.includes("status"));
    const unknownJenkinsCol =
      /unknown column ['`]?jenkins_build_number['`]?/i.test(msg) ||
      (msg.includes("Unknown column") && msg.includes("jenkins_build_number"));
    if (unknownStatusCol) {
      try {
        await sequelize.transaction(async (transaction) => {
          await sequelize.query(`SELECT id FROM nodes WHERE id = ? FOR UPDATE`, {
            replacements: [fid],
            transaction,
          });
          const [[agg]] = await sequelize.query(
            `SELECT COALESCE(MAX(build_number), 0) + 1 AS next_local FROM node_builds WHERE node_id = ?`,
            { replacements: [fid], transaction },
          );
          localBn = parseInt(agg?.next_local, 10);
          if (!Number.isFinite(localBn)) localBn = 1;
          const fields = unknownJenkinsCol
            ? ["node_id", "build_number", "built_at"]
            : ["node_id", "build_number", "jenkins_build_number", "built_at"];
          const row = unknownJenkinsCol
            ? {
                node_id: fid,
                build_number: localBn,
                built_at: at,
              }
            : {
                node_id: fid,
                build_number: localBn,
                jenkins_build_number: jenk,
                built_at: at,
              };
          await NodeBuild.create(row, { fields, transaction });
        });
      } catch (bhErr2) {
        console.error("⚠️ Failed to record build history (no status column):", bhErr2);
      }
    } else if (unknownJenkinsCol) {
      try {
        await sequelize.transaction(async (transaction) => {
          await sequelize.query(`SELECT id FROM nodes WHERE id = ? FOR UPDATE`, {
            replacements: [fid],
            transaction,
          });
          const [[agg]] = await sequelize.query(
            `SELECT COALESCE(MAX(build_number), 0) + 1 AS next_local FROM node_builds WHERE node_id = ?`,
            { replacements: [fid], transaction },
          );
          localBn = parseInt(agg?.next_local, 10);
          if (!Number.isFinite(localBn)) localBn = 1;
          await NodeBuild.create(
            {
              node_id: fid,
              build_number: localBn,
              built_at: at,
              status: statusValue,
            },
            { transaction },
          );
        });
      } catch (bhErr3) {
        console.error(
          "⚠️ Failed to record build history (no jenkins_build_number column):",
          bhErr3,
        );
      }
    } else {
      console.error("⚠️ Failed to record build history:", bhErr);
    }
  }

  return {
    localBuildNumber: localBn,
    jenkinsBuildNumber: jenk,
  };
}

/**
 * Build [{ key, value }, …] for env.json from ENV_JSON in the request body.
 */
function buildEnvJsonArrayFromBody(body) {
  if (Array.isArray(body?.ENV_JSON)) {
    return body.ENV_JSON.map((e) => ({
      key: String(e?.key ?? e?.name ?? "").trim(),
      value: String(e?.value ?? ""),
    })).filter((e) => e.key);
  }
  if (typeof body?.ENV_JSON === "string" && body.ENV_JSON.trim() !== "") {
    try {
      const parsed = JSON.parse(body.ENV_JSON);
      if (Array.isArray(parsed)) {
        return parsed
          .map((e) => ({
            key: String(e?.key ?? e?.name ?? "").trim(),
            value: String(e?.value ?? ""),
          }))
          .filter((e) => e.key);
      }
    } catch {
      /* ignore */
    }
  }
  return [];
}

function normalizeBuildTag(raw) {
  const t = String(raw ?? "").toLowerCase().trim();
  if (t === "frontend" || t === "backend") return t;
  return "";
}

/** Jenkins Location header may be relative to Jenkins base URL. */
function resolveJenkinsLocation(location, baseUrl) {
  if (location == null) return null;
  const s = Array.isArray(location) ? location[0] : String(location);
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  const base = trimBase(baseUrl);
  return `${base}${s.startsWith("/") ? s : `/${s}`}`;
}

const PREVIEW_DEPLOY_ROLES = { [Op.in]: ["frontend", "api_service"] };

async function findPreviewNodeForDeploy(domainName, repoUrl, branchName) {
  const base = { is_deleted: false, role: PREVIEW_DEPLOY_ROLES };
  if (domainName && repoUrl && branchName) {
    const n = await Node.findOne({
      where: {
        ...base,
        domain_name: domainName,
        repo_url: repoUrl,
        branch_name: branchName,
      },
    });
    if (n) return n;
  }
  if (domainName) {
    const n = await Node.findOne({
      where: { ...base, domain_name: domainName },
    });
    if (n) return n;
  }
  if (repoUrl && branchName) {
    const n = await Node.findOne({
      where: { ...base, repo_url: repoUrl, branch_name: branchName },
    });
    if (n) return n;
  }
  return null;
}

function readPortFromPreviewNode(previewNode) {
  if (!previewNode || previewNode.port == null) return NaN;
  return Number(previewNode.port);
}

// Test route to verify Jenkins routes are working
router.get("/test", (req, res) => {
  res.json({
    success: true,
    message: "Jenkins routes are working",
    timestamp: new Date().toISOString(),
  });
});

// Test Jenkins connectivity
router.get("/test-connection", async (req, res) => {
  try {
    const config = await configurationService.getJenkinsConfig();
    const response = await axios.get(jenkinsApiJsonUrl(config.baseUrl), {
      auth: {
        username: config.user,
        password: config.password,
      },
      timeout: 10000,
    });

    res.json({
      success: true,
      message: "Jenkins server is reachable",
      status: response.status,
      data: response.data,
    });
  } catch (error) {
    console.error("Jenkins connectivity test failed:", error);
    res.status(500).json({
      success: false,
      message: "Jenkins server is not reachable",
      error: error.message,
      code: error.code,
    });
  }
});

/**
 * Single Jenkins parameterized job:
 * TAG, REPO_URL, BRANCH_NAME, PORT, DOMAIN_NAME, ENV_JSON
 */
async function handleUnifiedPreviewBuild(req, res) {
  try {
    const config = await configurationService.getJenkinsConfig();
    let TAG = normalizeBuildTag(req.body.TAG);
    if (!TAG) TAG = "backend";

    const REPO_URL = req.body.REPO_URL;
    const BRANCH_NAME = req.body.BRANCH_NAME;
    let PORT =
      req.body.PORT !== undefined && req.body.PORT !== null && req.body.PORT !== ""
        ? Number(req.body.PORT)
        : NaN;
    const DOMAIN_NAME = req.body.DOMAIN_NAME;
    const envJsonArray = buildEnvJsonArrayFromBody(req.body);

    if (!REPO_URL || !BRANCH_NAME || !DOMAIN_NAME) {
      return res.status(400).json({
        success: false,
        message:
          "Missing required parameters: REPO_URL, BRANCH_NAME, DOMAIN_NAME",
      });
    }

    const previewNode = await findPreviewNodeForDeploy(
      DOMAIN_NAME,
      REPO_URL,
      BRANCH_NAME,
    );
    const previewNodeId = previewNode?.id ?? null;

    if (previewNode) {
      PORT = readPortFromPreviewNode(previewNode);
      if (!Number.isFinite(PORT) || PORT <= 0) {
        return res.status(400).json({
          success: false,
          message:
            "This preview node has no port stored in the database. Set the node port before deploying or rebuilding.",
        });
      }
    }

    if (!Number.isFinite(PORT) || PORT <= 0) {
      return res.status(400).json({
        success: false,
        message:
          "Missing or invalid PORT. No matching preview node was found to take a port from; send a valid PORT in the request body.",
      });
    }

    const jenkinsUrl = jenkinsBuildWithParamsUrl(
      config.baseUrl,
      config.jobPreview,
    );
    const triggerUrl = `${jenkinsUrl}?token=${encodeURIComponent(config.triggerToken)}`;

    const jenkinsForm = buildPreviewJobJenkinsForm({
      tag: TAG,
      repoUrl: REPO_URL,
      branchName: BRANCH_NAME,
      port: PORT,
      domainName: DOMAIN_NAME,
      envJsonArray,
    });

    const triggerResp = await axios.post(triggerUrl, jenkinsForm.toString(), {
      auth: jenkinsAuth(config),
      headers: await jenkinsPostHeaders(config, {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      }),
      timeout: 120_000,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      validateStatus: () => true,
    });

    if (triggerResp.status === 201 || triggerResp.status === 200) {
      const loc = triggerResp.headers?.location;
      const queueUrl = resolveJenkinsLocation(loc, config.baseUrl);
      if (!queueUrl || typeof queueUrl !== "string") {
        return res.status(502).json({
          success: false,
          message:
            "Jenkins did not return a queue Location header after triggering the job. Check Jenkins URL and credentials.",
        });
      }

      await setPreviewNodeLastBuildAtNow(previewNodeId);

      const queueId = queueUrl.split("/").slice(-2, -1)[0];
      let buildNumber = null;

      while (!buildNumber) {
        const queueResponse = await axios.get(
          jenkinsQueueItemUrl(config.baseUrl, queueId),
          {
          auth: {
            username: config.user,
            password: config.password,
          },
          },
        );

        const queueData = queueResponse.data;
        if (queueData.executable) {
          buildNumber = queueData.executable.number;
        } else {
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }
      }

      let buildComplete = false;
      let artifactFilePath;
      let completedBuildMeta = null;

      while (!buildComplete) {
        const buildResponse = await axios.get(
          jenkinsBuildApiUrl(config.baseUrl, config.jobPreview, buildNumber),
          {
            auth: {
              username: config.user,
              password: config.password,
            },
          },
        );

        const buildData = buildResponse.data;

        if (!buildData.building) {
          buildComplete = true;
          if (buildData.result !== "SUCCESS") {
            const builtAtFail = buildData.timestamp
              ? new Date(buildData.timestamp)
              : new Date();
            const recorded = await recordPreviewNodeBuild(
              previewNodeId,
              buildNumber,
              builtAtFail,
              buildData.result,
            );
            await persistPreviewNodeDeploymentResult(previewNodeId, {
              build_status: normalizeFrontendBuildStatus(buildData.result),
              build_number:
                recorded.localBuildNumber ?? recorded.jenkinsBuildNumber,
              jenkins_job_url: jenkinsUrl,
              last_build_at: builtAtFail,
            });
            return res.status(400).json({
              success: false,
              message: `Build failed with result: ${buildData.result}`,
              buildNumber:
                recorded.localBuildNumber ?? recorded.jenkinsBuildNumber,
              jenkinsBuildNumber: buildNumber,
              result: buildData.result,
            });
          }

          if (buildData.artifacts && buildData.artifacts.length > 0) {
            artifactFilePath = buildData.artifacts[0].relativePath;
            completedBuildMeta = buildData;
          } else {
            const builtAtNoArt = buildData.timestamp
              ? new Date(buildData.timestamp)
              : new Date();
            const recorded = await recordPreviewNodeBuild(
              previewNodeId,
              buildNumber,
              builtAtNoArt,
              "FAILURE",
            );
            await persistPreviewNodeDeploymentResult(previewNodeId, {
              build_status: "failed",
              build_number:
                recorded.localBuildNumber ?? recorded.jenkinsBuildNumber,
              jenkins_job_url: jenkinsUrl,
              last_build_at: builtAtNoArt,
            });
            return res.status(400).json({
              success: false,
              message: "Artifact file path not found.",
              buildNumber:
                recorded.localBuildNumber ?? recorded.jenkinsBuildNumber,
              jenkinsBuildNumber: buildNumber,
            });
          }
        } else {
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }
      }

      const domainOutput = await axios.get(
        jenkinsArtifactUrl(
          config.baseUrl,
          config.jobPreview,
          buildNumber,
          artifactFilePath,
        ),
        {
          auth: {
            username: config.user,
            password: config.password,
          },
        },
      );

      if (domainOutput.data.error) {
        const builtAtDomainErr = completedBuildMeta?.timestamp
          ? new Date(completedBuildMeta.timestamp)
          : new Date();
        const recordedDom = await recordPreviewNodeBuild(
          previewNodeId,
          buildNumber,
          builtAtDomainErr,
          "FAILURE",
        );
        await persistPreviewNodeDeploymentResult(previewNodeId, {
          build_status: "failed",
          build_number:
            recordedDom.localBuildNumber ?? recordedDom.jenkinsBuildNumber,
          jenkins_job_url: jenkinsUrl,
          last_build_at: builtAtDomainErr,
        });
        return res.status(400).json({
          success: false,
          message: domainOutput.data.error,
          buildNumber:
            recordedDom.localBuildNumber ?? recordedDom.jenkinsBuildNumber,
          jenkinsBuildNumber: buildNumber,
          artifactPath: artifactFilePath,
        });
      }

      let recordedOk = {
        localBuildNumber: null,
        jenkinsBuildNumber: buildNumber,
      };
      if (completedBuildMeta) {
        const builtAtOk = completedBuildMeta.timestamp
          ? new Date(completedBuildMeta.timestamp)
          : new Date();
        recordedOk = await recordPreviewNodeBuild(
          previewNodeId,
          buildNumber,
          builtAtOk,
          "SUCCESS",
        );
        await persistPreviewNodeDeploymentResult(previewNodeId, {
          build_status: "success",
          build_number:
            recordedOk.localBuildNumber ?? recordedOk.jenkinsBuildNumber,
          preview_link: domainOutput.data?.url ?? null,
          jenkins_job_url: jenkinsUrl,
          last_build_at: builtAtOk,
        });
      }

      res.json({
        success: true,
        message: "Preview build completed successfully",
        jobUrl: jenkinsUrl,
        buildNumber:
          recordedOk.localBuildNumber ??
          recordedOk.jenkinsBuildNumber ??
          buildNumber,
        jenkinsBuildNumber: buildNumber,
        result: "SUCCESS",
        artifactData: domainOutput.data,
        artifactPath: artifactFilePath,
      });
    } else {
      const snippet =
        typeof triggerResp.data === "string"
          ? triggerResp.data.slice(0, 500)
          : "";
      console.error(
        "Jenkins preview job trigger failed:",
        triggerResp.status,
        triggerResp.statusText,
        snippet,
      );
      res
        .status(triggerResp.status >= 400 ? triggerResp.status : 502)
        .json({
          success: false,
          message: `Failed to trigger Jenkins preview job: HTTP ${triggerResp.status} ${triggerResp.statusText || ""}`,
          status: triggerResp.status,
        });
    }
  } catch (error) {
    console.error("Error triggering Jenkins preview job:", error);
    if (error.response) {
      res.status(error.response.status).json({
        success: false,
        message: `Jenkins preview job failed: ${error.response.status} - ${error.response.statusText}`,
        status: error.response.status,
      });
    } else {
      res.status(500).json({
        success: false,
        message: "Internal server error while triggering Jenkins preview job",
        error: error.message,
      });
    }
  }
}

router.post("/trigger-preview-job", handleUnifiedPreviewBuild);

router.post("/delete-preview-job", async (req, res) => {
  try {
    const DOMAIN_NAME = req.body.DOMAIN_NAME;

    if (!DOMAIN_NAME) {
      return res.status(400).json({
        success: false,
        message: "Missing required parameters: DOMAIN_NAME",
      });
    }

    const result = await deletePreviewDomainViaJenkins(DOMAIN_NAME);
    if (result.success) {
      return res.json({
        success: true,
        message: result.message,
        jobUrl: result.jobUrl,
        buildNumber: result.buildNumber,
        result: result.result,
        artifactData: result.artifactData,
        artifactPath: result.artifactPath,
      });
    }
    const status = result.status && result.status >= 400 ? result.status : 400;
    return res.status(status).json({
      success: false,
      message: result.message,
      buildNumber: result.buildNumber,
      result: result.result,
      artifactPath: result.artifactPath,
      status: result.status,
    });
  } catch (error) {
    console.error("Error triggering Jenkins delete job:", error);
    if (error.response) {
      res.status(error.response.status).json({
        success: false,
        message: `Jenkins delete job failed: ${error.response.status} - ${error.response.statusText}`,
        status: error.response.status,
      });
    } else {
      res.status(500).json({
        success: false,
        message: "Internal server error while triggering Jenkins delete job",
        error: error.message,
      });
    }
  }
});

/** Legacy path — same handler and job as `/trigger-preview-job`. */
router.post("/trigger-frontend-job", handleUnifiedPreviewBuild);

export default router;
