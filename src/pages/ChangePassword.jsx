import { useState } from 'react';
import { Form, Input, Button, Card, Typography, Alert } from 'antd';
import { LockIcon, EyeIcon, EyeOffIcon } from 'lucide-react';
import { FaCodeBranch } from 'react-icons/fa6';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const { Title, Text } = Typography;

const ChangePassword = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { user, updateStoredUser, logout } = useAuth();
  const navigate = useNavigate();

  const onFinish = async (values) => {
    setLoading(true);
    setError('');

    try {
      await axios.post(`${import.meta.env.VITE_BACKEND_URL}auth/change-password`, {
        newPassword: values.newPassword,
        newPasswordConfirmation: values.newPasswordConfirmation,
      });

      // Clear the must_change_password flag in local state
      updateStoredUser({ ...user, must_change_password: false });

      navigate('/', { replace: true });
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to change password. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div
          className="rounded-2xl border p-8 shadow-xl backdrop-blur-sm"
          style={{
            borderColor: 'var(--app-border)',
            background: 'color-mix(in srgb, var(--app-surface) 92%, transparent)',
          }}
        >
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-4">
              <div
                className="mr-3 flex size-11 shrink-0 items-center justify-center rounded-xl"
                style={{
                  background: 'color-mix(in srgb, var(--app-primary) 16%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--app-primary) 26%, transparent)',
                }}
              >
                <FaCodeBranch style={{ fontSize: '22px', color: 'var(--app-primary)' }} />
              </div>
              <Title level={3} className="!mb-0 font-bold" style={{ color: 'var(--app-text)' }}>
                Preview Builder
              </Title>
            </div>
            <div className="mx-auto w-14 h-14 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mb-3">
              <LockIcon className="text-amber-600 dark:text-amber-400" size={24} />
            </div>
            <Title level={4} className="!mb-1" style={{ color: 'var(--app-text)' }}>
              Set Your Password
            </Title>
            <Text style={{ color: 'var(--app-text-secondary)' }}>
              Welcome{user?.name ? `, ${user.name}` : ''}! For security, please set a new password before continuing.
            </Text>
          </div>

          {error && (
            <Alert
              message={error}
              type="error"
              showIcon
              className="mb-6 rounded-lg"
              closable
              onClose={() => setError('')}
            />
          )}

          <Form name="change-password" onFinish={onFinish} layout="vertical" size="large">
            <Form.Item
              label="New Password"
              name="newPassword"
              rules={[
                { required: true, message: 'Please enter a new password!' },
                { min: 8, message: 'Password must be at least 8 characters!' },
                {
                  pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
                  message: 'Must include uppercase, lowercase, and a number.',
                },
              ]}
            >
              <Input.Password
                prefix={<LockIcon size={16} className="text-gray-400" />}
                placeholder="Enter new password"
                iconRender={(visible) => (visible ? <EyeIcon size={16} /> : <EyeOffIcon size={16} />)}
                className="h-12 rounded-lg"
                style={{ fontSize: '16px' }}
              />
            </Form.Item>

            <Form.Item
              label="Confirm New Password"
              name="newPasswordConfirmation"
              rules={[
                { required: true, message: 'Please confirm your new password!' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('newPassword') === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error('Passwords do not match!'));
                  },
                }),
              ]}
            >
              <Input.Password
                prefix={<LockIcon size={16} className="text-gray-400" />}
                placeholder="Confirm new password"
                iconRender={(visible) => (visible ? <EyeIcon size={16} /> : <EyeOffIcon size={16} />)}
                className="h-12 rounded-lg"
                style={{ fontSize: '16px' }}
              />
            </Form.Item>

            <Form.Item className="mb-2">
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                className="h-12 w-full rounded-lg border-none text-base font-semibold shadow-md"
              >
                {loading ? 'Saving...' : 'Set Password & Continue'}
              </Button>
            </Form.Item>

            <div className="text-center mt-3">
              <Button
                type="link"
                className="!h-auto !p-0 text-sm"
                style={{ color: 'var(--app-text-secondary)' }}
                onClick={() => logout()}
              >
                Sign out
              </Button>
            </div>
          </Form>
        </div>
      </div>
    </div>
  );
};

export default ChangePassword;
