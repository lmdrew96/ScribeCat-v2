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
  "🐱 Cats spend about 15% of their day in deep contemplation",
  "🐱 A cat's favorite napping spot changes 3-4 times per day",
  "🐱 Cats have been domesticated for over 10,000 years",
  "🐱 The first cat in space was French and named Felicette",
  "🐱 Cats can't move their jaw sideways like we can",
  "🐱 A cat's average lifespan is 13-17 years",
  "🐱 Cats have a 'righting reflex' to land on their feet",
  "🐱 Ancient Egyptians shaved their eyebrows when their cat died",
  "🐱 Cats sleep more than most mammals (16-20 hours a day!)",
  "🐱 A cat's purr can also mean they're stressed or in pain",
  "🐱 Cats have over 230 bones (humans only have 206)",
  "🐱 A cat's sense of smell is 14x stronger than humans",
  "🐱 Cats can't taste spicy food due to fewer taste receptors",
  "🐱 The oldest cat on record lived to 38 years old",
  "🐱 Cats spend 50% of their waking hours grooming themselves",
  "🐱 A cat's learning capacity is similar to a 2-3 year old child",
  "🐱 Cats can recognize their owner's footsteps from hundreds of feet away",
  "🐱 Black cats are considered good luck in Japan and UK",
  "🐱 Cats have retractable claws (except cheetahs!)",
  "🐱 A cat's whiskers help them navigate in complete darkness",
  "🐱 Cats can detect earthquakes 10-15 minutes before humans",
  "🐱 The world's longest cat measured 48.5 inches long",
  "🐱 Cats have a top speed of about 30 mph (48 km/h)",
  "🐱 A cat's spine has 53 loosely fitting vertebrae for flexibility",
  "🐱 Cats communicate through over 100 different vocalizations",
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
