const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const crypto = require('crypto');
require('dotenv').config({ path: './config.env' });

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Database connection configuration
let dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'talent'
};

// Create database connection pool
let pool;
let isPoolHealthy = false;

// Check if the current pool is healthy and can accept connections
async function isPoolReady() {
  if (!pool) return false;

  try {
    const connection = await pool.getConnection();
    connection.release();
    return true;
  } catch (error) {
    console.log('⚠️ Pool health check failed:', error.message);
    return false;
  }
}

async function initializeDatabase() {
  try {
    pool = mysql.createPool({
      ...dbConfig,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    // Test the connection
    const connection = await pool.getConnection();
    console.log('✅ Successfully connected to MySQL database');
    connection.release();
    isPoolHealthy = true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    isPoolHealthy = false;
    process.exit(1);
  }
}

// Function to update database configuration
async function updateDatabaseConfig(newConfig) {
  try {
    console.log('🔄 Updating database configuration...');
    console.log('📊 Old config:', dbConfig);
    console.log('📊 New config:', newConfig);

    // Check if current pool is healthy before proceeding
    if (pool && !(await isPoolReady())) {
      console.log('⚠️ Current pool is unhealthy, proceeding with replacement');
    }

    // Store the old pool reference
    const oldPool = pool;

    // Update configuration
    dbConfig = { ...dbConfig, ...newConfig };

    // Create new pool with updated config
    const newPool = mysql.createPool({
      ...dbConfig,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    // Test the new connection first
    const testConnection = await newPool.getConnection();
    console.log('✅ New connection test successful');
    testConnection.release();

    // If we get here, the new connection works, so we can safely close the old pool
    if (oldPool) {
      console.log('🔄 Closing old connection pool...');
      try {
        await oldPool.end();
        console.log('✅ Old connection pool closed successfully');
      } catch (closeError) {
        console.log('⚠️ Warning: Error closing old pool:', closeError.message);
        // Continue anyway as the new pool is working
      }
    }

    // Set the new pool as active and mark as healthy
    pool = newPool;
    isPoolHealthy = true;

    console.log('✅ Successfully updated and connected to MySQL database with new config');
    return { success: true, message: 'Database configuration updated successfully' };
  } catch (error) {
    console.error('❌ Failed to update database configuration:', error.message);

    // If the new connection failed, keep the old pool active
    if (pool) {
      console.log('🔄 Keeping old connection pool active due to new config failure');
      isPoolHealthy = false;
    }

    return { success: false, message: error.message };
  }
}

// Initialize database on startup
initializeDatabase();

// API Routes

// GET /api/profiles - Get all profiles
app.get('/api/profiles', async (req, res) => {
  try {
    // Check if pool is healthy before proceeding
    if (!(await isPoolReady())) {
      console.log('❌ Pool not ready, cannot fetch profiles');
      return res.status(500).json({ error: 'Database connection not ready' });
    }

    console.log('🔍 GET /api/profiles called');
    console.log('📊 Executing SQL query: SELECT * FROM user ORDER BY name');

    const [rows] = await pool.execute('SELECT * FROM user ORDER BY name');
    console.log('📊 Raw database rows:', rows);
    console.log('📊 Number of rows returned:', rows.length);

    // Parse JSON fields
    const profiles = rows.map(row => ({
      ...row,
      skills: JSON.parse(row.skills || '[]'),
      industries: JSON.parse(row.industries || '[]'),
      projects: row.projects ? JSON.parse(row.projects) : [],
      securityMeasures: row.securityMeasures ? JSON.parse(row.securityMeasures) : [],
      aiTools: row.aiTools ? JSON.parse(row.aiTools) : [],
      aiWorkflows: row.aiWorkflows ? JSON.parse(row.aiWorkflows) : [],
      // Map database fields to React app expected fields
      rates: {
        fullTime: row.fullTimeRate,
        partTime: row.partTimeRate
      },
      availability: {
        timezone: row.timezone,
        startHour: row.startHour,
        endHour: row.endHour,
        startDate: row.startDate,
        immediatelyAvailable: row.immediatelyAvailable
      },
      deviceAndSecurity: {
        device: row.device,
        securityMeasures: row.securityMeasures ? JSON.parse(row.securityMeasures) : []
      },
      aiEfficiency: {
        tools: row.aiTools ? JSON.parse(row.aiTools) : [],
        experienceLevel: row.aiExperienceLevel,
        workflows: row.aiWorkflows ? JSON.parse(row.aiWorkflows) : []
      }
    }));

    console.log('✅ Sending profiles response:', profiles.length, 'profiles');
    res.json(profiles);
  } catch (error) {
    console.error('❌ Error fetching profiles:', error);
    res.status(500).json({ error: 'Failed to fetch profiles' });
  }
});

// GET /api/profiles/:id - Get profile by ID
app.get('/api/profiles/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.execute('SELECT * FROM user WHERE id = ?', [id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const profile = rows[0];
    // Parse JSON fields and map to expected format (same as above)
    const mappedProfile = {
      ...profile,
      skills: JSON.parse(profile.skills || '[]'),
      industries: JSON.parse(profile.industries || '[]'),
      projects: profile.projects ? JSON.parse(profile.projects) : [],
      rates: {
        fullTime: profile.fullTimeRate,
        partTime: profile.partTimeRate
      },
      availability: {
        timezone: profile.timezone,
        startHour: profile.startHour,
        endHour: profile.endHour,
        startDate: profile.startDate,
        immediatelyAvailable: profile.immediatelyAvailable
      },
      deviceAndSecurity: {
        device: profile.device,
        securityMeasures: profile.securityMeasures ? JSON.parse(profile.securityMeasures) : []
      },
      aiEfficiency: {
        tools: profile.aiTools ? JSON.parse(profile.aiTools) : [],
        experienceLevel: profile.aiExperienceLevel,
        workflows: profile.aiWorkflows ? JSON.parse(profile.aiWorkflows) : []
      }
    };

    res.json(mappedProfile);
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

app.post('/api/profiles', async (req, res) => {
  try {
    console.log('🔍 POST /api/profiles called');

    const profile = req.body;

    // Generate profile ID if not provided
    const profileId = profile.id || crypto.randomUUID();

    // Set current timestamp for `created_at` and `updated_at`
    const currentTimestamp = new Date().toISOString();

    // Prepare values array with proper null handling
    const values = [
      profileId,  // 1. id
      profile.name || null,  // 2. name
      profile.title || null,  // 3. title
      profile.imageUrl || null,  // 4. imageUrl
      profile.yearsOfExperience || null,  // 5. yearsOfExperience
      profile.summary || null,  // 6. summary
      JSON.stringify(profile.skills || []),  // 7. skills
      JSON.stringify(profile.industries || []),  // 8. industries
      profile.valueAddition || null,  // 9. valueAddition
      JSON.stringify(profile.projects || []),  // 10. projects
      profile.videoUrl || null,  // 11. videoUrl
      profile.whyMavlers || null,  // 12. whyMavlers
      profile.availability?.timezone || null,  // 13. timezone
      profile.availability?.startHour || null,  // 14. startHour
      profile.availability?.endHour || null,  // 15. endHour
      profile.availability?.startDate || null,  // 16. startDate
      profile.availability?.immediatelyAvailable || false,  // 17. immediatelyAvailable
      profile.rates?.fullTime || null,  // 18. fullTimeRate
      profile.rates?.partTime || null,  // 19. partTimeRate
      profile.showRates !== false,  // 20. showRates
      profile.deviceAndSecurity?.device || null,  // 21. device
      JSON.stringify(profile.deviceAndSecurity?.securityMeasures || []),  // 22. securityMeasures
      JSON.stringify(profile.aiEfficiency?.tools || []),  // 23. aiTools
      profile.aiEfficiency?.experienceLevel || null,  // 24. aiExperienceLevel
      JSON.stringify(profile.aiEfficiency?.workflows || [])  // 25. aiWorkflows
    ];
    console.log(currentTimestamp);
    console.log(values);
    console.log(values.length);
    // Check if the values array length matches the SQL placeholders count (25 values)
    if (values.length !== 25) {
      console.log(`⚠️ Mismatch: Expected 25 values, but found ${values.length}.`);
      return res.status(400).json({ error: 'Column count and value count mismatch.' });
    }

    console.log('📝 SQL VALUES array:', values);
    console.log('🔢 Number of values:', values.length);

    // SQL query with 25 columns (matching MySQL table structure)
    const sqlQuery = `
       INSERT INTO user (
         id, name, title, imageUrl, yearsOfExperience, summary, 
         skills, industries, valueAddition, projects, videoUrl, whyMavlers,
         timezone, startHour, endHour, startDate, immediatelyAvailable,
         fullTimeRate, partTimeRate, showRates, device, 
         securityMeasures, aiTools, aiExperienceLevel, aiWorkflows
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     `;

    // Execute SQL query
    const [result] = await pool.execute(sqlQuery, values);

    console.log('✅ Profile created successfully');

    res.status(201).json({
      id: profileId,
      message: 'Profile created successfully'
    });

  } catch (error) {
    console.error('❌ Error creating profile:', error);

    res.status(500).json({
      error: 'Failed to create profile',
      details: error.message
    });
  }
});


// PUT /api/profiles/:id - Update profile
app.put('/api/profiles/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const profile = req.body;

    const [result] = await pool.execute(`
      UPDATE user SET 
        name = ?, title = ?, imageUrl = ?, yearsOfExperience = ?, 
        summary = ?, skills = ?, industries = ?, valueAddition = ?, 
        projects = ?, videoUrl = ?, whyMavlers = ?, timezone = ?, startHour = ?, 
        endHour = ?, startDate = ?, immediatelyAvailable = ?,
        fullTimeRate = ?, partTimeRate = ?, showRates = ?, device = ?,
        securityMeasures = ?, aiTools = ?, aiExperienceLevel = ?, aiWorkflows = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      profile.name,
      profile.title,
      profile.imageUrl,
      profile.yearsOfExperience,
      profile.summary,
      JSON.stringify(profile.skills || []),
      JSON.stringify(profile.industries || []),
      profile.valueAddition,
      JSON.stringify(profile.projects || []),
      profile.videoUrl,
      profile.whyMavlers || null,
      profile.availability?.timezone || null,
      profile.availability?.startHour || null,
      profile.availability?.endHour || null,
      profile.availability?.startDate || null,
      profile.availability?.immediatelyAvailable || false,
      profile.rates?.fullTime || null,
      profile.rates?.partTime || null,
      profile.showRates !== false,
      profile.deviceAndSecurity?.device || null,
      JSON.stringify(profile.deviceAndSecurity?.securityMeasures || []),
      JSON.stringify(profile.aiEfficiency?.tools || []),
      profile.aiEfficiency?.experienceLevel || null,
      JSON.stringify(profile.aiEfficiency?.workflows || []),
      id
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// DELETE /api/profiles/:id - Delete profile
app.delete('/api/profiles/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await pool.execute('DELETE FROM user WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json({ message: 'Profile deleted successfully' });
  } catch (error) {
    console.error('Error deleting profile:', error);
    res.status(500).json({ error: 'Failed to delete profile' });
  }
});

// ===== NEW APIs FOR USER MANAGEMENT AND AUTHENTICATION =====

// POST /api/auth/login - User login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Query admin_users table for authentication
    const [rows] = await pool.execute(
      'SELECT id, name, email, role, isActive FROM admin_users WHERE email = ? AND password = ? AND isActive = TRUE',
      [email, password]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials or account inactive' });
    }

    const user = rows[0];

    // Update last active timestamp
    await pool.execute(
      'UPDATE admin_users SET lastActive = CURRENT_TIMESTAMP WHERE id = ?',
      [user.id]
    );

    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// GET /api/admin/users - Get all admin users
app.get('/api/admin/users', async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT id, name, email, role, isActive, lastActive, createdAt 
      FROM admin_users 
      ORDER BY createdAt DESC
    `);

    res.json(rows);
  } catch (error) {
    console.error('Error fetching admin users:', error);
    res.status(500).json({ error: 'Failed to fetch admin users' });
  }
});

// POST /api/admin/users - Create new admin user
app.post('/api/admin/users', async (req, res) => {
  try {
    const { name, email, password, role, isActive } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'Name, email, password, and role are required' });
    }

    // Check if email already exists
    const [existingUsers] = await pool.execute(
      'SELECT id FROM admin_users WHERE email = ?',
      [email]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    const [result] = await pool.execute(`
      INSERT INTO admin_users (name, email, password, role, isActive) 
      VALUES (?, ?, ?, ?, ?)
    `, [name, email, password, role, isActive !== false]);

    res.status(201).json({
      success: true,
      message: 'Admin user created successfully',
      userId: result.insertId
    });
  } catch (error) {
    console.error('Error creating admin user:', error);
    res.status(500).json({ error: 'Failed to create admin user' });
  }
});

// PUT /api/admin/users/:id - Update admin user
app.put('/api/admin/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, role, isActive } = req.body;

    if (!name || !email || !role) {
      return res.status(400).json({ error: 'Name, email, and role are required' });
    }

    // Check if email already exists for other users
    const [existingUsers] = await pool.execute(
      'SELECT id FROM admin_users WHERE email = ? AND id != ?',
      [email, id]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    const [result] = await pool.execute(`
      UPDATE admin_users SET 
        name = ?, email = ?, role = ?, isActive = ?
      WHERE id = ?
    `, [name, email, role, isActive !== false, id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Admin user not found' });
    }

    res.json({ success: true, message: 'Admin user updated successfully' });
  } catch (error) {
    console.error('Error updating admin user:', error);
    res.status(500).json({ error: 'Failed to update admin user' });
  }
});

// PUT /api/admin/users/:id/password - Update admin user password
app.put('/api/admin/users/:id/password', async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    const [result] = await pool.execute(`
      UPDATE admin_users SET 
        password = ?
      WHERE id = ?
    `, [password, id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Admin user not found' });
    }

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    console.error('Error updating password:', error);
    res.status(500).json({ error: 'Failed to update password' });
  }
});

