/**
 * Cat Facts Utility
 * Fun cat facts for loading states
 */

const CAT_FACTS = [
  "🐱 Cats spend 70% of their lives sleeping... unlike you right now!",
  "🐱 A group of cats is called a 'clowder'",
  "🐱 Cats can rotate their ears 180 degrees",
  "🐱 A cat's purr vibrates at 25-150 Hz, which can help heal bones",
  "🐱 Cats have a third eyelid called a 'haw'",
  "🐱 A cat's brain is 90% similar to a human's brain",
  "🐱 Cats can't taste sweetness",
  "🐱 A cat's nose print is unique, like a human fingerprint",
  "🐱 Cats sleep 12-16 hours a day (goals)",
  "🐱 Cats have over 20 different vocalizations",
  "🐱 Cats can jump up to 6 times their length",
  "🐱 A cat's whiskers are the same width as their body",
  "🐱 Cats have 32 muscles in each ear",
  "🐱 A house cat can run up to 30 mph",
  "🐱 Cats spend 30-50% of their day grooming",
  "🐱 A cat's meow is just for humans, not other cats",
  "🐱 Cats have better night vision than humans",
  "🐱 A cat's heart beats 2x faster than a human's",
  "🐱 Cats can't see directly below their nose",
  "🐱 A cat's collar bone doesn't connect to other bones",
  "🐱 Cats use their whiskers to detect if they can fit through spaces",
  "🐱 Cats have scent glands on their paws",
  "🐱 A cat's field of view is about 200 degrees",
  "🐱 Cats can make over 100 different sounds",
  "🐱 A cat's tongue has tiny hooks for grooming",
];

/**
 * Get a random cat fact for display in loading states
 * @returns A random cat fact string with emoji
 */
export function getRandomCatFact(): string {
  const randomIndex = Math.floor(Math.random() * CAT_FACTS.length);
  return CAT_FACTS[randomIndex];
}

/**
 * Get a random cat fact with custom suffix
 * @param suffix - Text to append after the fact (e.g., "...")
 * @returns A random cat fact with the suffix
 */
export function getRandomCatFactWithSuffix(suffix: string = '...'): string {
  return `${getRandomCatFact()}${suffix}`;
}
