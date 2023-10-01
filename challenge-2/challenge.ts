/**
 * The entry point function. This will read the provided CSV file, scrape the companies'
 * YC pages, and output structured data in a JSON file.
 */

import {CheerioCrawler, Dataset, Dictionary} from 'crawlee';
import fs from 'fs';
import fsp from 'fs/promises'
import fastcsv from 'fast-csv';
import path from "path";

interface Batch {
  batch: string | null;
  batchLink: string | null;
}

interface Descriptions {
  tagLine: string | null;
  description: string | null;
  completeDescription: string | null;
}

enum Status {
  Active = "Active",
  Inactive = "Inactive",
  Acquired = "Acquired",
}

interface NewsArticle {
  title: string | null;
  url: string | null;
  datePosted: string | null;
}

interface Badge {
  badge: string | null;
  badgeLink: string | null;
}

interface Founder {
  imgSrc: string | null;
  name: string | null
  linkedInUrl: string | null;
  role: string | null;
  bio: string | null;
  twitterUrl: string | null;
}

interface Job {
  title: string | null;
  url: string | null;
  location: string | null;
  salary: string | null;
  equity: string | null;
  experience: string | null;
  jobType: string | null;
  applyUrl: string | null;
}

interface LaunchPost {
  title: string | null,
  timePosted: string | null,
  tagLine: string | null ,
  hashtags: string[],
  company: string | null,
  author: string | null,
  companyUrl: string | null,
  articleUrl: string | null
}
interface CompanyInfo {
  founded: number | null;
  teamSize: number | null;
  linkedInUrl: string | null;
  twitterUrl: string | null;
  githubUrl: string | null;
  facebookUrl: string | null;
  crunchbaseUrl: string | null;
}

interface Company {
  logoUrl: string | null;
  name: string | null;
  jobList: Job[];
  newsArticles: NewsArticle[];
  companyLink: string | null
  status: Status | null;
  batch: Batch
  companyInfo: CompanyInfo
  badges: Badge[];
  founders: Founder[];
  descriptions: Descriptions;
  locale: string | null;
  ycombinatorUrl: string;
}

const extractDescription = (str: string): string => {
  const firstColon: number = str.indexOf(":");
  const lastPipe: number = str.lastIndexOf("|");
  if (firstColon === -1 || lastPipe === -1 || firstColon >= lastPipe) return "Invalid string format";
  return str.substring(firstColon + 1, lastPipe).trim();
}

