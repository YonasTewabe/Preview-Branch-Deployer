import { useEffect } from 'react';
import { Modal, Form, Input, Row, Col, Select, Switch } from 'antd';
import { UserOutlined, MailOutlined } from '@ant-design/icons';

const UserFormModal = ({ 
  visible, 
  onCancel, 
  onSubmit, 
  initialValues, 
  loading 
}) => {
  const [form] = Form.useForm();

  useEffect(() => {
    if (visible) {
      if (initialValues) {
        form.setFieldsValue({
          ...initialValues,
          role: initialValues.role || 'user',
          status: String(initialValues.status ?? '').toLowerCase() === 'active',
        });
      } else {
        // Creating new user
        form.resetFields();
        form.setFieldsValue({
          role: 'user',
          status: true // Default to active
        });
      }
    }
  }, [visible, initialValues, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      // Convert status boolean back to string
      const formattedValues = {
        ...values,
        status: values.status ? 'active' : 'inactive',
      };
      onSubmit(formattedValues);
    } catch (error) {
      console.error('Form validation failed:', error);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onCancel();
  };

  return (
    <Modal
      title={
        <div className="flex items-center">
          <UserOutlined className="mr-2 text-blue-600" />
          <span className="text-lg font-semibold">
            {initialValues ? 'Edit User' : 'Create New User'}
          </span>
        </div>
      }
      open={visible}
      onOk={handleSubmit}
      onCancel={handleCancel}
      confirmLoading={loading}
      width={600}
      okText={initialValues ? 'Update User' : 'Create User'}
      cancelText="Cancel"
      className="user-form-modal"
      okButtonProps={{
        className: ' !rounded-lg'
      }}
    >
      <div className="py-4">
        <Form
          form={form}
          layout="vertical"
          requiredMark={false}
          className="space-y-4"
        >
          <Row gutter={16}>
            <Col span={24}>
              {/* <Form.Item
                name="username"
                label={
                  <span className="text-gray-700 font-medium">
                    Username
                  </span>
                }
                rules={[
                  { 
                    required: true, 
                    message: 'Please enter a username' 
                  },
                  { 
                    min: 3, 
                    message: 'Username must be at least 3 characters' 
                  },
                  {
                    pattern: /^[a-zA-Z0-9_.-]+$/,
                    message: 'Username can only contain letters, numbers, dots, hyphens, and underscores'
                  }
                ]}
              >
                <Input
                  prefix={<UserOutlined className="text-gray-400" />}
                  placeholder="Enter username"
                  size="large"
                  className="rounded-lg"
                />
              </Form.Item> */}
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={24}>
              <Form.Item
                name="name"
                label={
                  <span className="text-gray-700 font-medium">
                    Name
                  </span>
                }
                rules={[
                  { 
                    required: true, 
                    message: 'Please enter the name' 
                  },
                  { 
                    min: 2, 
                    message: 'Name must be at least 2 characters' 
                  },
                ]}
              >
                <Input
                  placeholder="Enter full name"
                  size="large"
                  className="rounded-lg"
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={24}>
              <Form.Item
                name="email"
                label={
                  <span className="text-gray-700 font-medium">
                    Email Address
                  </span>
                }
                rules={[
                  { 
                    required: true, 
                    message: 'Please enter the email address' 
                  },
                  { 
                    type: 'email', 
                    message: 'Please enter a valid email address' 
                  }
                ]}
              >
                <Input
                  prefix={<MailOutlined className="text-gray-400" />}
                  placeholder="Enter email address"
                  size="large"
                  className="!rounded-lg"
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="role"
                label={
                  <span className="text-gray-700 font-medium">
                    Role
                  </span>
                }
                rules={[
                  { 
                    required: true, 
                    message: 'Please select a role' 
                  }
                ]}
              >
                <Select size="large" className="rounded-lg">
                  <Select.Option value="user">User</Select.Option>
                  <Select.Option value="admin">Admin</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="status"
                label={
                  <span className="text-gray-700 font-medium">
                    Status
                  </span>
                }
                valuePropName="checked"
              >
                <Switch 
                  checkedChildren="Active" 
                  unCheckedChildren="Inactive"
                  size="large"
                />
              </Form.Item>
            </Col>
          </Row>

          {initialValues && (
            <div className="bg-gray-50 p-4 rounded-lg mt-6">
              <div className="text-sm text-gray-600">
                <div className="flex justify-between items-center">
                  <span>User ID:</span>
                  <span className="font-medium">#{initialValues.id}</span>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <span>Created:</span>
                  <span className="font-medium">
                    {new Date(initialValues.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          )}
        </Form>
      </div>
    </Modal>
  );
};

export default UserFormModal;