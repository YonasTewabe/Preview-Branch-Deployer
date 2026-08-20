import cron from "node-cron";
import dayjs from "dayjs";
import { Op } from "sequelize";
import { Node, Project } from "../models/index.js";
import configurationService from "../services/configurationService.js";

/**
 * Permanently deletes nodes and projects that have been in trash
 * for longer than `trash_retention_days` days.
 * Only runs when the setting is configured (> 0).
 */
export async function runTrashCleanup() {
  const systemConfig = await configurationService.getSystemConfig();
  const days = systemConfig.trashRetentionDays;

  if (!days || days <= 0) {
    console.warn(
      "[trash-cleanup] trash_retention_days not set or 0 — skipping.",
    );
    return;
  }

  const cutoff = dayjs().subtract(days, "day").toDate();

  // --- Purge trashed nodes ---
  const staleNodes = await Node.findAll({
    where: {
      is_deleted: true,
      updated_at: { [Op.lt]: cutoff },
    },
  });

  if (staleNodes.length > 0) {
    console.warn(
      `[trash-cleanup] Permanently deleting ${staleNodes.length} node(s) trashed more than ${days}d ago.`,
    );
    for (const node of staleNodes) {
      try {
        await node.destroy();
        console.warn(
          `[trash-cleanup] Node ${node.id} (${node.service_name || node.id}) permanently deleted.`,
        );
      } catch (err) {
        console.error(
          `[trash-cleanup] Failed to delete node ${node.id}:`,
          err?.message || err,
        );
      }
    }
  } else {
    console.warn("[trash-cleanup] No stale trashed nodes found.");
  }

  // --- Purge trashed projects ---
  const staleProjects = await Project.findAll({
    where: {
      is_deleted: true,
      updated_at: { [Op.lt]: cutoff },
    },
  });

  if (staleProjects.length > 0) {
    console.warn(
      `[trash-cleanup] Permanently deleting ${staleProjects.length} project(s) trashed more than ${days}d ago.`,
    );
    for (const project of staleProjects) {
      try {
        await project.destroy();
        console.warn(
          `[trash-cleanup] Project ${project.id} (${project.name || project.id}) permanently deleted.`,
        );
      } catch (err) {
        console.error(
          `[trash-cleanup] Failed to delete project ${project.id}:`,
          err?.message || err,
        );
      }
    }
  } else {
    console.warn("[trash-cleanup] No stale trashed projects found.");
  }
}

export function scheduleTrashCleanup() {
  if (process.env.DISABLE_TRASH_CLEANUP_CRON === "1") {
    console.warn(
      "⏭️ Trash cleanup cron disabled (DISABLE_TRASH_CLEANUP_CRON=1).",
    );
    return;
  }

  // Runs daily at 3:00 AM (1 hour after the stale-node sweep).
  const schedule = "0 3 * * *";
  console.warn(`[trash-cleanup] Cron scheduled: "${schedule}"`);
  cron.schedule(schedule, () => {
    runTrashCleanup().catch((err) => {
      console.error("[trash-cleanup] Scheduled run failed:", err);
    });
  });
}
