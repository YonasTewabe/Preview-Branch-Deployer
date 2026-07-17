import axios from "axios";
import configurationService from "./configurationService.js";
import { jenkinsAuth, jenkinsPostHeaders } from "./jenkinsClient.js";

function trimBase(url) {
  return String(url || "").replace(/\/+$/, "");
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

/**
 * Run the Jenkins delete-domain job to completion (same behavior as POST /api/jenkins/delete-preview-job).
 * @param {string} DOMAIN_NAME
 * @returns {Promise<{ success: boolean; message: string; [key: string]: unknown }>}
 */
export async function deletePreviewDomainViaJenkins(DOMAIN_NAME) {
  if (!DOMAIN_NAME) {
    return {
      success: false,
      message: "Missing required parameter: DOMAIN_NAME",
    };
  }

  const config = await configurationService.getJenkinsConfig();
  const jenkinsUrl = jenkinsBuildWithParamsUrl(
    config.baseUrl,
    config.jobDeleteDomain,
  );
  try {
    const response = await axios.post(
      `${jenkinsUrl}?DOMAIN_NAME=${DOMAIN_NAME}`,
      null,
      {
        auth: jenkinsAuth(config),
        headers: await jenkinsPostHeaders(config, {
          "Content-Type": "application/json",
        }),
        timeout: 30000,
      },
    );

    if (response.status !== 201 && response.status !== 200) {
      console.error(
        "Jenkins delete job trigger failed:",
        response.status,
        response.statusText,
      );
      return {
        success: false,
        message: `Failed to trigger Jenkins delete job: ${response.statusText}`,
        status: response.status,
      };
    }

    const queueUrl = response.headers.location;
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
    let artifactFilePath = null;
    let artifactData = null;

    while (!buildComplete) {
      const buildResponse = await axios.get(
        jenkinsBuildApiUrl(config.baseUrl, config.jobDeleteDomain, buildNumber),
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
          return {
            success: false,
            message: `Delete job failed with result: ${buildData.result}`,
            buildNumber: buildNumber,
            result: buildData.result,
          };
        }

        if (buildData.artifacts && buildData.artifacts.length > 0) {
          artifactFilePath = buildData.artifacts[0].relativePath;
        }
      } else {
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }

    if (artifactFilePath) {
      try {
        const domainOutput = await axios.get(
          jenkinsArtifactUrl(
            config.baseUrl,
            config.jobDeleteDomain,
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
          return {
            success: false,
            message: domainOutput.data.error,
            buildNumber: buildNumber,
            artifactPath: artifactFilePath,
          };
        }

        artifactData = domainOutput.data;
      } catch (artifactError) {
        console.warn(
          "⚠️ Warning: Failed to parse artifact output",
          artifactError?.message || artifactError,
        );
      }
    }

    return {
      success: true,
      message: "Domain deletion completed successfully",
      jobUrl: jenkinsUrl,
      buildNumber: buildNumber,
      result: "SUCCESS",
      artifactData: artifactData,
      artifactPath: artifactFilePath,
    };
  } catch (error) {
    console.error("Error triggering Jenkins delete job:", error);
    if (error.response) {
      return {
        success: false,
        message: `Jenkins delete job failed: ${error.response.status} - ${error.response.statusText}`,
        status: error.response.status,
      };
    }
    return {
      success: false,
      message: error.message || "Internal error while running Jenkins delete job",
    };
  }
}
