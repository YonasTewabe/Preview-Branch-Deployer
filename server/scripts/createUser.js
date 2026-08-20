import dotenv from "dotenv";
import { User } from "../models/index.js";
import { testConnection } from "../config/database.js";
import { initAssociations } from "../models/index.js";

dotenv.config();

const createUser = async () => {
  try {
    // Initialize associations
    initAssociations();

    // Test connection
    await testConnection();

    // Check if user already exists
    const existingUser = await User.findOne({
      where: { email: "your_email@example.com" },
    });

    if (existingUser) {
      console.warn("❌ User with email your_email@example.com already exists");
      process.exit(1);
    }

    // Create the user
    // The User model has hooks that will automatically hash the password
    const user = await User.create({
      username: "your_username",
      email: "your_email@example.com",
      name: "Your Name",
      password: "your_password", // Will be automatically hashed by the model hook
      role: "user", // Default role
      status: "active",
    });

    console.warn("✅ User created successfully!");
    console.warn("User details:");
    console.warn(`  ID: ${user.id}`);
    console.warn(`  Name: ${user.name}`);
    console.warn(`  Email: ${user.email}`);
    console.warn(`  Username: ${user.username}`);
    console.warn(`  Role: ${user.role}`);
    console.warn(`  Status: ${user.status}`);

    process.exit(0);
  } catch (error) {
    console.error("❌ Error creating user:", error);
    process.exit(1);
  }
};

createUser();
