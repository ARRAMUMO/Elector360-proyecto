const { validationResult } = require('express-validator');
const ApiError = require('../utils/ApiError');

exports.validate = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(err => err.msg);
    throw new ApiError(400, errorMessages.join(', '));
  }
  
  next();
};