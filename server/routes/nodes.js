import express from "express";
import { Op } from "sequelize";
import {
  Node,
  NodeBuild,
  NodeEnvVar,
  Project,
  ProjectEnvProfile,
  User,
  Environment,
} from "../models/index.js";
import { refreshStatsAfterMutation } from "../services/statsService.js";
import { checkNodeServiceNameUniqueInProject } from "../utils/checkNodeServiceNameUniqueInProject.js";
import { allocateNodePort } from "../utils/allocateNodePort.js";
import { deriveNodeDomainSlug } from "../utils/deriveNodeDomainSlug.js";
import {
  getDefaultEnvProfile,
  resolveProfileIdForNode,
  resolveProfileIdForProject,
} from "../utils/resolveProjectEnvProfile.js";

const router = express.Router();
router.use(refreshStatsAfterMutation);

const NODE_ROLES = new Set(["frontend", "api_service", "api_branch"]);

function includeProjectAndCreator() {
  return [
    {
      model: Project,
      as: "project",
      attributes: ["id", "name", "tag", "short_code"],
    },
    {
      model: User,
      as: "creator",
      attributes: ["id", "email"],
    },
  ];
}

const branchInclude = {
  model: Node,
  as: "branches",
  where: { role: "api_branch", is_deleted: false },
  required: false,
  attributes: [
    "id",
    "service_name",
    "description",
    "status",
    "domain_name",
    "port",
    "build_result",
    "build_number",
    "preview_link",
    "jenkins_job_url",
    "parent_node_id",
    "created_at",
    "updated_at",
    "branch_name",
  ],
};

function mapBranchCompat(row) {
  const p = row.get ? row.get({ plain: true }) : { ...row };
  if (Array.isArray(p.branches)) {
    p.branches = p.branches.map((b) => ({
      ...b,
      name: b.service_name,
      node_id: b.parent_node_id,
    }));
  }
  if (p.role === "api_branch") {
    p.name = p.service_name;
    p.node_id = p.parent_node_id;
  }
  return p;
}

async function createNodeWithAllocatedPort(payload) {
  const project = await Project.findByPk(payload.project_id);
  if (!project) {
    const err = new Error("Project not found");
    err.statusCode = 404;
    throw err;
  }
  const defaultProf = await getDefaultEnvProfile(project.id);
  if (!defaultProf) {
    const err = new Error("Project has no environment profiles.");
    err.statusCode = 400;
    throw err;
  }
  const envCount = await Environment.count({
    where: { project_id: project.id, profile_id: defaultProf.id },
  });
  if (envCount === 0) {
    const err = new Error(
      "Default environment profile has no variables. Add at least one variable before adding nodes.",
    );
    err.statusCode = 400;
    throw err;
  }

  const role = String(payload.role ?? "").trim().toLowerCase();
  if (!NODE_ROLES.has(role)) {
    const err = new Error("role must be frontend, api_service, or api_branch");
    err.statusCode = 400;
    throw err;
  }

  const bodyProfileId =
    payload.project_env_profile_id ?? payload.projectEnvProfileId ?? null;
  const resolvedProfileId = await resolveProfileIdForProject(
    project.id,
    bodyProfileId,
  );

  const baseData = {
    ...payload,
    role,
    project_env_profile_id: resolvedProfileId ?? defaultProf.id,
    is_deleted: false,
    status: payload.status ?? "active",
    environment: payload.environment ?? "preview",
  };

  if (role === "api_branch") {
    if (!payload.parent_node_id) {
      const err = new Error("parent_node_id is required for api_branch");
      err.statusCode = 400;
      throw err;
    }
    const parent = await Node.findOne({
      where: {
        id: payload.parent_node_id,
        project_id: project.id,
        role: "api_service",
        is_deleted: false,
      },
      attributes: ["id", "port"],
    });
    if (!parent) {
      const err = new Error("Parent api_service not found");
      err.statusCode = 400;
      throw err;
    }
    return Node.create({
      ...baseData,
      port: payload.port ?? parent.port,
    });
  }

  for (let attempt = 0; attempt < 12; attempt++) {
    const assignedPort = await allocateNodePort();
    const domain_name =
      payload.domain_name ||
      deriveNodeDomainSlug({
        shortCode: project.short_code,
        branchName: payload.branch_name,
        port: assignedPort,
        projectTag: project.tag,
      });
    try {
      return await Node.create({
        ...baseData,
        port: assignedPort,
        domain_name,
      });
    } catch (err) {
      if (
        err?.name === "SequelizeUniqueConstraintError" &&
        attempt < 11
      ) {
        continue;
      }
      throw err;
    }
  }
  throw new Error("Could not create node with a unique port");
}

