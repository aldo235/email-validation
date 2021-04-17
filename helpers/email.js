const util                                  = require('util');
const smtpVerifier                          = require('../email-verify');
const disposableDomains                     = require('./disposable-domains');
const requestPromise                        = require('request-promise')
const logger                                = require('../logger.js').logger

const SMTP_VERIFIER_INFO_CODES              = { finishedVerification: 1, invalidEmailStructure: 2, noMxRecords: 3, SMTPConnectionTimeout: 4, domainNotFound: 5, SMTPConnectionError: 6 };

const GMAIL_DOMAIN                          = 'gmail.com';
const YAHOO_DOMAIN                          = 'yahoo.com';
const AOL_DOMAIN                            = 'aol.com';
const OUTLOOK_DOMAIN                        = 'outlook.com';
const HOTMAIL_DOMAIN                        = 'hotmail.com';
const CRAWLABLE_EMAIL_DOMAINS               = [GMAIL_DOMAIN, YAHOO_DOMAIN, AOL_DOMAIN, OUTLOOK_DOMAIN, HOTMAIL_DOMAIN];

const GMAIL_SING_IN_URL                     = 'https://accounts.google.com/signin/v2';
const YAHOO_SING_IN_URL                     = 'https://login.yahoo.com/';
const AOL_SING_IN_URL                       = 'https://login.aol.com/';
const HOTMAIL_OUTLOOK_SING_IN_URL           = 'https://login.live.com/login.srf';

const AT_SIGN                               = '@';
const DOT_SIGN                              = '.';
const SPACE_SIGN                            = ' ';
const UNDERSCORE_SIGN                       = '_';

const RFC_5322_EMAIL_STANDARD_REGEX         = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
const RFC_5322_EMAIL_STANDARD_NOT_MET_ERROR = 'RFC 522 Email Adress Format Standard not met.' ;

const NON_EXISTENT_LOCAL_PART               = 'a32dp3.2.ds.2sj';


// GMAIL crawl validation actions
async function gmail(page, email) {
  await page.goto(GMAIL_SING_IN_URL);
  await page.keyboard.type(email);
  await page.click('#next');
  await sleep(1000);

  const error = await page.$('#errormsg_0_Email');
  return !error;
}

// HOTMAIL/OUTLOOK crawl validation actions
async function hotmailOutlook(page, email) {
  await page.goto(HOTMAIL_OUTLOOK_SING_IN_URL);
  await page.focus('#i0116');
  await page.keyboard.type(email);
  await page.click('#idSIButton9');
  await sleep(1000);

  const error = await page.$('#usernameError');
  return !error;
}

// YAHOO/AOL crawl validation actions
async function yahooAol(page, email, signInUrl) {
  await page.goto(signInUrl);
  await page.focus('#login-username');
  await page.keyboard.type(email);
  await page.click('#login-signin');
  await sleep(1000);

  const url = await page.url();
  return url.includes('challenge') && !url.includes('challenge/fail');
}

// HELPER FUNCTIONS

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function smtpValidate(email) {
  logger.info('# Verifying SMTP')
  if (isDisposable(email)) return { email, valid: 'Disposable' };

  let result;

  const options = {
    port: 25,
    timeout: parseInt(process.env.SMTP_TIMEOUT_IN_MILISECONDS),
    sender: process.env.SMTP_SENDER,
    fqdn : process.env.SMTP_FQDN,
    email
  };
  // dns: ip address, or array of ip addresses (as strings), used to set the servers of the dns check,
  // ignore: set an ending response code integer to ignore, such as 450 for greylisted emails
  return util.promisify(smtpVerifier.verify)(options)
    .then(info => {
      let message;
      let valid;
      //Info object returns a code which representing a state of validation:
      switch (info.code) {
        case SMTP_VERIFIER_INFO_CODES.finishedVerification:
          message = 'Connected to SMTP server and finished email verification';
          valid = info.success ? 'Valid' : 'Invalid';
          break;
        case SMTP_VERIFIER_INFO_CODES.domainNotFound:
          message = 'Domain Not Found';
          valid = 'Domain Not Found';
          break;
        case SMTP_VERIFIER_INFO_CODES.invalidEmailStructure:
          message = 'Email is not valid';
          valid = 'Invalid';
          break;
        case SMTP_VERIFIER_INFO_CODES.noMxRecords:
          message = 'No MX record in domain name';
          valid = 'No MX records';
          break;
        case SMTP_VERIFIER_INFO_CODES.SMTPConnectionTimeout:
          message = 'SMTP connection timeout';
          valid = 'Unknown';
          break;
        case SMTP_VERIFIER_INFO_CODES.SMTPConnectionError:
          message = 'SMTP connection error';
          valid = 'Unknown';
          break;
      }

      return { email, message, valid };
    })
    .catch(e => {
      // console.log(e)
      switch (e.code) {
        case 'ENOTFOUND':
          return { email, message: 'Domain Not Found', valid: 'Domain Not Found' }
        default:
          return { email, message: 'Couldn\'t establish connection', valid: 'Unknown' }
      }
    });
}

