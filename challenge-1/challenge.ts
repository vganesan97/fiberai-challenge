/**
 * The entry point function. This will download the given dump file, extract/decompress it,
 * parse the CSVs within, and add the data to a SQLite database.
 * This is the core function you'll need to edit, though you're encouraged to make helper
 * functions!
 */
import https from 'https';
import fs from 'fs';
import {IncomingMessage} from "http";
import zlib from 'zlib';
import tar from 'tar';
import knex, {Knex} from 'knex';
import csv from 'fast-csv';
import {DUMP_DOWNLOAD_URL, SQLITE_DB_PATH} from "./resources";
import path from "path";

type InferredType = 'int' | 'bigint' | 'float' | 'date' | 'string';


/**
 * Downloads a file from a given URL and saves it to a specified destination.
 * @param {string} url - The URL of the file to download.
 * @param {string} dest - The destination where the file should be saved.
 * @returns {Promise<void>} A promise that resolves when the download is complete.
 */
const downloadFile = (url: string, dest: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response: IncomingMessage) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err: Error) => {
      fs.unlink(dest, unlinkErr => {
        if (unlinkErr) console.error(`Failed to unlink file: ${unlinkErr}`);
      });
      reject(err);
    });
  });
};

/**
 * Decompresses a .tar.gz file and extracts its contents.
 * @param {string} src - The source path of the .tar.gz file.
 * @param {string} dest - The destination directory where the files should be extracted.
 * @returns {Promise<void>} A promise that resolves when decompression and extraction are complete.
 */
const decompressAndExtract = (src: string, dest: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    // Ensure the directory exists
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }

    // Create read and write streams
    const readStream = fs.createReadStream(src);
    const writeStream = tar.extract({ cwd: dest });

    // Handle errors
    readStream.on('error', reject);
    writeStream.on('error', reject);

    // Handle successful extraction
    writeStream.on('finish', resolve);

    // Pipe through gunzip (decompression) and then to the tar extractor
    readStream
        .pipe(zlib.createGunzip())
        .pipe(writeStream);
  });
};


// Infer the type of a single value
const inferType = (value: string): InferredType => {
  if (/^\d+$/.test(value)) {
    const intValue = parseInt(value, 10);
    if (intValue >= -2147483648 && intValue <= 2147483647) {
      return 'int';
    }
    return 'bigint';
  }
  if (/^\d+\.\d+$/.test(value)) return 'float';
  if (Date.parse(value)) return 'date';
  return 'string';
};

// Infer types of multiple columns based on sample rows
const inferColumnTypes = async (filePath: string, sampleSize: number = 10): Promise<Record<string, InferredType>> => {
  const sampleRows: any[] = [];
  const inferredTypes: Record<string, InferredType> = {};

  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
        .pipe(csv.parse({ headers: true }))
        .on('data', (row) => {
          if (sampleRows.length < sampleSize) {
            sampleRows.push(row);
          }
        })
        .on('end', () => {
          // Infer types based on sample rows
          const headers = Object.keys(sampleRows[0]);
          headers.forEach((header) => {
            const sampleValues = sampleRows.map(row => row[header]);
            const types = new Set(sampleValues.map(inferType));
            inferredTypes[header] = Array.from(types)[0];
          });
          resolve(inferredTypes);
        })
        .on('error', reject);
  });
};

// Setup database based on inferred types
const setupDatabase = async (inferredTypes: Record<string, InferredType>, tableName: string): Promise<void> => {
  const db = knex({
    client: 'sqlite3',
    connection: {
      filename: SQLITE_DB_PATH,
    },
    useNullAsDefault: true,
  });

  await db.schema.createTable(tableName, (table: Knex.CreateTableBuilder) => {
    table.increments('id').primary();
    Object.entries(inferredTypes).forEach(([header, type]) => {
      switch (type) {
        case 'int':
          table.integer(header);
          break;
        case 'bigint':
          table.bigInteger(header);
          break;
        case 'float':
          table.float(header);
          break;
        case 'date':
          table.dateTime(header);
          break;
        case 'string':
        default:
          table.string(header);
          break;
      }
    });
  });

  await db.destroy();
};

/**
 * Processes a CSV file and inserts its data into a specified SQLite table.
 * @param {string} filePath - The path of the CSV file to process.
 * @param {string} tableName - The name of the SQLite table to insert data into.
 * @returns {Promise<void>} A promise that resolves when the CSV processing is complete.
 */
const processCSV = async (filePath: string, tableName: string): Promise<void> => {
  const db = knex({
    client: 'sqlite3',
    connection: {
      filename: SQLITE_DB_PATH,
    },
    useNullAsDefault: true,
  });

  const rows: any[] = [];
  const batchSize: number = 90;
  let dbRowCount = 0;

  try {
    // Start a transaction
    await db.transaction(async (trx) => {
      return new Promise<void>(async (resolve, reject) => {
        const stream = fs.createReadStream(filePath)
            .pipe(csv.parse({ headers: true }))
            .on('data', async (row) => {
              rows.push(row);
              if (rows.length >= batchSize) {
                stream.pause();  // Pause the stream
                await trx.batchInsert(tableName, rows.splice(0, batchSize), batchSize)
                    .catch(reject);
                stream.resume();  // Resume the stream
              }
            })
            .on('end', async () => {
              if (rows.length) {
                await trx.batchInsert(tableName, rows, batchSize).catch(reject);
              }
              resolve();
            })
            .on('error', reject);
      });
    });

  } catch (err) {
    console.error(`An error occurred while processing the CSV: ${err}`);
  } finally {
    await db.destroy();
  }
};


export async function processDataDump(): Promise<void> {
  try {
// Helper function to ensure directory exists
    const ensureDirectoryExists = (filePath: string) => {
      const directory = path.dirname(filePath);
      if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, { recursive: true });
      }
    };

// Ensure the directory for SQLite exists
    console.log('Ensuring directory exists for SQLite database...');
    ensureDirectoryExists(SQLITE_DB_PATH);
    console.log('Directory check complete.');

// Now proceed with your database operations

    // Replace these with actual file paths and URLs
    const tarGzUrl = DUMP_DOWNLOAD_URL;
    const tarGzDest = '/tmp/dump.tar.gz';
    const extractDest = './tmp/extracted';

    // Step 1: Download the file
    await downloadFile(tarGzUrl, tarGzDest);

    // Step 2: Decompress and extract the file
    await decompressAndExtract(tarGzDest, extractDest);

    // Step 3: Infer column types
    const customerInferredTypes = await inferColumnTypes('./tmp/extracted/dump/customers.csv');
    const organizationInferredTypes = await inferColumnTypes('./tmp/extracted/dump/organizations.csv');

    // Step 4: Setup database
    await setupDatabase(customerInferredTypes, 'customers');
    await setupDatabase(organizationInferredTypes, 'organizations');

    // Step 5: Process CSV (Assuming you have a function for it)
    await processCSV('./tmp/extracted/dump/customers.csv', 'customers');
    await processCSV('./tmp/extracted/dump/organizations.csv', 'organizations');
  } catch (err) {
    throw Error(`An error occurred: ${err}`);
  };
};
