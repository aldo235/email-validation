'use strict';
const email = require('../controllers/email');

module.exports = (app) => {
  app.post('/verify', email.verifySingle);
  app.post('/verify/bulk', email.verifyBulk);
  app.post('/validate', email.validateSingle);
  app.post('/validate/bulk', email.validateBulk);
};