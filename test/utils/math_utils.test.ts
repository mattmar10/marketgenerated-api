import { expect } from "chai";

import {
  calculatePopulationStandardDeviation,
  calculateSampleStandardDeviation,
  calculateMedian,
} from "../../src/utils/math_utils";

describe("Standard Deviation and Median Functions", () => {
  const stockPricesArray: number[] = [
    749.44, 694.15, 449.88, 863.41, 823.73, 663.02, 423.28, 809.09, 487.99,
    977.66, 499.94, 365.59, 890.89, 348.62, 464.62, 586.57, 672.01, 938.91,
    912.53, 464.62, 987.29, 525.27, 355.02, 738.17, 878.27, 808.75, 855.82,
    580.12, 916.57, 846.84, 512.49, 518.71, 795.15, 774.25, 952.13, 626.32,
    719.26, 494.87, 959.85, 509.88, 813.29, 906.63, 525.86, 567.81, 712.99,
    336.5, 420.34, 996.35, 498.66, 625.3, 663.72, 973.54, 800.53, 925.04,
    791.08, 800.11, 625.22, 684.33, 743.39, 705.71, 558.01, 937.39, 925.57,
    924.4, 623.52, 868.15, 748.44, 690.7, 944.5, 700.05, 805.39, 630.68, 867.68,
    618.92, 689.6, 333.28, 742.8, 966.39, 315.22, 365.9, 393.82, 319.71, 772.15,
    894.7, 853.93, 337.22, 317.5, 692.47, 473.18, 333.01, 376.77, 721.86,
    722.79, 517.8, 953.08, 564.01, 580.46, 933.43, 635.71, 604.63, 732.12,
    514.86, 672.95, 472.09, 315.25, 486.47, 618.78, 991.29, 853.08, 745.34,
    924.44, 932.56, 948.97, 787.91, 574.46, 844.48, 430.38, 386.39, 926.65,
    466.09, 940.86, 747.53, 430.49, 494.72, 384.27, 365.6, 613.53, 992.94,
    609.08, 738.44, 772.23, 739.78, 337.19, 727.55, 522.52, 358.84, 704.79,
    979.33, 712.92, 800.28, 363.07, 386.48, 702.52, 485.07, 802.57, 341.15,
    478.97, 678.97, 474.89, 622.55, 882.53, 852.02, 664.88, 437.69, 754.96,
    421.49, 478.4, 399.19, 664.94, 641.68, 987.84, 579.84, 669.48, 370.7,
    881.22, 489.57, 896.79, 435.06, 900.03, 811.45, 518.45, 823.16, 890.71,
    503.99, 496.02, 481.92, 784.04, 321.84, 902.33, 983.79, 982.94, 891.35,
    887.69, 473.52, 949.02, 574.8, 768.29, 676.32, 395.65, 610.56,
  ];

  describe("calculateMedian()", () => {
    it("should calculate the correct median for an odd number of elements", () => {
      const numbers = [2, 4, 6, 8, 10];
      const result = calculateMedian(numbers);
      expect(result).to.be.equal(6);
    });

    it("should calculate the correct median for an even number of elements", () => {
      const numbers = [2, 4, 6, 8];
      const result = calculateMedian(numbers);
      expect(result).to.be.equal(5);
    });

    it("should return null for an empty array", () => {
      const numbers: number[] = [];
      const result = calculateMedian(numbers);
      expect(result).to.be.null;
    });
  });

  describe("calculatePopulationStandardDeviation()", () => {
    it("should calculate the correct population standard deviation", () => {
      const result = calculatePopulationStandardDeviation(stockPricesArray);
      const expected = 201.81862;
      const tolerance = 1e-5;
      expect(result).to.be.closeTo(expected, tolerance);
    });
  });

  describe("calculateSampleStandardDeviation()", () => {
    it("should calculate the correct sample standard deviation", () => {
      const result = calculateSampleStandardDeviation(stockPricesArray);
      const expected = 202.35183;
      const tolerance = 1e-5;

      expect(result).to.be.closeTo(expected, tolerance);
    });
  });
});
