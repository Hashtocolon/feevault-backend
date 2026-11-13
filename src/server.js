const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const errorHandler = require('./middlewares/errorHandler');

// Auth & Shared Routes
const authRoutes = require('./routes/authRoutes');

// Bhanu Priya's Routes
const masterRoutes = require('./routes/masterRoutes');
const customerRoutes = require('./routes/customerRoutes');
const cargoRoutes = require('./routes/cargoRoutes');
const complianceRoutes = require('./routes/complianceRoutes');
const dispatchRoutes = require('./routes/dispatchRoutes');
const tripRoutes = require('./routes/tripRoutes');

// Dhanush's Routes
const profileRoutes = require('./routes/profileRoutes');
const consentRoutes = require('./routes/consentRoutes');
const creditRoutes = require('./routes/creditRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const consigneeRoutes = require('./routes/consigneeRoutes');
const shareLinkRoutes = require('./routes/shareLinkRoutes');
const quoteRoutes = require('./routes/quoteRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const failedDeliveryRoutes = require('./routes/failedDeliveryRoutes');

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

// Mount Routes (Integrated from both Dev Team branches)
app.use('/api/v1/auth', authRoutes);

// Bhanu Priya's modules
app.use('/api/v1/master', masterRoutes);
app.use('/api/v1/customer', customerRoutes);
app.use('/api/v1/cargo', cargoRoutes);
app.use('/api/v1/compliance', complianceRoutes);
app.use('/api/v1/bookings', dispatchRoutes);
app.use('/api/v1/trips', tripRoutes);

// Dhanush's modules
app.use('/api/v1', profileRoutes);
app.use('/api/v1', consentRoutes);
app.use('/api/v1', creditRoutes);
app.use('/api/v1', dashboardRoutes);
app.use('/api/v1', consigneeRoutes);
app.use('/api/v1', shareLinkRoutes);
app.use('/api/v1', bookingRoutes);
app.use('/api/v1', quoteRoutes);
app.use('/api/v1', failedDeliveryRoutes);

// Error Handling Middleware
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(`🚀 Zoop Backend running on port ${PORT}`);
  console.log(`=========================================`);
});
