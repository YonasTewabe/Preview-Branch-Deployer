"use strict";

/** @type {import("sequelize-cli").Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("users", {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
      },
      name: { type: Sequelize.STRING(200), allowNull: false },      email: { type: Sequelize.STRING(255), allowNull: false, unique: true },
      password: { type: Sequelize.STRING(255), allowNull: false },
      role: {
        type: Sequelize.ENUM("admin", "user", "manager"),
        allowNull: false,
        defaultValue: "user",
      },
      status: {
        type: Sequelize.ENUM("active", "inactive", "suspended"),
        allowNull: false,
        defaultValue: "active",
      },
      last_login: { type: Sequelize.DATE, allowNull: true },
      email_verified: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      email_verification_token: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      reset_password_token: { type: Sequelize.STRING(255), allowNull: true },
      reset_password_expires: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.createTable("projects", {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
      },
      name: { type: Sequelize.STRING(255), allowNull: false, unique: true },
      short_code: {
        type: Sequelize.STRING(20),
        allowNull: false,
        unique: true,
      },
      description: { type: Sequelize.TEXT, allowNull: true },
      repository_url: {
        type: Sequelize.STRING(500),
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM("active", "inactive", "archived"),
        allowNull: false,
        defaultValue: "active",
      },
      tag: {
        type: Sequelize.ENUM("frontend", "backend"),
        allowNull: false,
      },
      env_name: { type: Sequelize.STRING(255), allowNull: true },
      created_by: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "users", key: "id" },
        onDelete: "RESTRICT",
        onUpdate: "CASCADE",
      },
      is_deleted: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.createTable("project_env_profiles", {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
      },
      project_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "projects", key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      name: { type: Sequelize.STRING(255), allowNull: false },
      slug: { type: Sequelize.STRING(64), allowNull: false },
      is_default: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.createTable("nodes", {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
      },
      project_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "projects", key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      created_by: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "users", key: "id" },
        onDelete: "RESTRICT",
        onUpdate: "CASCADE",
      },
      parent_node_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "nodes", key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      role: {
        type: Sequelize.ENUM("frontend", "api_service", "api_branch"),
        allowNull: false,
      },
      service_name: { type: Sequelize.STRING(255), allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: true },
      type: {
        type: Sequelize.ENUM(
          "api",
          "service",
          "database",
          "cache",
          "queue",
          "storage",
        ),
        allowNull: true,
        defaultValue: "api",
      },
      repository_name: { type: Sequelize.STRING(255), allowNull: true },
      repo_url: { type: Sequelize.STRING(500), allowNull: true },
      branch_name: { type: Sequelize.STRING(100), allowNull: true },
      env_name: { type: Sequelize.STRING(100), allowNull: true },
      project_env_profile_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "project_env_profiles", key: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      port: { type: Sequelize.INTEGER, allowNull: true, unique: true },
      build_number: { type: Sequelize.INTEGER, allowNull: true },
      build_status: {
        type: Sequelize.ENUM(
          "pending",
          "building",
          "success",
          "failed",
          "cancelled",
        ),
        allowNull: true,
        defaultValue: "pending",
      },
      build_result: { type: Sequelize.STRING(100), allowNull: true },
      preview_link: { type: Sequelize.STRING(500), allowNull: true },
      domain_name: { type: Sequelize.STRING(500), allowNull: true },
      status: {
        type: Sequelize.ENUM("active", "inactive", "deleted"),
        allowNull: true,
        defaultValue: "active",
      },
      is_deleted: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      default_url: { type: Sequelize.STRING(500), allowNull: true },
      jenkins_job_url: { type: Sequelize.STRING(500), allowNull: true },
      environment: {
        type: Sequelize.ENUM("development", "staging", "production", "preview"),
        allowNull: true,
        defaultValue: "preview",
      },
      last_build_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.createTable("environments", {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
      },
      project_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "projects", key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      profile_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "project_env_profiles", key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      env_variable: { type: Sequelize.STRING(255), allowNull: false },
      env: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.createTable("node_env_vars", {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
      },
      node_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "nodes", key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      project_env_profile_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "project_env_profiles", key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      key: { type: Sequelize.STRING(255), allowNull: false },
      value: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.createTable("node_builds", {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
      },
      node_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "nodes", key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      build_number: { type: Sequelize.INTEGER, allowNull: false },
      jenkins_build_number: { type: Sequelize.INTEGER, allowNull: true },
      built_at: { type: Sequelize.DATE, allowNull: false },
      status: {
        type: Sequelize.STRING(32),
        allowNull: false,
        defaultValue: "success",
      },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.createTable("stats", {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
      },
      key_name: {
        type: Sequelize.STRING(64),
        allowNull: false,
        unique: true,
        defaultValue: "global",
      },
      total_projects: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      total_env_profiles: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      total_env_vars: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      total_nodes: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      active_builds: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      successful_builds: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      failed_builds: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.createTable("configuration", {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
      },
      key_name: { type: Sequelize.STRING(128), allowNull: false, unique: true },
      value_text: { type: Sequelize.TEXT, allowNull: true },
      category: {
        type: Sequelize.STRING(64),
        allowNull: false,
        defaultValue: "general",
      },
      is_secret: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.addIndex("users", ["email"], { unique: true });
    await queryInterface.addIndex("users", ["status"]);
    await queryInterface.addIndex("users", ["role"]);

    await queryInterface.addIndex("projects", ["name"]);
    await queryInterface.addIndex("projects", ["short_code"]);
    await queryInterface.addIndex("projects", ["status"]);
    await queryInterface.addIndex("projects", ["tag"]);
    await queryInterface.addIndex("projects", ["created_by"]);
    await queryInterface.addIndex("projects", ["is_deleted"]);

    await queryInterface.addIndex(
      "project_env_profiles",
      ["project_id", "slug"],
      {
        unique: true,
        name: "uniq_project_env_profile_slug",
      },
    );
    await queryInterface.addIndex("project_env_profiles", ["project_id"]);

    await queryInterface.addIndex("nodes", ["project_id"]);
    await queryInterface.addIndex("nodes", ["parent_node_id"]);
    await queryInterface.addIndex("nodes", ["role"]);
    await queryInterface.addIndex("nodes", ["is_deleted"]);
    await queryInterface.addIndex("nodes", ["service_name"]);
    await queryInterface.addIndex("nodes", ["project_env_profile_id"]);

    await queryInterface.addIndex("environments", ["env_variable"]);
    await queryInterface.addIndex("environments", ["project_id"]);
    await queryInterface.addIndex("environments", ["profile_id"]);
    await queryInterface.addIndex(
      "environments",
      ["profile_id", "env_variable"],
      {
        unique: true,
        name: "unique_profile_env_variable",
      },
    );

    await queryInterface.addIndex("node_env_vars", ["node_id"]);
    await queryInterface.addIndex("node_env_vars", ["project_env_profile_id"]);
    await queryInterface.addIndex(
      "node_env_vars",
      ["node_id", "project_env_profile_id", "key"],
      {
        unique: true,
        name: "uniq_node_env_vars_node_profile_key",
      },
    );

    await queryInterface.addIndex("node_builds", ["node_id"]);
    await queryInterface.addIndex("node_builds", ["built_at"]);

    await queryInterface.addIndex("stats", ["key_name"], {
      unique: true,
      name: "uniq_stats_key_name",
    });

    await queryInterface.addIndex("configuration", ["key_name"], {
      unique: true,
      name: "uniq_configuration_key_name",
    });
    await queryInterface.addIndex("configuration", ["category"], {
      name: "idx_configuration_category",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("configuration");
    await queryInterface.dropTable("stats");
    await queryInterface.dropTable("node_builds");
    await queryInterface.dropTable("node_env_vars");
    await queryInterface.dropTable("environments");
    await queryInterface.dropTable("nodes");
    await queryInterface.dropTable("project_env_profiles");
    await queryInterface.dropTable("projects");
    await queryInterface.dropTable("users");

    if (queryInterface.sequelize.options.dialect === 'postgres') {
      const enums = [
        'enum_users_role',
        'enum_users_status',
        'enum_projects_status',
        'enum_projects_tag',
        'enum_nodes_role',
        'enum_nodes_type',
        'enum_nodes_build_status',
        'enum_nodes_status',
        'enum_nodes_environment'
      ];
      for (const enumType of enums) {
        await queryInterface.sequelize.query(`DROP TYPE IF EXISTS "${enumType}";`);
      }
    }
  },
};
