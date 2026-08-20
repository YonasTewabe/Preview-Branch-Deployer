import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { Row, Col, Card, Tag, Typography } from "antd";
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  ProjectOutlined,
  AppstoreOutlined,
} from "@ant-design/icons";
import StatsCard from "../components/Dashboard/StatsCard";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../services/projectService";

const { Title, Text } = Typography;

function pickServices(payload) {
  if (!payload || typeof payload !== "object") return [];
  const list =
    payload.data ??
    payload.services ??
    payload.webServices ??
    payload.apiServices ??
    payload.backendServices ??
    payload.frontendServices ??
    [];
  return Array.isArray(list) ? list : [];
}

function normalizeBuildStatus(raw) {
  const value = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (!value) return null;
  if (["success", "successful", "passed", "completed"].includes(value)) {
    return "success";
  }
  if (["failed", "failure", "error", "errored"].includes(value)) {
    return "failed";
  }
  return null;
}

function countBuildOutcomes(items) {
  return items.reduce(
    (acc, item) => {
      const status =
        normalizeBuildStatus(item?.build_status) ??
        normalizeBuildStatus(item?.buildStatus) ??
        normalizeBuildStatus(item?.status) ??
        normalizeBuildStatus(item?.last_build_status) ??
        normalizeBuildStatus(item?.result);

      if (status === "success") acc.success += 1;
      if (status === "failed") acc.failed += 1;
      return acc;
    },
    { success: 0, failed: 0 },
  );
}

