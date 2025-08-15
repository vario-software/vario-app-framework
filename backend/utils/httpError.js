class CustomError extends Error
{
  constructor(message, statusCode, logService, logInfo, logId, logLevel, errorData)
  {
    super(message);

    this.statusCode = statusCode;
    this.logLevel = logLevel;
    this.logService = logService;
    this.logId = logId;
    this.logInfo = logInfo;
    this.data = errorData;
  }
}

module.exports = CustomError;
