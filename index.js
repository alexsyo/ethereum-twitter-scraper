const puppeteer = require('puppeteer');
const fs = require('fs');
const { ethers } = require('ethers')
const provider = new ethers.providers.CloudflareProvider()
require('dotenv').config()


const uri = process.env.URI;
const tokenAddress = process.env.TOKEN_ADDRESS;
const tokenId = process.env.TOKEN_ID;
const quantity = process.env.QUANTITY;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  // start browser
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--window-size=600,800'],
    defaultViewport: null
  });
  const page = await browser.newPage();
  await page.goto(uri, { waitUntil: 'networkidle0' });
  await page.screenshot({ path: 'initial-load.png' });
  

  const items = [] 
  let currentHeight = 0;
  let scrollHeight = 1000

  // scroll and grab addresses
  while(currentHeight < scrollHeight) {
    const { data, scroll } = await page.evaluate(async () => {
      // scrape replies
      const replies = Array.from(document.querySelectorAll('article'))
      window.scrollBy(0, 30);

      // click show more if exists
      const buttons = Array.from(document.querySelectorAll('span')).filter(x => /Show/.test(x.innerText))
      buttons.forEach(b => b.click())

      return {
        data: replies.map(r => r.innerHTML),
        scroll: document.body.scrollHeight,
      }
    });

    scrollHeight = scroll;
    currentHeight += 30;

    // added address to items
    for(let i = 0; i < data.length; i++) {
      const d = data[i]
      const address = d.match(/0x[a-fA-F0-9]{40}|[a-zA-Z0-9]*\.eth/g)
      const time = d.match(/[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z/g)
      if(address && address[0] && time && time[0] && !items.find(x => x.address === address[0] || x.ens === address[0])) {

        if(/\.eth/.test(address[0])) {
          const resolvedAddress = await provider.resolveName(address[0]);
          console.log(`resolved ${address[0]} to ${resolvedAddress}`);
          items.push({
            address: resolvedAddress,
            ens: address[0],
            time: time[0],
          });
        } else {
          items.push({
            address: address[0],
            time: time[0]
          })
        }

      }
    }

    await sleep(100)
  }
  

  // write to csv
  let string = '"Recipient","Token Address","Token Id","Quantity"\n'
  items
    .sort((a,b) => {
      return new Date(a.time) - new Date(b.time) 
    })
    .forEach(i => {
      string += `"${i.address}","${tokenAddress}","${tokenId}","${quantity}"\n`
    })

  fs.writeFileSync('./data.csv', string);



  await browser.close();
})();
