/**
 * The entry point function. This will read the provided CSV file, scrape the companies'
 * YC pages, and output structured data in a JSON file.
 */

import {CheerioCrawler, Dataset} from 'crawlee';
import fs from 'fs';
import fastcsv from 'fast-csv';

interface Job {
  role: string;
  location: string;
}

interface Founder {
  name: string;
  linkedIn: string;
}

interface LaunchPost {
  title: string;
}

interface Company {
  type: string;
  logoUrl: string | null;
  name: string;
  jobList: any;
  newsArticles: any;
  companyLink: string;
  status: string | null;
  batch: string | null;
  companyInfo: any;
  badges: string[];
  founders: string[];
  descriptions: any;
  locale: string | null;
  ycombinatorUrl: string;
}

// Use an async function to read the CSV and build the JSON.
// Abstract out the scraping logic
const scrapeCompanies = async (rows: any[]): Promise<Company[]> => {
  const limit = 10;
  const comps: Company[] = [];
  for (let i = 0; i < rows.length; i += limit) {
    const slice = rows.slice(i, i + limit);
    const tasks = slice.map(row => scrapeCompany(row['YC URL']));
    const results = await Promise.all(tasks);  // Await for all the tasks to complete
    //comps.push(...results.flat());
    console.log(`Processed ${i + limit} companies. JSON so far:`, JSON.stringify(comps));
  }
  return comps;
};

function extractDescription(str: string): string {
  const firstColon = str.indexOf(":");
  const lastPipe = str.lastIndexOf("|");

  if (firstColon === -1 || lastPipe === -1 || firstColon >= lastPipe) {
    return "Invalid string format";
  }

  return str.substring(firstColon + 1, lastPipe).trim();
}