function isInvalid(email, domain) {
  return isValid(email) && { valid: true, crawable: isCrawableDomain(domain) };
}

function isValid(email) {
  return RFC_5322_EMAIL_STANDARD_REGEX.exec(email);
}

function isCrawableDomain(domain) {
  return CRAWLABLE_EMAIL_DOMAINS.indexOf(domain) !== -1;
}

async function executeCrawlerFor(page, email, domain) {
  let valid;

  switch (domain) {
    case HOTMAIL_DOMAIN:
    case OUTLOOK_DOMAIN:
      valid = await hotmailOutlook(page, email)
      break;
    case GMAIL_DOMAIN:
      valid = await gmail(page, email)
      break;
    case YAHOO_DOMAIN:
      valid = await yahooAol(page, email, YAHOO_SING_IN_URL)
      break;
    case AOL_DOMAIN:
      valid = await yahooAol(page, email, AOL_SING_IN_URL)
      break;
  }

  return { email, valid: (valid ? 'Valid' : 'Invalid') };
}

function generateEmailVariationsRows(personName, domain) {
  const [first, last] = personName.toLowerCase().split(SPACE_SIGN);
  const f = first[0];
  const l = last[0];

  const atDomain = AT_SIGN + domain;

  const variations = [];

  //first.last@domain.com
  variations.push(first + DOT_SIGN + last + atDomain);

  //flast@domain.com
  variations.push(f + last + atDomain);

  //first@domain.com
  variations.push(first + atDomain);

  //firstlast@domain.com
  variations.push(first + last + atDomain);

  //last@domain.com
  variations.push(last + atDomain);

  //firstl@domain.com
  variations.push(first + l + atDomain);

  //last.first@domain.com
  variations.push(last + DOT_SIGN + first + atDomain);

  //lastfirst@domain.com
  variations.push(last + first + atDomain);

  //first_last@domain.com
  variations.push(first + UNDERSCORE_SIGN + last + atDomain);

  return variations.map(email => {
    return {
      first,
      last,
      domain,
      email
    };
  });
}

async function verify(email, page) {
  logger.info('#verify helpers:' + email)
  const url = await requestPromise.get('http://httpbin.org/ip');
  const origin = JSON.parse(url)
  logger.info("# New Veryfing:" + email)
  logger.info("# Outgoing IP address is: " + origin.origin)
  const [_localPart, domain] = email.split(AT_SIGN);
  valitidyCheckReult = isInvalid(email, domain);

  // FORMAT CHECK
  if (!valitidyCheckReult) return {
    email,
    valid: 'Email format is not valid',
    message: RFC_5322_EMAIL_STANDARD_NOT_MET_ERROR
  };

  // CRAWLER CHECK
  if (valitidyCheckReult.crawable) {
   logger.info('# Verifying craw: '+ domain) 
   let result = await executeCrawlerFor(page, email, domain);
   return result;
  }

  // CATCH-ALL CHECK
  if (await isCatchAll(domain)) return { email, valid: 'Catch-All' };

  // SMTP CHECK
  let result = await smtpValidate(email);
  return result;
}

function isDisposable(email) {
  const domain = email.split(AT_SIGN)[1];
  return disposableDomains[domain];
}

async function isCatchAll(domain) {
  const result = await smtpValidate(NON_EXISTENT_LOCAL_PART + '@' + domain);

  return result.valid === 'Valid';
}

module.exports = {
  verify,
  generateEmailVariationsRows,
  isInvalid,
  executeCrawlerFor,
  smtpValidate
}
