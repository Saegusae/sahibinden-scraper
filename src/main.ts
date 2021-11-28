import Scraper from "./lib/Scraper";

const scraper = new Scraper({ pagingSize: 50, yearMin: 2008, yearMax: 2021 });

(async function () {
  await scraper.run();
})();
