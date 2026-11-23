const express = require('express');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const db = require(path.join(__dirname, 'db'));

const app = express();
const PORT = process.env.PORT || 3000;

// EJS Template Engine Setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- ROUTES ---

// Main Page: 2-column tank grid with search & filter
app.get('/', async (req, res) => {
  try {
    const filters = {
      search: req.query.search || '',
      texture: req.query.texture || 'all',
      render_mode: req.query.render_mode || 'all',
      flow_direction: req.query.flow_direction || 'all'
    };
    const tanks = await db.getAllTanks(filters);
    res.render('index', {
      title: 'FinnLab - 유체 시뮬레이션 실험실',
      tanks: tanks || [],
      filters
    });
  } catch (err) {
    console.error('Error loading main page:', err);
    res.status(500).render('index', {
      title: 'FinnLab - 유체 시뮬레이션 실험실',
      tanks: [],
      filters: { search: '', texture: 'all', render_mode: 'all', flow_direction: 'all' },
      error: '수조 목록을 불러오는 중 오류가 발생했습니다.'
    });
  }
});

// New Tank Page
app.get('/tank/new', (req, res) => {
  const defaultTank = {
    id: null,
    name: '새 실험 수조',
    density: 50,
    viscosity: 95,
    flow_direction: 'E',
    flow_speed: 50,
    render_mode: 'surface',
    fluid_color: '#00d2ff',
    fluid_texture: 'water',
    fin_size: 50,
    fin_shape: 'shark',
    fin_color: '#ffffff'
  };
  res.render('tank', {
    title: 'FinnLab - 새 수조 생성',
    isNew: true,
    tank: defaultTank
  });
});

// Existing Tank Page
app.get('/tank/:id', async (req, res) => {
  try {
    const tank = await db.getTankById(req.params.id);
    if (!tank) {
      return res.redirect('/');
    }
    res.render('tank', {
      title: `FinnLab - ${tank.name}`,
      isNew: false,
      tank
    });
  } catch (err) {
    console.error(`Error loading tank ${req.params.id}:`, err);
    res.redirect('/');
  }
});

// API: Create Tank
app.post('/api/tanks', async (req, res) => {
  try {
    const insertId = await db.createTank(req.body);
    res.status(201).json({
      success: true,
      id: insertId,
      message: '새 수조가 성공적으로 생성되었습니다.'
    });
  } catch (err) {
    console.error('Error creating tank:', err);
    res.status(500).json({ success: false, error: '수조 생성에 실패했습니다.' });
  }
});

// API: Update Tank
app.put('/api/tanks/:id', async (req, res) => {
  try {
    const updated = await db.updateTank(req.params.id, req.body);
    if (updated) {
      res.json({
        success: true,
        message: '수조 설정이 성공적으로 저장되었습니다.'
      });
    } else {
      res.status(404).json({ success: false, error: '해당 수조를 찾을 수 없습니다.' });
    }
  } catch (err) {
    console.error(`Error updating tank ${req.params.id}:`, err);
    res.status(500).json({ success: false, error: '수조 수정에 실패했습니다.' });
  }
});

// API: Delete Tank
app.delete('/api/tanks/:id', async (req, res) => {
  try {
    const deleted = await db.deleteTank(req.params.id);
    if (deleted) {
      res.json({ success: true, message: '수조가 삭제되었습니다.' });
    } else {
      res.status(404).json({ success: false, error: '해당 수조를 찾을 수 없습니다.' });
    }
  } catch (err) {
    console.error(`Error deleting tank ${req.params.id}:`, err);
    res.status(500).json({ success: false, error: '수조 삭제에 실패했습니다.' });
  }
});

// Form POST Fallback for Delete Tank
app.post('/tank/:id/delete', async (req, res) => {
  try {
    await db.deleteTank(req.params.id);
    res.redirect('/');
  } catch (err) {
    console.error(`Error deleting tank ${req.params.id}:`, err);
    res.redirect('/');
  }
});

// Start Server & Init DB
app.listen(PORT, async () => {
  console.log(`[FinnLab] Server listening on port ${PORT} (http://localhost:${PORT})`);
  await db.initDB();
});
