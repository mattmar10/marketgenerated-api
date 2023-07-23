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