const scrapeCompany = async (url: string): Promise<void> => {
  const crawler: CheerioCrawler = new CheerioCrawler({
    async requestHandler({ request,  $, enqueueLinks, log }): Promise<void> {
      const baseUrl: string = "https://www.ycombinator.com";
      const companyDataset: Dataset = await Dataset.open('company-dataset');
      const launchArticleDataset: Dataset = await Dataset.open('launch-article-dataset');

      if (request.url.includes('/launches')) {
        const articleTitle: string = $('.title-container h1').text();
        const authorName: string = $('.post-meta b').text();
        const articleTagLine: string = $('.tagline').text();
        const timeTitle: string | undefined = $('.timeago').attr('datetime');
        const postUrl: string | undefined = $('.post-url').attr('href');
        const hashtags: string[] = $('.hashtags span').map(function() {
          return $(this).text();
        }).get();

        const launchArticle: LaunchPost = {
          title: articleTitle || null,
          timePosted: timeTitle || null,
          tagLine: articleTagLine || null,
          hashtags: hashtags,
          company: request.label || null,
          author: authorName || null,
          companyUrl: postUrl || null,
          articleUrl: request.url || null
        };
        await launchArticleDataset.pushData(launchArticle)
      }
      else {
        const titleAndDescription: string = $('title').text();
        const partBeforeSemicolon: string = titleAndDescription.split(":")[0];
        const tagLine: string = extractDescription(titleAndDescription);
        const description: string | undefined = $('meta[name="description"]').attr('content');
        const logoUrl: string | undefined = $('meta[name="image"]').attr('content');
        const locale: string | undefined = $('meta[property="og:locale"]').attr('content');
        const sectionText: string = $('section.relative').find('p.whitespace-pre-line').text();
        const linkText: string = $("div.group a div.inline-block").text();

        const processYCombinatorBatch = (text: string, textWithHref: string, batches: any[], baseUrl: string) => {
          const batchFromUrl: string | undefined = textWithHref.split('=').pop();
          const batchFromText: string = text.replace("Y Combinator Logo", "").trim();
          const batchInfo: Batch = {batch: null, batchLink: null};
          if (batchFromUrl === batchFromText) {
            batchInfo.batch = batchFromUrl;
            batchInfo.batchLink = `${baseUrl}${textWithHref}`;
          }
          batches.push(batchInfo);
        }

        const processOtherBadge = (text: string, textWithHref: string, status: Status[], badgeTexts: any[], baseUrl: string) => {
          if (text === Status.Active) {
            status.push(Status.Active);
          } else if (text === Status.Inactive) {
            status.push(Status.Inactive);
          } else if (text === Status.Acquired) {
            status.push(Status.Acquired);
          } else {
            const badgeInfo = {
              badge: text,
              badgeLink: textWithHref !== undefined ? `${baseUrl}${textWithHref}` : null,
            };
            badgeTexts.push(badgeInfo);
          }
        }

        const batches: Batch[] = [];
        const status: Status[] = [];
        const badgeTexts: Badge[] = [];
        $('.mb-5 .ycdc-badge').each(function() {
          const text: string = $(this).text();
          const textWithHref: string | undefined = $(this).attr('href') || undefined;
          const baseUrl: string = "https://www.ycombinator.com";
          if (text.includes("Y Combinator")) processYCombinatorBatch(text, textWithHref as string, batches, baseUrl);
          else processOtherBadge(text, textWithHref as string, status, badgeTexts, baseUrl);
        });

        await enqueueLinks({
          selector: '.company-launch a',
          label: partBeforeSemicolon
        })

        const activeFounders: Founder[] = [];
        const companyInfos: CompanyInfo[] = []
        $('div.ycdc-card').each((index, element) => {
          const founder: Founder = {
            imgSrc: null,
            name: null,
            linkedInUrl: null,
            role: null,
            bio: null,
            twitterUrl: null,
          };
          const companyInfo: CompanyInfo = {
            founded: null,
            teamSize: null,
            linkedInUrl: null,
            twitterUrl: null,
            githubUrl: null,
            facebookUrl: null,
            crunchbaseUrl: null,
          };

          const imgSrc: string | undefined = $(element).find('img').attr('src');
          const name: string = $(element).find('div.font-bold').text();
          const role: string = $(element).find('div.font-bold').next('div').text();
          const bio: string | null = $(element).parent().find('p.prose').text() || null;  // New line to capture bio
          const linkedInUrl: string | undefined = $(element).find('a[aria-label="LinkedIn profile"]').attr('href');
          const twitterUrl: string | undefined = $(element).find('a[aria-label="Twitter account"]').attr('href');
          const githubUrl: string | undefined = $(element).find('a[aria-label="Github profile"]').attr('href');
          const facebookUrl: string | undefined = $(element).find('a[aria-label="Facebook profile"]').attr('href');
          const crunchbaseUrl: string | undefined = $(element).find('a[aria-label="Crunchbase profile"]').attr('href');
          const companyInfoPattern: RegExp = /Founded:.*Team Size:.*Location:.*/;
          const founded: string = $(element).find('div.flex-row:contains("Founded:")').find('span:last-child').text();
          const teamSize: string = $(element).find('div.flex-row:contains("Team Size:")').find('span:last-child').text();

          companyInfo.founded = Number(founded) || null;
          companyInfo.teamSize = Number(teamSize) || null;
          companyInfo.linkedInUrl = linkedInUrl || null;
          companyInfo.twitterUrl = twitterUrl || null;
          companyInfo.githubUrl = githubUrl || null;
          companyInfo.facebookUrl = facebookUrl || null;
          companyInfo.crunchbaseUrl = crunchbaseUrl || null;
          companyInfos.push(companyInfo)

          if (!companyInfoPattern.test(role)) {
            founder.imgSrc = imgSrc || null
            founder.name = name || null
            founder.role = role || null
            founder.bio = bio || null
            founder.linkedInUrl = linkedInUrl || null
            founder.twitterUrl = twitterUrl || null
            activeFounders.push(founder);
          }
        });

        const jobList: Job[] = [];
        $('.flex.w-full.flex-col.justify-between.divide-y.divide-gray-200 > div').each(function() {
          const job: Job = {
            title: null,
            url: null,
            location: null,
            salary: null,
            equity: null,
            experience: null,
            jobType: null,
            applyUrl: null,
          };

          const jobTitleElement = $(this).find('.text-lg.font-bold a');

          job.title = jobTitleElement.text() || null;
          job.url = jobTitleElement.attr('href') ? `${baseUrl}${jobTitleElement.attr('href')}` : null;

          const jobDetails = $(this).find('.justify-left.flex.flex-row.gap-x-7 div');

          jobDetails.each(function(): void {
            const text: string = $(this).text();
            if (text.match(/\b\d{2,3}K - \d{2,3}K\b/)) {
              job.salary = text;
            } else if (text.match(/\d+\.\d+% - \d+\.\d+%/) || text.match(/\d+\.\d+%/)) {
              job.equity = text;
            } else if (text.match(/years?|new grads? ok/i)) {
              job.experience = text;
            } else {
              job.location = text;
            }
          });

          const jobTypeElement = $(this).find('.text-sm span').filter(function() {
            const text: string = $(this).text().toLowerCase();
            return text.includes('intern') || text.includes('contract') || text.includes('fulltime');
          });

          if (jobTypeElement.length > 0) job.jobType = jobTypeElement.text();
          const applyNowElement = $(this).find('.APPLY a');
          job.applyUrl = applyNowElement.attr('href') || null;
          jobList.push(job);
        });

        const newsArticles: NewsArticle[] = [];
        $("#news > div > div").each(function(): void {
          const article: NewsArticle = {
            title: null,
            url: null,
            datePosted: null
          };

          const titleElement = $(this).find('.ycdc-with-link-color a');
          article.title = titleElement.text();
          article.url = titleElement.attr('href') || null

          const dateString: string = $(this).find('.text-sm').text();
          if (dateString && /^(\w{3} \d{2}, \d{4})$/.test(dateString)) {
            const dateObject: Date = new Date(`${dateString} 00:00:00`);
            article.datePosted = dateObject.toISOString();
          } else {
            console.warn(`Invalid date string: ${dateString}`);
            article.datePosted = null;
          }
          newsArticles.push(article);
        });

        const descriptions: Descriptions = {
          tagLine: tagLine,
          description: description || null,
          completeDescription: sectionText,
        };

        const company: Company = {
          name: partBeforeSemicolon,
          logoUrl: logoUrl || null,
          companyLink: linkText,
          newsArticles: newsArticles,
          jobList: jobList,
          status: status.length == 1 ? status[0] : null,
          ycombinatorUrl: request.url,
          companyInfo: companyInfos[0],
          batch: batches[0],
          badges: badgeTexts,
          descriptions: descriptions,
          founders: activeFounders,
          locale: locale ? locale : null,
        };
        await companyDataset.pushData(company)
      }
    },
  });
  await crawler.run([url]);
};

