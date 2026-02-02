import mongoose from 'mongoose';
const URI = process.env.MONGO_URI;

const connectDB = async () => {
  try {
    const CONNECTION_INSTANCE = await mongoose.connect(`${URI}`);
    console.log(`DATABASE CONNECTED AT ${CONNECTION_INSTANCE.connection.host}`);
  } catch (error) {
    console.log('Failed to connect with DATABASE ERROR ::', error);
    console.log('database url', URI);
    process.exit(1);
  }
};

export { connectDB };
