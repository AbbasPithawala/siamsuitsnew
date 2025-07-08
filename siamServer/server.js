const mongoose = require('mongoose')

process.on('uncaughtException', err => {
  console.log('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  console.log(err.name, err.message);
  process.exit(1);
});

require("dotenv/config");
const app = require('./index');
const DB = process.env.MONGOURL;

const start = async () => {

  if (!DB) {
    throw new Error('auth DB_URI must be defined');
  }
  try {
    mongoose.connect(DB, {
          useNewUrlParser: true,
          useUnifiedTopology: true,
      });
    console.log('Server connected to MongoDb!');
  } catch (err) {
    console.error(err.message);
    throw err;

  }

  const port = process.env.PORT || 4545;
  const server = app.listen(port, () => {
    console.log(`App running on port ${port}...`);
  });

// 
  process.on('unhandledRejection', err => {
    console.log('UNHANDLED REJECTION! 💥 Shutting down...');
    console.log(err.name, err.message);
    server.close(() => {
      process.exit(1);
    });
  });

  process.on('SIGTERM', () => {
    console.log('👋 SIGTERM RECEIVED. Shutting down gracefully');
    server.close(() => {
      console.log('💥 Process terminated!');
    });
  });
};

start();
