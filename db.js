const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'finner',
  password: process.env.DB_PASSWORD || 'finner05',
  database: process.env.DB_NAME || 'finn',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

let pool = null;
let isConnected = false;

// Fallback in-memory storage for environments where MySQL is not running
let memoryTanks = [];
let nextMemoryId = 1;

/**
 * Initialize Database and Table
 */
async function initDB() {
  try {
    pool = mysql.createPool(dbConfig);
    const conn = await pool.getConnection();
    
    console.log(`[DB] Successfully connected to MySQL (${dbConfig.host}:${dbConfig.database})`);
    
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS tanks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL DEFAULT '실험 수조 #1',
        density FLOAT NOT NULL DEFAULT 50,
        viscosity FLOAT NOT NULL DEFAULT 95,
        flow_direction VARCHAR(20) NOT NULL DEFAULT 'E',
        flow_speed FLOAT NOT NULL DEFAULT 50,
        render_mode VARCHAR(20) NOT NULL DEFAULT 'surface',
        fluid_color VARCHAR(30) NOT NULL DEFAULT '#00d2ff',
        fluid_texture VARCHAR(30) NOT NULL DEFAULT 'water',
        fin_size FLOAT NOT NULL DEFAULT 50,
        fin_shape VARCHAR(30) NOT NULL DEFAULT 'shark',
        fin_color VARCHAR(30) NOT NULL DEFAULT '#ffffff',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `;
    
    await conn.query(createTableQuery);
    try {
      await conn.query("ALTER TABLE tanks ADD COLUMN flow_speed FLOAT NOT NULL DEFAULT 50");
    } catch (ignore) {
      // Column already exists
    }
    conn.release();
    isConnected = true;
    console.log('[DB] Table `tanks` verified / initialized successfully.');
  } catch (err) {
    console.warn(`[DB Warning] Could not connect to MySQL: ${err.message}`);
    console.warn('[DB Warning] Operating in resilient fallback mode (in-memory mock store enabled).');
    console.warn('[DB Note] When running in Ubuntu/production with MySQL active, all data will persist to MySQL automatically.');
    isConnected = false;
  }
}

/**
 * Get all tanks with optional filters
 */
async function getAllTanks(filters = {}) {
  const { search, texture, render_mode, flow_direction } = filters;

  if (isConnected && pool) {
    try {
      let query = 'SELECT * FROM tanks WHERE 1=1';
      const params = [];

      if (search && search.trim() !== '') {
        query += ' AND name LIKE ?';
        params.push(`%${search.trim()}%`);
      }
      if (texture && texture !== 'all') {
        query += ' AND fluid_texture = ?';
        params.push(texture);
      }
      if (render_mode && render_mode !== 'all') {
        query += ' AND render_mode = ?';
        params.push(render_mode);
      }
      if (flow_direction && flow_direction !== 'all') {
        query += ' AND flow_direction = ?';
        params.push(flow_direction);
      }

      query += ' ORDER BY id ASC';
      const [rows] = await pool.query(query, params);
      return rows;
    } catch (err) {
      console.error('[DB Error] getAllTanks query failed:', err.message);
    }
  }

  // Memory fallback
  return memoryTanks.filter(tank => {
    if (search && search.trim() !== '' && !tank.name.toLowerCase().includes(search.trim().toLowerCase())) {
      return false;
    }
    if (texture && texture !== 'all' && tank.fluid_texture !== texture) {
      return false;
    }
    if (render_mode && render_mode !== 'all' && tank.render_mode !== render_mode) {
      return false;
    }
    if (flow_direction && flow_direction !== 'all' && tank.flow_direction !== flow_direction) {
      return false;
    }
    return true;
  });
}

/**
 * Get single tank by ID
 */
async function getTankById(id) {
  const numId = parseInt(id, 10);
  if (isNaN(numId)) return null;

  if (isConnected && pool) {
    try {
      const [rows] = await pool.query('SELECT * FROM tanks WHERE id = ?', [numId]);
      return rows.length > 0 ? rows[0] : null;
    } catch (err) {
      console.error('[DB Error] getTankById failed:', err.message);
    }
  }

  // Memory fallback
  return memoryTanks.find(t => t.id === numId) || null;
}

/**
 * Create a new tank
 */
async function createTank(data) {
  const tankData = {
    name: data.name || '실험 수조 #1',
    density: parseFloat(data.density) || 50,
    viscosity: parseFloat(data.viscosity) || 95,
    flow_direction: data.flow_direction || 'E',
    flow_speed: data.flow_speed !== undefined ? parseFloat(data.flow_speed) : 50,
    render_mode: data.render_mode || 'surface',
    fluid_color: data.fluid_color || '#00d2ff',
    fluid_texture: data.fluid_texture || 'water',
    fin_size: parseFloat(data.fin_size) || 50,
    fin_shape: data.fin_shape || 'shark',
    fin_color: data.fin_color || '#ffffff'
  };

  if (isConnected && pool) {
    try {
      const query = `
        INSERT INTO tanks (
          name, density, viscosity, flow_direction, flow_speed,
          render_mode, fluid_color, fluid_texture,
          fin_size, fin_shape, fin_color
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const [result] = await pool.query(query, [
        tankData.name,
        tankData.density,
        tankData.viscosity,
        tankData.flow_direction,
        tankData.flow_speed,
        tankData.render_mode,
        tankData.fluid_color,
        tankData.fluid_texture,
        tankData.fin_size,
        tankData.fin_shape,
        tankData.fin_color
      ]);
      return result.insertId;
    } catch (err) {
      console.error('[DB Error] createTank failed:', err.message);
      throw err;
    }
  }

  // Memory fallback
  const newTank = {
    id: nextMemoryId++,
    ...tankData,
    created_at: new Date(),
    updated_at: new Date()
  };
  memoryTanks.push(newTank);
  return newTank.id;
}

