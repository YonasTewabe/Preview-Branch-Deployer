import express from "express";
import { Node, Project, User } from "../models/index.js";

const router = express.Router();

router.get("/nodes", async (_req, res) => {
  try {
    const nodes = await Node.findAll({
      where: { is_deleted: true },
      include: [
        {
          model: Project,
          as: "project",
          attributes: ["id", "name", "short_code"],
          required: false,
        },
        {
          model: User,
          as: "creator",
          attributes: ["id", "email"],
          required: false,
        },
      ],
      order: [["updated_at", "DESC"]],
    });
    res.json(nodes.map((n) => n.get({ plain: true })));
  } catch (error) {
    console.error("Error fetching trashed nodes:", error);
    res.status(500).json({ error: "Failed to fetch trashed nodes" });
  }
});

router.patch("/nodes/:id/restore", async (req, res) => {
  try {
    const node = await Node.findOne({
      where: { id: req.params.id, is_deleted: true },
    });
    if (!node) return res.status(404).json({ error: "Node not found in trash" });
    const project = await Project.findByPk(node.project_id, {
      attributes: ["id", "is_deleted"],
    });
    if (!project || project.is_deleted) {
      return res.status(400).json({
        error:
          "Cannot restore node because its project is deleted. Restore the project first.",
      });
    }
    await node.update({
      is_deleted: false,
      // Reset runtime/deploy state so restored nodes behave like fresh deployments.
      preview_link: null,
      build_number: null,
      build_result: null,
      jenkins_job_url: null,
      build_status: "pending",
      last_build_at: null,
      status: "active",
    });
    res.json({ message: "Node restored successfully" });
  } catch (error) {
    console.error("Error restoring node:", error);
    res.status(500).json({ error: "Failed to restore node" });
  }
});

router.delete("/nodes/:id/permanent", async (req, res) => {
  try {
    const node = await Node.findOne({ where: { id: req.params.id } });
    if (!node) return res.status(404).json({ error: "Node not found" });
    await node.destroy();
    res.json({ message: "Node permanently deleted" });
  } catch (error) {
    console.error("Error permanently deleting node:", error);
    res.status(500).json({ error: "Failed to permanently delete node" });
  }
});

export default router;
