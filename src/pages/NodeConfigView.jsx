"use client";
import { useState, useMemo, useEffect, useCallback } from "react";
import {
  Card,
  Typography,
  Layout,
  Space,
  Row,
  Col,
  Table,
  Button,
  Input,
  message,
  Popconfirm,
  Tag,
  Collapse,
  Select,
  Checkbox,
  Skeleton,
  Tooltip,
} from "antd";
import {
  EditOutlined,
  DeleteOutlined,
  ArrowLeftOutlined,
  RocketOutlined,
  ReloadOutlined,
  RightOutlined,
  CopyOutlined,
  HistoryOutlined,
  LinkOutlined,
} from "@ant-design/icons";
import { useNavigate, useParams } from "react-router-dom";
import dayjs from "dayjs";
import DeployProgressModal from "../components/DeployProgressModal";
import BuildProgressModal from "../components/BuildProgressModal";
import {
  useDeletePreviewNode,
  usePreviewNode,
  useUpdatePreviewNode,
} from "../services/usePreviewNodes";
import { jenkinsPreviewTag } from "../utils/projectServiceKind";
import { useAuth } from "../contexts/AuthContext";
import { useJenkins } from "../hooks/useJenkins";
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  jenkinsJobFolderUrl,
  JENKINS_JOB_PREVIEW,
  pickPreviewTriggerRequestBody,
} from "../config/jenkins";
import { deriveNodeDomainSlug } from "../utils/deriveNodeDomainSlug";
import { nodeHasCompletedBuild } from "../utils/nodeHasCompletedBuild";
import {
  invalidateAndRefetchActive,
  queryKeyPart,
} from "../utils/invalidateQueries";

const { Title, Text } = Typography;
const { Content } = Layout;
const { Panel } = Collapse;

function projectEnvVarsFetchUrl(projectId, profileId) {
  const base = `${import.meta.env.VITE_BACKEND_URL}projects/${projectId}/env-vars`;
  if (profileId != null && profileId !== "") {
    return `${base}?profileId=${encodeURIComponent(profileId)}`;
  }
  return base;
}

function previewNodeEnvVarsUrl(nodeId, profileId) {
  const path = `${import.meta.env.VITE_BACKEND_URL}nodes/${nodeId}/env-vars`;
  if (profileId == null || profileId === "") {
    return path;
  }
  return `${path}?profileId=${encodeURIComponent(profileId)}`;
}

function previewNodeEnvVarKeyUrl(nodeId, key, profileId) {
  const enc = encodeURIComponent(key);
  const base = `${import.meta.env.VITE_BACKEND_URL}nodes/${nodeId}/env-vars/${enc}`;
  if (profileId == null || profileId === "") {
    return base;
  }
  return `${base}?profileId=${encodeURIComponent(profileId)}`;
}