const updateCompaniesWithLaunchArticles = async () => {
  const companyDataset: Dataset = await Dataset.open('company-dataset');
  const launchArticleDataset: Dataset = await Dataset.open('launch-article-dataset');
  const resultDataset: Dataset = await Dataset.open("results")

  const updatedCompanyData: Dictionary<any>[] = await companyDataset.map(async (company): Promise<Dictionary<any>> => {
    const launchArticlesForCompany = await launchArticleDataset.map((launchArticle: Dictionary) => {
      if (launchArticle.company === company.name) return launchArticle;
      return null;
    });
    company.launchArticles = launchArticlesForCompany.filter(Boolean);
    return company;
  });

  await resultDataset.pushData(updatedCompanyData);
  console.log("Updated companies with launch articles");
};

const exportAndMoveData = async (): Promise<void> => {
  const results: Dataset = await Dataset.open("results");
  await results.exportToJSON('scraped');
  await moveExportedData()
  console.log("Data has been exported to a key-value store as 'scraped'");
};

const runCrawlersInBatches = async (urls: string[], startIndex: number = 0): Promise<void> => {
  const MAX_BATCH_SIZE: number = 10
  if (urls.length > MAX_BATCH_SIZE) throw new Error(`Batch size should be ${MAX_BATCH_SIZE} or less`);
  if (startIndex < urls.length) {
    const batchUrls: string[] = urls.slice(startIndex, startIndex + MAX_BATCH_SIZE);
    await Promise.all(batchUrls.map(url => scrapeCompany(url)));
    return runCrawlersInBatches(urls, startIndex + MAX_BATCH_SIZE);
  }
};

const buildCompanyAndLaunchArticleJSONDatasets = (): Promise<void> => {
  return new Promise(async (resolve, reject): Promise<void> => {
    try {
      const BUFFER_SIZE: number = 10;
      const rows: any[] = []; // will only take up O(BUFFER_SIZE) space
      let rowCount: number = 0;
      const stream: fs.ReadStream = fs.createReadStream('inputs/companies.csv');
      stream.on('error', reject);
      const csvStream = fastcsv.parseStream(stream, { headers: true })
          .on('data', (row: any): void => {
            rowCount++;
            rows.push(row);
            console.log(typeof row, "type of row")
            if (rowCount % BUFFER_SIZE === 0) {
              csvStream.pause();
              // Run crawler for the batch
              runCrawlersInBatches(rows.map(row => row['YC URL']))
                  .then(() => {
                    rows.length = 0; // Clear buffer
                    csvStream.resume();
                  })
                  .catch(err => {
                    console.error('An error occurred while scraping:', err);
                    reject(err);
                  });
            }
          })
          .on('end', async (): Promise<void> => {
            if (rows.length > 0) await runCrawlersInBatches(rows.map(row => row['YC URL']));
            console.log('Successfully scraped jsons to storage/datasets');
            resolve();
          });
    } catch (err) {
      console.error('An error occurred:', err);
      reject(err);
    }
  });
};

const moveExportedData = async (): Promise<void> => {
  const tempPath: string = path.join('storage', 'key_value_stores', 'default', 'scraped.json');
  const rawData: string = await fsp.readFile(tempPath, 'utf8');
  const outputPath: string = path.join('out', 'scraped.json');
  await fsp.mkdir(path.dirname(outputPath), { recursive: true });
  await fsp.writeFile(outputPath, rawData);
  console.log(`Data has been moved to ${outputPath}`);
};

export async function processCompanyList() {
  try {
    await buildCompanyAndLaunchArticleJSONDatasets();
    await updateCompaniesWithLaunchArticles();
    await exportAndMoveData();
  } catch (err) {
    console.error('An error occurred:', err);
  }
}

