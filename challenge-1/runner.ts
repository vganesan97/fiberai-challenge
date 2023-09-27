import { processDataDump } from "./challenge";

/**
 * This is the entry point for the challenge.
 * This will run your code.
 */
console.time("processDataDump");  // Start the timer

await processDataDump().catch((err) => console.error(err));  // Call your function and catch any errors

console.timeEnd("processDataDump");  // End the timer and log the elapsed time

console.log("✅ Done!");
