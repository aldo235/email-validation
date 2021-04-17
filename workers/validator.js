const { _Worker, parentPort, workerData } = require('worker_threads');
const puppeteer                           = require('puppeteer');
const helper                              = require('../helpers/email');

const DEFINITE_VALIDATION_RESULTS         = ['Valid', 'Domain Not Found', 'Catch-All'];

(async () => {
  const browser = await puppeteer.launch({ headless: true, args:['--no-sandbox']});
  const page = await browser.newPage();

  const results = [];
  let variationDetails;
  for(let i = 0; i < workerData.length; i++) {
    let [name, domain] = workerData[i];

    rows = helper.generateEmailVariationsRows(name, domain);
    variationDetails = {
      first:  rows[0].first,
      last:   rows[0].last,
      domain: rows[0].domain
    };

    let result;
    let row;
    let foundMatch = false;
    for(let j = 0; j < rows.length; j++) {
      row = rows[j];

      result = await helper.verify(row.email, page, results);

      if (DEFINITE_VALIDATION_RESULTS.indexOf(result.valid) !== -1) {
        results.push([
          row.first,
          row.last,
          row.domain,
          result.valid,
          row.email
        ]);

        foundMatch = true;
        break;
      }
    }

    if (!foundMatch) {
      results.push([
        variationDetails.first,
        variationDetails.last,
        variationDetails.domain,
        'Invalid',
        row.email
      ]);
    }
  }

  await browser.close();

  parentPort.postMessage(results);
})();