const Dashboard = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalProjects: 0,
    totalNodes: 0,
    successfulBuilds: 0,
    failedBuilds: 0,
  });
  const [recentBuilds, setRecentBuilds] = useState([]);

  const formatTimeAgo = (dateString) => {
    if (!dateString) return "Unknown";
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return "Unknown";
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    if (diffInSeconds < 60) return `${diffInSeconds} seconds ago`;
    if (diffInSeconds < 3600)
      return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400)
      return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    return `${Math.floor(diffInSeconds / 86400)} days ago`;
  };

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);

      const [statsRes, nodesRes, projectsRes] = await Promise.all([
        api.get("stats").catch(() => ({ data: null })),
        api.get("nodes/summary").catch(() => ({ data: { data: [] } })),
        api.get("projects").catch(() => ({ data: [] })),
      ]);

      const statsPayload =
        statsRes?.data && typeof statsRes.data === "object"
          ? statsRes.data
          : {};
      const services = pickServices(nodesRes.data).filter((s) => !s.is_deleted);
      const projectRows = Array.isArray(projectsRes?.data) ? projectsRes.data : [];
      const projectNameById = new Map(
        projectRows.map((p) => [String(p.id), p.name]).filter(([, n]) => !!n),
      );
      const allBuildItems = services;
      const computedOutcomes = countBuildOutcomes(allBuildItems);

      const payloadTotalProjects = Number(statsPayload.totalProjects) || 0;
      const payloadTotalNodes = Number(statsPayload.totalNodes) || 0;
      const payloadSuccessfulBuilds =
        Number(statsPayload.successfulBuilds) || 0;
      const payloadFailedBuilds = Number(statsPayload.failedBuilds) || 0;

      setStats({
        totalProjects: payloadTotalProjects,
        totalNodes: Math.max(payloadTotalNodes, allBuildItems.length),
        // Prefer backend stats when present, but never undercount what we can
        // prove from current service/node build statuses.
        successfulBuilds: Math.max(
          payloadSuccessfulBuilds,
          computedOutcomes.success,
        ),
        failedBuilds: Math.max(payloadFailedBuilds, computedOutcomes.failed),
      });

      const recentBuildsList = [];

      services.forEach((service, index) => {
        const buildDate =
          service.updated_at ||
          service.last_build_at ||
          service.created_at;
        const t = buildDate ? new Date(buildDate).getTime() : 0;
        recentBuildsList.push({
          key: `service-${service.id ?? index}`,
          nodeId: service.id,
          projectId: service.project_id ?? service.projectId,
          projectName:
            service.project?.name ||
            service.project_name ||
            service.projectName ||
            projectNameById.get(
              String(service.project_id ?? service.projectId ?? ""),
            ) ||
            "Unknown project",
          service:
            service.service_name || service.serviceName || "Unknown service",
          branch: service.branch_name || service.branchName || "main",
          
          timestamp: formatTimeAgo(buildDate),
          buildDate: t,
        });
      });

      recentBuildsList.sort((a, b) => b.buildDate - a.buildDate);
      setRecentBuilds(recentBuildsList.slice(0, 10));
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      setRecentBuilds([]);
      setStats({
        totalProjects: 0,
        totalNodes: 0,
        successfulBuilds: 0,
        failedBuilds: 0,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchDashboardData();
  }, [fetchDashboardData]);

  return (
    <div className="space-y-6" style={{ color: "var(--app-text)" }}>
      <div className="mb-6">
        <Title
          level={1}
          className="!mb-1 !text-3xl sm:!text-4xl !text-blue-900 dark:!text-blue-400"
        >
          Dashboard
        </Title>
        <Text
          className="mb-1 block text-base font-bold sm:text-lg"
          style={{ color: "var(--app-text)" }}
        >
          Welcome back, {user?.name}
        </Text>
      </div>

      <Row gutter={[24, 24]}>
        <Col xs={24} sm={12} lg={6}>
          <StatsCard
            title="Total Preview Nodes"
            value={stats.totalNodes}
            icon={<AppstoreOutlined />}
            color="blue"
            loading={loading}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatsCard
            title="Successful Builds"
            value={stats.successfulBuilds}
            icon={<CheckCircleOutlined />}
            color="green"
            loading={loading}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatsCard
            title="Failed Builds"
            value={stats.failedBuilds}
            icon={<CloseCircleOutlined />}
            color="red"
            loading={loading}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatsCard
            title="Total Projects"
            value={stats.totalProjects}
            icon={<ProjectOutlined />}
            color="blue"
            loading={loading}
          />
        </Col>
      </Row>

      <Row gutter={[24, 24]}>
        <Col xs={24}>
          <Card
            title={
              <span className="font-bold text-blue-900 dark:text-blue-400">
                Recent Builds
              </span>
            }
            className="shadow-sm"
            loading={loading}
          >
            {recentBuilds.length > 0 ? (
              <div className="space-y-3">
                {recentBuilds.map((build) => {
                  const canLink =
                    build.projectId != null &&
                    build.nodeId != null &&
                    String(build.projectId) !== "" &&
                    String(build.nodeId) !== "";
                  const detailPath = canLink
                    ? `/projects/${build.projectId}/nodes/${build.nodeId}`
                    : null;

                  const rowClass =
                    "block rounded-xl border p-3 transition-all hover:-translate-y-0.5 hover:shadow-md sm:p-4";
                  const rowInner = (
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <Text
                            strong
                            className="text-base text-black dark:text-white"
                          >
                            {build.service}
                          </Text>
                          <Tag color="blue" className="text-xs">
                            {build.branch}
                          </Tag>
                          <Tag color="red" className="text-xs">
                            {build.projectName}
                          </Tag>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-sm">
                          <Text type="secondary" className="text-xs">
                            {build.timestamp}
                          </Text>
                        </div>
                      </div>
                    </div>
                  );

                  return detailPath ? (
                    <Link
                      key={build.key}
                      to={detailPath}
                      className={`${rowClass} text-inherit no-underline hover:text-inherit focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900`}
                      style={{
                        borderColor: "var(--app-border)",
                        backgroundColor: "var(--app-surface)",
                      }}
                    >
                      {rowInner}
                    </Link>
                  ) : (
                    <div
                      key={build.key}
                      className={`${rowClass} cursor-default`}
                      style={{
                        borderColor: "var(--app-border)",
                        backgroundColor: "var(--app-surface)",
                      }}
                    >
                      {rowInner}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center">
                <Text type="secondary" className="text-base">
                  No build activity yet.
                </Text>
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
