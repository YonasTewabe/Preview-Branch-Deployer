import express from "express";
import { Op } from "sequelize";
import { sequelize } from "../config/database.js";
import {
  Project,
  User,
  Environment,
  ProjectEnvProfile,
  Node,
} from "../models/index.js";
import {
  slugifyEnvProfileLabel,
  uniqueSlugForProject,
} from "../utils/envProfileSlug.js";
import {
  getDefaultEnvProfile,
  resolveProfileIdForProject,
} from "../utils/resolveProjectEnvProfile.js";
import {
  refreshStatsAfterMutation,
  refreshSystemStats,
} from "../services/statsService.js";
import { deletePreviewDomainViaJenkins } from "../services/jenkinsDeletePreviewDomain.js";

const router = express.Router();
router.use(refreshStatsAfterMutation);
const ACTIVE_PROJECT_WHERE = { is_deleted: false };

function normalizeProjectTag(tag) {
  const t = String(tag ?? "").trim().toLowerCase();
  if (t === "frontend" || t === "backend") return t;
  return null;
}
const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function findActiveProjectByPk(id, options = {}) {
  return Project.findOne({
    where: { id, ...ACTIVE_PROJECT_WHERE },
    ...options,
  });
}

async function envProfileNameTaken(projectId, nameTrimmed, excludeProfileId) {
  const want = String(nameTrimmed ?? "")
    .trim()
    .toLowerCase();
  if (!want) return null;
  const rows = await ProjectEnvProfile.findAll({
    where: { project_id: projectId },
    attributes: ["id", "name"],
  });
  for (const r of rows) {
    if (excludeProfileId != null && String(r.id) === String(excludeProfileId)) {
      continue;
    }
    if (
      String(r.name ?? "")
        .trim()
        .toLowerCase() === want
    ) {
      return "An environment profile with this name already exists for this project.";
    }
  }
  return null;
}

function normalizeRepositoryUrl(u) {
  return String(u ?? "")
    .trim()
    .replace(/\/+$/, "");
}

function tombstoneProjectUniqueFields(projectLike) {
  const token = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const nameBase = String(projectLike?.name ?? "").trim() || "project";
  const shortBase = String(projectLike?.short_code ?? "")
    .trim()
    .toLowerCase() || "proj";
  const repoBase = normalizeRepositoryUrl(projectLike?.repository_url) || "deleted://project";
  const envBase = String(projectLike?.env_name ?? "")
    .trim()
    .toLowerCase() || "env";
  const shortSuffix = `-d-${token}`.slice(0, 18);
  return {
    name: `${nameBase} [deleted ${token}]`.slice(0, 255),
    short_code: `${shortBase.slice(0, Math.max(2, 20 - shortSuffix.length))}${shortSuffix}`.slice(
      0,
      20,
    ),
    repository_url: `${repoBase}#deleted-${token}`.slice(0, 500),
    env_name: `${envBase}-deleted-${token}`.slice(0, 255),
    is_deleted: true,
  };
}

async function releaseDeletedProjectUniqueConflicts(payload) {
  const nameNorm = String(payload?.name ?? "").trim();
  const shortNorm = String(payload?.short_code ?? "")
    .trim()
    .toLowerCase();
  const repoNorm = normalizeRepositoryUrl(payload?.repository_url);
  const envNorm = String(payload?.env_name ?? "")
    .trim()
    .toLowerCase();
  if (!nameNorm && !shortNorm && !repoNorm && !envNorm) return;

  const deletedRows = await Project.findAll({
    where: { is_deleted: true },
    attributes: ["id", "name", "short_code", "repository_url", "env_name"],
  });

  for (const p of deletedRows) {
    const sameName = nameNorm && String(p.name ?? "").trim() === nameNorm;
    const sameShort =
      shortNorm && String(p.short_code ?? "").trim().toLowerCase() === shortNorm;
    const sameRepo =
      repoNorm && normalizeRepositoryUrl(p.repository_url) === repoNorm;
    const sameEnv =
      envNorm && String(p.env_name ?? "").trim().toLowerCase() === envNorm;
    if (!(sameName || sameShort || sameRepo || sameEnv)) continue;
    await p.update(tombstoneProjectUniqueFields(p));
  }
}

/**
 * Returns { field, error } if another project uses the same name, short_code, or repo URL.
 */