const scrapeCompany = async (url: string) => {
  const crawler = new CheerioCrawler({
    // Use the requestHandler to process each of the crawled pages.
    //maxRequestsPerCrawl: 10,
    async requestHandler({ request,  $, enqueueLinks, log }) {
      const baseUrl = "https://www.ycombinator.com";
      const companyDataset = await Dataset.open('company-dataset');
      const launchArticleDataset = await Dataset.open('launch-article-dataset');

      if (request.url.includes('/launches')) {
        const articleTitle = $('.title-container h1').text();
        const authorName = $('.post-meta b').text();
        const articleTagLine = $('.tagline').text();
        const hashtags = $('.hashtags span').map(function() {
          return $(this).text();
        }).get();
        // Get the title attribute from the time element
        const timeTitle = $('.timeago').attr('datetime');
        // Get the href attribute from the post-url class
        const postUrl = $('.post-url').attr('href');
        const launchArticle: any = {
          type: "launch article",
          title: articleTitle,
          timePosted: timeTitle,
          tagLine: articleTagLine,
          hashtags: hashtags,
          company: request.label,
          author: authorName,
          companyUrl: postUrl,
          articleUrl: request.url
        };
        await launchArticleDataset.pushData(launchArticle)
      }
      else {
        const titleAndDescription = $('title').text();
        const partBeforeSemicolon = titleAndDescription.split(":")[0];
        const tagLine = extractDescription(titleAndDescription);
        const description = $('meta[name="description"]').attr('content');
        const logoUrl = $('meta[name="image"]').attr('content');
        const locale = $('meta[property="og:locale"]').attr('content');
        const sectionText = $('section.relative').find('p.whitespace-pre-line').text();
        const linkText = $("div.group a div.inline-block").text();

        const badgeTexts: string[] = [];
        const batches: string[] = [];
        const status: string[] = [];

        $('.mb-5 .ycdc-badge').each(function() {
          const text = $(this).text();
          const textWithHref = $(this).attr('href')
          if (text.includes("Y Combinator")) {
            // Extract the batch information from the URL
            const batchFromUrl = textWithHref.split('=').pop();
            // Extract the batch information from the logoText
            const batchFromText = text.replace("Y Combinator Logo", "").trim();
            // Construct the object
            const batchInfo: any = {};

            if (batchFromUrl === batchFromText) {
              batchInfo.batch = batchFromUrl;
              batchInfo.batchLink = `${baseUrl}${textWithHref}`;
            }
            batches.push(batchInfo)
          } else {
            const badgeInfo: any = {};
            if (text === "Active") status.push("Active")
            else if (text === "Inactive") status.push("Inactive")
            else if (text === "Acquired") status.push("Acquired")
            else {
              badgeInfo.badge = text
              badgeInfo.badgeLink = textWithHref !== undefined ? `${baseUrl}${textWithHref}` : null
              badgeTexts.push(badgeInfo)
            }
          }
        });

        await enqueueLinks({
          selector: '.company-launch a',
          label: partBeforeSemicolon
        })

        let activeFounders: string[] = [];
        let companyInfos: any[] = []

        $('div.ycdc-card').each((index, element) => {
          const founder: any = {};
          const companyInfo: any = {};

          const imgSrc = $(element).find('img').attr('src');
          const name = $(element).find('div.font-bold').text();
          const role = $(element).find('div.font-bold').next('div').text();
          const bio = $(element).parent().find('p.prose').text() || null;  // New line to capture bio


          const linkedInUrl = $(element).find('a[aria-label="LinkedIn profile"]').attr('href');
          const twitterUrl = $(element).find('a[aria-label="Twitter account"]').attr('href');
          const githubUrl = $(element).find('a[aria-label="Github profile"]').attr('href');
          const facebookUrl = $(element).find('a[aria-label="Facebook profile"]').attr('href');
          const crunchbaseUrl = $(element).find('a[aria-label="Crunchbase profile"]').attr('href');

          const companyInfoPattern = /Founded:.*Team Size:.*Location:.*/;
          const founded = $(element).find('div.flex-row:contains("Founded:")').find('span:last-child').text();
          const teamSize = $(element).find('div.flex-row:contains("Team Size:")').find('span:last-child').text();

          companyInfo.founded = founded || null;
          companyInfo.teamSize = teamSize || null;
          companyInfo.linkedInUrl = linkedInUrl || null;
          companyInfo.twitterUrl = twitterUrl || null;
          companyInfo.githubUrl = githubUrl || null;
          companyInfo.facebookUrl = facebookUrl || null;
          companyInfo.crunchbaseUrl = crunchbaseUrl || null;

          companyInfos.push(companyInfo)

          if (!companyInfoPattern.test(role)) {
            founder.imgSrc = imgSrc || null;
            founder.name = name || null;
            founder.role = role || null;
            founder.bio = bio;  // New line to add bio to founder object
            founder.linkedInUrl = linkedInUrl || null;
            founder.twitterUrl = twitterUrl || null;
            activeFounders.push(founder);
          }

        });

        const jobList: any = [];

        $('.flex.w-full.flex-col.justify-between.divide-y.divide-gray-200 > div').each(function() {
          let job: any = {
            title: null,
            url: null,
            location: null,
            salary: null,
            equity: null,
            experience: null,
            jobType: null,
            applyUrl: null
          };

          // Get the job title and its URL
          const jobTitleElement = $(this).find('.text-lg.font-bold a');
          job.title = jobTitleElement.text() || null;
          job.url = jobTitleElement.attr('href') ? `${baseUrl}${jobTitleElement.attr('href')}` : null;

          // Get the job details like location, salary, equity, and experience
          const jobDetails = $(this).find('.justify-left.flex.flex-row.gap-x-7 div');

          jobDetails.each(function() {
            const text = $(this).text();
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

          // Check for job type
          const jobTypeElement = $(this).find('.text-sm span').filter(function() {
            const text = $(this).text().toLowerCase();
            return text.includes('intern') || text.includes('contract') || text.includes('fulltime');
          });

          if (jobTypeElement.length > 0) {
            job.jobType = jobTypeElement.text();
          }

          // Get the Apply Now URL
          const applyNowElement = $(this).find('.APPLY a');
          job.applyUrl = applyNowElement.attr('href') || null;

          jobList.push(job);
        });

        const descriptions = {
          tagLine: tagLine,
          description:  description,
          completeDescription: sectionText,
        }

        const newsArticles: any[] = [];

        $("#news > div > div").each(function() {
          let article: any = {};

          // Get the article title and its URL
          const titleElement = $(this).find('.ycdc-with-link-color a');
          article.title = titleElement.text();
          article.url = titleElement.attr('href');

          // Get the date posted and convert it to ISO date-time string
          const dateString = $(this).find('.text-sm').text();

          // Validate the date string
          if (dateString && /^(\w{3} \d{2}, \d{4})$/.test(dateString)) {
            const dateObject = new Date(`${dateString} 00:00:00`);
            article.datePosted = dateObject.toISOString();
          } else {
            console.warn(`Invalid date string: ${dateString}`);
            article.datePosted = null;
          }

          newsArticles.push(article);
        });

        const c: Company = {
          type: "company ycomb page",
          name: partBeforeSemicolon,
          logoUrl: logoUrl || null,
          companyLink: linkText,
          newsArticles: newsArticles,
          jobList: jobList,
          status: status.length == 1 ? status[0].toUpperCase() : null,
          ycombinatorUrl: request.url,
          companyInfo: companyInfos[0],
          batch: batches.length == 1 ? batches[0] : null,
          badges: badgeTexts,
          descriptions: descriptions,
          founders: activeFounders,
          locale: locale ? locale : null,
        };
        await companyDataset.pushData(c)
      }
    },
  });
  await crawler.run([url]);
};

const updateCompaniesWithLaunchArticles = async () => {
  const companyDataset = await Dataset.open('company-dataset');
  const launchArticleDataset = await Dataset.open('launch-article-dataset');
  const x = await Dataset.open("results")

  const updatedCompanyData = await companyDataset.map(async (company) => {
    const launchArticlesForCompany = await launchArticleDataset.map((launchArticle) => {
      if (launchArticle.company === company.name) {
        return launchArticle;
      }
    });
    company.launchArticles = launchArticlesForCompany.filter(Boolean);
    return company;
  });

  await x.pushData(updatedCompanyData);
  console.log("Updated companies with launch articles");
};


const buildCompanyJSON = (): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    try {
      const rows: any[] = [];
      const stream = fs.createReadStream('inputs/companies.csv');
      stream.on('error', reject);
      const onData = (row: any) => {
        rows.push(row);
      };
      const onEnd = async () => {
        try {
          await Promise.all(rows.map(row => scrapeCompany(row['YC URL'])));
          console.log('Successfully scraped jsons to storage/datasets');
          resolve();
        } catch (err) {
          console.error('An error occurred while scraping:', err);
          reject(err);
        }
      };
      fastcsv.parseStream(stream, { headers: true })
          .on('data', onData)
          .on('end', onEnd);
    } catch (err) {
      console.error('An error occurred:', err);
      reject(err);
    }
  });
};

export async function processCompanyList() {
  try {
    await buildCompanyJSON();
    await updateCompaniesWithLaunchArticles();  // Update companies with launch articles
  } catch (err) {
    console.error('An error occurred:', err);
  }
}

