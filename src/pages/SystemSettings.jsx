import { useMemo } from "react";
import { Button, Card, Form, Input, Tabs, Typography, message } from "antd";
import { useMutation, useQuery } from "@tanstack/react-query";
import configurationService from "../services/configurationService";

const { Title, Text } = Typography;

function settingsToInitialValues(settings) {
  const values = {};
  for (const row of settings || []) {
    values[row.key] = row.value || "";
  }
  return values;
}

function mapFormToSettings(values, settingsMeta = {}) {
  return Object.entries(values)
    .filter(([key, value]) => {
      const row = settingsMeta[key];
      // Do not overwrite stored secrets with the display mask.
      if (row?.isSecret && value === "********") return false;
      return true;
    })
    .map(([key, value]) => ({
      key,
      value: value ?? "",
    }));
}

function SettingsTab({ title, description, fields, queryKey, load, save }) {
  const [form] = Form.useForm();

  const { data = [], isLoading } = useQuery({
    queryKey,
    queryFn: load,
  });

  const mutation = useMutation({
    mutationFn: save,
    onSuccess: () => {
      message.success(`Settings saved`);
    },
    onError: (error) => {
      message.error(
        error?.response?.data?.error ||
          error?.message ||
          "Failed to save settings",
      );
    },
  });

  const initialValues = useMemo(() => settingsToInitialValues(data), [data]);
  const settingsMeta = useMemo(() => {
    const map = {};
    for (const row of data || []) map[row.key] = row;
    return map;
  }, [data]);
  const loadedFields = fields;

  return (
    <Card className="border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-4">
        <Title level={4} className="!mb-1">
          {title}
        </Title>
        <Text type="secondary">{description}</Text>
      </div>

      <Form
        form={form}
        layout="vertical"
        initialValues={initialValues}
        onFinish={(values) =>
          mutation.mutate(mapFormToSettings(values, settingsMeta))
        }
        key={JSON.stringify(initialValues)}
      >
        {loadedFields.map((field) => (
          <Form.Item key={field.key} label={field.label} name={field.key}>
            {field.secret ? (
              <Input.Password placeholder={field.placeholder} />
            ) : (
              <Input placeholder={field.placeholder} />
            )}
          </Form.Item>
        ))}
        <Button
          type="primary"
          htmlType="submit"
          loading={mutation.isPending || isLoading}
        >
          Save {title}
        </Button>
      </Form>
    </Card>
  );
}

const jenkinsFields = [
  {
    key: "jenkins_base_url",
    label: "Jenkins Base URL",
    placeholder: "https://jenkins.example.com",
    secret: false,
  },
  {
    key: "jenkins_user",
    label: "Jenkins Username",
    placeholder: "service-user",
    secret: false,
  },
  {
    key: "jenkins_password",
    label: "Jenkins Password / API Token",
    placeholder: "Enter Jenkins password or API token",
    secret: true,
  },
  {
    key: "jenkins_job_preview",
    label: "Preview Job Name",
    placeholder: "preview-build-job",
    secret: false,
  },
  {
    key: "jenkins_job_delete_domain",
    label: "Delete Preview Job Name",
    placeholder: "delete-preview-domain-job",
    secret: false,
  },
];

const githubFields = [
  {
    key: "github_api_base",
    label: "GitHub API Base URL",
    placeholder: "https://api.github.com",
    secret: false,
  },
  {
    key: "github_org",
    label: "GitHub Organization / Owner",
    placeholder: "your-org-name",
    secret: false,
  },
  {
    key: "github_token",
    label: "GitHub Token",
    placeholder: "ghp_***",
    secret: true,
  },
];

const systemFields = [
  {
    key: "stale_preview_node_days",
    label: "Move preview node to trash after days",
    placeholder: "5",
    secret: false,
  },
  {
    key: "trash_retention_days",
    label: "Permanently delete nodes & projects from trash after days",
    placeholder: "Leave empty to never auto-delete",
    secret: false,
  },
];

const SystemSettings = () => {
  return (
    <div className="space-y-6 text-black dark:text-white">
      <div className="mb-2">
        <h2 className="mb-0 text-2xl sm:text-3xl font-bold text-blue-900 dark:text-blue-400">
          System settings
        </h2>
        <p className="font-bold text-gray-700 dark:text-gray-300">
          Manage your system configuration
        </p>
      </div>

      <Tabs
        defaultActiveKey="jenkins"
        tabBarGutter={8}
        items={[
          {
            key: "jenkins",
            label: "Jenkins",
            children: (
              <SettingsTab
                fields={jenkinsFields}
                queryKey={["systemSettings", "jenkins"]}
                load={configurationService.getJenkinsSettings}
                save={configurationService.saveJenkinsSettings}
              />
            ),
          },
          {
            key: "github",
            label: "GitHub",
            children: (
              <SettingsTab
                fields={githubFields}
                queryKey={["systemSettings", "github"]}
                load={configurationService.getGithubSettings}
                save={configurationService.saveGithubSettings}
              />
            ),
          },
          {
            key: "system-config",
            label: "System config",
            children: (
              <SettingsTab
                fields={systemFields}
                queryKey={["systemSettings", "system"]}
                load={configurationService.getSystemSettings}
                save={configurationService.saveSystemSettings}
              />
            ),
          },
        ]}
      />
    </div>
  );
};

export default SystemSettings;
