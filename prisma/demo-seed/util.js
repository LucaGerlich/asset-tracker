// Small deterministic helpers shared by the demo seed builders.
// Everything random goes through the seeded faker instance, so a given seed
// always yields the same data.

const { faker } = require("@faker-js/faker");

const DAY_MS = 24 * 60 * 60 * 1000;

const uuid = () => faker.string.uuid();

const int = (min, max) => faker.number.int({ min, max });

const chance = (probability) =>
  faker.number.float({ min: 0, max: 1 }) < probability;

const pick = (list) => list[int(0, list.length - 1)];

const sample = (list, count) =>
  faker.helpers.arrayElements(list, Math.min(count, list.length));

const shuffle = (list) => faker.helpers.shuffle(list);

/** Money rounded to two decimals. */
const money = (min, max) =>
  Math.round(faker.number.float({ min, max }) * 100) / 100;

/** Picks from `[{ item, weight }]` proportionally to the weights. */
const weighted = (entries) => {
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = faker.number.float({ min: 0, max: total });
  for (const entry of entries) {
    roll -= entry.weight;
    if (roll <= 0) return entry.item;
  }
  return entries[entries.length - 1].item;
};

const daysBefore = (anchor, days) => new Date(anchor.getTime() - days * DAY_MS);

const daysAfter = (anchor, days) => new Date(anchor.getTime() + days * DAY_MS);

/** Later of the two dates, never past `limit`. */
const clampDate = (date, limit) => (date > limit ? limit : date);

/** Calendar-month arithmetic in UTC (clamped to the end of short months). */
const addMonths = (date, months) => {
  const result = new Date(date.getTime());
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
  ).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
};

/** UTC midnight of the given instant, for `@db.Date` columns. */
const dateOnly = (date) =>
  new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );

const chunk = (list, size) => {
  const chunks = [];
  for (let index = 0; index < list.length; index += size) {
    chunks.push(list.slice(index, index + size));
  }
  return chunks;
};

const padNumber = (value, length) => String(value).padStart(length, "0");

module.exports = {
  DAY_MS,
  uuid,
  int,
  chance,
  pick,
  sample,
  shuffle,
  money,
  weighted,
  daysBefore,
  daysAfter,
  clampDate,
  addMonths,
  dateOnly,
  chunk,
  padNumber,
};