async function findFirstDuplicateProjectField(payload, excludeProjectId) {
  const nameNorm = String(payload.name ?? "").trim();
  const shortNorm = String(payload.short_code ?? "")
    .trim()
    .toLowerCase();
  const repoNorm = normalizeRepositoryUrl(payload.repository_url);
  const envNorm = String(payload.env_name ?? "")
    .trim()
    .toLowerCase();

  const idFilter =
    excludeProjectId != null && String(excludeProjectId).trim()
      ? { id: { [Op.ne]: String(excludeProjectId).trim() } }
      : {};

  const rows = await Project.findAll({
    where: { ...idFilter, ...ACTIVE_PROJECT_WHERE },
    attributes: ["name", "short_code", "repository_url", "env_name"],
  });

  for (const p of rows) {
    if (nameNorm && p.name === nameNorm) {
      return {
        field: "name",
        error: "A project with this name already exists.",
      };
    }
    if (shortNorm && String(p.short_code ?? "").toLowerCase() === shortNorm) {
      return {
        field: "short_code",
        error: "This short code is already in use.",
      };
    }
    if (repoNorm && normalizeRepositoryUrl(p.repository_url) === repoNorm) {
      return {
        field: "repository_url",
        error: "This repository URL is already linked to another project.",
      };
    }
    if (
      envNorm &&
      String(p.env_name ?? "")
        .trim()
        .toLowerCase() === envNorm
    ) {
      return {
        field: "env_name",
        error: "Another project already uses this environment name.",
      };
    }
  }
  return null;
}

function mapUniqueConstraintError(error) {
  if (error?.name !== "SequelizeUniqueConstraintError") return null;
  const msg = String(
    error?.parent?.sqlMessage ||
      error?.original?.sqlMessage ||
      error?.message ||
      "",
  );
  const path = error?.errors?.[0]?.path;
  if (path === "name" || /for key.*name/i.test(msg)) {
    return "A project with this name already exists.";
  }
  if (path === "short_code" || /short_code/i.test(msg)) {
    return "This short code is already in use.";
  }
  if (path === "repository_url" || /repository_url/i.test(msg)) {
    return "This repository URL is already linked to another project.";
  }
  if (path === "env_name" || /\benv_name\b/i.test(msg)) {
    return "Another project already uses this environment name.";
  }
  return "This value is already in use by another project.";
}

const isUnknownColumnError = (error, columnName) => {
  const msg =
    error?.original?.sqlMessage ||
    error?.parent?.sqlMessage ||
    error?.message ||
    "";
  return (
    typeof msg === "string" &&
    msg.includes("Unknown column") &&
    msg.includes(columnName)
  );
};

const sanitizeProject = (projectInstanceOrJson) => {
  const json =
    typeof projectInstanceOrJson?.toJSON === "function"
      ? projectInstanceOrJson.toJSON()
      : { ...(projectInstanceOrJson || {}) };

  // Removed from API surface
  delete json.status;
  // Keep environment payload in API; required by environment management UI

  if (Array.isArray(json.envProfiles)) {
    json.env_profiles = json.envProfiles.map((p) => {
      const x = p.get ? p.get({ plain: true }) : p;
      return {
        id: x.id,
        name: x.name,
        slug: x.slug,
        is_default: x.is_default,
      };
    });
    delete json.envProfiles;
  }

  if (Array.isArray(json.environments)) {
    json.environments = json.environments
      .filter((e) => {
        const plain = e.get ? e.get({ plain: true }) : e;
        if (plain.profile == null) return true;
        const pr = plain.profile.get
          ? plain.profile.get({ plain: true })
          : plain.profile;
        return pr.is_default === true;
      })
      .map((e) => {
        const plain = e.get ? e.get({ plain: true }) : e;
        return {
          id: plain.id,
          key: plain.env_variable,
          value: plain.env,
        };
      });
  }

  return json;
};

/** Non-deleted preview nodes per project id (for list/detail payloads). */
async function getNodeCountsByProjectIds(projectIds) {
  const ids = [
    ...new Set(
      (projectIds || []).map((id) => String(id ?? "").trim()).filter(Boolean),
    ),
  ];
  if (ids.length === 0) return {};
  const rows = await Node.findAll({
    attributes: [
      "project_id",
      [sequelize.fn("COUNT", sequelize.col("Node.id")), "cnt"],
    ],
    where: { project_id: { [Op.in]: ids }, is_deleted: false },
    group: ["project_id"],
    raw: true,
  });
  /** @type {Record<string, number>} */
  const map = {};
  for (const r of rows) {
    map[String(r.project_id)] = Number(r.cnt) || 0;
  }
  return map;
}

