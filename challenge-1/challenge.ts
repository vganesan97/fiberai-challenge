/**
 * The entry point function. This will download the given dump file, extract/decompress it,
 * parse the CSVs within, and add the data to a SQLite database.
 * This is the core function you'll need to edit, though you're encouraged to make helper
 * functions!
 */
import fs from 'fs';
import zlib from 'zlib';
import tar from 'tar';
import knex, {Knex} from 'knex';
import csv from 'fast-csv';
import {DUMP_DOWNLOAD_URL, SQLITE_DB_PATH} from "./resources";
import path from "path";
import _ from "lodash";
import axios from 'axios';
import assert from "assert";
import Dict = NodeJS.Dict;


type InferredType = 'int' | 'bigint' | 'float' | 'date' | 'string';

/**
 * Downloads a file from a given URL and saves it to a specified destination.
 * @param {string} url - The URL of the file to download.
 * @param {string} dest - The destination where the file should be saved.
 * @returns {Promise<void>} A promise that resolves when the download is complete.
 */
const downloadFile = async (url: string, dest: string): Promise<void> => {
  const writer = fs.createWriteStream(dest);

  try {
    const response = await axios({
      url,
      method: 'GET',
      responseType: 'stream',
    });

    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
  } catch (error) {
    fs.unlink(dest, unlinkErr => {
      if (unlinkErr) console.error(`Failed to unlink file: ${unlinkErr}`);
    });
    throw error;
  }
};

/**
 * Decompresses a .tar.gz file and extracts its contents to a specific destination.
 * @param {string} src - The source path of the .tar.gz file.
 * @param {string} dest - The destination directory where the files should be extracted.
 * @returns {Promise<void>} A promise that resolves when the decompression and extraction are complete.
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

/**
 * Infers the type of given value based on its structure.
 * @param {string} value - The value whose type needs to be inferred.
 * @returns {InferredType} The inferred type of the value.
 */
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

/**
 * Infers the types of multiple columns based on a sample of rows from a CSV file.
 * @param {string} filePath - The path to the CSV file.
 * @param {number} [sampleSize=10] - The number of sample rows to use for type inference.
 * @returns {Promise<Record<string, InferredType>>} A promise that resolves with a record of inferred column types.
 */
const inferColumnTypes = async (filePath: string, sampleSize: number = 10): Promise<Record<string, InferredType>> => {
  const sampleRows: any[] = [];
  const inferredTypes: Record<string, InferredType> = {};

  return new Promise((resolve, reject): void => {
    fs.createReadStream(filePath)
        .pipe(csv.parse({ headers: true }))
        .on('data', (row) => {
          if (sampleRows.length < sampleSize) {
            sampleRows.push(row);
          }
        })
        .on('end', (): void => {
          // Infer types based on sample rows
          const headers = Object.keys(sampleRows[0]);
          _.forEach(headers, (header) => {
            const sampleValues = _.map(sampleRows, row => row[header]);
            const types: Set<InferredType> = new Set(sampleValues.map(inferType));
            inferredTypes[header] =  Array.from(types)[0];
          });
          resolve(inferredTypes);
        })
        .on('error', reject);
  });
};

/**
 * Sets up a SQLite database table based on inferred column types.
 * @param {Record<string, InferredType>} inferredTypes - A record of inferred column types.
 * @param {string} tableName - The name of the table to create.
 * @returns {Promise<void>} A promise that resolves when the table is set up.
 */
