import React from "react";
import { Modal, Spin, Typography, Button, message } from "antd";
import { CheckCircleOutlined, CopyOutlined, LinkOutlined } from "@ant-design/icons";

const { Text } = Typography;

export default function DeployProgressModal({
  isVisible,
  deployProgress,
  onCancel,
  previewLink,
  onSuccess,
}) {
  const handleOk = () => {
    if (deployProgress.stage === "completed") {
      if (onSuccess) {
        onSuccess();
      } else {
        onCancel();
      }
    } else {
      onCancel();
    }
  };

  const getModalTitle = () => {
    if (deployProgress.stage === "deleting") {
      return "Delete Progress";
    }
    if (deployProgress.stage === "completed") {
      return "Success";
    }
    return "Deployment Progress";
  };

  const getFooterButtons = () => {
    if (deployProgress.stage === "completed") {
      return [
        <Button key="ok" type="primary" onClick={handleOk}>
          OK
        </Button>,
      ];
    }
    return [
      <Button key="close" onClick={onCancel}>
        Close
      </Button>,
    ];
  };

  const handleCopyPreview = () => {
    if (!previewLink) return;
    navigator.clipboard.writeText(previewLink);
    message.success("Preview link copied");
  };

  return (
    <Modal
      title={getModalTitle()}
      open={isVisible}
      onCancel={onCancel}
      footer={getFooterButtons()}
      closable
      width={480}
    >
      <div style={{ textAlign: "center", padding: "12px 0 8px" }}>
        {deployProgress.stage === "deploying" && (
          <div>
            <Spin size="large" />
            <div style={{ marginTop: 16 }}>
              <Text strong>{deployProgress.message}</Text>
              <br />
              <Text type="secondary">
                Please wait while Jenkins processes your deployment request…
              </Text>
            </div>
          </div>
        )}

        {deployProgress.stage === "deleting" && (
          <div>
            <Spin size="large" />
            <div style={{ marginTop: 16 }}>
              <Text strong>{deployProgress.message}</Text>
              <br />
              <Text type="secondary">
                Please wait while Jenkins processes your delete request…
              </Text>
            </div>
          </div>
        )}

        {deployProgress.stage === "completed" && (
          <div>
            <CheckCircleOutlined
              style={{
                fontSize: 52,
                color: "#52c41a",
                marginBottom: 16,
                display: "block",
              }}
            />
            <Text
              strong
              style={{
                color: "#52c41a",
                fontSize: 16,
                display: "block",
                marginBottom: previewLink ? 20 : 0,
              }}
            >
              {deployProgress.message}
            </Text>

            {previewLink ? (
              <div
                style={{
                  marginTop: 16,
                  maxWidth: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 12px",
                  background: "#fafafa",
                  borderRadius: 8,
                  border: "1px solid #f0f0f0",
                  textAlign: "left",
                }}
              >
                <Text
                  code
                  style={{
                    fontSize: 13,
                    wordBreak: "break-all",
                    flex: 1,
                    minWidth: 0,
                    margin: 0,
                    padding: "2px 0",
                    background: "transparent",
                    border: "none",
                  }}
                >
                  {previewLink}
                </Text>
                <Button
                  type="default"
                  icon={<CopyOutlined />}
                  onClick={handleCopyPreview}
                  style={{ flexShrink: 0 }}
                >
                  Copy link
                </Button>
                <Button
                  type="primary"
                  icon={<LinkOutlined />}
                  href={previewLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ flexShrink: 0 }}
                >
                  Go to
                </Button>
              </div>
            ) : null}
          </div>
        )}

        {deployProgress.stage === "failed" && (
          <div>
            <div
              style={{ fontSize: "48px", color: "#ff4d4f", marginBottom: "16px" }}
            >
              ❌
            </div>
            <Text strong style={{ color: "#ff4d4f", fontSize: "16px" }}>
              Deployment Failed
            </Text>
            <br />
            <Text type="secondary">{deployProgress.message}</Text>
            {deployProgress.buildNumber && (
              <div style={{ marginTop: "8px" }}>
                <Text type="secondary">
                  Build #{deployProgress.buildNumber}
                </Text>
              </div>
            )}
          </div>
        )}

        {deployProgress.stage === "error" && (
          <div>
            <div
              style={{ fontSize: "48px", color: "#ff4d4f", marginBottom: "16px" }}
            >
              ⚠️
            </div>
            <Text strong style={{ color: "#ff4d4f", fontSize: "16px" }}>
              Deployment Error
            </Text>
            <br />
            <Text type="secondary">{deployProgress.message}</Text>
          </div>
        )}
      </div>
    </Modal>
  );
}
