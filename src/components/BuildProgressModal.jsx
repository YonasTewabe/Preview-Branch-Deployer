import React from "react";
import { Modal, Spin, Typography, Button, message } from "antd";
import { CheckCircleOutlined, CopyOutlined, LinkOutlined } from "@ant-design/icons";

const { Text } = Typography;

export default function BuildProgressModal({
  isVisible,
  buildProgress,
  onCancel,
  onSuccess,
  inProgressTitle = "Jenkins build progress",
  failedHeading = "Build failed",
  errorHeading = "Build error",
}) {
  const previewLink = buildProgress?.artifactData?.url ?? null;

  const handleOk = () => {
    if (buildProgress.stage === "completed") {
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
    if (buildProgress.stage === "completed") {
      return "Success";
    }
    return inProgressTitle;
  };

  const getFooterButtons = () => {
    if (buildProgress.stage === "completed") {
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
        {buildProgress.stage === "triggering" && (
          <div>
            <Spin size="large" />
            <div style={{ marginTop: 16 }}>
              <Text strong>{buildProgress.message}</Text>
              <br />
              <Text type="secondary">
                Please wait while Jenkins processes your deployment request…
              </Text>
              {buildProgress.buildNumber != null &&
                buildProgress.buildNumber !== "" && (
                  <div style={{ marginTop: 8 }}>
                    <Text type="secondary">
                      Build #{buildProgress.buildNumber}
                    </Text>
                  </div>
                )}
            </div>
          </div>
        )}

        {buildProgress.stage === "completed" && (
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
              {buildProgress.message}
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

        {buildProgress.stage === "failed" && (
          <div>
            <div
              style={{ fontSize: "48px", color: "#ff4d4f", marginBottom: "16px" }}
            >
              ❌
            </div>
            <Text strong style={{ color: "#ff4d4f", fontSize: "16px" }}>
              {failedHeading}
            </Text>
            <br />
            <Text type="secondary">{buildProgress.message}</Text>
            {buildProgress.buildNumber ? (
              <div style={{ marginTop: "8px" }}>
                <Text type="secondary">
                  Build #{buildProgress.buildNumber}
                </Text>
              </div>
            ) : null}
          </div>
        )}

        {buildProgress.stage === "error" && (
          <div>
            <div
              style={{ fontSize: "48px", color: "#ff4d4f", marginBottom: "16px" }}
            >
              ⚠️
            </div>
            <Text strong style={{ color: "#ff4d4f", fontSize: "16px" }}>
              {errorHeading}
            </Text>
            <br />
            <Text type="secondary">{buildProgress.message}</Text>
          </div>
        )}
      </div>
    </Modal>
  );
}
