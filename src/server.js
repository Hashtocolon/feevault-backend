
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const errorHandler = require('./middlewares/errorHandler');

const authRoutes = require('./routes/authRoutes');
const masterRoutes = require('./routes/masterRoutes');
const customerRoutes = require('./routes/customerRoutes');
const cargoRoutes = require('./routes/cargoRoutes');
const complianceRoutes = require('./routes/complianceRoutes');
const dispatchRoutes = require('./routes/dispatchRoutes');
const quoteRoutes = require('./routes/quoteRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const tripRoutes = require('./routes/tripRoutes');


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

// Mount Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/master', masterRoutes);
app.use('/api/v1/customer', customerRoutes);
app.use('/api/v1/cargo', cargoRoutes);
app.use('/api/v1/compliance', complianceRoutes);


app.use('/api/v1', quoteRoutes);
app.use('/api/v1', bookingRoutes);

// Screen 11 - Your APIs
app.use('/api/v1/bookings', dispatchRoutes);
app.use('/api/v1/trips', tripRoutes);
// Error Handling Middleware
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log('=========================================');
  console.log('🚀 Zoop Backend running on port ' + PORT);
  console.log('=========================================');
});
