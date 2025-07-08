const winston = require('winston');

const LogIt = async(error)=>{


  const logConfiguration = {
    'transports': [
        new winston.transports.Console()
    ]
  };
  
  const logger = winston.createLogger(logConfiguration);
  
  // Log a message
  logger.log({
        message: error,
        level: 'error'
    });


}

module.exports = LogIt
