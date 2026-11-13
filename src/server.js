const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const errorHandler = require('./middlewares/errorHandler');
const authRoutes = require('./routes/authRoutes');
const profileRoutes = require('./routes/profileRoutes');
const consentRoutes = require('./routes/consentRoutes');
const creditRoutes = require('./routes/creditRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const consigneeRoutes = require('./routes/consigneeRoutes');
const shareLinkRoutes = require('./routes/shareLinkRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const quoteRoutes = require('./routes/quoteRoutes');
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

// Mount Routes
app.use('/api/v1/auth', authRoutes);
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