router.get("/", async (req, res) => {
  try {
    const where = { is_deleted: false };
    const role = String(req.query.role ?? "").trim();
    if (role) where.role = role;
    if (req.query.projectId) where.project_id = req.query.projectId;
    if (req.query.parentNodeId) where.parent_node_id = req.query.parentNodeId;

    const include = [...includeProjectAndCreator()];
    const includeBranches = String(req.query.includeBranches ?? "") === "true";
    if (includeBranches || role === "api_service") include.push(branchInclude);

    const rows = await Node.findAll({
      where,
      include,
      order: [["created_at", "DESC"]],
    });
    const data = rows.map((r) => mapBranchCompat(r));
    return res.json({ data });
  } catch (error) {
    console.error("Error fetching nodes:", error);
    return res.status(500).json({ error: "Failed to fetch nodes" });
  }
});

router.get("/summary", async (_req, res) => {
  try {
    const rows = await Node.findAll({
      where: { role: { [Op.in]: ["frontend", "api_service"] }, is_deleted: false },
      attributes: [
        "id",
        "project_id",
        "service_name",
        "branch_name",
        "build_status",
        "build_result",
        "build_number",
        "preview_link",
        "updated_at",
        "created_at",
        "last_build_at",
      ],
      include: [{ model: Project, as: "project", attributes: ["id", "name"] }],
      order: [["updated_at", "DESC"]],
    });
    return res.json({ data: rows.map((r) => r.get({ plain: true })) });
  } catch (error) {
    console.error("Error fetching node summary:", error);
    return res.status(500).json({ error: "Failed to fetch node summary" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const id = String(req.params.id ?? "").trim();
    if (!id) return res.status(400).json({ error: "Invalid id" });
    const node = await Node.findOne({
      where: { id, is_deleted: false },
      include: [
        ...includeProjectAndCreator(),
        {
          model: ProjectEnvProfile,
          as: "envProfile",
          attributes: ["id", "name", "slug", "is_default"],
          required: false,
        },
        {
          model: NodeEnvVar,
          as: "envOverrides",
          attributes: [
            "id",
            "key",
            "value",
            "project_env_profile_id",
            "created_at",
            "updated_at",
          ],
          required: false,
        },
        branchInclude,
      ],
    });
    if (!node) return res.status(404).json({ error: "Node not found" });
    const plain = mapBranchCompat(node);
    const resolvedProfile = await resolveProfileIdForNode(node);
    if (Array.isArray(plain.envOverrides) && resolvedProfile != null) {
      plain.envOverrides = plain.envOverrides.filter(
        (e) => String(e.project_env_profile_id) === String(resolvedProfile),
      );
    }
    return res.json(plain);
  } catch (error) {
    console.error("Error fetching node:", error);
    return res.status(500).json({ error: "Failed to fetch node" });
  }
});

router.post("/", async (req, res) => {
  try {
    const payload = req.body?.data ?? req.body ?? {};
    const serviceName = payload.service_name ?? payload.serviceName;
    const nameCheck = await checkNodeServiceNameUniqueInProject(
      payload.project_id,
      serviceName,
      null,
      payload.branch_name,
    );
    if (!nameCheck.ok) {
      return res.status(400).json({ error: nameCheck.error, field: nameCheck.field });
    }
    const created = await createNodeWithAllocatedPort({
      ...payload,
      service_name: serviceName,
    });
    return res.status(201).json({ message: "Node created", data: created });
  } catch (error) {
    console.error("Error creating node:", error);
    const status = error.statusCode ?? 500;
    return res.status(status).json({ error: error.message || "Failed to create node" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const id = String(req.params.id ?? "").trim();
    const node = await Node.findOne({ where: { id, is_deleted: false } });
    if (!node) return res.status(404).json({ error: "Node not found" });
    const data = req.body ?? {};
    const targetProjectId =
      data.project_id !== undefined ? data.project_id : node.project_id;
    const targetName =
      data.service_name !== undefined
        ? data.service_name
        : data.serviceName !== undefined
          ? data.serviceName
          : node.service_name;
    const targetBranch =
      data.branch_name !== undefined ? data.branch_name : node.branch_name;
    const nameCheck = await checkNodeServiceNameUniqueInProject(
      targetProjectId,
      targetName,
      node.id,
      targetBranch,
    );
    if (!nameCheck.ok) {
      return res.status(400).json({ error: nameCheck.error, field: nameCheck.field });
    }
    await node.update(data);
    return res.json({ message: "Node updated", data: node });
  } catch (error) {
    console.error("Error updating node:", error);
    return res.status(500).json({ error: "Failed to update node" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = String(req.params.id ?? "").trim();
    const node = await Node.findOne({ where: { id, is_deleted: false } });
    if (!node) return res.status(404).json({ error: "Node not found" });
    await node.update({ is_deleted: true, updated_at: new Date() });
    return res.json({ message: "Node moved to trash successfully" });
  } catch (error) {
    console.error("Error deleting node:", error);
    return res.status(500).json({ error: "Failed to delete node" });
  }
});

router.get("/:id/build-history", async (req, res) => {
  try {
    const id = String(req.params.id ?? "").trim();
    if (!id) return res.status(400).json({ error: "Invalid node id" });
    const node = await Node.findOne({ where: { id, is_deleted: false } });
    if (!node) return res.status(404).json({ error: "Node not found" });
    const rows = await NodeBuild.findAll({
      where: { node_id: id },
      order: [["built_at", "DESC"]],
      limit: 100,
      attributes: [
        "id",
        "build_number",
        "jenkins_build_number",
        "built_at",
        "status",
      ],
    });
    return res.json({
      builds: rows.map((r) => ({
        id: r.id,
        build_number: r.build_number,
        jenkins_build_number: r.jenkins_build_number ?? null,
        built_at: r.built_at,
        status: r.status ?? "success",
      })),
    });
  } catch (error) {
    console.error("Error fetching build history:", error);
    return res.status(500).json({ error: "Failed to fetch build history" });
  }
});

async function resolveExplicitNodeEnvProfileId(node, requested) {
  if (requested == null || requested === "") return null;
  const id = String(requested).trim();
  if (!id) return null;
  const row = await ProjectEnvProfile.findOne({
    where: { id, project_id: node.project_id },
  });
  return row?.id ?? null;
}

router.get("/:id/env-vars", async (req, res) => {
  try {
    const node_id = String(req.params.id ?? "").trim();
    const node = await Node.findOne({
      where: { id: node_id, is_deleted: false },
      attributes: ["id", "project_id", "project_env_profile_id"],
    });
    if (!node) return res.status(404).json({ error: "Node not found" });
    let profileId;
    if (req.query.profileId != null && req.query.profileId !== "") {
      profileId = await resolveExplicitNodeEnvProfileId(node, req.query.profileId);
      if (profileId == null) {
        return res.status(400).json({ error: "Invalid profileId for this project" });
      }
    } else {
      profileId = await resolveProfileIdForNode(node);
      if (profileId == null) {
        return res.status(400).json({ error: "No environment profile for this node" });
      }
    }
    const rows = await NodeEnvVar.findAll({
      where: { node_id, project_env_profile_id: profileId },
      order: [["created_at", "DESC"]],
    });
    return res.json({
      env_vars: rows.map((r) => ({
        id: r.id,
        key: r.key,
        value: r.value,
        project_env_profile_id: r.project_env_profile_id,
      })),
    });
  } catch (error) {
    console.error("Error fetching node env vars:", error);
    return res.status(500).json({ error: "Failed to fetch node env vars" });
  }
});

router.post("/:id/env-vars", async (req, res) => {
  try {
    const node_id = String(req.params.id ?? "").trim();
    const { key, value } = req.body || {};
    if (!key) return res.status(400).json({ error: "key is required" });
    const envKey = String(key).trim();
    const envVal = String(value ?? "").trim();
    if (!envVal) return res.status(400).json({ error: "value is required" });
    const node = await Node.findOne({
      where: { id: node_id, is_deleted: false },
      attributes: ["id", "project_id", "project_env_profile_id"],
    });
    if (!node) return res.status(404).json({ error: "Node not found" });
    let profileId;
    if (req.body?.profileId != null && req.body.profileId !== "") {
      profileId = await resolveExplicitNodeEnvProfileId(node, req.body.profileId);
      if (profileId == null) {
        return res.status(400).json({ error: "Invalid profileId for this project" });
      }
    } else {
      profileId = await resolveProfileIdForNode(node);
      if (profileId == null) {
        return res.status(400).json({ error: "No environment profile for this project" });
      }
    }

    const inSelected = await Environment.findOne({
      where: {
        project_id: node.project_id,
        profile_id: profileId,
        env_variable: envKey,
      },
    });
    const existingNodeKey = await NodeEnvVar.findOne({
      where: { node_id, key: envKey, project_env_profile_id: profileId },
    });
    if (!inSelected && !existingNodeKey) {
      return res.status(400).json({
        error:
          "Key must exist on this environment profile or already be an override on this node for this profile.",
      });
    }

    const [row, created] = await NodeEnvVar.findOrCreate({
      where: { node_id, key: envKey, project_env_profile_id: profileId },
      defaults: {
        node_id,
        key: envKey,
        value: envVal,
        project_env_profile_id: profileId,
      },
    });
    if (!created) await row.update({ value: envVal });
    return res.status(created ? 201 : 200).json({
      env_var: {
        id: row.id,
        key: row.key,
        value: row.value,
        project_env_profile_id: row.project_env_profile_id,
      },
    });
  } catch (error) {
    console.error("Error saving node env var:", error);
    return res.status(500).json({ error: "Failed to save node env var" });
  }
});

router.put("/:id/env-vars/:key", async (req, res) => {
  try {
    const node_id = String(req.params.id ?? "").trim();
    const envKey = String(req.params.key || "").trim();
    const envVal = String(req.body?.value ?? "").trim();
    if (!envKey) return res.status(400).json({ error: "key param is required" });
    if (!envVal) return res.status(400).json({ error: "value is required" });
    const node = await Node.findOne({
      where: { id: node_id, is_deleted: false },
      attributes: ["id", "project_id", "project_env_profile_id"],
    });
    if (!node) return res.status(404).json({ error: "Node not found" });
    let profileId;
    if (req.query.profileId != null && req.query.profileId !== "") {
      profileId = await resolveExplicitNodeEnvProfileId(node, req.query.profileId);
      if (profileId == null) {
        return res.status(400).json({ error: "Invalid profileId for this project" });
      }
    } else {
      profileId = await resolveProfileIdForNode(node);
      if (profileId == null) {
        return res.status(400).json({ error: "No environment profile for this node" });
      }
    }
    const row = await NodeEnvVar.findOne({
      where: { node_id, key: envKey, project_env_profile_id: profileId },
    });
    if (!row) return res.status(404).json({ error: "Env var not found" });
    await row.update({ value: envVal });
    return res.json({ env_var: { id: row.id, key: row.key, value: row.value } });
  } catch (error) {
    console.error("Error updating node env var:", error);
    return res.status(500).json({ error: "Failed to update node env var" });
  }
});

router.delete("/:id/env-vars/:key", async (req, res) => {
  try {
    const node_id = String(req.params.id ?? "").trim();
    const envKey = String(req.params.key || "").trim();
    if (!envKey) return res.status(400).json({ error: "key param is required" });
    const node = await Node.findOne({
      where: { id: node_id, is_deleted: false },
      attributes: ["id", "project_id", "project_env_profile_id"],
    });
    if (!node) return res.status(404).json({ error: "Node not found" });
    let profileId;
    if (req.query.profileId != null && req.query.profileId !== "") {
      profileId = await resolveExplicitNodeEnvProfileId(node, req.query.profileId);
      if (profileId == null) {
        return res.status(400).json({ error: "Invalid profileId for this project" });
      }
    } else {
      profileId = await resolveProfileIdForNode(node);
      if (profileId == null) {
        return res.status(400).json({ error: "No environment profile for this node" });
      }
    }
    const deleted = await NodeEnvVar.destroy({
      where: { node_id, key: envKey, project_env_profile_id: profileId },
    });
    if (!deleted) return res.status(404).json({ error: "Env var not found" });
    return res.json({ message: "Env var deleted" });
  } catch (error) {
    console.error("Error deleting node env var:", error);
    return res.status(500).json({ error: "Failed to delete node env var" });
  }
});

router.get("/ops/export/all", async (req, res) => {
  try {
    const where = { role: "api_service", is_deleted: false };
    if (req.query.projectId) where.project_id = String(req.query.projectId);
    const rows = await Node.findAll({
      where,
      order: [["created_at", "DESC"]],
    });
    return res.json({
      backendServices: rows.map((node) => ({
        serviceName: node.service_name,
        defaultUrl: node.default_url,
        type: node.type,
        repo: node.repository_name,
        repoUrl: node.repo_url,
        envName: node.env_name,
        description: node.description,
        projectId: node.project_id,
        createdAt: node.created_at,
        status: node.status,
        environment: node.environment,
      })),
      lastUpdated: new Date().toISOString(),
      version: "1.0",
    });
  } catch (error) {
    console.error("Error exporting nodes:", error);
    return res.status(500).json({ error: "Failed to export nodes" });
  }
});

router.post("/ops/import/bulk", async (req, res) => {
  try {
    const { backendServices, projectId, userId, conflictResolution = "skip" } =
      req.body || {};
    if (!Array.isArray(backendServices)) {
      return res.status(400).json({ error: "backendServices must be an array" });
    }
    const importedServices = [];
    const skippedServices = [];
    const updatedServices = [];
    for (const service of backendServices) {
      const existingService = await Node.findOne({
        where: {
          service_name: service.serviceName,
          project_id: projectId,
          role: "api_service",
          is_deleted: false,
        },
      });
      if (existingService) {
        if (conflictResolution === "skip") {
          skippedServices.push({
            serviceName: service.serviceName,
            reason: "Service already exists",
          });
          continue;
        }
        if (conflictResolution === "update") {
          await existingService.update({
            default_url: service.defaultUrl,
            type: service.type || "api",
            repository_name: service.repo || service.repository_name,
            repo_url: service.repoUrl,
            env_name: service.envName,
            description: service.description,
            updated_at: new Date(),
          });
          updatedServices.push(existingService);
          continue;
        }
        await existingService.update({ is_deleted: true });
      }
      const newService = await createNodeWithAllocatedPort({
        role: "api_service",
        service_name: service.serviceName,
        default_url: service.defaultUrl,
        type: service.type || "api",
        repository_name: service.repo || service.repository_name,
        repo_url: service.repoUrl,
        env_name: service.envName,
        description: service.description,
        branch_name: service.branchName ?? service.branch_name ?? "main",
        project_id: projectId,
        created_by: userId,
      });
      importedServices.push(newService);
    }
    return res.json({
      message: "Import completed successfully",
      summary: {
        imported: importedServices.length,
        updated: updatedServices.length,
        skipped: skippedServices.length,
      },
      details: { skippedServices },
    });
  } catch (error) {
    console.error("Error importing nodes:", error);
    return res.status(500).json({ error: "Failed to import nodes" });
  }
});

export default router;