const projectDetailIncludes = [
  {
    model: User,
    as: "creator",
    attributes: ["id", "email", "name"],
  },
  {
    model: ProjectEnvProfile,
    as: "envProfiles",
    attributes: ["id", "name", "slug", "is_default"],
    required: false,
  },
  {
    model: Environment,
    as: "environments",
    attributes: ["id", "env_variable", "env", "profile_id"],
    required: false,
    include: [
      {
        model: ProjectEnvProfile,
        as: "profile",
        attributes: ["id", "is_default"],
        required: false,
      },
    ],
  },
];

async function listTrashedProjectsHandler(_req, res) {
  try {
    const projects = await Project.findAll({
      where: { is_deleted: true },
      attributes: { exclude: ["status"] },
      include: [
        {
          model: User,
          as: "creator",
          attributes: ["id", "email", "name"],
        },
      ],
      order: [["updated_at", "DESC"]],
    });
    res.json(projects.map((p) => sanitizeProject(p)));
  } catch (error) {
    console.error("Error fetching trashed projects:", error);
    res.status(500).json({ error: "Failed to fetch trashed projects" });
  }
}

// GET /api/projects - Get all projects
router.get("/", async (req, res) => {
  try {
    const projects = await Project.findAll({
      where: ACTIVE_PROJECT_WHERE,
      attributes: { exclude: ["status"] },
      include: projectDetailIncludes,
      order: [["created_at", "DESC"]],
    });
    const countMap = await getNodeCountsByProjectIds(projects.map((p) => p.id));
    res.json(
      projects.map((p) => ({
        ...sanitizeProject(p),
        nodes_count: countMap[p.id] ?? 0,
      })),
    );
  } catch (error) {
    // Backward-compatible fallback when DB schema hasn't been updated yet.
    if (isUnknownColumnError(error, "Project.env_name")) {
      try {
        const projects = await Project.findAll({
          attributes: { exclude: ["status", "env_name"] },
          include: [
            {
              model: User,
              as: "creator",
              attributes: [
                "id",
                "email",
                "name",
              ],
            },
          ],
          order: [["created_at", "DESC"]],
        });
        const countMapFb = await getNodeCountsByProjectIds(
          projects.map((p) => p.id),
        );
        return res.json(
          projects.map((p) => ({
            ...sanitizeProject(p),
            nodes_count: countMapFb[p.id] ?? 0,
          })),
        );
      } catch (fallbackError) {
        console.error("Error fetching projects (fallback):", fallbackError);
      }
    }
    console.error("Error fetching projects:", error);
    res.status(500).json({ error: "Failed to fetch projects" });
  }
});

// GET /api/projects/:id - Get a specific project
router.get("/:id", async (req, res) => {
  if (String(req.params.id ?? "").toLowerCase() === "trash") {
    return listTrashedProjectsHandler(req, res);
  }
  try {
    const project = await findActiveProjectByPk(req.params.id, {
      attributes: { exclude: ["status"] },
      include: projectDetailIncludes,
    });

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    const countMapOne = await getNodeCountsByProjectIds([project.id]);
    res.json({
      ...sanitizeProject(project),
      nodes_count: countMapOne[project.id] ?? 0,
    });
  } catch (error) {
    if (
      isUnknownColumnError(error, "Project.env_name") ||
      isUnknownColumnError(error, "env_name")
    ) {
      try {
        const project = await findActiveProjectByPk(req.params.id, {
          attributes: { exclude: ["status", "env_name"] },
          include: [
            {
              model: User,
              as: "creator",
              attributes: [
                "id",
                "email",
                "name",
              ],
            },
          ],
        });

        if (!project) {
          return res.status(404).json({ error: "Project not found" });
        }

        const countMapFb = await getNodeCountsByProjectIds([project.id]);
        return res.json({
          ...sanitizeProject(project),
          nodes_count: countMapFb[project.id] ?? 0,
        });
      } catch (fallbackError) {
        console.error("Error fetching project (fallback):", fallbackError);
      }
    }
    console.error("Error fetching project:", error);
    res.status(500).json({ error: "Failed to fetch project" });
  }
});

