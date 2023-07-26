export type MathError = string;

export function calculateMedian(numbers: number[]): number | null {
  // Step 1: Sort the array in ascending order
  const sortedNumbers = numbers.slice().sort((a, b) => a - b);

  // Step 2: Determine if the number of elements is even or odd
  const length = sortedNumbers.length;
  const isEven = length % 2 === 0;

  if (length === 0) {
    // Empty array, no median
    return null;
  } else if (isEven) {
    // Step 4: Calculate median for even number of elements
    const middleIndex = length / 2;
    return (sortedNumbers[middleIndex - 1] + sortedNumbers[middleIndex]) / 2;
  } else {
    // Step 3: Calculate median for odd number of elements
    const middleIndex = Math.floor(length / 2);
    return sortedNumbers[middleIndex];
  }
}

export function calculatePopulationStandardDeviation(
  numbers: number[]
): number | MathError {
  const n = numbers.length;

  if (n === 0) {
    return "The array must contain at least one number.";
  }

  const sum = numbers.reduce((acc, num) => acc + num, 0);
  const mean = sum / n;
  const squaredDifferences = numbers.map((num) => Math.pow(num - mean, 2));

  const variance =
    squaredDifferences.reduce((acc, squaredDiff) => acc + squaredDiff, 0) / n;

  const standardDeviation = Math.sqrt(variance);

  return standardDeviation;
}

export function calculateSampleStandardDeviation(
  numbers: number[]
): number | MathError {
  const n = numbers.length;

  if (n === 0) {
    return "The array must contain at least one number.";
  }

  const sum = numbers.reduce((acc, num) => acc + num, 0);
  const mean = sum / n;
  const squaredDifferences = numbers.map((num) => Math.pow(num - mean, 2));

  const variance =
    squaredDifferences.reduce((acc, squaredDiff) => acc + squaredDiff, 0) /
    (n - 1);

  const standardDeviation = Math.sqrt(variance);

  return standardDeviation;
}
