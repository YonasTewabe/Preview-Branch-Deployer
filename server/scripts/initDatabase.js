import { testConnection, syncDatabase, User } from '../models/index.js';


const initializeDatabase = async () => {
  // Test connection
  await testConnection();
  
  // Sync database (create tables)
  await syncDatabase(false); // Set to true to force recreate tables
  
  // Create default users (admin and user)
  try {
    // Clean up any old duplicate admin user
    await User.destroy({ where: { email: 'admin@preview-builder.local' } });
    
    // Create admin user if not exists
    const existingAdmin = await User.findOne({ 
      where: { email: 'admin@example.com' }
    });
    
    if (!existingAdmin) {
      await User.create({
        email: 'admin@example.com',
        name: 'Admin',
        role: 'admin',
        status: 'active',
        password: '%TGBnhy6'
      });
      console.log('✅ Default admin user created successfully.');
    }

    // Create regular user if not exists
    const existingUser = await User.findOne({
      where: { email: 'user@example.com' }
    });

    if (!existingUser) {
      await User.create({
        email: 'user@example.com',
        name: 'User',
        role: 'user',
        status: 'active',
        password: '%TGBnhy6'
      });
      console.log('✅ Default regular user created successfully.');
    }
  } catch (error) {
    console.error('❌ Error creating default users:', error);
  }
  
  process.exit(0);
};

initializeDatabase().catch(error => {
  console.error('Database initialization failed:', error);
  process.exit(1);
});