// DELETE /api/admin/users/:id - Delete admin user
app.delete('/api/admin/users/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await pool.execute('DELETE FROM admin_users WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Admin user not found' });
    }

    res.json({ success: true, message: 'Admin user deleted successfully' });
  } catch (error) {
    console.error('Error deleting admin user:', error);
    res.status(500).json({ error: 'Failed to delete admin user' });
  }
});

// GET /api/admin/analytics - Get analytics data
app.get('/api/admin/analytics', async (req, res) => {
  try {
    console.log('📊 Fetching analytics data...');

    // Get total profiles count
    let profileCount;
    try {
      [profileCount] = await pool.execute('SELECT COUNT(*) as total FROM user');
      console.log('📈 Total profiles:', profileCount[0].total);
    } catch (tableError) {
      console.log('⚠️ Table might not exist, using fallback data');
      profileCount = [{ total: 0 }];
    }

    // Get profiles by timezone
    let timezoneData = [];
    try {
      [timezoneData] = await pool.execute(`
        SELECT timezone, COUNT(*) as count 
        FROM user 
        WHERE timezone IS NOT NULL AND timezone != ''
        GROUP BY timezone 
        ORDER BY count DESC
      `);
      console.log('🌍 Timezone data:', timezoneData);
    } catch (e) {
      console.log('⚠️ Error fetching timezone data:', e.message);
    }

    // Get average rates
    let rateData = [{ avgFullTime: 0, avgPartTime: 0, minRate: 0, maxRate: 0 }];
    try {
      [rateData] = await pool.execute(`
        SELECT 
          AVG(fullTimeRate) as avgFullTime,
          AVG(partTimeRate) as avgPartTime,
          MIN(fullTimeRate) as minRate,
          MAX(fullTimeRate) as maxRate
        FROM user 
        WHERE fullTimeRate IS NOT NULL AND fullTimeRate > 0
      `);
      console.log('💰 Rate data:', rateData);
    } catch (e) {
      console.log('⚠️ Error fetching rate data:', e.message);
    }

    // Get skills distribution
    let skillsData = [];
    try {
      [skillsData] = await pool.execute(`
        SELECT skills 
        FROM user 
        WHERE skills IS NOT NULL AND skills != '[]' AND skills != ''
      `);
    } catch (e) {
      console.log('⚠️ Error fetching skills data:', e.message);
    }

    // Process skills data to count occurrences
    const skillsCount = {};
    skillsData.forEach(row => {
      try {
        const skills = JSON.parse(row.skills);
        if (Array.isArray(skills)) {
          skills.forEach(skill => {
            if (skill && skill.trim()) {
              skillsCount[skill.trim()] = (skillsCount[skill.trim()] || 0) + 1;
            }
          });
        }
      } catch (e) {
        // Skip invalid JSON
        console.log('Invalid skills JSON:', row.skills);
      }
    });

    // Get availability data
    let availabilityData = [{ totalAvailable: 0, immediatelyAvailable: 0 }];
    try {
      [availabilityData] = await pool.execute(`
        SELECT 
          COUNT(*) as totalAvailable,
          SUM(CASE WHEN immediatelyAvailable = TRUE THEN 1 ELSE 0 END) as immediatelyAvailable
        FROM user
      `);
    } catch (e) {
      console.log('⚠️ Error fetching availability data:', e.message);
    }

    // Get recent activity (profiles created in last 30 days)
    // Since we don't have created_at column, we'll use a fallback approach
    let recentProfiles = 0;
    try {
      const [recentActivity] = await pool.execute(`
        SELECT COUNT(*) as recentProfiles
        FROM user 
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      `);
      recentProfiles = recentActivity[0].recentProfiles || 0;
    } catch (e) {
      // If created_at column doesn't exist, just return 0 for recent profiles
      console.log('created_at column not available, using fallback');
      recentProfiles = 0;
    }

    // If no profiles exist, return empty analytics
    if (profileCount[0].total === 0) {
      const emptyResponse = {
        totalProfiles: 0,
        timezoneDistribution: [],
        rateAnalytics: {
          avgFullTime: 0,
          avgPartTime: 0,
          minRate: 0,
          maxRate: 0
        },
        topSkills: [],
        availability: {
          totalAvailable: 0,
          immediatelyAvailable: 0
        },
        recentActivity: {
          profilesLast30Days: 0
        }
      };

      console.log('✅ Empty analytics response:', emptyResponse);
      return res.json(emptyResponse);
    }

    const responseData = {
      totalProfiles: profileCount[0].total,
      timezoneDistribution: timezoneData,
      rateAnalytics: {
        avgFullTime: rateData[0].avgFullTime || 0,
        avgPartTime: rateData[0].avgPartTime || 0,
        minRate: rateData[0].minRate || 0,
        maxRate: rateData[0].maxRate || 0
      },
      topSkills: Object.entries(skillsCount)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([skill, count]) => ({ skill, count })),
      availability: {
        totalAvailable: availabilityData[0].totalAvailable || 0,
        immediatelyAvailable: availabilityData[0].immediatelyAvailable || 0
      },
      recentActivity: {
        profilesLast30Days: recentProfiles
      }
    };

    console.log('✅ Analytics response:', responseData);
    res.json(responseData);
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics data' });
  }
});

