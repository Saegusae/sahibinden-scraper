import Axios, { AxiosInstance } from "axios";
import { JSDOM } from "jsdom";
import { Listing } from "./Types";

import * as fs from "fs";
import * as path from "path";
import { sleep } from "./Helpers";

export interface ScraperOptions {
  pagingSize: 20 | 50;
  yearMin: number; // 1980
  yearMax: number; // 2021
}

export default class Scraper {
  private readonly _opts: ScraperOptions;
  private readonly _client: AxiosInstance;

  private _listingCount: number;
  private _maxPage: number;

  private _startTime: number = -1;
  private _finishTime: number = -1;

  private _buffer: Listing[] = [];

  constructor(opts: ScraperOptions) {
    this._opts = opts;

    this._client = Axios.create({
      baseURL: "https://www.sahibinden.com",
      params: {
        pagingSize: this._opts.pagingSize,
        a269_min: this._opts.yearMin || 1980,
        a269_max: this._opts.yearMax || 2021,
      },
    });

    this._listingCount = 0;
    this._maxPage = 0;

    if (!fs.existsSync(path.join("output")))
      fs.mkdirSync(path.join("output"), { recursive: true });
  }

  public get pageCount(): number {
    return this._maxPage;
  }

  public get listingCount(): number {
    return this._listingCount;
  }

  public async run(): Promise<void> {
    if (this._buffer.length > 0) this._buffer = [];
    this._startTime = Date.now();

    await this.parseMetadata();

    for (let page = 1; page <= this._maxPage; page++) {
      try {
        const { data } = await this._client.get("/motosiklet/ikinci-el", {
          params: {
            pagingOffset: (page - 1) * this._opts.pagingSize,
          },
        });

        console.debug("Pulled page number " + page + ".");

        const { document } = new JSDOM(data).window;
        const resultRows = document.querySelectorAll(
          "tr.searchResultsItem[data-id]"
        );

        for (const result of resultRows) {
          const id = parseInt(result.attributes[0].value, 10);

          try {
            const fields = result.querySelectorAll("td:not(.ignore-me)");

            this._buffer.push({
              id,
              image: fields[0].querySelector("img")?.src || undefined,
              brand: fields[1].innerHTML.trim(),
              model: fields[2].innerHTML.trim(),
              year: parseInt(fields[4].innerHTML.trim(), 10),
              km: parseInt(fields[5].innerHTML.trim().split(".").join(""), 10),
              color: fields[6].innerHTML.trim(),
              price: fields[7].children[0].innerHTML.trim(),
              date: fields[8].textContent?.trim().replace(/\s{2,}/g, " "),
              area: fields[9].innerHTML.trim().split("<br>").join(", "),
            });
          } catch (e) {
            console.debug(
              "[ERROR] Result id: " + id + " could not be parsed properly."
            );
            continue;
          }
        }
      } catch (error) {
        console.debug("[ERROR] There was an error parsing page: " + page);
        break;
      }

      if (page % 20 === 0) {
        await sleep(310000);
      }
    }

    fs.writeFileSync(
      path.join("output", "scrape-result_" + this._startTime + ".json"),
      JSON.stringify(this._buffer, null, 2),
      "utf-8"
    );

    this._finishTime = Date.now();

    console.log(
      "[FINISHED] Job done in " +
        (this._finishTime - this._startTime) +
        " seconds."
    );

    this._buffer = [];
  }

  private async parseMetadata(): Promise<void> {
    const { data } = await this._client.get("/motosiklet/ikinci-el");

    const dom = new JSDOM(data);
    const { document } = dom.window;

    this._listingCount = parseInt(
      document
        .getElementsByClassName("result-text")[0]
        .children[1].innerHTML.split(".")
        .join("")
        .split(" ")[0],
      10
    );

    this._maxPage = parseInt(
      document.getElementsByClassName("mbdef")[0].innerHTML.split(" ")[1],
      10
    );
  }
}
