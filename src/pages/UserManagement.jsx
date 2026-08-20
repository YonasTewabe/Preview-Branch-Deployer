import { useState, useMemo, useEffect } from "react";
import { Table, Input, Button, Space, Tag, Popconfirm, Card } from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  UserOutlined,
} from "@ant-design/icons";
import UserFormModal from "../components/UserFormModal";
import {
  useUsers,
  useCreateUser,
  useUpdateUser,
  useDeleteUser,
} from "../hooks/useUsers";

const { Search } = Input;

function formatEnumLabel(value) {
  if (value == null || value === "") return "—";
  const s = String(value);
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function statusTagColor(status) {
  const k = String(status ?? "").toLowerCase();
  if (k === "active") return "success";
  if (k === "inactive") return "default";
  if (k === "suspended") return "warning";
  return "default";
}

const UserManagement = () => {
  const [modalVisible, setModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [searchText, setSearchText] = useState("");
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
  });

  // React Query hooks
  const { data: usersData, isLoading } = useUsers();

  const createUserMutation = useCreateUser();
  const updateUserMutation = useUpdateUser();
  const deleteUserMutation = useDeleteUser();

  const allUsers = Array.isArray(usersData) ? usersData : [];
  const filteredUsers = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return allUsers;
    return allUsers.filter((u) => {
      const name = (u.name ?? "").toLowerCase();
      return (
        name.includes(q) ||
        (u.email && String(u.email).toLowerCase().includes(q))
      );
    });
  }, [allUsers, searchText]);

  const total = filteredUsers.length;
  const tableRows = useMemo(() => {
    const start = (pagination.current - 1) * pagination.pageSize;
    return filteredUsers.slice(start, start + pagination.pageSize);
  }, [filteredUsers, pagination.current, pagination.pageSize]);

  const loading =
    isLoading ||
    createUserMutation.isPending ||
    updateUserMutation.isPending ||
    deleteUserMutation.isPending;

  useEffect(() => {
    const pages = Math.max(
      1,
      Math.ceil(filteredUsers.length / pagination.pageSize) || 1,
    );
    if (pagination.current > pages) {
      setPagination((p) => ({ ...p, current: pages }));
    }
  }, [filteredUsers.length, pagination.pageSize, pagination.current]);

  const applySearch = (value) => {
    setSearchText(value);
    setPagination((prev) => ({ ...prev, current: 1 }));
  };

  // Handle create new user
  const handleCreateUser = () => {
    setEditingUser(null);
    setModalVisible(true);
  };

  // Handle edit user
  const handleEditUser = (user) => {
    setEditingUser(user);
    setModalVisible(true);
  };

  // Handle delete user
  const handleDeleteUser = (userId) => {
    deleteUserMutation.mutate(userId);
  };

  // Handle form submission (create/update)
  const handleFormSubmit = (values) => {
    if (editingUser) {
      updateUserMutation.mutate(
        { id: editingUser.id, ...values },
        {
          onSuccess: () => {
            setModalVisible(false);
            setEditingUser(null);
          },
        },
      );
    } else {
      createUserMutation.mutate(values, {
        onSuccess: () => {
          setModalVisible(false);
          setEditingUser(null);
        },
      });
    }
  };

  // Handle pagination change
  const handleTableChange = (paginationInfo) => {
    setPagination({
      current: paginationInfo.current,
      pageSize: paginationInfo.pageSize,
    });
  };

  // Table columns configuration
  const columns = [
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
      sorter: (a, b) => (a.name ?? "").localeCompare(b.name ?? ""),
      render: (name) => (
        <div className="flex items-center">
          <UserOutlined className="mr-2 text-gray-400" />
          <span className="font-medium">{name}</span>
        </div>
      ),
    },
    {
      title: "Email",
      dataIndex: "email",
      key: "email",
      sorter: (a, b) => a.email.localeCompare(b.email),
      render: (email) => (
        <span className="text-blue-600 dark:text-blue-400">{email}</span>
      ),
    },
    {
      title: "Role",
      dataIndex: "role",
      key: "role",
      filters: [
        { text: "Admin", value: "admin" },
        { text: "User", value: "user" },
      ],
      onFilter: (value, record) =>
        String(record.role ?? "").toLowerCase() ===
        String(value).toLowerCase(),
      render: (role) => {
        const displayRole = role === 'admin' ? 'Admin' : 'User';
        const color = role === 'admin' ? 'volcano' : 'blue';
        return <Tag color={color}>{displayRole}</Tag>;
      },
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      filters: [
        { text: "Active", value: "active" },
        { text: "Inactive", value: "inactive" },
        { text: "Suspended", value: "suspended" },
      ],
      onFilter: (value, record) =>
        String(record.status ?? "").toLowerCase() ===
        String(value).toLowerCase(),
      render: (status) => (
        <Tag color={statusTagColor(status)}>{formatEnumLabel(status)}</Tag>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      width: 160,
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEditUser(record)}
            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
            size="small"
            title="Edit user"
          />
          <Popconfirm
            title="Delete User"
            description="Are you sure you want to delete this user?"
            onConfirm={() => handleDeleteUser(record.id)}
            okText="Yes"
            cancelText="No"
            okButtonProps={{ danger: true }}
          >
            <Button
              type="link"
              icon={<DeleteOutlined />}
              danger
              className="!text-red-600 dark:!text-red-400 hover:!text-red-800 dark:hover:!text-red-300"
              size="small"
              title="Delete user"
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="space-y-6 text-black dark:text-white">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="mb-0 text-2xl sm:text-3xl font-bold text-blue-900 dark:text-blue-400">
            User Management
          </h2>
          <p className="font-bold text-gray-700 dark:text-gray-300">
            Manage your application users
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto sm:justify-end">
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreateUser}
            size="large"
            className="!border-blue-600 !bg-blue-600 hover:!bg-blue-700"
            style={{ width: "100%", maxWidth: 220 }}
          >
            Create New User
          </Button>
        </div>
      </div>

      <Card className="mb-4 border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex w-full flex-1 gap-2 sm:w-auto">
            <Search
              placeholder="Search by name or email"
              allowClear
              size="large"
              className="flex-1 max-w-xl"
              value={searchText}
              onChange={(e) => applySearch(e.target.value)}
              onSearch={applySearch}
            />
          </div>
        </div>

        <Table
          className="mt-4 ant-table-responsive"
          columns={columns}
          dataSource={tableRows}
          rowKey="id"
          loading={loading}
          locale={{
            emptyText: "No users match your search.",
          }}
          onChange={handleTableChange}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (t, range) => `${range[0]}-${range[1]} of ${t} users`,
            className: "mt-4",
            pageSizeOptions: ["10", "20", "50", "100"],
          }}
          scroll={{ x: 800 }}
        />
      </Card>

      <UserFormModal
        visible={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setEditingUser(null);
        }}
        onSubmit={handleFormSubmit}
        initialValues={editingUser}
        loading={createUserMutation.isPending || updateUserMutation.isPending}
      />
    </div>
  );
};

export default UserManagement;
