import express from 'express';
import 'dotenv/config';
import cookieParser from 'cookie-parser';
import authRoutes from '../src/routes/auth.routes.js';
import patternRoutes from '../src/routes/pattern.routes.js';
import cors from 'cors';
import { globalErrorHandler } from './middlewares/globalErrorHandler.middleware.js';

const app = express();

const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'https://patterntracker.netlify.app',
      'http://localhost:5173', // For local development
    ];

    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'Access-Control-Request-Method',
    'Access-Control-Request-Headers',
  ],
  exposedHeaders: ['Set-Cookie'],
  optionsSuccessStatus: 204,
  maxAge: 86400, // 24 hours
};

// Handle pre-flight requests globally
app.options('*', cors(corsOptions));

// Apply CORS middleware
app.use(cors(corsOptions));

// Rest of your middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use('/api/v1', authRoutes);
app.use('/api/v1/pattern', patternRoutes);

app.use(globalErrorHandler);

export { app };
