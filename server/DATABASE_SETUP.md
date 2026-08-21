# Database Setup for Preview Builder

This project now supports PostgreSQL database for storing projects, users, backend nodes, and frontend nodes data.

## Prerequisites

1. **PostgreSQL Server**: Make sure you have PostgreSQL installed and running on your system
2. **Node.js Dependencies**: The required packages (`pg`, `pg-hstore`, `sequelize`) are already installed

## Database Configuration

1. **Create Database**: First, create a PostgreSQL database named `preview_builder` (using pgAdmin, psql, or another client):
   ```sql
   CREATE DATABASE preview_builder;
   ```

2. **Environment Variables**: Create a `.env` file in the `server` directory with your database configuration:
   ```env
   # Database Configuration
   DB_HOST=localhost
   DB_PORT=5432
   DB_USERNAME=postgres
   DB_PASSWORD=your_password_here
   DB_NAME=preview_builder

   # Application Configuration
   NODE_ENV=development
   PORT=4000
   ```

## Database Initialization

Run the following command to initialize the database tables:

```bash
cd server
npm run db:init
```

This will:
- Test the database connection
- Create all necessary tables with proper relationships
- Set up indexes for optimal performance

## Database Tables

### 1. Users Table
- `id` (Primary Key)
- `email` (Unique)
- `name`
- `role` (admin, developer, viewer)
- `status` (active, inactive)
- `must_change_password`
- `password`
- `created_at`, `updated_at`

### 2. Projects Table
- `id` (Primary Key)
- `name` (Unique)
- `description`
- `repository_url`
- `jenkins_job`
- `tag` (frontend, backend)
- `status` (active, inactive, archived)
- `version`
- `last_build_date`
- `created_by` (Foreign Key to users)
- `created_at`, `updated_at`

### 3. Backend Nodes Table
- `id` (Primary Key)
- `service_name`
- `repository_name`
- `branch_name`
- `jenkins_job`
- `build_status` (pending, building, success, failed, cancelled)
- `build_number`
- `build_url`
- `deployment_url`
- `port`
- `environment` (development, staging, production, preview)
- `last_build_date`
- `created_at_build`
- `project_id` (Foreign Key to projects)
- `created_by` (Foreign Key to users)
- `created_at`, `updated_at`

### 4. Frontend Nodes Table
- `id` (Primary Key)
- `service_name`
- `repository_name`
- `branch_name`
- `jenkins_job`
- `build_status` (pending, building, success, failed, cancelled)
- `build_number`
- `build_url`
- `deployment_url`
- `port`
- `framework` (React, Vue, Angular, etc.)
- `build_command`
- `dist_folder`
- `environment` (development, staging, production, preview)
- `last_build_date`
- `created_at_build`
- `project_id` (Foreign Key to projects)
- `created_by` (Foreign Key to users)
- `created_at`, `updated_at`

## API Endpoints

### Projects
- `GET /api/projects` - Get all projects
- `GET /api/projects/:id` - Get a specific project
- `POST /api/projects` - Create a new project
- `PUT /api/projects/:id` - Update a project
- `DELETE /api/projects/:id` - Delete a project

### Users
- `GET /api/users` - Get all users
- `GET /api/users/:id` - Get a specific user
- `POST /api/users` - Create a new user
- `PUT /api/users/:id` - Update a user
- `DELETE /api/users/:id` - Delete a user

### Backend Nodes
- `GET /api/backendnodes` - Get all backend nodes
- `GET /api/backendnodes/:id` - Get a specific backend node
- `POST /api/backendnodes` - Create backend nodes (supports batch creation)
- `PUT /api/backendnodes/:id` - Update a backend node
- `DELETE /api/backendnodes` - Clear all backend nodes
- `DELETE /api/backendnodes/:id` - Delete a specific backend node

### Frontend Nodes
- `GET /api/frontendnodes` - Get all frontend nodes
- `GET /api/frontendnodes/:id` - Get a specific frontend node
- `POST /api/frontendnodes` - Create frontend nodes (supports batch creation)
- `PUT /api/frontendnodes/:id` - Update a frontend node
- `DELETE /api/frontendnodes` - Clear all frontend nodes
- `DELETE /api/frontendnodes/:id` - Delete a specific frontend node

## Migration from JSON Files

The existing JSON-based routes (`/api/backendnodes`) will continue to work. To use the database-based routes, you can:

1. Use the new database routes directly
2. Replace the existing `backendnodes.js` route with `backendnodes-db.js` if you want to migrate completely

## Example Usage

### Creating a User
```javascript
POST /api/users
{
  "email": "john@example.com",
  "name": "John Doe",
  "role": "user"
}
```

### Creating a Project
```javascript
POST /api/projects
{
  "name": "my-awesome-project",
  "description": "A great project",
  "repository_url": "https://github.com/user/repo",
  "jenkins_job": "my-jenkins-job",
  "tag": "backend",
  "created_by": 1
}
```

### Creating Backend Nodes
```javascript
POST /api/backendnodes
{
  "backendServices": [
    {
      "service_name": "auth-service",
      "repository_name": "auth-backend",
      "branch_name": "feature/new-auth",
      "jenkins_job": "auth-build-job",
      "port": 3001,
      "project_id": 1,
      "created_by": 1
    }
  ]
}
```

## Starting the Server

After setting up the database, start the server:

```bash
npm run dev
```

The server will automatically test the database connection on startup.

## Troubleshooting

1. **Connection Error**: Make sure MySQL is running and credentials in `.env` are correct
2. **Table Creation Error**: Ensure the database exists and user has proper permissions
3. **Port Conflicts**: Check if the specified port is available

## Notes

- The database uses Sequelize ORM for better query management and relationships
- All tables include automatic timestamps (`created_at`, `updated_at`)
- Foreign key relationships are properly established between tables
- Indexes are created on frequently queried columns for better performance