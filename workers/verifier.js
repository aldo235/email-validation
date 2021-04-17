const { _Worker, parentPort, workerData } = require('worker_threads');
const puppeteer                           = require('puppeteer');
const useProxy                            = require('puppeteer-page-proxy');
const helper                              = require('../helpers/email');

(async () => {
  console.log('workers')
  const browser = await puppeteer.launch({ headless: true, args: ['--disable-web-security'] });
  const page = await browser.newPage();
  page.on('response', async response => {
    const status = response.status()
    await useProxy(response, 'socks5://cnhjfhlo-rotate:jx9lodr1mr03@138.128.27.58:80')
    console.log(status, 'success use proxy')
  });
  const results = [];
  let email;
  for(let i = 0; i < workerData.length; i++) {
    email = workerData[i];
    // logger.info("# Veryfing " + email)
    results.push(await helper.verify(email, page, results));
  }

  await browser.close();

  parentPort.postMessage(results);
})();