const NodeConfigSkeleton = () => {
  return (
    <>
      <div style={{ marginBottom: "16px" }}>
        <Skeleton.Button
          active
          size="default"
          style={{ width: 60, height: 32 }}
        />
      </div>
      <div
        style={{
          backgroundColor: "#ffffff",
          padding: "22px",
          borderBottom: "1px solid #e2e8f0",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <Skeleton.Input
            active
            size="large"
            style={{ width: 250, height: 32 }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Skeleton.Button
              active
              size="default"
              style={{ width: 100, height: 32 }}
            />
            <Skeleton.Button
              active
              size="default"
              style={{ width: 150, height: 32 }}
            />
            <Skeleton.Button
              active
              size="default"
              style={{ width: 120, height: 32 }}
            />
          </div>
        </div>
      </div>

      <Content
        style={{
          padding: 0,
          marginTop: "24px",
          width: "100%",
          maxWidth: "none",
        }}
      >
        {/* Node Information Skeleton */}
        <Card
          title={
            <Skeleton.Input
              active
              size="default"
              style={{ width: 150, height: 24 }}
            />
          }
          bordered={false}
          style={{
            marginBottom: "24px",
            borderRadius: 8,
            backgroundColor: "#ffffff",
            border: "1px solid #e2e8f0",
          }}
        >
          <Row gutter={[24, 16]}>
            {/* Left Column Skeleton */}
            <Col span={12}>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "16px",
                }}
              >
                <div>
                  <Skeleton.Input
                    active
                    size="small"
                    style={{ width: 100, height: 16, marginBottom: "8px" }}
                  />
                  <Skeleton.Input
                    active
                    size="default"
                    style={{ width: 150, height: 20 }}
                  />
                </div>
                <div>
                  <Skeleton.Input
                    active
                    size="small"
                    style={{ width: 100, height: 16, marginBottom: "8px" }}
                  />
                  <Skeleton.Button
                    active
                    size="small"
                    style={{ width: 80, height: 24 }}
                  />
                </div>
                <div>
                  <Skeleton.Input
                    active
                    size="small"
                    style={{ width: 100, height: 16, marginBottom: "8px" }}
                  />
                  <Skeleton.Button
                    active
                    size="small"
                    style={{ width: 100, height: 24 }}
                  />
                </div>
                <div>
                  <Skeleton.Input
                    active
                    size="small"
                    style={{ width: 100, height: 16, marginBottom: "8px" }}
                  />
                  <Skeleton.Button
                    active
                    size="small"
                    style={{ width: 90, height: 24 }}
                  />
                </div>
              </div>
            </Col>

            {/* Right Column Skeleton */}
            <Col span={12}>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                {[1, 2, 3, 4, 5].map((item) => (
                  <div key={item}>
                    <Skeleton.Input
                      active
                      size="small"
                      style={{ width: 120, height: 16, marginBottom: "4px" }}
                    />
                    <Skeleton.Input
                      active
                      size="default"
                      style={{ width: "100%", height: 32 }}
                    />
                  </div>
                ))}
              </div>
            </Col>
          </Row>
        </Card>

        {/* Build history skeleton */}
        <Card
          title={
            <Skeleton.Input
              active
              size="default"
              style={{ width: 200, height: 24 }}
            />
          }
          bordered={false}
          style={{
            flex: 1,
            borderRadius: 12,
            backgroundColor: "#ffffff",
            boxShadow:
              "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
            border: "1px solid #e2e8f0",
          }}
        >
          <Skeleton active paragraph={{ rows: 4 }} />
        </Card>
      </Content>
    </>
  );
};

function buildHistoryStatusTag(status) {
  const map = {
    success: { label: "Success", color: "success" },
    failed: { label: "Failed", color: "error" },
    cancelled: { label: "Cancelled", color: "default" },
    unstable: { label: "Unstable", color: "warning" },
  };
  if (status && map[status]) {
    const { label, color } = map[status];
    return <Tag color={color}>{label}</Tag>;
  }
  if (status) {
    return <Tag>{String(status)}</Tag>;
  }
  return <Tag>—</Tag>;
}

export default function NodeConfigView({
  routeProjectId,
  routeNodeId,
  project: projectFromRoute,
} = {}) {
  const params = useParams();
  const id = routeNodeId ?? params.nodeId ?? params.id;
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [isDeployModalVisible, setIsDeployModalVisible] = useState(false);
  const [deployProgress, setDeployProgress] = useState({
    stage: "",
    message: "",
    buildNumber: null,
  });
  const [deploymentDetails, setDeploymentDetails] = useState({
    previewLink: null,
    portNumber: null,
  });
  const navigate = useNavigate();
  const {
    data: selectedNode,
    isLoading: isLoadingNodeDetail,
    refetch: refetchPreviewNode,
  } = usePreviewNode(id, { enabled: Boolean(id) });

  /** Web + API preview services: same page, deploy, env, build history */
  const isPreviewServiceNode =
    selectedNode?.role === "frontend" || selectedNode?.role === "api_service";

  const deletePreviewNodeMutation = useDeletePreviewNode();
  const updatePreviewNodeMutation = useUpdatePreviewNode();

  // Add Jenkins hook for rebuild functionality
  const {
    isBuildModalVisible,
    buildProgress,
    triggerJenkinsFrontBuild,
    handleBuildModalCancel,
  } = useJenkins();

  const projectEnvPidRaw = routeProjectId ?? selectedNode?.project_id;
  const projectEnvPid =
    projectEnvPidRaw != null && projectEnvPidRaw !== ""
      ? queryKeyPart(projectEnvPidRaw)
      : null;

  const [nodeProfileId, setNodeProfileId] = useState(null);
  const [savingNodeProfile, setSavingNodeProfile] = useState(false);

  useEffect(() => {
    if (!selectedNode?.id || !isPreviewServiceNode) {
      setNodeProfileId(null);
      return;
    }
    const raw = selectedNode.project_env_profile_id;
    setNodeProfileId(raw != null && raw !== "" ? String(raw) : null);
  }, [
    selectedNode?.id,
    isPreviewServiceNode,
    selectedNode?.project_env_profile_id,
  ]);

  useEffect(() => {
    if (!selectedNode?.project_id || !routeProjectId) return;
    if (String(selectedNode.project_id) !== String(routeProjectId)) {
      navigate(
        `/projects/${selectedNode.project_id}/nodes/${selectedNode.id}`,
        { replace: true },
      );
    }
  }, [selectedNode, routeProjectId, navigate]);

  const invalidateNodeDetailQueries = () => {
    const nodeKey = queryKeyPart(id);
    void invalidateAndRefetchActive(
      queryClient,
      ...(nodeKey != null ? [["previewNode", nodeKey]] : []),
      ["previewNodesByProject"],
      ["previewServicesByProject"],
      ...(nodeKey != null ? [["nodeBuildHistory", nodeKey]] : []),
      ...(projectEnvPid
        ? [
            ["projectEnvVars", projectEnvPid],
            ["envVars", projectEnvPid],
            ["envProfiles", projectEnvPid],
          ]
        : []),
      ...(selectedNode?.id
        ? [["nodeEnvVars", queryKeyPart(selectedNode.id)]]
        : []),
    );
    refetchPreviewNode();
  };

  const { data: projectEnvVarsResp } = useQuery({
    queryKey: ["projectEnvVars", projectEnvPid, nodeProfileId ?? "default"],
    enabled: Boolean(projectEnvPid),
    queryFn: async () => {
      const res = await fetch(
        projectEnvVarsFetchUrl(projectEnvPid, nodeProfileId),
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        },
      );
      if (!res.ok) throw new Error(await res.text());
      return await res.json();
    },
  });

  const defaultEnvProfileId = useMemo(() => {
    const list = projectEnvVarsResp?.env_profiles;
    if (!Array.isArray(list)) return null;
    const d = list.find((p) => p.is_default);
    if (d?.id == null || d.id === "") return null;
    return String(d.id);
  }, [projectEnvVarsResp?.env_profiles]);

  const effectiveEnvProfileId = useCallback(
    (explicit) => {
      if (explicit != null && String(explicit).trim() !== "")
        return String(explicit);
      return defaultEnvProfileId;
    },
    [defaultEnvProfileId],
  );

  const nodeOverrideProfileId = useMemo(
    () => effectiveEnvProfileId(nodeProfileId),
    [nodeProfileId, effectiveEnvProfileId],
  );

  const { data: nodeEnvVarsResp } = useQuery({
    queryKey: [
      "nodeEnvVars",
      queryKeyPart(selectedNode?.id),
      nodeOverrideProfileId ?? "none",
    ],
    enabled:
      Boolean(selectedNode?.id) &&
      isPreviewServiceNode &&
      nodeOverrideProfileId != null,
    queryFn: async () => {
      const res = await fetch(
        previewNodeEnvVarsUrl(selectedNode?.id, nodeOverrideProfileId),
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        },
      );
      if (!res.ok) throw new Error(await res.text());
      return await res.json();
    },
  });

  const { data: buildHistoryResp } = useQuery({
    queryKey: ["nodeBuildHistory", queryKeyPart(id)],
    enabled: Boolean(id) && isPreviewServiceNode,
    queryFn: async () => {
      const res = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}nodes/${id}/build-history`,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        },
      );
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });

  const projectEnvVars = Array.isArray(projectEnvVarsResp?.env_vars)
    ? projectEnvVarsResp.env_vars
    : [];

  /** Keys overridable for the profile currently selected in the UI (base vars table). */
  const allOverrideKeyPool = useMemo(() => {
    const keys = (projectEnvVars ?? []).map((e) => e.key).filter(Boolean);
    return [...new Set(keys)];
  }, [projectEnvVars]);

  const nodeEnvVars = Array.isArray(nodeEnvVarsResp?.env_vars)
    ? nodeEnvVarsResp.env_vars
    : [];

  const projectEnvsReady = useMemo(() => {
    return Boolean(
      projectEnvVarsResp?.profile_id &&
      Array.isArray(projectEnvVarsResp?.env_vars) &&
      projectEnvVarsResp.env_vars.length > 0,
    );
  }, [projectEnvVarsResp]);

  const savedExplicitProfileId = useMemo(() => {
    const raw = selectedNode?.project_env_profile_id;
    if (raw == null || raw === "") return null;
    return String(raw);
  }, [selectedNode?.project_env_profile_id]);

  const profileSelectionDirty = useMemo(() => {
    if (!selectedNode?.id || !isPreviewServiceNode) return false;
    return (
      effectiveEnvProfileId(nodeProfileId) !==
      effectiveEnvProfileId(savedExplicitProfileId)
    );
  }, [
    selectedNode?.id,
    isPreviewServiceNode,
    nodeProfileId,
    savedExplicitProfileId,
    effectiveEnvProfileId,
  ]);

  /** Deploy/rebuild must use saved profile until user clicks Save. */
  const savedResolvedProfileIdForDeploy = useMemo(() => {
    return effectiveEnvProfileId(savedExplicitProfileId);
  }, [savedExplicitProfileId, effectiveEnvProfileId]);

  const envProfileSelectOptions = useMemo(() => {
    const list = projectEnvVarsResp?.env_profiles;
    if (!Array.isArray(list)) return [];
    return list.map((p) => ({
      value: p.id,
      label: p.is_default ? `${p.name} (default)` : p.name,
    }));
  }, [projectEnvVarsResp?.env_profiles]);

  const saveNodeProfileSelection = async () => {
    if (!selectedNode?.id || !profileSelectionDirty) return;
    const payloadId =
      nodeProfileId != null && String(nodeProfileId).trim() !== ""
        ? String(nodeProfileId)
        : (projectEnvVarsResp?.profile_id ?? defaultEnvProfileId);
    if (payloadId == null || String(payloadId).trim() === "") {
      message.error("Could not resolve profile to save.");
      return;
    }
    setSavingNodeProfile(true);
    try {
      await updatePreviewNodeMutation.mutateAsync({
        id: selectedNode.id,
        data: { project_env_profile_id: String(payloadId) },
      });
      const nodeKey = queryKeyPart(selectedNode.id ?? id);
      void invalidateAndRefetchActive(
        queryClient,
        ["projectEnvVars", projectEnvPid],
        ...(nodeKey != null
          ? [
              ["previewNode", nodeKey],
              ["nodeEnvVars", nodeKey],
            ]
          : []),
      );
    } catch {
      /* mutation onError shows details */
    } finally {
      setSavingNodeProfile(false);
    }
  };

  const warnProjectEnvsMissing = () => {
    message.warning("Set this project's environments before adding services.");
    const pid = routeProjectId ?? selectedNode?.project_id;
    if (pid) {
      navigate(`/projects/${pid}/environments`);
    }
  };

  const buildHistoryRows = useMemo(() => {
    const fromApi = Array.isArray(buildHistoryResp?.builds)
      ? buildHistoryResp.builds
      : [];
    return fromApi.map((row) => ({
      ...row,
      status: row.status ?? "success",
    }));
  }, [buildHistoryResp]);

  const [overrideKey, setOverrideKey] = useState("");
  const [overrideValue, setOverrideValue] = useState("");
  const [editingOverrideKey, setEditingOverrideKey] = useState(null);
  const [savingOverride, setSavingOverride] = useState(false);

  const overrideKeySelectOptions = useMemo(() => {
    const node = Array.isArray(nodeEnvVarsResp?.env_vars)
      ? nodeEnvVarsResp.env_vars
      : [];
    const pool = allOverrideKeyPool;
    const overridden = new Set(node.map((e) => e.key));
    if (editingOverrideKey) {
      const set = new Set(pool);
      set.add(editingOverrideKey);
      return Array.from(set).map((k) => ({ value: k, label: k }));
    }
    return pool
      .filter((k) => !overridden.has(k))
      .map((k) => ({ value: k, label: k }));
  }, [allOverrideKeyPool, nodeEnvVarsResp, editingOverrideKey]);

  const saveNodeOverride = async () => {
    const k = overrideKey.trim();
    const v = String(overrideValue ?? "").trim();
    if (!k) return message.error("Key is required");
    if (!v) return message.error("Value is required");
    const allowed = new Set(overrideKeySelectOptions.map((o) => o.value));
    if (!allowed.has(k)) return message.error("Choose a valid project env key");
    const profId = nodeOverrideProfileId;
    if (profId == null) {
      message.error("Select a profile before saving overrides.");
      return;
    }
    setSavingOverride(true);
    try {
      if (
        editingOverrideKey &&
        editingOverrideKey.toLowerCase() !== k.toLowerCase()
      ) {
        // rename: delete old then add new
        await fetch(
          previewNodeEnvVarKeyUrl(selectedNode?.id, editingOverrideKey, profId),
          { method: "DELETE", headers: { Authorization: `Bearer ${token}` } },
        );
        await fetch(previewNodeEnvVarsUrl(selectedNode?.id, profId), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ key: k, value: v, profileId: profId }),
        });
      } else if (editingOverrideKey) {
        await fetch(
          previewNodeEnvVarKeyUrl(selectedNode?.id, editingOverrideKey, profId),
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ value: v }),
          },
        );
      } else {
        await fetch(previewNodeEnvVarsUrl(selectedNode?.id, profId), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ key: k, value: v, profileId: profId }),
        });
      }
      const nodeKey = queryKeyPart(selectedNode?.id ?? id);
      await invalidateAndRefetchActive(
        queryClient,
        ...(nodeKey != null ? [["nodeEnvVars", nodeKey]] : []),
        ...(nodeKey != null ? [["previewNode", nodeKey]] : []),
        ["previewNodesByProject"],
        ["previewServicesByProject"],
      );
      setOverrideKey("");
      setOverrideValue("");
      setEditingOverrideKey(null);
      message.success("Saved");
    } catch {
      message.error("Failed to save override");
    } finally {
      setSavingOverride(false);
    }
  };

  const startEditOverride = (row) => {
    setEditingOverrideKey(row.key);
    setOverrideKey(row.key);
    setOverrideValue(row.value ?? "");
  };

  const deleteOverride = async (key) => {
    const profId = nodeOverrideProfileId;
    if (profId == null) {
      message.error("Select a profile first.");
      return;
    }
    setSavingOverride(true);
    try {
      await fetch(previewNodeEnvVarKeyUrl(selectedNode?.id, key, profId), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const nodeKey = queryKeyPart(selectedNode?.id ?? id);
      await invalidateAndRefetchActive(
        queryClient,
        ...(nodeKey != null ? [["nodeEnvVars", nodeKey]] : []),
        ...(nodeKey != null ? [["previewNode", nodeKey]] : []),
        ["previewNodesByProject"],
        ["previewServicesByProject"],
      );
      message.success("Deleted");
    } catch {
      message.error("Failed to delete override");
    } finally {
      setSavingOverride(false);
    }
  };

  const handleDeleteNode = async () => {
    const role = selectedNode?.role;
    if (role === "api_branch") {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_BACKEND_URL}nodes/${selectedNode.id}`,
          {
            method: "DELETE",
            headers: {
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
          },
        );
        if (!res.ok) throw new Error(await res.text());
        message.success("Branch deleted");
        const parentId = selectedNode.parent_node_id ?? selectedNode.node_id;
        const parentKey = queryKeyPart(parentId);
        await invalidateAndRefetchActive(
          queryClient,
          ["branches"],
          ...(parentKey != null ? [["branches", parentKey]] : []),
          ["previewServicesByProject"],
          ["previewNodesByProject"],
          ...(parentKey != null
            ? [
                ["previewNode", parentKey],
                ["previewServiceById", parentKey],
              ]
            : []),
        );
        if (parentId) {
          navigate(
            `/projects/${routeProjectId ?? selectedNode.project_id}/nodes/${parentId}`,
          );
        } else {
          navigate(`/projects/${routeProjectId ?? selectedNode.project_id}`);
        }
      } catch (error) {
        console.error("Error deleting branch:", error);
        message.error("Failed to delete branch");
      }
      return;
    }
    try {
      const node = selectedNode;
      if (!node?.id) {
        message.error("Node not found");
        return;
      }
      if (node.role !== "frontend" && node.role !== "api_service") {
        message.error("Delete is not available for this node type.");
        return;
      }
      const shouldRemoveFromJenkins =
        nodeHasCompletedBuild(node) && Boolean(node.domain_name);
      if (shouldRemoveFromJenkins) {
        try {
          const response = await fetch(
            `${import.meta.env.VITE_BACKEND_URL}jenkins/delete-preview-job`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                DOMAIN_NAME: node.domain_name,
              }),
            },
          );
          const result = await response.json();
          if (result.success) {
            message.success(
              `Domain "${node.domain_name}" removed from Jenkins`,
            );
          } else {
            message.warning(
              result.message || "Jenkins domain cleanup may have failed",
            );
          }
        } catch (jenkinsError) {
          console.error("Jenkins deletion error:", jenkinsError);
          message.warning(
            "Could not reach Jenkins to delete preview domain; removing node record.",
          );
        }
      }
      await deletePreviewNodeMutation.mutateAsync(node.id);
      navigate(`/projects/${routeProjectId ?? node.project_id}`);
    } catch (error) {
      console.error("Error deleting node:", error);
      message.error("Failed to delete node");
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    message.success("URL copied to clipboard");
  };

  const handleDeploy = async () => {
    if (!isPreviewServiceNode) {
      message.error("Deploy is not available for this node.");
      return;
    }
    if (!projectEnvsReady) {
      warnProjectEnvsMissing();
      return;
    }
    if (profileSelectionDirty) {
      message.warning("Save the profile for this node before deploying.");
      return;
    }
    try {
      setIsDeployModalVisible(true);
      setDeployProgress({
        stage: "deploying",
        message: "Deploying preview configuration...",
        buildNumber: null,
      });
      setDeploymentDetails({
        previewLink: null,
        portNumber: null,
      });

      // Fetch envs fresh (avoid empty arrays from not-yet-loaded queries)
      const [projRes, nodeRes] = await Promise.all([
        fetch(
          projectEnvVarsFetchUrl(
            selectedNode?.project_id,
            savedResolvedProfileIdForDeploy,
          ),
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          },
        ),
        fetch(
          previewNodeEnvVarsUrl(
            selectedNode?.id,
            savedResolvedProfileIdForDeploy,
          ),
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          },
        ),
      ]);

      const projJson = projRes.ok ? await projRes.json() : { env_vars: [] };
      const nodeJson = nodeRes.ok ? await nodeRes.json() : { env_vars: [] };

      const projectVars = Array.isArray(projJson?.env_vars)
        ? projJson.env_vars
        : [];
      const overrideVars = Array.isArray(nodeJson?.env_vars)
        ? nodeJson.env_vars
        : [];

      // Merge project env vars + node overrides (node overrides win)
      const mergedMap = new Map();
      projectVars.forEach((e) => mergedMap.set(e.key, e.value ?? ""));
      overrideVars.forEach((e) => mergedMap.set(e.key, e.value ?? ""));
      const envVars = Array.from(mergedMap.entries()).map(([key, value]) => ({
        key,
        value,
      }));

      // Domain name for first deploy; rebuilt nodes may already have domain_name
      const nodePortNum = Number(selectedNode?.port);
      const feSuffix =
        String(selectedNode?.project?.tag ?? "").toLowerCase() === "frontend"
          ? "-fe"
          : "";
      const fallbackNum = Number.isFinite(nodePortNum)
        ? nodePortNum
        : Math.floor(1000 + Math.random() * 9000);
      const scRaw = String(selectedNode?.project?.short_code ?? "")
        .trim()
        .toLowerCase();
      const domainName =
        selectedNode?.domain_name ||
        deriveNodeDomainSlug({
          shortCode: selectedNode?.project?.short_code,
          branchName: selectedNode?.branch_name,
          port: Number.isFinite(nodePortNum) ? nodePortNum : null,
          projectTag: selectedNode?.project?.tag,
        }) ||
        (scRaw ? `${scRaw}-${fallbackNum}${feSuffix}` : null);

      const deployParams = {
        TAG: jenkinsPreviewTag(
          selectedNode?.project?.tag ?? projectFromRoute?.tag,
        ),
        REPO_URL: selectedNode?.repo_url,
        BRANCH_NAME: selectedNode?.branch_name,
        DOMAIN_NAME: domainName,
        ENV_JSON: envVars.map(({ key, value }) => ({
          key: String(key),
          value: String(value ?? ""),
        })),
      };

      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}jenkins/trigger-preview-job`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(pickPreviewTriggerRequestBody(deployParams)),
        },
      );

      const result = await response.json();

      if (result.success) {
        setDeployProgress({
          stage: "completed",
          message: "Preview deployment completed successfully!",
          buildNumber: result.buildNumber,
        });

        // Update selectedNode with deployment results
        if (selectedNode && result.artifactData) {
          // Update deployment details for modal display
          setDeploymentDetails({
            previewLink: result.artifactData.url,
            portNumber: result.artifactData.port,
          });

          // Update the node in the main storage
          try {
            const nodeForStorage = {
              ...selectedNode,
              service_name: selectedNode?.service_name,
              repository_name: selectedNode?.repository_name,
              branch_name: selectedNode?.branch_name,
              build_status: result.buildStatus,
              port: result.artifactData?.port ?? selectedNode?.port,
              repo_url: selectedNode?.repo_url,
              build_number: result.buildNumber,
              preview_link: result.artifactData.url,
              env_name: selectedNode?.env_name,
              domain_name: deployParams.DOMAIN_NAME,
              project_id: selectedNode?.project_id,
            };
            await updatePreviewNodeMutation.mutateAsync({
              id: selectedNode.id,
              data: nodeForStorage,
            });
          } catch (error) {
            console.error("Error updating node in storage:", error);
          }
        }

        message.success("Preview deployed successfully!");
        invalidateNodeDetailQueries();
      } else {
        setDeployProgress({
          stage: "failed",
          message: `Deployment failed: ${result.message}`,
          buildNumber: result.buildNumber,
        });

        message.error(`Deployment failed: ${result.message}`);
        invalidateNodeDetailQueries();
      }
    } catch (error) {
      console.error("Deployment error:", error);
      setDeployProgress({
        stage: "error",
        message: error.message || "Deployment failed. Please try again.",
        buildNumber: null,
      });

      message.error("Deployment failed. Please try again.");
    }
  };

  const handleRebuild = async () => {
    try {
      if (!selectedNode) {
        message.error("No node selected for rebuild");
        return;
      }
      if (!isPreviewServiceNode) {
        message.error("Rebuild is not available for this node.");
        return;
      }
      if (!projectEnvsReady) {
        warnProjectEnvsMissing();
        return;
      }
      if (profileSelectionDirty) {
        message.warning("Save the profile for this node before rebuilding.");
        return;
      }

      // Update node status to pending
      await updatePreviewNodeMutation.mutateAsync({
        id: selectedNode.id,
        data: {
          build_status: "pending",
        },
      });

      // Fetch envs fresh (avoid empty arrays from not-yet-loaded queries)
      const [projRes, nodeRes] = await Promise.all([
        fetch(
          projectEnvVarsFetchUrl(
            selectedNode?.project_id,
            savedResolvedProfileIdForDeploy,
          ),
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          },
        ),
        fetch(
          previewNodeEnvVarsUrl(
            selectedNode?.id,
            savedResolvedProfileIdForDeploy,
          ),
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          },
        ),
      ]);

      const projJson = projRes.ok ? await projRes.json() : { env_vars: [] };
      const nodeJson = nodeRes.ok ? await nodeRes.json() : { env_vars: [] };

      const projectVars = Array.isArray(projJson?.env_vars)
        ? projJson.env_vars
        : [];
      const overrideVars = Array.isArray(nodeJson?.env_vars)
        ? nodeJson.env_vars
        : [];

      // Merge project env vars + node overrides (node overrides win)
      const mergedMap = new Map();
      projectVars.forEach((e) => mergedMap.set(e.key, e.value ?? ""));
      overrideVars.forEach((e) => mergedMap.set(e.key, e.value ?? ""));
      const envVars = Array.from(mergedMap.entries()).map(([key, value]) => ({
        key,
        value,
      }));

      const rebuildPortNum = Number(selectedNode?.port);
      const rebuildFeSuffix =
        String(selectedNode?.project?.tag ?? "").toLowerCase() === "frontend"
          ? "-fe"
          : "";
      const rebuildFallbackNum = Number.isFinite(rebuildPortNum)
        ? rebuildPortNum
        : Math.floor(1000 + Math.random() * 9000);
      const rebuildSc = String(selectedNode?.project?.short_code ?? "")
        .trim()
        .toLowerCase();
      const domainName =
        selectedNode?.domain_name ||
        deriveNodeDomainSlug({
          shortCode: selectedNode?.project?.short_code,
          branchName: selectedNode?.branch_name,
          port: Number.isFinite(rebuildPortNum) ? rebuildPortNum : null,
          projectTag: selectedNode?.project?.tag,
        }) ||
        (rebuildSc
          ? `${rebuildSc}-${rebuildFallbackNum}${rebuildFeSuffix}`
          : null);
      const rebuildParams = {
        TAG: jenkinsPreviewTag(
          selectedNode?.project?.tag ?? projectFromRoute?.tag,
        ),
        REPO_URL: selectedNode?.repo_url,
        BRANCH_NAME: selectedNode?.branch_name,
        DOMAIN_NAME: domainName,
        ENV_JSON: envVars.map(({ key, value }) => ({
          key: String(key),
          value: String(value ?? ""),
        })),
      };

      // Trigger Jenkins build with callbacks
      await triggerJenkinsFrontBuild(
        rebuildParams,
        // Success callback
        async (jenkinsData) => {
          try {
            // Update node with success data
            const updateData = {
              build_status: jenkinsData.result || "success",
              build_number: jenkinsData.buildNumber,
              preview_link: jenkinsData.artifactData?.url,
              port: jenkinsData.artifactData?.port ?? selectedNode?.port,
              jenkins_job_url:
                jenkinsData.jobUrl || jenkinsJobFolderUrl(JENKINS_JOB_PREVIEW),
            };

            await updatePreviewNodeMutation.mutateAsync({
              id: selectedNode.id,
              data: updateData,
            });

            invalidateNodeDetailQueries();
            message.success(`Rebuild completed successfully!`);
          } catch (updateError) {
            console.error(
              "Error updating node with success data:",
              updateError,
            );
            message.warning(
              "Rebuild completed but failed to update build status",
            );
          }
        },
        // Error callback
        async (error) => {
          try {
            console.error("Jenkins rebuild failed:", error);

            // Update node with failure data
            const updateData = {
              build_status: "failed",
              jenkins_job_url: jenkinsJobFolderUrl(JENKINS_JOB_PREVIEW),
            };

            await updatePreviewNodeMutation.mutateAsync({
              id: selectedNode.id,
              data: updateData,
            });

            message.error(`Rebuild failed`);
            invalidateNodeDetailQueries();
          } catch (updateError) {
            console.error(
              "Error updating node with failure data:",
              updateError,
            );
            message.warning("Rebuild failed but failed to update build status");
            invalidateNodeDetailQueries();
          }
        },
      );

      message.success(`Rebuild started for "${selectedNode.service_name}"`);
    } catch (error) {
      console.error("Error starting rebuild:", error);
      message.error("Failed to start rebuild. Please try again.");
    }
  };

  // Show skeleton while loading
  if (isLoadingNodeDetail) {
    return <NodeConfigSkeleton />;
  }
  if (!selectedNode) {
    return (
      <>
        <Button
          type="link"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate(`/projects/${routeProjectId ?? ""}`)}
        >
          Back
        </Button>
        <Card>Node not found.</Card>
      </>
    );
  }
  return (
    <>
      <div style={{ marginBottom: "16px" }}>
        <Button
          type="link"
          icon={<ArrowLeftOutlined />}
          onClick={() =>
            navigate(`/projects/${routeProjectId ?? selectedNode?.project_id}`)
          }
          className="!font-semibold !text-base sm:!text-lg"
          style={{ color: "var(--app-text)" }}
        >
          Back
        </Button>
      </div>
      <Card
        className="p-4 border-b"
        style={{
          backgroundColor: "var(--app-surface)",
          borderColor: "var(--app-border)",
        }}
      >
        <div
          data-node-header-actions=""
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <Title
            level={3}
            className="!mb-0 user-select-none font-semibold sm:!text-3xl"
          >
            Node Configuration
          </Title>

          <Space wrap>
            {isPreviewServiceNode &&
              (selectedNode?.preview_link == null ? (
                <Tooltip
                  title={
                    !projectEnvsReady
                      ? "Configure project environments first."
                      : undefined
                  }
                >
                  <span style={{ display: "inline-block" }}>
                    <Button
                      type="primary"
                      icon={<RocketOutlined />}
                      onClick={handleDeploy}
                      disabled={!projectEnvsReady}
                      style={{
                        backgroundColor: "#3b82f6",
                        borderColor: "#3b82f6",
                      }}
                    >
                      Deploy Node
                    </Button>
                  </span>
                </Tooltip>
              ) : (
                <Tooltip
                  title={
                    !projectEnvsReady
                      ? "Configure project environments first."
                      : undefined
                  }
                >
                  <span style={{ display: "inline-block" }}>
                    <Button
                      type="primary"
                      icon={<ReloadOutlined />}
                      onClick={handleRebuild}
                      disabled={!projectEnvsReady}
                      style={{
                        backgroundColor: "#3b82f6",
                        borderColor: "#3b82f6",
                      }}
                    >
                      Rebuild Node
                    </Button>
                  </span>
                </Tooltip>
              ))}
            <Popconfirm
              title={`Delete “${selectedNode?.service_name}” node?`}
              okText="Delete"
              cancelText="Cancel"
              okButtonProps={{ danger: true }}
              placement="bottomRight"
              getPopupContainer={(trigger) =>
                trigger.closest?.("[data-node-header-actions]") ??
                trigger.parentElement ??
                document.body
              }
              onConfirm={handleDeleteNode}
            >
              <span
                className="inline-block"
                onClick={(e) => e.stopPropagation()}
              >
                <Button
                  icon={<DeleteOutlined />}
                  danger
                  className="!text-white !bg-[#ef4444] "
                >
                  Delete Node
                </Button>
              </span>
            </Popconfirm>
          </Space>
        </div>
      </Card>

      <Content
        style={{
          padding: 0,
          marginTop: "24px",
          width: "100%",
          maxWidth: "none",
        }}
      >
        {/* Node Information Section */}
        {selectedNode && (
          <Card
            title="Service details"
            bordered={false}
            style={{
              marginBottom: "24px",
              borderRadius: 8,
              border: "1px solid #e2e8f0",
            }}
          >
            <Row gutter={[24, 16]}>
              {/* Left: name + branch */}
              <Col xs={24} md={12}>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "16px",
                  }}
                >
                  <div>
                    <Text
                      strong
                      style={{
                        fontSize: "12px",
                        color: "#64748b",
                        display: "block",
                        marginBottom: "4px",
                      }}
                    >
                      Node Name
                    </Text>
                    <Input
                      value={
                        selectedNode.service_name
                          ? String(selectedNode.service_name)
                          : "—"
                      }
                      readOnly
                      style={{
                        backgroundColor: "#f8fafc",
                        border: "1px solid #e2e8f0",
                        borderRadius: "6px",
                        fontSize: "12px",
                        color: "#64748b",
                      }}
                    />
                  </div>
                  <div>
                    <Text
                      strong
                      style={{
                        fontSize: "12px",
                        color: "#64748b",
                        display: "block",
                        marginBottom: "4px",
                      }}
                    >
                      Branch
                    </Text>
                    <Input
                      value={
                        selectedNode.branch_name ||
                        selectedNode.branches?.[0]?.name
                          ? String(
                              selectedNode.branch_name ||
                                selectedNode.branches?.[0]?.name,
                            )
                          : "—"
                      }
                      readOnly
                      style={{
                        backgroundColor: "#f8fafc",
                        border: "1px solid #e2e8f0",
                        borderRadius: "6px",
                        fontSize: "12px",
                        color: "#64748b",
                      }}
                    />
                  </div>
                </div>
              </Col>

              {/* Right: preview link + port */}
              <Col xs={24} md={12}>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                  }}
                >
                  <div>
                    <Text
                      strong
                      style={{
                        fontSize: "12px",
                        color: "#64748b",
                        display: "block",
                        marginBottom: "4px",
                      }}
                    >
                      Preview Link
                    </Text>
                    <Input.Group compact style={{ display: "flex" }}>
                      <Input
                        value={
                          selectedNode.preview_link
                            ? selectedNode.preview_link
                            : "—"
                        }
                        readOnly
                        style={{
                          backgroundColor: "#f8fafc",
                          border: "1px solid #e2e8f0",
                          borderRadius: "6px 0 0 6px",
                          fontSize: "12px",
                          color: "#64748b",
                          flex: 1,
                        }}
                      />
                      <Button
                        icon={<CopyOutlined />}
                        disabled={!selectedNode.preview_link}
                        onClick={() =>
                          selectedNode.preview_link &&
                          copyToClipboard(selectedNode.preview_link)
                        }
                        style={{
                          borderRadius: "0",
                          borderLeft: "none",
                          backgroundColor: "#f8fafc",
                          borderColor: "#e2e8f0",
                          color: "#64748b",
                        }}
                      >
                        Copy
                      </Button>
                      <Button
                        icon={<LinkOutlined />}
                        disabled={!selectedNode.preview_link}
                        href={selectedNode.preview_link ?? undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          borderRadius: "0 6px 6px 0",
                          borderLeft: "none",
                          backgroundColor: "#f8fafc",
                          borderColor: "#e2e8f0",
                          color: "#64748b",
                        }}
                      >
                        Go to
                      </Button>
                    </Input.Group>
                  </div>
                  <div>
                    <Text
                      strong
                      style={{
                        fontSize: "12px",
                        color: "#64748b",
                        display: "block",
                        marginBottom: "4px",
                      }}
                    >
                      Preview port
                    </Text>
                    <Input
                      value={
                        selectedNode.port != null &&
                        Number.isFinite(Number(selectedNode.port))
                          ? String(selectedNode.port)
                          : "—"
                      }
                      readOnly
                      style={{
                        backgroundColor: "#f8fafc",
                        border: "1px solid #e2e8f0",
                        borderRadius: "6px",
                        fontSize: "12px",
                        fontFamily: "monospace",
                        color: "#64748b",
                      }}
                    />
                  </div>
                </div>
              </Col>
            </Row>
          </Card>
        )}

        {isPreviewServiceNode ? (
          <>
            {/* Environment Variables Section */}
            <Card
              title="Environment variables"
              bordered={false}
              style={{
                marginBottom: "24px",
                borderRadius: 8,
                border: "1px solid #e2e8f0",
              }}
            >
              <div
                style={{
                  marginBottom: 20,
                  paddingBottom: 16,
                  borderBottom: "1px solid #e2e8f0",
                }}
              >
                <Text strong style={{ display: "block", marginBottom: 6 }}>
                  Profile for this node
                </Text>
                {envProfileSelectOptions.length > 0 ? (
                  <>
                    <Space wrap align="center">
                      <Select
                        size="large"
                        style={{ minWidth: 260 }}
                        value={
                          nodeProfileId ??
                          projectEnvVarsResp?.profile_id ??
                          undefined
                        }
                        options={envProfileSelectOptions}
                        placeholder="Choose profile to preview"
                        onChange={(v) => setNodeProfileId(v)}
                      />
                      <Button
                        type="primary"
                        loading={savingNodeProfile}
                        disabled={!profileSelectionDirty}
                        onClick={() => void saveNodeProfileSelection()}
                      >
                        Save profile
                      </Button>
                    </Space>
                    <Space wrap style={{ marginTop: 10 }}>
                      {profileSelectionDirty ? (
                        <Tag
                          color="warning"
                          style={{ marginInlineEnd: 0, borderRadius: "4px" }}
                        >
                          Unsaved — previewing{" "}
                          {projectEnvVarsResp?.profile?.name ?? "…"}
                        </Tag>
                      ) : null}
                    </Space>
                  </>
                ) : (
                  <Text type="secondary">
                    No profiles loaded — configure project environments first.
                  </Text>
                )}
              </div>

              <Row gutter={[24, 24]}>
                <Col xs={24} md={12} style={{ minWidth: 0 }}>
                  <Text strong style={{ display: "block", marginBottom: 12 }}>
                    Base values (selected profile)
                  </Text>
                  <Table
                    size="small"
                    tableLayout="fixed"
                    rowKey={(r) => r.key}
                    dataSource={projectEnvVars}
                    pagination={
                      projectEnvVars.length > 10 ? { pageSize: 10 } : false
                    }
                    columns={[
                      {
                        title: "Key",
                        dataIndex: "key",
                        key: "key",
                        width: "32%",
                        ellipsis: true,
                        render: (v) => (
                          <span style={{ fontFamily: "monospace" }}>{v}</span>
                        ),
                      },
                      {
                        title: "Value",
                        dataIndex: "value",
                        key: "value",
                        ellipsis: false,
                        render: (v) => (
                          <span
                            style={{
                              display: "block",
                              fontFamily: "monospace",
                              fontSize: 12,
                              whiteSpace: "pre-wrap",
                              overflowWrap: "anywhere",
                              wordBreak: "break-word",
                            }}
                          >
                            {String(v ?? "")}
                          </span>
                        ),
                      },
                    ]}
                    scroll={{ x: 680 }}
                  />
                </Col>

                <Col xs={24} md={12} style={{ minWidth: 0 }}>
                  <Text strong style={{ display: "block", marginBottom: 12 }}>
                    Node Overrides (only this node)
                  </Text>
                  <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-[1fr_2fr_auto]">
                    <Select
                      showSearch
                      optionFilterProp="label"
                      allowClear={!editingOverrideKey}
                      placeholder={
                        allOverrideKeyPool.length === 0
                          ? "Define keys on this or the default profile in Manage variables"
                          : editingOverrideKey
                            ? "Env key"
                            : "Key from this profile or default profile"
                      }
                      value={overrideKey || undefined}
                      onChange={(val) => setOverrideKey(val ?? "")}
                      options={overrideKeySelectOptions}
                      disabled={
                        !editingOverrideKey && allOverrideKeyPool.length === 0
                      }
                      style={{ width: "100%" }}
                    />
                    <Input.TextArea
                      value={overrideValue}
                      onChange={(e) => setOverrideValue(e.target.value)}
                      placeholder="value"
                      rows={1}
                      autoSize={{ minRows: 1, maxRows: 4 }}
                    />
                    <Space wrap>
                      {editingOverrideKey ? (
                        <Button
                          onClick={() => {
                            setEditingOverrideKey(null);
                            setOverrideKey("");
                            setOverrideValue("");
                          }}
                        >
                          Cancel
                        </Button>
                      ) : null}
                      <Button
                        type="primary"
                        loading={savingOverride}
                        onClick={saveNodeOverride}
                        disabled={
                          !editingOverrideKey &&
                          overrideKeySelectOptions.length === 0
                        }
                      >
                        {editingOverrideKey ? "Update" : "Add"}
                      </Button>
                    </Space>
                  </div>

                  <div style={{ marginTop: 16 }}>
                    <Table
                      size="small"
                      tableLayout="fixed"
                      rowKey={(r) => r.key}
                      dataSource={nodeEnvVars}
                      pagination={
                        nodeEnvVars.length > 10 ? { pageSize: 10 } : false
                      }
                      columns={[
                        {
                          title: "Key",
                          dataIndex: "key",
                          key: "key",
                          width: "28%",
                          ellipsis: true,
                          render: (v) => (
                            <span style={{ fontFamily: "monospace" }}>{v}</span>
                          ),
                        },
                        {
                          title: "Value",
                          dataIndex: "value",
                          key: "value",
                          ellipsis: false,
                          render: (v) => (
                            <span
                              style={{
                                display: "block",
                                fontFamily: "monospace",
                                fontSize: 12,
                                whiteSpace: "pre-wrap",
                                overflowWrap: "anywhere",
                                wordBreak: "break-word",
                              }}
                            >
                              {String(v ?? "")}
                            </span>
                          ),
                        },
                        {
                          title: "Action",
                          key: "action",
                          width: 110,
                          render: (_, record) => (
                            <Space size="small">
                              <Button
                                type="text"
                                icon={<EditOutlined />}
                                onClick={() => startEditOverride(record)}
                              />
                              <Popconfirm
                                title="Delete override?"
                                okText="Delete"
                                okType="danger"
                                cancelText="Cancel"
                                onConfirm={() => deleteOverride(record.key)}
                              >
                                <Button
                                  danger
                                  type="text"
                                  icon={<DeleteOutlined />}
                                />
                              </Popconfirm>
                            </Space>
                          ),
                        },
                      ]}
                      scroll={{ x: 680 }}
                    />
                  </div>
                  <div style={{ marginTop: 8, color: "#64748b", fontSize: 12 }}>
                    Overrides take precedence over project envs when
                    deploying/rebuilding.
                  </div>
                </Col>
              </Row>
            </Card>

            <Card
              title={
                <Space align="center">
                  <HistoryOutlined className="text-blue-600" />
                  <span>Build history</span>
                </Space>
              }
              bordered={false}
              style={{
                borderRadius: 12,
                boxShadow:
                  "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
                border: "1px solid #e2e8f0",
              }}
            >
              <Table
                size="small"
                rowKey={(r) =>
                  r.id ??
                  `${r.build_number}-${r.jenkins_build_number ?? ""}-${r.built_at}`
                }
                pagination={
                  buildHistoryRows.length > 15 ? { pageSize: 15 } : false
                }
                dataSource={buildHistoryRows}
                locale={{
                  emptyText: "No builds recorded yet.",
                }}
                columns={[
                  {
                    title: "Node build #",
                    dataIndex: "build_number",
                    key: "build_number",
                    width: 200,
                    render: (n, row) => (
                      <span>
                        <span style={{ fontFamily: "monospace" }}>{n}</span>
                        {row.jenkins_build_number != null && (
                          <Text
                            type="secondary"
                            style={{ marginLeft: 8, fontSize: 12 }}
                          >
                            (Jenkins {row.jenkins_build_number})
                          </Text>
                        )}
                      </span>
                    ),
                  },
                  {
                    title: "Status",
                    dataIndex: "status",
                    key: "status",
                    width: 120,
                    render: (s) => buildHistoryStatusTag(s ?? "success"),
                  },
                  {
                    title: "Build time",
                    dataIndex: "built_at",
                    key: "built_at",
                    render: (d) =>
                      d ? dayjs(d).format("YYYY-MM-DD HH:mm:ss") : "—",
                  },
                ]}
                scroll={{ x: 760 }}
              />
            </Card>
          </>
        ) : null}
      </Content>

      {/* Deploy Progress Modal */}
      <DeployProgressModal
        isVisible={isDeployModalVisible}
        deployProgress={deployProgress}
        previewLink={deploymentDetails?.previewLink}
        onCancel={() => {
          setIsDeployModalVisible(false);
          setDeployProgress({
            stage: "",
            message: "",
            buildNumber: null,
          });
          setDeploymentDetails({
            previewLink: null,
            portNumber: null,
          });
        }}
        onSuccess={() => {
          const isDelete = deployProgress.message?.includes("deleted") ?? false;
          setIsDeployModalVisible(false);
          setDeployProgress({
            stage: "",
            message: "",
            buildNumber: null,
          });
          setDeploymentDetails({
            previewLink: null,
            portNumber: null,
          });
          if (isDelete) {
            navigate("/");
          }
        }}
      />

      {/* Build progress modal — same UX as deploy (DeployProgressModal) */}
      <BuildProgressModal
        isVisible={isBuildModalVisible}
        buildProgress={buildProgress}
        onCancel={handleBuildModalCancel}
        onSuccess={handleBuildModalCancel}
        inProgressTitle="Deployment Progress"
        failedHeading="Deployment Failed"
        errorHeading="Deployment Error"
      />
    </>
  );
}
