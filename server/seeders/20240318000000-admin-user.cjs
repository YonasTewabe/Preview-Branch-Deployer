'use strict';
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

module.exports = {
  async up(queryInterface, Sequelize) {
    // Clean up any old duplicate admin user
    await queryInterface.bulkDelete('users', {
      email: 'admin@preview-builder.local'
    }, {});

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('%TGBnhy6', salt);

    // Check if admin user already exists
    const [existingAdmin] = await queryInterface.sequelize.query(
      `SELECT id FROM users WHERE email = 'admin@example.com' LIMIT 1;`
    );

    if (!existingAdmin || existingAdmin.length === 0) {
      // Create admin user
      await queryInterface.bulkInsert('users', [{
        id: uuidv4(),
        name: 'Admin',
        email: 'admin@example.com',
        password: hashedPassword,
        role: 'admin',
        status: 'active',
        reset_password_token: null,
        reset_password_expires: null,
        created_at: new Date(),
        updated_at: new Date()
      }], {});
      console.log('✅ Seeded default admin user');
    }

    // Check if regular user already exists
    const [existingUser] = await queryInterface.sequelize.query(
      `SELECT id FROM users WHERE email = 'user@example.com' LIMIT 1;`
    );

    if (!existingUser || existingUser.length === 0) {
      // Create regular user
      await queryInterface.bulkInsert('users', [{
        id: uuidv4(),
        name: 'User',
        email: 'user@example.com',
        password: hashedPassword,
        role: 'user',
        status: 'active',
        reset_password_token: null,
        reset_password_expires: null,
        created_at: new Date(),
        updated_at: new Date()
      }], {});
      console.log('✅ Seeded default regular user');
    }
  },

  async down(queryInterface, Sequelize) {
    // Remove the seeded users
    await queryInterface.bulkDelete('users', {
      email: 'admin@example.com'
    }, {});
    await queryInterface.bulkDelete('users', {
      email: 'user@example.com'
    }, {});
  }
};