// POST /api/projects - Create a new project
router.post("/", async (req, res) => {
  try {
    const {
      name,
      description,
      repository_url,
      created_by,
      short_code,
      env_name,
      tag,
    } = req.body;

    if (!name || !repository_url || !short_code || !env_name || !created_by) {
      return res
        .status(400)
        .json({
          error:
            "Name, repository_url, short_code, env_name, and created_by are required",
        });
    }

    const normalizedTag = normalizeProjectTag(tag);
    if (!normalizedTag) {
      return res.status(400).json({
        error: 'tag must be either "frontend" or "backend".',
        field: "tag",
      });
    }

    const nameNorm = String(name).trim();
    const shortNorm = String(short_code).trim().toLowerCase();
    const repoNorm = normalizeRepositoryUrl(repository_url);
    const envDisplay = String(env_name).trim();
    const envNorm = envDisplay.toLowerCase();

    const dup = await findFirstDuplicateProjectField(
      {
        name: nameNorm,
        short_code: shortNorm,
        repository_url: repoNorm,
        env_name: envNorm,
      },
      null,
    );
    if (dup) {
      return res.status(400).json({ error: dup.error, field: dup.field });
    }

    // Compatibility path: older soft-deleted rows may still hold unique values.
    // Tombstone those deleted rows so active project creation is not blocked.
    await releaseDeletedProjectUniqueConflicts({
      name: nameNorm,
      short_code: shortNorm,
      repository_url: repoNorm,
      env_name: envNorm,
    });

    const project = await Project.create({
      name: nameNorm,
      description,
      repository_url: repoNorm,
      tag: normalizedTag,
      env_name: envNorm,
      created_by: String(created_by).trim(),
      short_code: shortNorm,
    });

    const slug = await uniqueSlugForProject(
      ProjectEnvProfile,
      project.id,
      slugifyEnvProfileLabel(envDisplay, project.id),
    );
    await ProjectEnvProfile.create({
      project_id: project.id,
      name: envDisplay,
      slug,
      is_default: true,
    });

    const createdFull = await Project.findByPk(project.id, {
      include: projectDetailIncludes,
    });
    res.status(201).json({
      ...sanitizeProject(createdFull),
      nodes_count: 0,
    });
  } catch (error) {
    console.error("Error creating project:", error);
    const mapped = mapUniqueConstraintError(error);
    if (mapped) {
      return res.status(400).json({ error: mapped });
    }
    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(400).json({
        error: "This value is already in use by another project.",
      });
    }
    res.status(500).json({ error: "Failed to create project" });
  }
});

// PUT /api/projects/:id - Update a project
router.put("/:id", async (req, res) => {
  try {
    const {
      name,
      description,
      repository_url,
      short_code,
      env_name,
      tag,
    } = req.body;

    const project = await findActiveProjectByPk(req.params.id);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    const nameNorm =
      name != null ? String(name).trim() : String(project.name ?? "").trim();
    const shortCodeNorm =
      short_code != null
        ? String(short_code).trim().toLowerCase()
        : String(project.short_code ?? "")
            .trim()
            .toLowerCase();
    const repoNorm =
      repository_url != null
        ? normalizeRepositoryUrl(repository_url)
        : normalizeRepositoryUrl(project.repository_url);
    const envNorm =
      env_name != null && String(env_name).trim() !== ""
        ? String(env_name).trim().toLowerCase()
        : String(project.env_name ?? "")
            .trim()
            .toLowerCase();

    const dup = await findFirstDuplicateProjectField(
      {
        name: nameNorm,
        short_code: shortCodeNorm,
        repository_url: repoNorm,
        env_name: envNorm,
      },
      project.id,
    );
    if (dup) {
      return res.status(400).json({ error: dup.error, field: dup.field });
    }

    const updates = {
      name: nameNorm,
      description,
      repository_url: repoNorm,
      short_code: shortCodeNorm,
    };
    if (env_name != null && String(env_name).trim() !== "") {
      updates.env_name = String(env_name).trim().toLowerCase();
    }
    if (tag != null && String(tag).trim() !== "") {
      const normalizedTag = normalizeProjectTag(tag);
      if (!normalizedTag) {
        return res.status(400).json({
          error: 'tag must be either "frontend" or "backend".',
          field: "tag",
        });
      }
      updates.tag = normalizedTag;
    }

    await project.update(updates);

    if (env_name != null && String(env_name).trim() !== "") {
      const def = await getDefaultEnvProfile(project.id);
      if (def) {
        await def.update({ name: String(env_name).trim() });
      }
    }

    const updatedFull = await Project.findByPk(project.id, {
      include: projectDetailIncludes,
    });
    const countMapPut = await getNodeCountsByProjectIds([project.id]);
    res.json({
      ...sanitizeProject(updatedFull),
      nodes_count: countMapPut[project.id] ?? 0,
    });
  } catch (error) {
    console.error("Error updating project:", error);
    const mapped = mapUniqueConstraintError(error);
    if (mapped) {
      return res.status(400).json({ error: mapped });
    }
    res.status(500).json({ error: "Failed to update project" });
  }
});

