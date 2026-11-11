const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const errorHandler = require('./middlewares/errorHandler');

const app = express();
const PORT = process.env.PORT || 5000;

// Security & Utility Middlewares
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Zoop ColdRoute API Backend',
    version: '1.0.0',
    status: 'online'
  });
});

// Error Handling Middleware
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(`🚀 Zoop Backend running on port ${PORT}`);
  console.log(`=========================================`);
});

