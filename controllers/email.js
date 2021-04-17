'use strict';

const scheduler = require('../scheduler');
const Papa      = require('papaparse');
const logger	= require('../logger.js').logger

function verifySingle(req, res) {
  const { email } = req.body;
  logger.info('testing' + email)
  return scheduler
    .verifiers([email])
    .then(results => res.status(200).json(results))
    .catch(error => res.status(500).json({ error }));
}

function verifyBulk(req, res) {
  const emails = [].concat.apply([], getFileContentVerify(req));

  scheduler.verifiers(emails, { email: req.body.email })

  return res.status(200).json('Accepted. The results will be send in an email to ' + req.body.email);
}

function validateSingle(req, res) {
  const [name, domain] = req.body;

  return scheduler
    .validators([[name, domain]])
    .then(results => res.status(200).json(results))
    .catch(error => res.status(500).json({ error }));
}

function validateBulk(req, res) {
  scheduler.validators(getFileContentValidate(req), { email: req.body.email })

  return res.status(200).json('Accepted. The results will be send in an email to ' + req.body.email);
}

function getFileContentValidate(req) {
  const rawContent = req.files.file.data.toString('ascii');
  const content    = Papa.parse(rawContent).data;

  if (!content.slice(-1)[0][0]) content.pop(); // remove the last element if it's empty

  return content.map(row => {
    let [firstName, lastName, email] = row;
    return [`${firstName} ${lastName}`, email];
  });
}

function getFileContentVerify(req) {
  const rawContent = req.files.file.data.toString('ascii');
  const content    = Papa.parse(rawContent).data;

  if (!content.slice(-1)[0][0]) content.pop(); // remove the last element if it's empty

  return content;
}


module.exports = {
  verifySingle,
  verifyBulk,
  validateSingle,
  validateBulk
};