// DELETE /api/projects/:id - Delete a project
router.delete("/:id", async (req, res) => {
  try {
    const project = await findActiveProjectByPk(req.params.id);
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }
    const projectNodes = await Node.findAll({
      where: { project_id: project.id, is_deleted: false },
      attributes: ["id", "domain_name"],
    });
    const domainNames = [
      ...new Set(
        projectNodes
          .map((n) => String(n.domain_name ?? "").trim())
          .filter(Boolean),
      ),
    ];
    /** @type {Array<{domain_name: string, success: boolean, message: string}>} */
    const jenkinsCleanup = [];
    for (const domainName of domainNames) {
      try {
        const result = await deletePreviewDomainViaJenkins(domainName);
        jenkinsCleanup.push({
          domain_name: domainName,
          success: Boolean(result?.success),
          message: String(result?.message ?? ""),
        });
      } catch (cleanupError) {
        jenkinsCleanup.push({
          domain_name: domainName,
          success: false,
          message: String(cleanupError?.message || cleanupError),
        });
      }
    }

    await project.update({
      ...tombstoneProjectUniqueFields(project),
      is_deleted: true,
    });
    await Node.update(
      { is_deleted: true, updated_at: new Date() },
      { where: { project_id: project.id } },
    );
    await refreshSystemStats();
    const failedJenkinsCleanup = jenkinsCleanup.filter((x) => !x.success);
    if (failedJenkinsCleanup.length > 0) {
      return res.status(207).json({
        message:
          "Project moved to trash, but some Jenkins domain deletions failed.",
        jenkins_cleanup: jenkinsCleanup,
      });
    }
    return res.json({
      message: "Project moved to trash successfully",
      jenkins_cleanup: jenkinsCleanup,
    });
  } catch (error) {
    console.error("Error deleting project:", error);
    res.status(500).json({ error: "Failed to delete project" });
  }
});

// GET /api/projects/trash - List deleted projects
router.get("/trash", async (_req, res) => {
  return listTrashedProjectsHandler(_req, res);
});

// PATCH /api/projects/:id/restore - Restore a soft-deleted project
router.patch("/:id/restore", async (req, res) => {
  try {
    const project = await Project.findOne({
      where: { id: req.params.id, is_deleted: true },
    });
    if (!project)
      return res.status(404).json({ error: "Project not found in trash" });
    await project.update({ is_deleted: false });
    res.json({ message: "Project restored successfully" });
  } catch (error) {
    console.error("Error restoring project:", error);
    res.status(500).json({ error: "Failed to restore project" });
  }
});

// DELETE /api/projects/:id/permanent - Permanently delete a project
router.delete("/:id/permanent", async (req, res) => {
  try {
    const project = await Project.findOne({ where: { id: req.params.id } });
    if (!project) return res.status(404).json({ error: "Project not found" });
    await project.destroy();
    res.json({ message: "Project permanently deleted" });
  } catch (error) {
    console.error("Error permanently deleting project:", error);
    res.status(500).json({ error: "Failed to permanently delete project" });
  }
});