// GET /api/health - Health check
app.get('/api/health', async (req, res) => {
  try {
    if (await isPoolReady()) {
      res.json({ status: 'healthy', database: 'connected' });
    } else {
      res.status(500).json({ status: 'unhealthy', database: 'disconnected', error: 'Pool not ready' });
    }
  } catch (error) {
    res.status(500).json({ status: 'unhealthy', database: 'disconnected', error: error.message });
  }
});

// PUT /api/database/config - Update database configuration
app.put('/api/database/config', async (req, res) => {
  try {
    const { host, port, username, password, database } = req.body;

    // Validate required fields
    if (!host || !port || !username || !database) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: host, port, username, database'
      });
    }

    // Update database configuration
    const result = await updateDatabaseConfig({
      host,
      port: parseInt(port),
      user: username,
      password: password || '',
      database
    });

    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    console.error('Error updating database config:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update database configuration'
    });
  }
});

// GET /api/database/config - Get current database configuration
app.get('/api/database/config', (req, res) => {
  res.json({
    success: true,
    config: {
      host: dbConfig.host,
      port: dbConfig.port,
      username: dbConfig.user,
      database: dbConfig.database
      // Note: password is not returned for security
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Database: ${dbConfig.database} on ${dbConfig.host}:${dbConfig.port}`);
  console.log(`👤 User: ${dbConfig.user}`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down server...');
  if (pool) {
    await pool.end();
    console.log('✅ Database connections closed');
  }
  process.exit(0);
});
