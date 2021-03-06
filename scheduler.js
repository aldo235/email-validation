const { Worker, _isMainThread, _parentPort, workerData } = require('worker_threads');
const nodemailer = require('nodemailer');
const os = require('os');
const path = require('path');
const validatorWorkerPath = path.resolve('workers/validator.js');
const verifierWorkerPath = path.resolve('workers/verifier.js');
const converter = require('json-2-csv');
// create reusable transporter object using the default SMTP transport
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
      user: process.env.EMAIL_FROM_USERNAME,
      pass: process.env.EMAIL_FROM_PASSWORD
  }
});

async function verifiers(emailData, options = {}) {
  console.log('scheduler')
  const recipient = options.email;
  const emailSequence = JSON.parse(JSON.stringify(emailData)); // make a copy

  // signle verification
  if (!recipient) return workers(emailData, verifierWorkerPath);


  // bulk verification
  const verificationResults = await workers(emailData, verifierWorkerPath);
  const orderedResults = reorderToInitialStateVerification(emailSequence, verificationResults);

  sendVerificationEmail(recipient, orderedResults);
}

async function validators(emailData, options = {}) {
  const recipient = options.email;
  const emailSequence = JSON.parse(JSON.stringify(emailData)); // make a copy

  // signle validation
  if (!recipient) return workers(emailData, validatorWorkerPath);

  // bulk validation
  const validationResults = await workers(emailData, validatorWorkerPath);
  const orderedResults = reordeToInitialStateValidation(emailSequence, validationResults);
  const finalResults = clearEmailsForRowsThatAreNotValid(orderedResults);

  sendValidationEmail(recipient, finalResults);
}

// HELPERS

function workers(data, workerPath) {
  const promises = chunks(data).map(chunk => {
    return new Promise((resolve, reject) => {
      const worker = new Worker(workerPath, { workerData: chunk });

      worker.on('message', resolve);
      worker.on('error', reject);
      worker.on('exit', code => {
        if (code !== 0) reject(new Error(`Worker stopped with exit code ${code}`));
      });
    })
  });

  return Promise.all(promises).then(results => [].concat.apply([], results));
}

// separates the data into N equal portions, N is the number of CPU count
function chunks(emailData) {
  const userCPUCount = os.cpus().length;
  const chunkSize = Math.floor(emailData.length / userCPUCount);
  const chunks = [];

  let tmpChunk = [];
  for(let i = 0; i < userCPUCount - 1; i++) {
    for(let j = 0; j < chunkSize; j++) {
      tmpChunk.push(emailData.pop());
    }

    chunks.push(tmpChunk);
    tmpChunk = [];
  }

  chunks.push(emailData);

  return chunks.filter(c => c.length);
}

async function sendVerificationEmail(recipient, data) {
  data = data.map(({ email, valid }) => {
    return {
      'Email': email,
      'Result': valid
    }
  });

    const opts = { prependHeader: true, keys: ['Email', 'Result'] };
  const attachmentContent = await converter.json2csvAsync(data, opts);

  sendEmail(attachmentContent, recipient);
}

async function sendValidationEmail(recipient, data) {
  data = data.map(([first, last, domain, result, email]) => {
    return {
      'First Name': capitalize(first),
      'Last Name': capitalize(last),
      'Domain': domain,
      'Result': result,
      'Valid Emails': email
    };
  });

  const opts = { prependHeader: true, keys: ['First Name', 'Last Name', 'Domain', 'Result', 'Valid Emails'] };
  const attachmentContent = await converter.json2csvAsync(data, opts);

  sendEmail(attachmentContent, recipient);
}

function sendEmail(attachmentContent, recipient) {
  // send mail with defined transport object
  transporter.sendMail({
    to: recipient,
    subject: "Bulk Email Verification/Validation", // Subject line
    text: "Results are in the attachment" , // plain text body
    html: '<h2 style="background-color: #38c973;color: white;width: fit-content;padding: 10px;border-radius: 9px;border-right: solid 5px;border-bottom: solid 5px;border-color: #30b15c;font-family: sans-serif;font-weight: lighter;">Results are in the attachment</h2>', // html body
    attachments: [{
      filename: 'results.csv',
      content: attachmentContent
    }]
  });
}

function reorderToInitialStateVerification(sequence, unordered) {
  const cache = {};

  let temp;
  for (let i = 0; i < unordered.length; i++) {
    temp = unordered[i];
    cache[temp.email] = temp;
  }

  return sequence.map(email => cache[email]);
}

function reordeToInitialStateValidation(sequence, unordered) {
  // convert the sequence to array of strings. Each string is:
  // `${lower-case first name} ${lower-case last name} ${domain]}`
  sequence = sequence.map(([fullName, domain]) => fullName.toLowerCase() + ' ' + domain);

  const cache = {};

  let temp, key;
  for (let i = 0; i < unordered.length; i++) {
    temp = unordered[i];
    key = temp[0] + ' ' + temp[1] + ' ' + temp[2];
    cache[key] = temp;
  }

  return sequence.map(key => cache[key]);
}

function capitalize(s) {
  if (typeof s !== 'string') return ''
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function clearEmailsForRowsThatAreNotValid(rows) {
  return rows.map(row => {
    row[4] = row[3] === 'Valid' ? row[4] : '';
    return row;
  });
}

module.exports = {
  verifiers,
  validators
}