// PUT /api/projects/:id/environments - Update environments for a project
router.put("/:id/environments", async (req, res) => {
  try {
    let project;
    try {
      project = await findActiveProjectByPk(req.params.id);
    } catch (e) {
      if (
        isUnknownColumnError(e, "Project.env_name") ||
        isUnknownColumnError(e, "env_name")
      ) {
        project = await findActiveProjectByPk(req.params.id, {
          attributes: { exclude: ["env_name"] },
        });
      } else {
        throw e;
      }
    }
    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    const { environments } = req.body; // Array of { key, value } objects (preferred) or string format

    // Parse environments if it's a string (text format)
    let environmentArray = [];
    if (typeof environments === "string") {
      // Parse text format: KEY1=value1\nKEY2=value2
      const lines = environments.split("\n").filter((line) => line.trim());
      environmentArray = lines
        .map((line) => {
          const [key, ...valueParts] = line.split("=");
          return {
            env_variable: key?.trim() || "",
            env: valueParts.join("=").trim() || "",
          };
        })
        .filter((env) => env.env_variable); // Filter out empty keys
    } else if (Array.isArray(environments)) {
      environmentArray = environments
        .map((item) => {
          // Accept either { key, value } or legacy { env_variable, env }
          const env_variable =
            (item?.key ?? item?.env_variable ?? "").trim?.() ?? "";
          const env = item?.value ?? item?.env ?? "";
          return { env_variable, env };
        })
        .filter((env) => env.env_variable);
    }

    const missingValue = environmentArray.find(
      (row) => !String(row.env ?? "").trim(),
    );
    if (missingValue) {
      return res.status(400).json({
        error: "Each environment variable must have a non-empty value",
      });
    }

    const envKeys = environmentArray.map((row) => row.env_variable);
    if (new Set(envKeys).size !== envKeys.length) {
      return res.status(400).json({
        error:
          "Duplicate environment variable keys are not allowed for a profile",
      });
    }

    const bodyProfile =
      req.body.profile_id ?? req.body.profileId ?? req.body.env_profile_id;
    const profileId = await resolveProfileIdForProject(
      project.id,
      bodyProfile != null && bodyProfile !== "" ? bodyProfile : null,
    );
    if (!profileId) {
      return res.status(400).json({
        error: "No environment profile found for this project",
      });
    }

    await Environment.destroy({ where: { profile_id: profileId } });
    if (environmentArray.length > 0) {
      await Environment.bulkCreate(
        environmentArray.map((env) => ({
          project_id: project.id,
          profile_id: profileId,
          env_variable: env.env_variable,
          env: String(env.env ?? "").trim(),
        })),
        { validate: true },
      );
    }

    const updatedProject = await Project.findByPk(req.params.id, {
      include: projectDetailIncludes,
    });

    const countMapEnv = await getNodeCountsByProjectIds([project.id]);
    res.json({
      ...sanitizeProject(updatedProject),
      nodes_count: countMapEnv[project.id] ?? 0,
    });
  } catch (error) {
    console.error("Error updating project environments:", error);
    res.status(500).json({ error: "Failed to update project environments" });
  }
});

// --- Project environment profiles (dev / staging / prod, etc.) ---

router.get("/:id/env-profiles", async (req, res) => {
  try {
    const project = await findActiveProjectByPk(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });
    const rows = await ProjectEnvProfile.findAll({
      where: { project_id: project.id },
      attributes: ["id", "name", "slug", "is_default", "created_at"],
      order: [
        ["is_default", "DESC"],
        ["name", "ASC"],
      ],
    });
    const withCounts = await Promise.all(
      rows.map(async (r) => {
        const plain = r.get({ plain: true });
        const n = await Environment.count({
          where: { profile_id: plain.id },
        });
        return { ...plain, variable_count: n };
      }),
    );
    res.json({ env_profiles: withCounts });
  } catch (error) {
    console.error("Error listing env profiles:", error);
    res.status(500).json({ error: "Failed to list environment profiles" });
  }
});