/**
 * Update an existing tank
 */
async function updateTank(id, data) {
  const numId = parseInt(id, 10);
  if (isNaN(numId)) return false;

  const tankData = {
    name: data.name || '실험 수조 #1',
    density: parseFloat(data.density) || 50,
    viscosity: parseFloat(data.viscosity) || 95,
    flow_direction: data.flow_direction || 'E',
    flow_speed: data.flow_speed !== undefined ? parseFloat(data.flow_speed) : 50,
    render_mode: data.render_mode || 'surface',
    fluid_color: data.fluid_color || '#00d2ff',
    fluid_texture: data.fluid_texture || 'water',
    fin_size: parseFloat(data.fin_size) || 50,
    fin_shape: data.fin_shape || 'shark',
    fin_color: data.fin_color || '#ffffff'
  };

  if (isConnected && pool) {
    try {
      const query = `
        UPDATE tanks SET
          name = ?, density = ?, viscosity = ?, flow_direction = ?, flow_speed = ?,
          render_mode = ?, fluid_color = ?, fluid_texture = ?,
          fin_size = ?, fin_shape = ?, fin_color = ?
        WHERE id = ?
      `;
      const [result] = await pool.query(query, [
        tankData.name,
        tankData.density,
        tankData.viscosity,
        tankData.flow_direction,
        tankData.flow_speed,
        tankData.render_mode,
        tankData.fluid_color,
        tankData.fluid_texture,
        tankData.fin_size,
        tankData.fin_shape,
        tankData.fin_color,
        numId
      ]);
      return result.affectedRows > 0;
    } catch (err) {
      console.error('[DB Error] updateTank failed:', err.message);
      throw err;
    }
  }

  // Memory fallback
  const index = memoryTanks.findIndex(t => t.id === numId);
  if (index !== -1) {
    memoryTanks[index] = {
      ...memoryTanks[index],
      ...tankData,
      updated_at: new Date()
    };
    return true;
  }
  return false;
}

/**
 * Delete a tank
 */
async function deleteTank(id) {
  const numId = parseInt(id, 10);
  if (isNaN(numId)) return false;

  if (isConnected && pool) {
    try {
      const [result] = await pool.query('DELETE FROM tanks WHERE id = ?', [numId]);
      return result.affectedRows > 0;
    } catch (err) {
      console.error('[DB Error] deleteTank failed:', err.message);
      throw err;
    }
  }

  // Memory fallback
  const initialLength = memoryTanks.length;
  memoryTanks = memoryTanks.filter(t => t.id !== numId);
  return memoryTanks.length < initialLength;
}

module.exports = {
  pool,
  initDB,
  getAllTanks,
  getTankById,
  createTank,
  updateTank,
  deleteTank
};
