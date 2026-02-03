import express from 'express';
import 'dotenv/config';
import cookieParser from 'cookie-parser';
import authRoutes from '../src/routes/auth.routes.js';
import patternRoutes from '../src/routes/pattern.routes.js';
import cors from 'cors';
import { globalErrorHandler } from './middlewares/globalErrorHandler.middleware.js';

const app = express();

app.use(
  cors({
    origin: "https://patterntracker.netlify.app",
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use('/api/v1', authRoutes);
app.use('/api/v1/pattern', patternRoutes);

app.use(globalErrorHandler);

export { app };