const setupDatabase = async (inferredTypes: Record<string, InferredType>, tableName: string): Promise<void> => {
  const db = knex({
    client: 'sqlite3',
    connection: {
      filename: SQLITE_DB_PATH,
    },
    useNullAsDefault: true,
  });

  await db.schema.createTable(tableName, (table: Knex.CreateTableBuilder): void => {
    table.increments('id').primary();
    _.forEach(Object.entries(inferredTypes), ([header, type]): void => {
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
 * @param {Knex} db - The Knex database connection.
 * @param {string} filePath - The path to the CSV file.
 * @param {string} tableName - The name of the SQLite table where the data should be inserted.
 * @returns {Promise<void>} A promise that resolves when the CSV processing is complete.
 */
const processCSV = async (db: Knex, filePath: string, tableName: string): Promise<void> => {

  const rows: any[] = [];
  const batchSize: number = 10;

  try {
    await db.transaction(async (trx): Promise<void> => {
      return new Promise<void>(async (resolve, reject): Promise<void> => {
        fs.createReadStream(filePath)
            .pipe(csv.parse({ headers: true }))
            .on('data', async (row): Promise<void> => {
              rows.push(row);
              if (rows.length >= batchSize) await trx.batchInsert(tableName, rows.splice(0, batchSize), batchSize).catch(reject);
            })
            .on('end', async (): Promise<void> => {
              if (rows.length) await trx.batchInsert(tableName, rows, batchSize).catch(reject);
              resolve();
            })
            .on('error', reject);
      });
    });
    console.log(rows.length)
  } catch (err) {
    console.error(`An error occurred while processing the CSV: ${err}`);
  }
};

/**
 * Count the number of rows in a SQLite table.
 * @param {Knex} db - The Knex database connection.
 * @param {string} tableName - The name of the SQLite table.
 * @returns {Promise<number>} A promise that resolves with the number of rows in the table.
 */
const countRowsInTable = async (db: Knex, tableName: string): Promise<number> => {
  const result: Dict<string | number>[] = await db(tableName).count('* as count');
  return Number(result[0].count);
};

/**
 * Count the number of rows in a CSV file. Mainly a sanity check.
 * @param {string} filePath - The path to the CSV file.
 * @returns {Promise<number>} A promise that resolves with the number of rows in the CSV file.
 */
const countRowsInCSV = (filePath: string): Promise<number> => {
  let rowCount: number = 0;
  return new Promise((resolve, reject): void  => {
    fs.createReadStream(filePath)
        .pipe(csv.parse({ headers: true }))
        .on('data', (): void => {
          rowCount++;
        })
        .on('end', (): void  => {
          resolve(rowCount);
        })
        .on('error', reject);
  });
};

/**
 * Checks if a table exists in the SQLite database.
 * @param {Knex} db - The Knex database connection.
 * @param {string} tableName - The name of the table to check.
 * @returns {Promise<boolean>} A promise that resolves with a boolean indicating if the table exists.
 */
const checkTableExistence = async (db: Knex, tableName: string): Promise<boolean> => {
  return await db.schema.hasTable(tableName);
};

/**
 * Checks if the directory at the given filepath exists.
 * @param {string} filePath - The filepath
 * @returns {void} - Creates the directory if it does not exist and returns nothing.
 */
const ensureDirectoryExists = (filePath: string): void => {
  const directory = path.dirname(filePath);
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }
};

/**
 * Checks if the tables in the sqlite db exists.
 * @param {any} db - The filepath
 * @returns {void} - Creates the directory if it does not exist and returns nothing.
 */const checkAndVerifyTables = async (db: any): Promise<boolean> => {
  const [doesCustomersTableExist, doesOrganizationsTableExist] = await Promise.all([
    checkTableExistence(db, 'customers'),
    checkTableExistence(db, 'organizations'),
  ]);

  if (doesCustomersTableExist && doesOrganizationsTableExist) {
    // Verify row counts
    const [dbCustomerCount, csvCustomerCount, dbOrganizationCount, csvOrganizationCount] = await Promise.all([
      countRowsInTable(db, 'customers'),
      countRowsInCSV('./tmp/extracted/dump/customers.csv'),
      countRowsInTable(db, 'organizations'),
      countRowsInCSV('./tmp/extracted/dump/organizations.csv'),
    ]);

    assert(dbCustomerCount !== csvCustomerCount, "customer count in db != customer count in csv");
    assert(dbOrganizationCount !== csvOrganizationCount, "organization count in db != organization count in csv");

    console.log("Required tables 'customers' and 'organizations' already exist and have the required amount of rows.");
    await db.destroy();
    return true;
  }
  return false;
};

// Main function
export async function processDataDump(): Promise<void> {
  try {
    console.log('Ensuring directory exists for SQLite database...');
    ensureDirectoryExists(SQLITE_DB_PATH);
    console.log('Directory check complete.');

    const tarGzUrl = DUMP_DOWNLOAD_URL;
    const tarGzDest = '/tmp/dump.tar.gz';
    const extractDest = './tmp/extracted';

    await downloadFile(tarGzUrl, tarGzDest);
    await decompressAndExtract(tarGzDest, extractDest);

    const [customerInferredTypes, organizationInferredTypes] = await Promise.all([
      inferColumnTypes('./tmp/extracted/dump/customers.csv'),
      inferColumnTypes('./tmp/extracted/dump/organizations.csv')
    ]);

    const db = knex({
      client: 'sqlite3',
      connection: {
        filename: SQLITE_DB_PATH,
      },
      useNullAsDefault: true,
    });

    if (await checkAndVerifyTables(db)) return;

    await Promise.all([
      setupDatabase(customerInferredTypes, 'customers'),
      setupDatabase(organizationInferredTypes, 'organizations')
    ]);

    await processCSV(db,'./tmp/extracted/dump/customers.csv', 'customers');
    await processCSV(db, './tmp/extracted/dump/organizations.csv', 'organizations');

    await db.destroy();

  } catch (err) {
    throw Error(`An error occurred: ${err}`);
  }
}