router.post("/:id/env-profiles", async (req, res) => {
  try {
    const project = await findActiveProjectByPk(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });
    let { name, slug: slugRaw, is_default: isDefaultRaw } = req.body || {};
    name = String(name ?? "").trim();
    if (!name) return res.status(400).json({ error: "name is required" });

    const profileNameTaken = await envProfileNameTaken(project.id, name, null);
    if (profileNameTaken) {
      return res.status(400).json({ error: profileNameTaken, field: "name" });
    }

    let slug =
      slugRaw != null && String(slugRaw).trim()
        ? slugifyEnvProfileLabel(String(slugRaw).trim(), project.id)
        : slugifyEnvProfileLabel(name, project.id);
    slug = await uniqueSlugForProject(ProjectEnvProfile, project.id, slug);

    const existingCount = await ProjectEnvProfile.count({
      where: { project_id: project.id },
    });
    const isDefault = Boolean(isDefaultRaw) || existingCount === 0;
    if (isDefault) {
      await ProjectEnvProfile.update(
        { is_default: false },
        { where: { project_id: project.id } },
      );
    }

    const row = await ProjectEnvProfile.create({
      project_id: project.id,
      name,
      slug,
      is_default: isDefault,
    });

    if (isDefault) {
      await project.update({ env_name: name.toLowerCase() });
    }

    res.status(201).json({
      env_profile: row.get({ plain: true }),
    });
  } catch (error) {
    const dup =
      error?.name === "SequelizeUniqueConstraintError" ||
      error?.parent?.code === "ER_DUP_ENTRY";
    if (dup) {
      return res
        .status(409)
        .json({ error: "Slug already exists for this project" });
    }
    console.error("Error creating env profile:", error);
    res.status(500).json({ error: "Failed to create environment profile" });
  }
});

router.patch("/:id/env-profiles/:profileId", async (req, res) => {
  try {
    const project = await findActiveProjectByPk(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });
    const pid = String(req.params.profileId ?? "").trim();
    if (!pid) {
      return res.status(400).json({ error: "Invalid profile id" });
    }
    const row = await ProjectEnvProfile.findOne({
      where: { id: pid, project_id: project.id },
    });
    if (!row)
      return res.status(404).json({ error: "Environment profile not found" });

    const { name, slug: slugRaw, is_default: isDefaultRaw } = req.body || {};
    const updates = {};
    if (name != null && String(name).trim() !== "") {
      const nextName = String(name).trim();
      const profileNameTaken = await envProfileNameTaken(
        project.id,
        nextName,
        row.id,
      );
      if (profileNameTaken) {
        return res.status(400).json({ error: profileNameTaken, field: "name" });
      }
      updates.name = nextName;
    }
    if (slugRaw != null && String(slugRaw).trim() !== "") {
      const s = await uniqueSlugForProject(
        ProjectEnvProfile,
        project.id,
        slugifyEnvProfileLabel(String(slugRaw).trim(), project.id),
        row.id,
      );
      if (s !== row.slug) updates.slug = s;
    }

    const setDefault = isDefaultRaw === true;
    if (setDefault) {
      await ProjectEnvProfile.update(
        { is_default: false },
        { where: { project_id: project.id } },
      );
      updates.is_default = true;
    }

    await row.update(updates);
    await row.reload();

    if (row.is_default) {
      await project.update({
        env_name: String(row.name ?? "").toLowerCase(),
      });
    }

    res.json({ env_profile: row.get({ plain: true }) });
  } catch (error) {
    console.error("Error updating env profile:", error);
    res.status(500).json({ error: "Failed to update environment profile" });
  }
});

router.delete("/:id/env-profiles/:profileId", async (req, res) => {
  try {
    const project = await findActiveProjectByPk(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });
    const pid = String(req.params.profileId ?? "").trim();
    if (!pid) {
      return res.status(400).json({ error: "Invalid profile id" });
    }
    const row = await ProjectEnvProfile.findOne({
      where: { id: pid, project_id: project.id },
    });
    if (!row)
      return res.status(404).json({ error: "Environment profile not found" });

    const count = await ProjectEnvProfile.count({
      where: { project_id: project.id },
    });
    if (count <= 1) {
      return res.status(400).json({
        error: "Cannot delete the only environment profile for this project",
      });
    }

    if (row.is_default) {
      return res.status(400).json({
        error:
          "Cannot delete the default environment profile. Set another profile as default first.",
      });
    }

    const def = await getDefaultEnvProfile(project.id);
    if (!def || def.id === row.id) {
      return res.status(400).json({
        error: "No default environment profile to reassign nodes to",
      });
    }

    await Node.update(
      { project_env_profile_id: def.id },
      { where: { project_id: project.id, project_env_profile_id: row.id } },
    );

    await row.destroy();

    res.json({ message: "Environment profile deleted" });
  } catch (error) {
    console.error("Error deleting env profile:", error);
    res.status(500).json({ error: "Failed to delete environment profile" });
  }
});

export default router;
