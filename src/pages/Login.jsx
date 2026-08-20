import { useState, useEffect } from "react";
import { Form, Input, Button, Alert, Typography, Checkbox } from "antd";
import { FaCodeBranch } from "react-icons/fa6";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const { Title, Text } = Typography;

const Login = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated()) {
      navigate("/", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const onFinish = async (values) => {
    setLoading(true);
    setError("");

    try {
      const result = await login(values.email, values.password);

      if (result.success) {
        // Redirect to home page
        navigate("/", { replace: true });
      } else {
        setError(result.error);
      }
    } catch (error) {
      console.error("Login error:", error);
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const onFinishFailed = () => {};

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        {/* Login Card */}
        <div
          className="rounded-2xl border p-8 shadow-xl backdrop-blur-sm"
          style={{
            borderColor: "var(--app-border)",
            background:
              "color-mix(in srgb, var(--app-surface) 92%, transparent)",
          }}
        >
          {/* Logo/Brand */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-4">
              <div
                className="mr-3 flex size-11 shrink-0 items-center justify-center rounded-xl"
                style={{
                  background:
                    "color-mix(in srgb, var(--app-primary) 16%, transparent)",
                  border:
                    "1px solid color-mix(in srgb, var(--app-primary) 26%, transparent)",
                }}
              >
                <FaCodeBranch
                  style={{ fontSize: "22px", color: "var(--app-primary)" }}
                />
              </div>
              <Title
                level={3}
                className="!mb-0 font-bold"
                style={{ color: "var(--app-text)" }}
              >
                Preview Builder
              </Title>
            </div>
          </div>

          {error && (
            <Alert
              message={error}
              type="error"
              showIcon
              className="mb-6 rounded-lg"
              closable
              onClose={() => setError("")}
            />
          )}

          <Form
            name="login"
            onFinish={onFinish}
            onFinishFailed={onFinishFailed}
            layout="vertical"
            className="space-y-4"
          >
            <Form.Item
              label="Email"
              name="email"
              className="mb-4"
              rules={[
                {
                  required: true,
                  message: "Please input your email!",
                },
                {
                  type: "email",
                  message: "Please enter a valid email address",
                },
              ]}
            >
              <Input
                placeholder="Enter your email"
                className="h-12 rounded-lg"
                style={{ fontSize: "16px" }}
              />
            </Form.Item>

            <Form.Item
              label="Password"
              name="password"
              className="mb-4"
              rules={[
                { required: true, message: "Please input your password!" },
                {
                  min: 3,
                  message: "Password must be at least 3 characters long!",
                },
              ]}
            >
              <Input.Password
                placeholder="••••••••"
                className="h-12 rounded-lg"
                style={{ fontSize: "16px" }}
              />
            </Form.Item>

            <div className="flex items-center justify-between mb-6">
              <Form.Item
                name="remember"
                valuePropName="checked"
                className="!mb-0"
              >
                <Checkbox style={{ color: "var(--app-text)" }}>
                  Remember for 30 days
                </Checkbox>
              </Form.Item>

              <Button
                type="link"
                className="!h-auto !p-0 font-medium"
                style={{ color: "var(--app-primary)" }}
                onClick={() => navigate("/forgot-password")}
              >
                Forgot password
              </Button>
            </div>

            <Form.Item className="mb-4">
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                className="h-12 w-full rounded-lg border-none text-base font-semibold shadow-md transition-all duration-200 hover:shadow-lg"
              >
                {loading ? "Signing in..." : "Sign in"}
              </Button>
            </Form.Item>
          </Form>
        </div>
      </div>
    </div>
  );
};

export default Login;
