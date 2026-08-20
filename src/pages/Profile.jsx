import { useEffect } from "react";
import { Card, Form, Input, Button, Tabs, Typography } from "antd";
import { useAuth } from "../contexts/AuthContext";
import { useChangePassword, useUpdateUser } from "../hooks/useUsers";

const { Title, Text } = Typography;

const Profile = () => {
  const { user, updateStoredUser } = useAuth();
  const [infoForm] = Form.useForm();
  const [passwordForm] = Form.useForm();
  const updateUserMutation = useUpdateUser();
  const changePasswordMutation = useChangePassword();

  useEffect(() => {
    if (!user) return;
    infoForm.setFieldsValue({
      username: user.username ?? "",
      email: user.email ?? "",
      name: user.name ?? "",
    });
  }, [user, infoForm]);

  const handleSaveInfo = (values) => {
    if (!user?.id) return;
    updateUserMutation.mutate(
      {
        id: user.id,
        username: values.username,
        email: values.email,
        name: values.name,
        role: user.role,
        status: user.status ?? "active",
      },
      {
        onSuccess: (updatedUser) => {
          updateStoredUser(updatedUser);
        },
      },
    );
  };

  const handleChangePassword = (values) => {
    if (!user?.id) return;
    changePasswordMutation.mutate(
      {
        userId: user.id,
        passwordData: {
          currentPassword: values.currentPassword,
          newPassword: values.newPassword,
        },
      },
      {
        onSuccess: () => {
          passwordForm.resetFields();
        },
      },
    );
  };

  const tabItems = [
    {
      key: "info",
      label: "Info",
      children: (
        <Form
          form={infoForm}
          layout="vertical"
          onFinish={handleSaveInfo}
          className="mt-2"
        >
          <Form.Item label="Username" name="username">
            <Input size="large" />
          </Form.Item>
          <Form.Item
            label="Email"
            name="email"
            rules={[
              { required: true, message: "Please enter your email" },
              { type: "email", message: "Please enter a valid email address" },
            ]}
          >
            <Input size="large" />
          </Form.Item>
          <Form.Item
            label="Name"
            name="name"
            rules={[{ required: true, message: "Please enter your name" }]}
          >
            <Input size="large" />
          </Form.Item>
          <Form.Item className="mb-0">
            <Button
              type="primary"
              htmlType="submit"
              loading={updateUserMutation.isPending}
            >
              Save changes
            </Button>
          </Form.Item>
        </Form>
      ),
    },
    {
      key: "password",
      label: "Password",
      children: (
        <Form
          form={passwordForm}
          layout="vertical"
          onFinish={handleChangePassword}
          className="mt-2"
        >
          <Form.Item
            label="Current password"
            name="currentPassword"
            rules={[{ required: true, message: "Please enter current password" }]}
          >
            <Input.Password size="large" />
          </Form.Item>
          <Form.Item
            label="New password"
            name="newPassword"
            rules={[
              { required: true, message: "Please enter a new password" },
              { min: 6, message: "Password must be at least 6 characters" },
            ]}
          >
            <Input.Password size="large" />
          </Form.Item>
          <Form.Item
            label="Confirm new password"
            name="confirmPassword"
            dependencies={["newPassword"]}
            rules={[
              { required: true, message: "Please confirm your new password" },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue("newPassword") === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error("Passwords do not match"));
                },
              }),
            ]}
          >
            <Input.Password size="large" />
          </Form.Item>
          <Form.Item className="mb-0">
            <Button
              type="primary"
              htmlType="submit"
              loading={changePasswordMutation.isPending}
            >
              Update password
            </Button>
          </Form.Item>
        </Form>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <Title level={2} className="app-page-title !mb-1">
          Profile
        </Title>
        <Text className="app-muted">
          Manage your account information and password.
        </Text>
      </div>
      <Card className="max-w-3xl">
        <Tabs defaultActiveKey="info" items={tabItems} />
      </Card>
    </div>
  );
};

export default Profile;
